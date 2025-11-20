import express, { Request, Response } from 'express';
import { uploadJSON, downloadJSON } from '../lib/ipfs';

/**
 * AP2 (Agent Protocol 2) Capability Registry Adapter
 * Allows agents to register and discover capabilities
 */

const app = express();
app.use(express.json());

// Type definitions
interface Capability {
  agentDID: string;
  name: string;
  schemas: any;
  category?: string;
  tags?: string[];
}

interface RegisteredCapability {
  cid: string;
  name: string;
  category: string;
  tags: string[];
  registeredAt: number;
}

// In-memory capability registry (in production, use database)
const capabilityRegistry = new Map<string, RegisteredCapability[]>();

/**
 * POST /ap2/register
 * Register an agent's capability
 */
app.post('/ap2/register', async (req: Request, res: Response) => {
  try {
    const capability: Capability = req.body;
    
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
    
    capabilityRegistry.get(capability.agentDID)!.push({
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
  } catch (error: any) {
    console.error('[AP2] Registration error:', error);
    res.status(500).json({ error: 'Failed to register capability' });
  }
});

/**
 * GET /ap2/query
 * Query capabilities by skill, category, or tags
 */
app.get('/ap2/query', (req: Request, res: Response) => {
  const { skill, category, tag, agentDID } = req.query;
  
  try {
    let results: Array<RegisteredCapability & { agentDID: string }> = [];
    
    if (agentDID) {
      // Get all capabilities for specific agent
      const agentCaps = capabilityRegistry.get(agentDID as string) || [];
      results = agentCaps.map(cap => ({ ...cap, agentDID: agentDID as string }));
    } else {
      // Search across all agents
      for (const [did, capabilities] of capabilityRegistry.entries()) {
        for (const cap of capabilities) {
          let match = true;
          
          if (skill && !cap.name.toLowerCase().includes((skill as string).toLowerCase())) {
            match = false;
          }
          
          if (category && cap.category !== category) {
            match = false;
          }
          
          if (tag && !cap.tags.includes(tag as string)) {
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
  } catch (error: any) {
    console.error('[AP2] Query error:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

/**
 * GET /ap2/capability/:cid
 * Retrieve full capability details from IPFS
 */
app.get('/ap2/capability/:cid', async (req: Request, res: Response) => {
  try {
    const { cid } = req.params;
    const capability = await downloadJSON(cid);
    res.json(capability);
  } catch (error: any) {
    console.error('[AP2] Capability fetch error:', error);
    res.status(404).json({ error: 'Capability not found' });
  }
});

/**
 * GET /ap2/agents
 * List all registered agents
 */
app.get('/ap2/agents', (req: Request, res: Response) => {
  const agents = Array.from(capabilityRegistry.keys()).map((did) => ({
    agentDID: did,
    capabilityCount: capabilityRegistry.get(did)!.length,
  }));
  
  res.json({
    count: agents.length,
    agents,
  });
});

/**
 * Start the AP2 adapter server
 */
export function start(port: number = 4100): void {
  app.listen(port, () => {
    console.log(`[AP2] Registry server running on port ${port}`);
  });
}

// Auto-start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.AP2_PORT || '4100', 10);
  start(port);
}

export { app };


