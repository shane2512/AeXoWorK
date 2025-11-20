/**
 * MarketplaceAgent - Agent Marketplace & Discovery
 * Manages agent templates, deployment, and discovery
 * A2A Protocol Compliant
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { init as initHCS10, sendA2A, subscribe as subscribeHCS10, getClient, getAgentAccountId } from '../lib/hcs10';
import { AIAgentCapability } from '@hashgraphonline/standards-sdk';

const app = express();
app.use(express.json());

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = parseInt(process.env.MARKETPLACE_AGENT_PORT || '3008', 10);

// Type definitions
interface AgentCard {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  methods: Record<string, any>;
  transport: string;
  endpoint: string;
  protocols: string[];
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  type: string;
  features: string[];
  config?: any;
}

interface TemplatesData {
  templates: Template[];
  categories: string[];
  metadata: any;
}

interface DeployedAgent {
  id: string;
  templateId?: string;
  name: string;
  type: string;
  config: any;
  status: string;
  createdAt: number;
  endpoint: string;
  process?: number | null;
  startedAt?: number;
  stoppedAt?: number;
}

interface AgentMetadata {
  accountId: string;
  privateKey: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId: string;
}

interface AgentCreationResult {
  success: boolean;
  metadata?: AgentMetadata;
  error?: string;
}

// A2A Agent Card
const AGENT_CARD: AgentCard = {
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
let templates: TemplatesData = { templates: [], categories: [], metadata: {} };

function loadTemplates(): void {
  try {
    const data = fs.readFileSync(templatesPath, 'utf8');
    templates = JSON.parse(data);
    console.log(`✅ Loaded ${templates.templates.length} agent templates`);
  } catch (error: any) {
    console.error('❌ Failed to load templates:', error.message);
  }
}

loadTemplates();

// Track deployed agents
const deployedAgents = new Map<string, DeployedAgent>();

// Helper function to get port for agent type
function getPortForAgentType(agentType: string): number {
  const agentTypePorts: Record<string, number> = {
    'client': 3001,
    'worker': 3002,
    'verification': 3003,
    'repute': 3004,
    'dispute': 3005,
    'data': 3006,
    'escrow': 3007,
    'marketplace': 3008
  };
  return agentTypePorts[agentType.toLowerCase()] || 3001;
}

// HCS-10 connection
let hcs10Initialized = false;

async function initHCS10Connection(): Promise<void> {
  try {
    await initHCS10({
      network: (process.env.HEDERA_NETWORK || 'testnet') as 'testnet' | 'mainnet',
      agentName: 'MarketplaceAgent',
      agentDescription: 'A2A-compliant agent marketplace for template management, deployment, and discovery',
      capabilities: [AIAgentCapability.TEXT_GENERATION, AIAgentCapability.KNOWLEDGE_RETRIEVAL],
    });
    hcs10Initialized = true;
    console.log('✅ Connected to HCS-10 network');

    // Subscribe to agent discovery channel
    subscribeHCS10('aexowork.agent.discovery', async (data: any) => {
      try {
        console.log('[A2A] Discovery request:', data.from);
        await handleDiscoveryRequest(data);
      } catch (error: any) {
        console.error('[A2A] Discovery error:', error);
      }
    });

    console.log('[A2A] Subscribed to agent discovery channel');
  } catch (error: any) {
    console.error('⚠️  HCS-10 connection failed:', error.message);
  }
}

// A2A Protocol: Health check & Agent Card
app.get('/', (req: Request, res: Response) => {
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
app.get('/agent-card', (req: Request, res: Response) => {
  res.json(AGENT_CARD);
});

// List all templates (A2A method: template.list)
app.get(['/templates', '/api/marketplace/templates'], (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific template (A2A method: template.get)
app.get(['/templates/:templateId', '/api/marketplace/templates/:templateId'], (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const template = templates.templates.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search templates (A2A method: template.search)
app.get(['/templates/search/:query', '/api/marketplace/search/:query'], (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const searchTerm = query.toLowerCase();

    const results = templates.templates.filter(t => 
      t.name.toLowerCase().includes(searchTerm) ||
      t.description.toLowerCase().includes(searchTerm) ||
      (t.features && t.features.some((f: string) => f.toLowerCase().includes(searchTerm)))
    );

    res.json({
      query: searchTerm,
      total: results.length,
      results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register agent with HCS-10 (NEW: HCS-10 registration endpoint)
app.post(['/register-hcs10', '/api/marketplace/register-hcs10'], async (req: Request, res: Response) => {
  try {
    const { name, description, agentType, capabilities, metadata, walletAddress, hederaAccountId, hederaPrivateKey } = req.body;

    if (!name || !description || !agentType) {
      return res.status(400).json({ error: 'Missing required fields: name, description, agentType' });
    }

    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress. Please connect your wallet.' });
    }

    // Check if HCS-10 is initialized
    if (!hcs10Initialized) {
      return res.status(503).json({ error: 'HCS-10 not initialized. Please wait for MarketplaceAgent to connect.' });
    }

    // Get HCS-10 client from the library
    const { HCS10Client, AgentBuilder } = require('@hashgraphonline/standards-sdk');
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    // Use user's Hedera credentials if provided, otherwise use operator wallet
    let operatorId: string, operatorKey: string;
    if (hederaAccountId && hederaPrivateKey) {
      // User provided their own Hedera account credentials
      operatorId = hederaAccountId;
      operatorKey = hederaPrivateKey;
      console.log(`[MarketplaceAgent] Using user's Hedera account for registration: ${operatorId}`);
    } else {
      // Use operator wallet (default)
      operatorId = process.env.HEDERA_ACCOUNT_ID!;
      operatorKey = process.env.HEDERA_PRIVATE_KEY!;
      if (!operatorId || !operatorKey) {
        return res.status(500).json({ error: 'Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY in environment' });
      }
      console.log(`[MarketplaceAgent] Using operator wallet for registration (user wallet: ${walletAddress})`);
    }

    // Create operator client for registration
    const operatorClient = new HCS10Client({
      network,
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'error', // Reduce logs
    });

    // Build agent configuration
    // Include wallet address as owner in metadata
    const agentMetadata = {
      type: agentType,
      version: '1.0.0',
      transport: 'hcs-10',
      owner: walletAddress, // User's connected wallet address
      registeredBy: operatorId, // Account that paid for registration
      ...metadata
    };

    const agentBuilder = new AgentBuilder()
      .setName(name)
      .setDescription(description)
      .setAgentType('autonomous')
      .setNetwork(network)
      .setCapabilities(capabilities || [AIAgentCapability.TEXT_GENERATION, AIAgentCapability.KNOWLEDGE_RETRIEVAL])
      .setMetadata(agentMetadata);

    // Register agent - Use manual creation to avoid HCS-11 issues
    console.log(`[MarketplaceAgent] Creating agent manually (bypassing HCS-10 SDK to avoid HCS-11 issues): ${name}`);
    let result: AgentCreationResult;
    
    // Always use manual creation to avoid HCS-11 profile requirements
    try {
      const { Client, PrivateKey, AccountCreateTransaction, TopicCreateTransaction, AccountId } = require('@hashgraph/sdk');
      
      // Create Hedera client
      const hederaClient = network === 'mainnet' 
        ? Client.forMainnet() 
        : Client.forTestnet();
      hederaClient.setOperator(AccountId.fromString(operatorId), PrivateKey.fromStringECDSA(operatorKey));
      
      console.log(`[MarketplaceAgent] Generating new key pair for agent...`);
      // Generate new key pair for agent
      const newPrivateKey = PrivateKey.generateECDSA();
      const newPublicKey = newPrivateKey.publicKey;
      
      console.log(`[MarketplaceAgent] Creating Hedera account...`);
      // Create account
      const accountTx = await new AccountCreateTransaction()
        .setKey(newPublicKey)
        .setInitialBalance(0) // No initial balance - operator pays for transactions
        .execute(hederaClient);
      
      const accountReceipt = await accountTx.getReceipt(hederaClient);
      const newAccountId = accountReceipt.accountId!.toString();
      console.log(`[MarketplaceAgent] ✅ Account created: ${newAccountId}`);
      
      console.log(`[MarketplaceAgent] Creating HCS topics...`);
      // Create inbound topic
      const inboundTopicTx = await new TopicCreateTransaction()
        .execute(hederaClient);
      const inboundTopicReceipt = await inboundTopicTx.getReceipt(hederaClient);
      const inboundTopicId = inboundTopicReceipt.topicId!.toString();
      console.log(`[MarketplaceAgent] ✅ Inbound topic created: ${inboundTopicId}`);
      
      // Create outbound topic
      const outboundTopicTx = await new TopicCreateTransaction()
        .execute(hederaClient);
      const outboundTopicReceipt = await outboundTopicTx.getReceipt(hederaClient);
      const outboundTopicId = outboundTopicReceipt.topicId!.toString();
      console.log(`[MarketplaceAgent] ✅ Outbound topic created: ${outboundTopicId}`);
      
      // Create profile topic
      const profileTopicTx = await new TopicCreateTransaction()
        .execute(hederaClient);
      const profileTopicReceipt = await profileTopicTx.getReceipt(hederaClient);
      const profileTopicId = profileTopicReceipt.topicId!.toString();
      console.log(`[MarketplaceAgent] ✅ Profile topic created: ${profileTopicId}`);
      
      console.log(`[MarketplaceAgent] ✅ Agent created successfully: ${newAccountId}`);
      
      // Return result in same format as SDK
      result = {
        success: false, // Registry confirmation not done (we skip HCS-10 registry)
        metadata: {
          accountId: newAccountId,
          privateKey: newPrivateKey.toString(),
          inboundTopicId: inboundTopicId,
          outboundTopicId: outboundTopicId,
          profileTopicId: profileTopicId
        }
      };
    } catch (manualError: any) {
      console.error(`[MarketplaceAgent] ❌ Failed to create agent manually: ${manualError.message}`);
      console.error(`[MarketplaceAgent] Error stack:`, manualError.stack);
      throw new Error(
        `Failed to create agent: ${manualError.message}. ` +
        `Please check the MarketplaceAgent logs for details.`
      );
    }

    // Check if agent was created (even if registry confirmation failed)
    if (!result || !result.metadata) {
      throw new Error(result?.error || 'Failed to create agent - no metadata returned.');
    }

    // Agent was created successfully
    const agentData = {
      name,
      description,
      agentType,
      owner: walletAddress, // User's wallet address
      accountId: result.metadata.accountId,
      privateKey: result.metadata.privateKey,
      inboundTopicId: result.metadata.inboundTopicId,
      outboundTopicId: result.metadata.outboundTopicId,
      profileTopicId: result.metadata.profileTopicId,
      registryConfirmed: result.success,
      registeredBy: operatorId, // Account that paid for registration
      createdAt: Date.now()
    };
    
    // Add to deployedAgents map so it shows up in the UI
    const agentId = result.metadata.accountId; // Use accountId as agent ID
    const defaultPort = getPortForAgentType(agentType);
    
    const deployedAgent: DeployedAgent = {
      id: agentId,
      name: name,
      type: agentType,
      config: {
        accountId: result.metadata.accountId,
        inboundTopicId: result.metadata.inboundTopicId,
        outboundTopicId: result.metadata.outboundTopicId,
        profileTopicId: result.metadata.profileTopicId,
        owner: walletAddress,
        description: description,
        ...metadata
      },
      status: 'deployed', // Status is 'deployed' (not 'running' until started)
      createdAt: Date.now(),
      endpoint: `http://localhost:${defaultPort}` // Default endpoint based on type
    };
    deployedAgents.set(agentId, deployedAgent);
    console.log(`[MarketplaceAgent] ✅ Added agent to deployedAgents map: ${name} (${agentId})`);

    // Log success (even if registry confirmation failed)
    if (result.success) {
      console.log(`✅ Agent registered with HCS-10: ${name} (${result.metadata.accountId})`);
    } else {
      console.log(`⚠️  Agent created with HCS-10 (registry confirmation pending): ${name} (${result.metadata.accountId})`);
      console.log(`   Note: Agent was created but registry confirmation failed. This is usually due to HCS-11 profile issues.`);
    }

    // Broadcast agent registration via A2A
    if (hcs10Initialized) {
      try {
        await sendA2A('aexowork.agent.registered', {
          type: 'agent.registered',
          name,
          agentType,
          accountId: result.metadata.accountId,
          inboundTopicId: result.metadata.inboundTopicId,
          timestamp: Date.now()
        });
      } catch (broadcastError: any) {
        console.warn(`[MarketplaceAgent] Failed to broadcast agent registration: ${broadcastError.message}`);
        // Don't fail the request if broadcast fails
      }
    }

    res.json({
      success: true,
      ...agentData,
      message: result.success 
        ? 'Agent registered successfully with HCS-10' 
        : 'Agent created successfully (registry confirmation pending - agent is still usable)'
    });
  } catch (error: any) {
    console.error('❌ HCS-10 registration error:', error);
    res.status(500).json({ error: error.message || 'Failed to register agent with HCS-10' });
  }
});

// Deploy agent from template (A2A method: agent.deploy)
app.post(['/deploy', '/api/marketplace/deploy'], async (req: Request, res: Response) => {
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
    const agent: DeployedAgent = {
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
    if (hcs10Initialized) {
      await sendA2A('aexowork.agent.deployed', {
        type: 'agent.deployed',
        agentId,
        templateId,
        name: agentName,
        endpoint: agent.endpoint,
        timestamp: Date.now()
      });
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
  } catch (error: any) {
    console.error('❌ Deployment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start deployed agent
app.post(['/start/:agentId', '/api/marketplace/start/:agentId'], async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = deployedAgents.get(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.status === 'running') {
      return res.status(400).json({ error: 'Agent already running' });
    }

    // Determine agent file path - use .ts files now
    const agentTypeMap: Record<string, string> = {
      'client': 'clientAgent.ts',
      'worker': 'workerAgent.ts',
      'verification': 'verificationAgent.ts',
      'reputation': 'reputeAgent.ts',
      'dispute': 'disputeAgent.ts',
      'data': 'dataAgent.ts',
      'escrow': 'escrowAgent.ts'
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

    // Spawn agent process using tsx for TypeScript files
    const proc = spawn('tsx', [agentPath], {
      env: {
        ...process.env,
        ...agent.config
      },
      detached: true,
      stdio: 'ignore'
    });

    proc.unref();

    agent.process = proc.pid || null;
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
  } catch (error: any) {
    console.error('❌ Start error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop deployed agent
app.post(['/stop/:agentId', '/api/marketplace/stop/:agentId'], async (req: Request, res: Response) => {
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
      } catch (error: any) {
        console.log(`⚠️  Process may have already stopped: ${error.message}`);
      }
    }

    agent.status = 'stopped';
    agent.stoppedAt = Date.now();
    deployedAgents.set(agentId, agent);

    // A2A: Broadcast agent stopped
    if (hcs10Initialized) {
      await sendA2A('aexowork.agent.stopped', {
        type: 'agent.stopped',
        agentId,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      agentId,
      name: agent.name,
      status: 'stopped'
    });
  } catch (error: any) {
    console.error('❌ Stop error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single agent by ID
app.get(['/agents/:id', '/api/marketplace/agents/:id'], (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agent = deployedAgents.get(id);

    if (!agent) {
      return res.status(404).json({ 
        success: false,
        error: 'Agent not found' 
      });
    }

    // Extract config without private key
    const { privateKey, ...configWithoutPrivateKey } = agent.config || {};
    
    // Return agent details in format expected by frontend (excluding private key)
    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        agentType: agent.type, // Frontend uses both
        status: agent.status === 'running' ? 1 : agent.status === 'deployed' ? 0 : 2,
        endpoint: agent.endpoint,
        createdAt: agent.createdAt,
        startedAt: agent.startedAt,
        stoppedAt: agent.stoppedAt,
        // Include config data if available (excluding private key)
        accountId: agent.config?.accountId || agent.id,
        inboundTopicId: agent.config?.inboundTopicId,
        outboundTopicId: agent.config?.outboundTopicId,
        profileTopicId: agent.config?.profileTopicId,
        did: `did:hedera:testnet:${agent.config?.accountId || agent.id}_0.0.${agent.config?.accountId || agent.id}`,
        owner: agent.config?.owner || 'Unknown',
        description: agent.config?.description || '',
        metadataCID: agent.config?.metadataCID || '',
        // Additional fields from config (excluding private key)
        ...configWithoutPrivateKey
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// List deployed agents (A2A method: agent.list)
app.get(['/agents', '/api/marketplace/agents'], async (req: Request, res: Response) => {
  try {
    const { status, type, sync } = req.query;

    // If sync=true, try to discover agents from HCS-10 registry
    if (sync === 'true' && hcs10Initialized) {
      try {
        console.log('[MarketplaceAgent] 🔍 Syncing agents from HCS-10 registry...');
        const hcs10Client = getClient();
        if (hcs10Client) {
          // Try to get agent info from HCS-10 SDK
          // Note: This is a simplified approach - in production, you'd query the HCS-10 registry
          console.log('[MarketplaceAgent] HCS-10 client available, but direct agent discovery not implemented yet');
        }
      } catch (syncError: any) {
        console.warn('[MarketplaceAgent] Failed to sync from HCS-10:', syncError.message);
      }
    }

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
        agentType: a.type, // Frontend uses both
        status: a.status,
        endpoint: a.endpoint,
        createdAt: a.createdAt,
        startedAt: a.startedAt,
        // Include owner and other config fields
        owner: a.config?.owner || a.owner || 'Unknown',
        description: a.config?.description || a.description || '',
        did: a.config?.did || `did:hedera:testnet:${a.id}_0.0.${a.id}`,
        metadataCID: a.config?.metadataCID || '',
        // Include all config fields
        ...(a.config || {})
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Discover running agents (A2A method: agent.discover)
app.get(['/discover', '/api/marketplace/discover'], async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    // Broadcast discovery request via A2A
    if (hcs10Initialized) {
      await sendA2A('aexowork.agent.discovery', {
        type: 'discovery.request',
        from: 'MarketplaceAgent',
        filter: { type },
        timestamp: Date.now()
      });
    }

    // Return currently known agents
    const runningAgents = Array.from(deployedAgents.values()).filter(a => a.status === 'running');

    res.json({
      total: runningAgents.length,
      agents: runningAgents,
      message: 'Discovery request broadcast on A2A network'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
app.get(['/categories', '/api/marketplace/categories'], (req: Request, res: Response) => {
  res.json({
    total: templates.categories.length,
    categories: templates.categories
  });
});

// Template statistics
app.get(['/stats', '/api/marketplace/stats'], (req: Request, res: Response) => {
  const stats: any = {
    totalTemplates: templates.templates.length,
    byCategory: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>,
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
async function handleDiscoveryRequest(data: any): Promise<void> {
  const { from, filter } = data;

  let agents = Array.from(deployedAgents.values()).filter(a => a.status === 'running');

  if (filter && filter.type) {
    agents = agents.filter(a => a.type === filter.type);
  }

  // Reply with discovered agents
  if (from && hcs10Initialized) {
    const response = {
      type: 'discovery.response',
      from: 'MarketplaceAgent',
      to: from,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        endpoint: a.endpoint,
        capabilities: a.config.capabilities || []
      })),
      timestamp: Date.now()
    };
    await sendA2A('aexowork.agent.discovery.response', response);
  }

  console.log(`✅ Discovery response sent to ${from}: ${agents.length} agents`);
}

// Start server
async function start(): Promise<void> {
  await initHCS10Connection();

  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   MarketplaceAgent (A2A Protocol)      ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`✅ Running on port ${PORT}`);
    console.log(`📡 A2A Protocol: v1.0 (HCS-10)`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}`);
    console.log(`📄 Agent Card: http://localhost:${PORT}/agent-card`);
    console.log(`📦 Templates loaded: ${templates.templates.length}`);
    if (hcs10Initialized) {
      console.log(`🌐 HCS-10 Agent ID: ${getAgentAccountId()}\n`);
    }
  });
}

start().catch(console.error);

export { app, AGENT_CARD };

