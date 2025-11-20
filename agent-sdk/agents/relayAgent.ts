/**
 * Relay Agent - Message Broker for HCS-10
 * Acts as a central hub for routing messages between agents
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { init as initHCS10, sendA2A, subscribe as subscribeHCS10, getClient, getAgentAccountId } from '../lib/hcs10';
import { AIAgentCapability } from '@hashgraphonline/standards-sdk';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.RELAY_AGENT_PORT || '3009', 10);
let hcs10Initialized = false;

// Type definitions
interface MessageMetadata {
  fromAccountId?: string;
  connectionTopicId?: string;
}

interface MessageData {
  type?: string;
  subject?: string;
  agentAccountId?: string;
  subjects?: string[];
  [key: string]: any;
}

// Message routing table: subject -> array of agent account IDs
const subscribers = new Map<string, Set<string>>(); // subject -> Set of accountIds
const agentConnections = new Map<string, string>(); // accountId -> connectionTopicId

// Health check
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    agent: 'RelayAgent',
    protocol: 'HCS-10',
    version: '1.0.0',
    stats: {
      subscribers: Array.from(subscribers.entries()).map(([subject, agents]) => ({
        subject,
        agentCount: agents.size
      })),
      connectedAgents: agentConnections.size
    }
  });
});

// Get routing table
app.get('/routes', (req: Request, res: Response) => {
  res.json({
    subscribers: Object.fromEntries(
      Array.from(subscribers.entries()).map(([subject, agents]) => [
        subject,
        Array.from(agents)
      ])
    ),
    connections: Object.fromEntries(agentConnections.entries())
  });
});

async function initHCS10Connection(): Promise<void> {
  try {
    await initHCS10({
      network: (process.env.HEDERA_NETWORK || 'testnet') as 'testnet' | 'mainnet',
      agentName: 'RelayAgent',
      agentDescription: 'Message relay and routing service for HCS-10 agents',
      capabilities: [AIAgentCapability.TEXT_GENERATION, AIAgentCapability.KNOWLEDGE_RETRIEVAL],
    });
    hcs10Initialized = true;
    console.log('✅ RelayAgent connected to HCS-10 network');

    // Subscribe to all messages via wildcard - we'll route them based on subject
    subscribeHCS10('*', async (data: any, metadata?: MessageMetadata) => {
      try {
        const fromAccountId = metadata?.fromAccountId || data.fromAccountId;
        const connectionTopicId = metadata?.connectionTopicId;
        
        // Handle agent registration
        if (data.type === 'aexowork.agent.register' || data.subject === 'aexowork.agent.register') {
          await handleAgentRegistration(data, fromAccountId, connectionTopicId);
          return;
        }
        
        // Handle regular messages
        if (data.subject) {
          await handleIncomingMessage(data, fromAccountId);
        }
      } catch (error: any) {
        console.error('[RelayAgent] Error handling message:', error);
      }
    });

    console.log('[RelayAgent] ✅ Ready to relay messages');
  } catch (error: any) {
    console.error('❌ RelayAgent HCS-10 connection failed:', error.message);
  }
}

// Handle new connection established
export async function handleNewConnection(agentAccountId: string, connectionTopicId: string): Promise<void> {
  agentConnections.set(agentAccountId, connectionTopicId);
  console.log(`[RelayAgent] ✅ New connection: ${agentAccountId} -> ${connectionTopicId}`);
  
  // Auto-subscribe to common subjects
  const commonSubjects = ['aexowork.jobs', 'aexowork.offers', 'aexowork.verifications'];
  for (const subject of commonSubjects) {
    if (!subscribers.has(subject)) {
      subscribers.set(subject, new Set());
    }
    subscribers.get(subject)!.add(agentAccountId);
  }
  console.log(`[RelayAgent] Auto-subscribed ${agentAccountId} to common subjects`);
}

async function handleAgentRegistration(data: MessageData, fromAccountId?: string, connectionTopicId?: string): Promise<void> {
  const agentAccountId = data.agentAccountId || fromAccountId;
  const subjects = data.subjects || [];
  
  if (!agentAccountId) {
    console.log('[RelayAgent] Invalid registration data - no account ID');
    return;
  }
  
  // Store connection if provided
  if (connectionTopicId) {
    agentConnections.set(agentAccountId, connectionTopicId);
    console.log(`[RelayAgent] ✅ Agent ${agentAccountId} registered (connection: ${connectionTopicId})`);
  } else {
    console.log(`[RelayAgent] ⚠️  Agent ${agentAccountId} registered but no connection topic provided`);
  }

  // Register subjects
  if (subjects && Array.isArray(subjects)) {
    for (const subject of subjects) {
      if (!subscribers.has(subject)) {
        subscribers.set(subject, new Set());
      }
      subscribers.get(subject)!.add(agentAccountId);
      console.log(`[RelayAgent] Agent ${agentAccountId} subscribed to ${subject}`);
    }
  }
  
  // Also subscribe to common subjects if not explicitly registered
  const commonSubjects = ['aexowork.jobs', 'aexowork.offers', 'aexowork.verifications'];
  for (const subject of commonSubjects) {
    if (!subscribers.has(subject)) {
      subscribers.set(subject, new Set());
    }
    if (!subscribers.get(subject)!.has(agentAccountId)) {
      subscribers.get(subject)!.add(agentAccountId);
      console.log(`[RelayAgent] Agent ${agentAccountId} auto-subscribed to ${subject}`);
    }
  }
}

async function handleIncomingMessage(data: MessageData, fromAccountId?: string): Promise<void> {
  if (!data || !data.subject) {
    return; // Not a routable message
  }

  const subject = data.subject;
  
  // Get subscribers for this subject
  const targetAgents = subscribers.get(subject);
  
  if (!targetAgents || targetAgents.size === 0) {
    console.log(`[RelayAgent] No subscribers for ${subject}`);
    return;
  }

  // Route to all subscribers (except sender)
  const targets = Array.from(targetAgents).filter(id => id !== fromAccountId);
  
  if (targets.length === 0) {
    console.log(`[RelayAgent] No targets for ${subject} (only sender subscribed)`);
    return;
  }

  console.log(`[RelayAgent] Routing ${subject} from ${fromAccountId} to ${targets.length} agent(s)`);

  // Send to each subscriber via their connection
  for (const targetAccountId of targets) {
    try {
      const connectionTopicId = agentConnections.get(targetAccountId);
      if (!connectionTopicId) {
        console.log(`[RelayAgent] ⚠️  No connection for ${targetAccountId}, skipping`);
        continue;
      }

      // Get HCS10Client to send directly
      const hcs10Client = getClient();
      if (!hcs10Client) {
        console.error(`[RelayAgent] No HCS10Client available`);
        continue;
      }

      // Send message to target agent's connection topic
      const relayAccountId = getAgentAccountId();
      const messageToSend = {
        ...data,
        relayed: true,
        originalFrom: fromAccountId,
        relayedBy: relayAccountId
      };
      
      // sendMessage uses the client's operator credentials automatically
      await hcs10Client.sendMessage(
        connectionTopicId,
        JSON.stringify(messageToSend),
        `A2A: ${subject}`
      );
      
      console.log(`[RelayAgent] ✅ Routed ${subject} to ${targetAccountId}`);
    } catch (error: any) {
      console.error(`[RelayAgent] ❌ Failed to route to ${targetAccountId}:`, error.message);
    }
  }
}

export async function init(): Promise<void> {
  console.log(`[RelayAgent] 🚀 Starting Relay Agent...`);
  
  // Initialize HCS-10
  await initHCS10Connection();
  
  // Start HTTP server
  app.listen(PORT, () => {
    console.log(`[RelayAgent] 🌐 HTTP server running on port ${PORT}`);
    console.log(`[RelayAgent] ✅ RelayAgent initialized and ready`);
    console.log(`[RelayAgent] 📡 Agents should connect to this relay for message routing`);
  });
}

// Start if run directly
if (require.main === module) {
  init().catch(console.error);
}

export { app };


