/**
 * MarketplaceAgent - Agent Marketplace & Discovery
 * Manages agent templates, deployment, and discovery
 * A2A Protocol Compliant
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { connect, StringCodec } = require('nats');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.MARKETPLACE_AGENT_PORT || 3008;
const sc = StringCodec();

// A2A Agent Card
const AGENT_CARD = {
  name: 'MarketplaceAgent',
  version: '1.0.0',
  description: 'A2A-compliant agent marketplace for template management, deployment, and discovery',
  capabilities: [
    'template.list',
    'template.get',
    'template.search',
    'agent.deploy',
    'agent.discover',
    'agent.list',
    'agent.stop'
  ],
  methods: {
    'template.list': {
      description: 'List all available agent templates',
      params: {
        category: 'string (optional)',
        difficulty: 'string (optional)'
      }
    },
    'template.get': {
      description: 'Get specific template details',
      params: {
        templateId: 'string'
      }
    },
    'agent.deploy': {
      description: 'Deploy an agent from template',
      params: {
        templateId: 'string',
        config: 'object (optional)'
      }
    },
    'agent.discover': {
      description: 'Discover running agents',
      params: {
        type: 'string (optional)'
      }
    }
  },
  transport: 'http',
  endpoint: `http://localhost:${PORT}`,
  protocols: ['A2A/1.0', 'JSON-RPC/2.0']
};

// Load templates
const templatesPath = path.join(__dirname, '../templates/agent-templates.json');
let templates = { templates: [], categories: [], metadata: {} };

function loadTemplates() {
  try {
    const data = fs.readFileSync(templatesPath, 'utf8');
    templates = JSON.parse(data);
    console.log(`✅ Loaded ${templates.templates.length} agent templates`);
  } catch (error) {
    console.error('❌ Failed to load templates:', error.message);
  }
}

loadTemplates();

// Track deployed agents
const deployedAgents = new Map();

// NATS connection
let nc;

async function initNATS() {
  try {
    nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    console.log('✅ Connected to NATS server');

    // Subscribe to agent discovery channel
    const discovery_sub = nc.subscribe('aexowork.agent.discovery');

    (async () => {
      for await (const msg of discovery_sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          console.log('[A2A] Discovery request:', data.from);
          await handleDiscoveryRequest(data, msg);
        } catch (error) {
          console.error('[A2A] Discovery error:', error);
        }
      }
    })();

    console.log('[A2A] Subscribed to agent discovery channel');
  } catch (error) {
    console.error('⚠️  NATS connection failed:', error.message);
  }
}

// A2A Protocol: Health check & Agent Card
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    agent: 'MarketplaceAgent',
    protocol: 'A2A/1.0',
    version: '1.0.0',
    agentCard: AGENT_CARD,
    stats: {
      totalTemplates: templates.templates.length,
      categories: templates.categories.length,
      deployedAgents: deployedAgents.size,
      activeAgents: Array.from(deployedAgents.values()).filter(a => a.status === 'running').length
    }
  });
});

// A2A Protocol: Get Agent Card
app.get('/agent-card', (req, res) => {
  res.json(AGENT_CARD);
});

// List all templates (A2A method: template.list)
app.get(['/templates', '/api/marketplace/templates'], (req, res) => {
  try {
    const { category, difficulty, type } = req.query;

    let filteredTemplates = [...templates.templates];

    if (category) {
      filteredTemplates = filteredTemplates.filter(t => t.category === category);
    }

    if (difficulty) {
      filteredTemplates = filteredTemplates.filter(t => t.difficulty === difficulty);
    }

    if (type) {
      filteredTemplates = filteredTemplates.filter(t => t.type === type);
    }

    res.json({
      total: filteredTemplates.length,
      templates: filteredTemplates,
      categories: templates.categories
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific template (A2A method: template.get)
app.get(['/templates/:templateId', '/api/marketplace/templates/:templateId'], (req, res) => {
  try {
    const { templateId } = req.params;
    const template = templates.templates.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search templates (A2A method: template.search)
app.get(['/templates/search/:query', '/api/marketplace/search/:query'], (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = query.toLowerCase();

    const results = templates.templates.filter(t => 
      t.name.toLowerCase().includes(searchTerm) ||
      t.description.toLowerCase().includes(searchTerm) ||
      t.features.some(f => f.toLowerCase().includes(searchTerm))
    );

    res.json({
      query: searchTerm,
      total: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deploy agent from template (A2A method: agent.deploy)
app.post(['/deploy', '/api/marketplace/deploy'], async (req, res) => {
  try {
    const { templateId, config, name } = req.body;

    const template = templates.templates.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Generate agent instance
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const agentName = name || `${template.name} Instance`;

    // Merge template config with custom config
    const finalConfig = {
      ...template.config,
      ...config
    };

    // Create agent instance
    const agent = {
      id: agentId,
      templateId,
      name: agentName,
      type: template.type,
      config: finalConfig,
      status: 'deployed',
      createdAt: Date.now(),
      endpoint: `http://localhost:${finalConfig.port}`,
      process: null
    };

    deployedAgents.set(agentId, agent);

    // A2A: Broadcast agent deployment
    if (nc) {
      nc.publish('aexowork.agent.deployed', sc.encode(JSON.stringify({
        type: 'agent.deployed',
        agentId,
        templateId,
        name: agentName,
        endpoint: agent.endpoint,
        timestamp: Date.now()
      })));
    }

    console.log(`✅ Agent deployed: ${agentName} (${agentId})`);

    res.json({
      success: true,
      agentId,
      name: agentName,
      endpoint: agent.endpoint,
      config: finalConfig,
      message: 'Agent deployed successfully. Use /start/:agentId to launch it.'
    });
  } catch (error) {
    console.error('❌ Deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start deployed agent
app.post(['/start/:agentId', '/api/marketplace/start/:agentId'], async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = deployedAgents.get(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.status === 'running') {
      return res.status(400).json({ error: 'Agent already running' });
    }

    // Determine agent file path
    const agentTypeMap = {
      'client': 'clientAgent.js',
      'worker': 'workerAgent.js',
      'verification': 'verificationAgent.js',
      'reputation': 'reputeAgent.js',
      'dispute': 'disputeAgent.js',
      'data': 'dataAgent.js',
      'escrow': 'escrowAgent.js'
    };

    const agentFile = agentTypeMap[agent.type];
    if (!agentFile) {
      return res.status(400).json({ error: 'Unknown agent type' });
    }

    const agentPath = path.join(__dirname, agentFile);

    // Check if agent file exists
    if (!fs.existsSync(agentPath)) {
      return res.status(404).json({ error: `Agent file not found: ${agentFile}` });
    }

    // Spawn agent process
    const proc = spawn('node', [agentPath], {
      env: {
        ...process.env,
        ...agent.config
      },
      detached: true,
      stdio: 'ignore'
    });

    proc.unref();

    agent.process = proc.pid;
    agent.status = 'running';
    agent.startedAt = Date.now();
    deployedAgents.set(agentId, agent);

    console.log(`✅ Agent started: ${agent.name} (PID: ${proc.pid})`);

    res.json({
      success: true,
      agentId,
      name: agent.name,
      status: 'running',
      pid: proc.pid,
      endpoint: agent.endpoint
    });
  } catch (error) {
    console.error('❌ Start error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop deployed agent
app.post(['/stop/:agentId', '/api/marketplace/stop/:agentId'], async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = deployedAgents.get(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.status !== 'running') {
      return res.status(400).json({ error: 'Agent not running' });
    }

    // Kill process
    if (agent.process) {
      try {
        process.kill(agent.process);
        console.log(`✅ Agent stopped: ${agent.name} (PID: ${agent.process})`);
      } catch (error) {
        console.log(`⚠️  Process may have already stopped: ${error.message}`);
      }
    }

    agent.status = 'stopped';
    agent.stoppedAt = Date.now();
    deployedAgents.set(agentId, agent);

    // A2A: Broadcast agent stopped
    if (nc) {
      nc.publish('aexowork.agent.stopped', sc.encode(JSON.stringify({
        type: 'agent.stopped',
        agentId,
        timestamp: Date.now()
      })));
    }

    res.json({
      success: true,
      agentId,
      name: agent.name,
      status: 'stopped'
    });
  } catch (error) {
    console.error('❌ Stop error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List deployed agents (A2A method: agent.list)
app.get(['/agents', '/api/marketplace/agents'], (req, res) => {
  try {
    const { status, type } = req.query;

    let agentList = Array.from(deployedAgents.values());

    if (status) {
      agentList = agentList.filter(a => a.status === status);
    }

    if (type) {
      agentList = agentList.filter(a => a.type === type);
    }

    res.json({
      total: agentList.length,
      agents: agentList.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        endpoint: a.endpoint,
        createdAt: a.createdAt,
        startedAt: a.startedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Discover running agents (A2A method: agent.discover)
app.get(['/discover', '/api/marketplace/discover'], async (req, res) => {
  try {
    const { type } = req.query;

    // Broadcast discovery request via A2A
    if (nc) {
      nc.publish('aexowork.agent.discovery', sc.encode(JSON.stringify({
        type: 'discovery.request',
        from: 'MarketplaceAgent',
        filter: { type },
        timestamp: Date.now()
      })));
    }

    // Return currently known agents
    const runningAgents = Array.from(deployedAgents.values()).filter(a => a.status === 'running');

    res.json({
      total: runningAgents.length,
      agents: runningAgents,
      message: 'Discovery request broadcast on A2A network'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
app.get(['/categories', '/api/marketplace/categories'], (req, res) => {
  res.json({
    total: templates.categories.length,
    categories: templates.categories
  });
});

// Template statistics
app.get(['/stats', '/api/marketplace/stats'], (req, res) => {
  const stats = {
    totalTemplates: templates.templates.length,
    byCategory: {},
    byType: {},
    byDifficulty: {},
    deployedAgents: deployedAgents.size,
    runningAgents: Array.from(deployedAgents.values()).filter(a => a.status === 'running').length
  };

  // Count by category
  templates.templates.forEach(t => {
    stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + 1;
    stats.byType[t.type] = (stats.byType[t.type] || 0) + 1;
    stats.byDifficulty[t.difficulty] = (stats.byDifficulty[t.difficulty] || 0) + 1;
  });

  res.json(stats);
});

// A2A: Handle discovery request
async function handleDiscoveryRequest(data, msg) {
  const { from, filter } = data;

  let agents = Array.from(deployedAgents.values()).filter(a => a.status === 'running');

  if (filter && filter.type) {
    agents = agents.filter(a => a.type === filter.type);
  }

  // Reply with discovered agents
  if (msg.reply) {
    const response = {
      type: 'discovery.response',
      from: 'MarketplaceAgent',
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        endpoint: a.endpoint,
        capabilities: a.config.capabilities || []
      })),
      timestamp: Date.now()
    };
    nc.publish(msg.reply, sc.encode(JSON.stringify(response)));
  }

  console.log(`✅ Discovery response sent to ${from}: ${agents.length} agents`);
}

// Start server
async function start() {
  await initNATS();

  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   MarketplaceAgent (A2A Protocol)      ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`✅ Running on port ${PORT}`);
    console.log(`📡 A2A Protocol: v1.0`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}`);
    console.log(`📄 Agent Card: http://localhost:${PORT}/agent-card`);
    console.log(`📦 Templates loaded: ${templates.templates.length}\n`);
  });
}

start().catch(console.error);

module.exports = { app, AGENT_CARD };

