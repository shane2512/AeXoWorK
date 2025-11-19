const express = require('express');
const { uploadJSON, downloadJSON } = require('../lib/ipfs');

/**
 * AP2 (Agent Protocol 2) Capability Registry Adapter
 * Allows agents to register and discover capabilities
 */

const app = express();
app.use(express.json());

// In-memory capability registry (in production, use database)
const capabilityRegistry = new Map();

/**
 * POST /ap2/register
 * Register an agent's capability
 */
app.post('/ap2/register', async (req, res) => {
  try {
    const capability = req.body;
    
    // Validate required fields
    if (!capability.agentDID || !capability.name || !capability.schemas) {
      return res.status(400).json({ error: 'Missing required fields: agentDID, name, schemas' });
    }
    
    // Upload capability metadata to IPFS
    const cid = await uploadJSON(capability);
    
    // Store in registry
    if (!capabilityRegistry.has(capability.agentDID)) {
      capabilityRegistry.set(capability.agentDID, []);
    }
    
    capabilityRegistry.get(capability.agentDID).push({
      cid,
      name: capability.name,
      category: capability.category || 'general',
      tags: capability.tags || [],
      registeredAt: Date.now(),
    });
    
    console.log(`[AP2] Registered capability for ${capability.agentDID}: ${capability.name}`);
    
    res.json({
      ok: true,
      capabilityCID: cid,
      agentDID: capability.agentDID,
    });
  } catch (error) {
    console.error('[AP2] Registration error:', error);
    res.status(500).json({ error: 'Failed to register capability' });
  }
});

/**
 * GET /ap2/query
 * Query capabilities by skill, category, or tags
 */
app.get('/ap2/query', (req, res) => {
  const { skill, category, tag, agentDID } = req.query;
  
  try {
    let results = [];
    
    if (agentDID) {
      // Get all capabilities for specific agent
      const agentCaps = capabilityRegistry.get(agentDID) || [];
      results = agentCaps;
    } else {
      // Search across all agents
      for (const [did, capabilities] of capabilityRegistry.entries()) {
        for (const cap of capabilities) {
          let match = true;
          
          if (skill && !cap.name.toLowerCase().includes(skill.toLowerCase())) {
            match = false;
          }
          
          if (category && cap.category !== category) {
            match = false;
          }
          
          if (tag && !cap.tags.includes(tag)) {
            match = false;
          }
          
          if (match) {
            results.push({
              ...cap,
              agentDID: did,
            });
          }
        }
      }
    }
    
    res.json({
      query: { skill, category, tag, agentDID },
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[AP2] Query error:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

/**
 * GET /ap2/capability/:cid
 * Retrieve full capability details from IPFS
 */
app.get('/ap2/capability/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const capability = await downloadJSON(cid);
    res.json(capability);
  } catch (error) {
    console.error('[AP2] Capability fetch error:', error);
    res.status(404).json({ error: 'Capability not found' });
  }
});

/**
 * GET /ap2/agents
 * List all registered agents
 */
app.get('/ap2/agents', (req, res) => {
  const agents = Array.from(capabilityRegistry.keys()).map((did) => ({
    agentDID: did,
    capabilityCount: capabilityRegistry.get(did).length,
  }));
  
  res.json({
    count: agents.length,
    agents,
  });
});

/**
 * Start the AP2 adapter server
 * @param {number} port - Port to listen on
 */
function start(port = 4100) {
  app.listen(port, () => {
    console.log(`[AP2] Registry server running on port ${port}`);
  });
}

module.exports = {
  app,
  start,
};

