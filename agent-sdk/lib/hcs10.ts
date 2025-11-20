import 'dotenv/config';
import * as path from 'path';
import axios from 'axios';
import { HCS10Client, AgentBuilder, AIAgentCapability, ConnectionsManager } from '@hashgraphonline/standards-sdk';
import { PrivateKey, Client, AccountId, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';
import { 
  initMessageServer, 
  sendOffChainMessage, 
  receiveAndVerifyMessage,
  setMessageHandler
} from './offchain-messaging';

// Type definitions
interface InitOptions {
  network?: 'testnet' | 'mainnet';
  accountId?: string;
  privateKey?: string;
  agentName?: string;
  agentDescription?: string;
  capabilities?: any[];
}

interface MessageHandler {
  (message: any, metadata?: any): Promise<void> | void;
}

interface ConnectionSubscriptionInfo {
  pollInterval: NodeJS.Timeout;
}

interface AgentInfo {
  name: string;
  envKey: string;
  defaultPort?: number;
}

interface MessageMetadata {
  fromAccountId?: string | null;
  connectionTopicId?: string;
  verified?: boolean;
}

interface MirrorNodeMessage {
  message: string;
  sequence_number: number;
  consensus_timestamp: string;
  payer_account_id: string;
}

interface SendResult {
  sent?: number;
  success?: boolean;
  messageId?: string;
  anchorTxId?: string;
  method: string;
}

interface ConnectionStatus {
  isInitialized: boolean;
  agentAccountId: string | null;
  inboundTopicId: string | null;
  outboundTopicId: string | null;
  activeConnections: number;
  connectionTopics: Array<{ key: string; topicId: string }>;
  subscriptions: string[];
}

// Module-level variables
let hcs10Client: any = null;
let connectionsManager: any = null;
let agentAccountId: string | null = null;
let agentPrivateKey: string | null = null;
let inboundTopicId: string | null = null;
let outboundTopicId: string | null = null;
let connectionTopics = new Map<string, string>(); // Map of connectionKey -> connectionTopicId
let subscriptions = new Map<string, MessageHandler[]>(); // Map of subject -> array of handlers
let connectionSubscriptions = new Map<string, ConnectionSubscriptionInfo>(); // Map of connectionTopicId -> subscription info
let isInitialized = false;
let connectionEstablished = false; // Track if initial connections are established
let verboseLogging = true; // Enable verbose logging for debugging message delivery
let useOffChainMessaging = true; // Use off-chain messaging with HCS anchoring via NATS (default: true)
let currentAgentName: string = ''; // Store current agent name

/**
 * Initialize HCS-10 client and agent registration
 */
export async function init(options: InitOptions = {}): Promise<void> {
  if (isInitialized && hcs10Client) {
    console.log('[HCS-10] Already initialized');
    return;
  }

  try {
    const network = (options.network || process.env.HEDERA_NETWORK || 'testnet') as 'testnet' | 'mainnet';
    const agentName = options.agentName || process.env.AGENT_NAME || 'A2A Agent';
    currentAgentName = agentName; // Store for later use
    const agentDescription = options.agentDescription || process.env.AGENT_DESCRIPTION || 'A2A-compliant agent using HCS-10';
    
    // Check if we have existing agent credentials
    // Try agent-specific env vars first, then generic HCS10 vars
    // Map agent names to their env key prefixes (from registration script)
    const agentNameToEnvKey: Record<string, string> = {
      'ClientAgent': 'CLIENT_AGENT',
      'WorkerAgent': 'WORKER_AGENT',
      'VerificationAgent': 'VERIFICATION_AGENT',
      'ReputeAgent': 'REPUTE_AGENT',
      'DisputeAgent': 'DISPUTE_AGENT',
      'DataAgent': 'DATA_AGENT',
      'EscrowAgent': 'ESCROW_AGENT',
      'MarketplaceAgent': 'MARKETPLACE_AGENT',
      'EnhancedVerificationAgent': 'ENHANCED_VERIFICATION_AGENT'
    };
    
    const agentEnvPrefix = agentNameToEnvKey[agentName] || agentName.toUpperCase().replace(/-/g, '_').replace('AGENT', '_AGENT');
    
    agentAccountId = options.accountId 
      || process.env[`${agentEnvPrefix}_ACCOUNT_ID`] || undefined
      || process.env.HCS10_AGENT_ACCOUNT_ID || undefined || null;
    agentPrivateKey = options.privateKey 
      || process.env[`${agentEnvPrefix}_PRIVATE_KEY`] || undefined
      || process.env.HCS10_AGENT_PRIVATE_KEY || undefined || null;
    
    // Also check for inbound/outbound topics
    const inboundTopic = process.env[`${agentEnvPrefix}_INBOUND_TOPIC`] || process.env.HCS10_AGENT_INBOUND_TOPIC;
    const outboundTopic = process.env[`${agentEnvPrefix}_OUTBOUND_TOPIC`] || process.env.HCS10_AGENT_OUTBOUND_TOPIC;

    // Debug logging
    console.log(`[HCS-10] Looking for credentials for ${agentName}`);
    console.log(`[HCS-10] Env prefix: ${agentEnvPrefix}`);
    console.log(`[HCS-10] Account ID found: ${agentAccountId ? 'YES' : 'NO'}`);
    console.log(`[HCS-10] Private Key found: ${agentPrivateKey ? 'YES' : 'NO'}`);

    if (!agentAccountId || !agentPrivateKey) {
      console.log(`[HCS-10] ⚠️  No credentials found for ${agentName}. Creating new agent...`);
      console.log(`[HCS-10] ⚠️  Make sure ${agentEnvPrefix}_ACCOUNT_ID and ${agentEnvPrefix}_PRIVATE_KEY are set in .env`);
      
      // Use main Hedera wallet as operator (payer) for creating agents
      const operatorId = process.env.HEDERA_ACCOUNT_ID;
      const operatorKey = process.env.HEDERA_PRIVATE_KEY;
      
      if (!operatorId || !operatorKey) {
        throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in .env to create agents');
      }

      const operatorClient = new HCS10Client({
        network,
        operatorId, // Main wallet pays for agent creation
        operatorPrivateKey: operatorKey,
        logLevel: 'error', // Only log errors, not info/debug messages
      });

      // Create and register agent
      const agentBuilder = new AgentBuilder()
        .setName(agentName)
        .setDescription(agentDescription)
        .setAgentType('autonomous')
        .setNetwork(network)
        .setCapabilities(options.capabilities || [
          AIAgentCapability.TEXT_GENERATION,
          AIAgentCapability.KNOWLEDGE_RETRIEVAL,
        ])
        .setMetadata({
          type: 'a2a-agent',
          version: '1.0.0',
          transport: 'hcs-10',
        });

      const result = await operatorClient.createAndRegisterAgent(agentBuilder, {
        progressCallback: (progress: any) => {
          console.log(`[HCS-10] ${progress.stage}: ${progress.progressPercent}%`);
        },
      });

      if (!result.success) {
        throw new Error(`Failed to create agent: ${result.error}`);
      }

      agentAccountId = result.metadata.accountId;
      agentPrivateKey = result.metadata.privateKey;
      inboundTopicId = result.metadata.inboundTopicId;
      outboundTopicId = result.metadata.outboundTopicId;

      console.log(`[HCS-10] ✅ Agent created: ${agentAccountId}`);
      console.log(`[HCS-10] Inbound Topic: ${inboundTopicId}`);
      console.log(`[HCS-10] Outbound Topic: ${outboundTopicId}`);
      console.log(`[HCS-10] ⚠️  Save these credentials: ${agentEnvPrefix}_ACCOUNT_ID=${agentAccountId}, ${agentEnvPrefix}_PRIVATE_KEY=${agentPrivateKey}`);
      
      // Create HCS-10 client with agent's own account as operator (for identity)
      // Note: Agent account needs HBAR to pay for transactions
      hcs10Client = new HCS10Client({
        network,
        operatorId: agentAccountId,
        operatorPrivateKey: agentPrivateKey,
        logLevel: 'error', // Only log errors, not info/debug messages
      });
      
      // Using agent's own account for identity and transactions
    } else {
      // Use topics from env vars if available, otherwise retrieve from profile
      if (inboundTopic && outboundTopic) {
        inboundTopicId = inboundTopic;
        outboundTopicId = outboundTopic;
      } else {
        // Profile retrieval disabled - requires HCS-11 memo which may not be set
        // Topics must be provided in .env
        throw new Error(`Topics not found in .env for ${agentName}. Please set ${agentEnvPrefix}_INBOUND_TOPIC and ${agentEnvPrefix}_OUTBOUND_TOPIC in .env file.`);
      }
      
      // Create HCS-10 client with agent's own account as operator (for identity)
      // The agent account will be used for identity, but we'll try to use main wallet for payments
      // However, Hedera SDK requires operator to pay, so agent account needs HBAR
      // For now, use agent account as operator - user can fund agent accounts with HBAR
      hcs10Client = new HCS10Client({
        network,
        operatorId: agentAccountId, // Agent's account for identity
        operatorPrivateKey: agentPrivateKey, // Agent's private key
        logLevel: 'error', // Only log errors, not info/debug messages
      });
      
      // Using agent's own account for identity and transactions
    }

    // Initialize connections manager
    connectionsManager = new ConnectionsManager({
      baseClient: hcs10Client,
    });

    // Initialize off-chain messaging via NATS if enabled
    if (useOffChainMessaging && agentAccountId) {
      try {
        await initMessageServer(agentAccountId);
        console.log(`[OffChain/NATS] ✅ Connected to NATS for off-chain messaging`);
        
        // Set up message handler to process incoming messages
        setMessageHandler(async (messageId: string, fromAccountId: string) => {
          // Message received via NATS - try to verify and process immediately
          console.log(`[OffChain/NATS] 📨 Received message ${messageId} from ${fromAccountId} - checking for HCS anchor...`);
          
          // Try to verify the message (this will check for HCS anchor)
          try {
            const verified = await receiveAndVerifyMessage(messageId, inboundTopicId!);
            
            // Process verified message
            const subject = verified.message.subject;
            const handlers = subscriptions.get(subject) || [];
            const wildcardHandlers = subscriptions.get('*') || [];
            
            console.log(`[HCS-10] ✅ Verified off-chain message: ${messageId}, subject: ${subject}`);
            console.log(`[HCS-10] 📨 Found ${handlers.length} handler(s) for subject '${subject}', ${wildcardHandlers.length} wildcard handler(s)`);
            
            for (const handler of handlers) {
              try {
                console.log(`[HCS-10] 🔔 Calling handler for subject '${subject}'`);
                await handler(verified.message, { fromAccountId: verified.fromAccountId, verified: true });
              } catch (error: any) {
                console.error(`[HCS-10] Handler error:`, error);
              }
            }
            
            for (const handler of wildcardHandlers) {
              try {
                console.log(`[HCS-10] 🔔 Calling wildcard handler`);
                await handler(verified.message, { fromAccountId: verified.fromAccountId, verified: true });
              } catch (error: any) {
                console.error(`[HCS-10] Wildcard handler error:`, error);
              }
            }
          } catch (verifyError: any) {
            // Anchor might not be indexed yet - will be processed by polling
            console.log(`[OffChain/NATS] ⏳ HCS anchor not found yet for ${messageId} (will retry via polling): ${verifyError.message}`);
          }
        });
      } catch (error: any) {
        console.error(`[OffChain/NATS] ❌ Failed to connect to NATS:`, error.message);
        console.log(`[OffChain/NATS] ⚠️  Falling back to direct HCS messaging`);
        useOffChainMessaging = false;
      }
    }

    // Start monitoring inbound topic for messages (connection requests and regular messages)
    startInboundMonitoring();
    
    // Note: We don't auto-connect anymore - messages are sent directly to inbound topics
    // This saves HBAR by not creating connection topics

    isInitialized = true;
    console.log(`[HCS-10] ✅ Connected to Hedera network: ${network}`);
    
  } catch (error: any) {
    console.error(`[HCS-10] ❌ Failed to initialize: ${error.message}`);
    throw error;
  }
}

// Add sequenceTracker as a static property on the function
declare namespace startInboundMonitoring {
  let sequenceTracker: Map<string, number>;
}

/**
 * Start monitoring inbound topic for connection requests
 */
async function startInboundMonitoring(): Promise<void> {
  if (!inboundTopicId) {
    console.log('[HCS-10] ⚠️  Cannot start inbound monitoring - no inbound topic ID');
    return;
  }

  // Starting inbound monitoring silently

  // Poll for messages (reduced frequency to avoid rate limiting)
  let lastPollTime = 0;
  let lastProcessedSequence = 0; // Track last processed message sequence (persist across polls)
  const POLL_INTERVAL = 10000; // Poll every 10 seconds to avoid rate limiting
  
  // Store last processed sequence per topic to persist across function calls
  if (!startInboundMonitoring.sequenceTracker) {
    startInboundMonitoring.sequenceTracker = new Map<string, number>();
  }
  const topicKey = inboundTopicId;
  if (startInboundMonitoring.sequenceTracker.has(topicKey)) {
    lastProcessedSequence = startInboundMonitoring.sequenceTracker.get(topicKey) || 0;
  }
  
  setInterval(async () => {
    const now = Date.now();
    if (now - lastPollTime < POLL_INTERVAL) {
      return; // Skip if too soon
    }
    lastPollTime = now;
    
    try {
      if (!inboundTopicId) {
        if (verboseLogging) {
          console.error('[HCS-10] ⚠️  Cannot poll inbound topic - topic ID is undefined');
        }
        return;
      }
      
      // Use mirror node REST API to get topic messages
      // This works for messages sent via TopicMessageSubmitTransaction
      let messages: MirrorNodeMessage[] = [];
      
      try {
        const network = process.env.HEDERA_NETWORK || 'testnet';
        const mirrorNodeUrl = network === 'mainnet' 
          ? 'https://mainnet-public.mirrornode.hedera.com'
          : 'https://testnet.mirrornode.hedera.com';
        
        // Get messages from mirror node
        const response = await axios.get(`${mirrorNodeUrl}/api/v1/topics/${inboundTopicId}/messages`, {
          params: {
            limit: 100,
            order: 'asc'
          },
          timeout: 5000
        });
        
        if (response.data && response.data.messages) {
          // Convert mirror node format to our format
          messages = response.data.messages.map((msg: any) => ({
            message: Buffer.from(msg.message, 'base64').toString('utf8'),
            sequence_number: parseInt(msg.sequence_number),
            consensus_timestamp: msg.consensus_timestamp,
            payer_account_id: msg.payer_account_id,
          })).filter((msg: MirrorNodeMessage) => msg.sequence_number > lastProcessedSequence);
          
          if (messages.length > 0) {
            const minSeq = Math.min(...messages.map(m => m.sequence_number));
            const maxSeq = Math.max(...messages.map(m => m.sequence_number));
            lastProcessedSequence = maxSeq;
            startInboundMonitoring.sequenceTracker.set(topicKey, maxSeq);
            console.log(`[HCS-10] 📨 Retrieved ${messages.length} new message(s) from mirror node (seq ${minSeq} to ${maxSeq}, last processed: ${lastProcessedSequence})`);
          }
        }
      } catch (mirrorError: any) {
        // Fallback to HCS-10 SDK method
        if (verboseLogging && !mirrorError.message.includes('429') && !mirrorError.message.includes('timeout')) {
          console.log(`[HCS-10] Mirror node query failed, using HCS-10 SDK: ${mirrorError.message}`);
        }
        try {
          const hcs10Result = await hcs10Client.getMessages(inboundTopicId);
          messages = (hcs10Result.messages || []) as MirrorNodeMessage[];
        } catch (hcs10Error: any) {
          if (verboseLogging && !hcs10Error.message.includes('429')) {
            console.error(`[HCS-10] HCS-10 SDK getMessages failed:`, hcs10Error.message);
          }
          return;
        }
      }
      
      if (!messages || messages.length === 0) {
        return; // No messages yet
      }
      
      // Debug: Log message count
      if (verboseLogging && messages.length > 0) {
        console.log(`[HCS-10] 📨 Found ${messages.length} message(s) on inbound topic ${inboundTopicId}`);
      }
      
      // Process all messages
      // Check for off-chain message notifications first
      for (const msg of messages) {
        try {
          // Check if this is an off-chain message notification
          let content: any = (msg as any).message || (msg as any).data || (msg as any).content || msg;
          if (typeof content === 'string') {
            try {
              content = JSON.parse(content);
            } catch (e) {
              // Not JSON, continue with normal processing
              continue;
            }
          }
          
          // Log message type for debugging
          if (content && content.type) {
            if (verboseLogging || content.type === 'message_anchor') {
              console.log(`[HCS-10] 📨 Processing message type: ${content.type}`);
            }
          }
          
          // If it's an off-chain message anchor, fetch and verify the message
          if (content && content.type === 'message_anchor' && content.messageId) {
            // Only process if we have the message in our store (it was sent to us via NATS)
            // Skip silently if message not in store (might be for another agent)
            const { hasMessage } = await import('./offchain-messaging');
            if (!hasMessage(content.messageId)) {
              // Message not in our store - it's for another agent, skip silently
              continue;
            }
            
            if (verboseLogging) {
              console.log(`[HCS-10] 🔍 Detected message_anchor for messageId: ${content.messageId}`);
            }
            try {
              const verified = await receiveAndVerifyMessage(content.messageId, inboundTopicId!);
              
              // Process verified message
              const subject = verified.message.subject;
              const handlers = subscriptions.get(subject) || [];
              const wildcardHandlers = subscriptions.get('*') || [];
              
              if (verboseLogging) {
                console.log(`[HCS-10] ✅ Verified off-chain message: ${content.messageId}, subject: ${subject}`);
                console.log(`[HCS-10] 📨 Found ${handlers.length} handler(s) for subject '${subject}', ${wildcardHandlers.length} wildcard handler(s)`);
              }
              
              for (const handler of handlers) {
                try {
                  if (verboseLogging) {
                    console.log(`[HCS-10] 🔔 Calling handler for subject '${subject}'`);
                  }
                  await handler(verified.message, { fromAccountId: verified.fromAccountId, verified: true });
                } catch (error: any) {
                  console.error(`[HCS-10] Handler error:`, error);
                }
              }
              
              for (const handler of wildcardHandlers) {
                try {
                  if (verboseLogging) {
                    console.log(`[HCS-10] 🔔 Calling wildcard handler`);
                  }
                  await handler(verified.message, { fromAccountId: verified.fromAccountId, verified: true });
                } catch (error: any) {
                  console.error(`[HCS-10] Wildcard handler error:`, error);
                }
              }
              
              continue; // Skip normal processing
            } catch (verifyError: any) {
              // Only log if it's not a "not found" error (which is expected for other agents' messages)
              if (!verifyError.message || !verifyError.message.includes('not found in store')) {
                if (verboseLogging) {
                  console.error(`[HCS-10] ❌ Failed to verify off-chain message ${content.messageId}:`, verifyError.message);
                }
              }
              // Continue with normal processing as fallback
            }
          }
        } catch (e) {
          // Continue with normal processing
        }
        
        // Normal message processing (existing code)
        
        try {
          // Messages from TopicMessageSubmitTransaction are in msg.message field
          // HCS-10 SDK messages might be in msg.data or msg.content
          let content: any = (msg as any).message || (msg as any).data || (msg as any).content || msg;
          
          // If content is a string, try to parse as JSON
          if (typeof content === 'string') {
            try {
              content = JSON.parse(content);
            } catch (e) {
              // Not JSON, skip this message
              continue;
            }
          }
          
          // Skip if content is not an object
          if (typeof content !== 'object' || content === null) {
            continue;
          }
          
          // Skip HCS-10 protocol messages (connection_request, connection_created, etc.)
          // These have "p":"hcs-10" and "op" fields
          if (content.p === 'hcs-10' && (content.op === 'connection_request' || content.op === 'connection_created')) {
            continue; // Skip HCS-10 protocol messages
          }
          
          // Extract subject from message (required for routing)
          const subject = content.subject;
          if (!subject) {
            // Log all messages without subject to debug
            console.log(`[HCS-10] ⚠️  Message missing subject field:`, JSON.stringify(content).substring(0, 200));
            continue; // Skip messages without subject
          }
          
          // Log when we find a message with subject
          console.log(`[HCS-10] ✅ Found message with subject '${subject}':`, JSON.stringify(content).substring(0, 150));
          
          const fromAccountId = content.fromAccountId || (msg as any).payer_account_id || null;
          const metadata: MessageMetadata = { fromAccountId, connectionTopicId: inboundTopicId || undefined };
          
          // Debug: Log subject and handlers
          if (verboseLogging) {
            console.log(`[HCS-10] 📨 Message subject: ${subject}, handlers: ${subscriptions.get(subject)?.length || 0}, wildcard: ${subscriptions.get('*')?.length || 0}`);
          }
          
          // Call registered handlers for this subject
          const handlers = subscriptions.get(subject) || [];
          const wildcardHandlers = subscriptions.get('*') || [];
          
          if (handlers.length > 0 || wildcardHandlers.length > 0) {
            console.log(`[HCS-10] ✅ Calling ${handlers.length} handler(s) for subject '${subject}'`);
            for (const handler of handlers) {
              try {
                await handler(content, metadata);
              } catch (error: any) {
                if (verboseLogging) {
                  console.error(`[HCS-10] Handler error for ${subject}:`, error);
                }
              }
            }
            
            for (const handler of wildcardHandlers) {
              try {
                await handler(content, metadata);
              } catch (error: any) {
                if (verboseLogging) {
                  console.error(`[HCS-10] Wildcard handler error:`, error);
                }
              }
            }
          }
        } catch (error: any) {
          if (verboseLogging) {
            console.error(`[HCS-10] Error processing message from inbound topic:`, error);
          }
        }
      }
      
      // Connection requests are ignored - we use direct inbound topic messaging
      // No connection topics are created, saving HBAR
    } catch (error: any) {
      if (error.message && error.message.includes('429')) {
        // Rate limited - just skip this poll
        return;
      }
      if (verboseLogging) {
        console.error('[HCS-10] ❌ Error monitoring inbound topic:', error.message);
      }
    }
  }, POLL_INTERVAL);
}

/**
 * Start monitoring a connection topic for messages
 */
function startConnectionMonitoring(connectionTopicId: string): void {
  if (connectionSubscriptions.has(connectionTopicId)) {
    return; // Already monitoring
  }

  let lastProcessedSequence = 0;
  let lastPollTime = 0;
  const POLL_INTERVAL = 15000; // Poll every 15 seconds to avoid rate limiting

  const pollInterval = setInterval(async () => {
    const now = Date.now();
    if (now - lastPollTime < POLL_INTERVAL) {
      return; // Skip if too soon
    }
    lastPollTime = now;
    
    try {
      if (!connectionTopicId) {
        if (verboseLogging) {
          console.error(`[HCS-10] ⚠️  Cannot poll connection topic - topic ID is undefined`);
        }
        return;
      }
      const { messages } = await hcs10Client.getMessages(connectionTopicId);
      
      // Filter for new messages
      const newMessages = messages.filter(
        (msg: any) => msg.op === 'message' && msg.sequence_number > lastProcessedSequence
      );

      for (const message of newMessages) {
        lastProcessedSequence = Math.max(lastProcessedSequence, message.sequence_number);

        // Resolve message content (handles HCS-1 references)
        let content: any = message.data;
        if (typeof content === 'string' && content.startsWith('hcs://')) {
          try {
            content = await hcs10Client.getMessageContent(content);
          } catch (error: any) {
            if (!error.message || !error.message.includes('429')) {
              console.error('[HCS-10] Error resolving content:', error);
            }
          }
        }

        // Parse JSON if possible
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch (e) {
            // Not JSON, keep as string
          }
        }

        // Extract subject from message (use 'subject' field or default to connection topic)
        const subject = content.subject || `hcs10.${connectionTopicId}`;
        
        // Extract fromAccountId from message or metadata
        const fromAccountId = content.fromAccountId || message.operator_id?.split('@')[0] || null;
        const metadata: MessageMetadata = { fromAccountId, connectionTopicId };
        
        // Call registered handlers for this subject
        const handlers = subscriptions.get(subject) || [];
        const wildcardHandlers = subscriptions.get('*') || [];
        
        // Call subject-specific handlers
        for (const handler of handlers) {
          try {
            await handler(content, metadata);
          } catch (error: any) {
            console.error(`[HCS-10] Handler error for ${subject}:`, error);
          }
        }
        
        // Call wildcard handlers
        for (const handler of wildcardHandlers) {
          try {
            await handler(content, metadata);
          } catch (error: any) {
            console.error(`[HCS-10] Wildcard handler error:`, error);
          }
        }
      }
    } catch (error: any) {
      if (error.message && error.message.includes('429')) {
        // Rate limited - just skip this poll, will retry later
        return;
      }
      if (verboseLogging) {
        console.error(`[HCS-10] Error monitoring connection ${connectionTopicId}:`, error.message);
      }
    }
  }, POLL_INTERVAL);

  connectionSubscriptions.set(connectionTopicId, { pollInterval });
}

/**
 * Send A2A message using off-chain messaging + HCS anchoring
 */
export async function sendA2A(subject: string, message: any): Promise<SendResult> {
  if (!hcs10Client || !isInitialized) {
    await init();
  }

  try {
    // Use off-chain messaging via NATS with HCS anchoring if enabled
    if (useOffChainMessaging && agentAccountId) {
      return await sendA2AOffChain(subject, message);
    }
    
    // Fallback to direct HCS messaging (legacy)
    return await sendA2ADirect(subject, message);
  } catch (error: any) {
    console.error(`[HCS-10] Failed to publish to ${subject}:`, error.message);
    throw error;
  }
}

/**
 * Send A2A message using off-chain messaging + HCS anchoring
 */
async function sendA2AOffChain(subject: string, message: any): Promise<SendResult> {
  // Extract target account ID - check both 'to' and 'targetAccountId' fields
  // Also check for empty strings and trim whitespace
  let targetAccountId = message.to || message.targetAccountId;
  if (targetAccountId && typeof targetAccountId === 'string') {
    targetAccountId = targetAccountId.trim();
    if (targetAccountId === '') {
      targetAccountId = undefined;
    }
  }
  
  // Get agent URLs from environment
  const knownAgents: AgentInfo[] = [
    { name: 'ClientAgent', envKey: 'CLIENT_AGENT', defaultPort: 3001 },
    { name: 'WorkerAgent', envKey: 'WORKER_AGENT', defaultPort: 3002 },
    { name: 'VerificationAgent', envKey: 'VERIFICATION_AGENT', defaultPort: 3003 },
    { name: 'ReputeAgent', envKey: 'REPUTE_AGENT', defaultPort: 3004 },
    { name: 'DisputeAgent', envKey: 'DISPUTE_AGENT', defaultPort: 3005 },
    { name: 'DataAgent', envKey: 'DATA_AGENT', defaultPort: 3006 },
    { name: 'EscrowAgent', envKey: 'ESCROW_AGENT', defaultPort: 3007 },
    { name: 'MarketplaceAgent', envKey: 'MARKETPLACE_AGENT', defaultPort: 3008 },
  ];

  // Preserve the 'to' field in the message (don't overwrite it)
  const messageWithSubject = { ...message, subject, fromAccountId: agentAccountId };
  
  // Debug: Log the target if verbose logging is enabled
  if (verboseLogging) {
    if (targetAccountId) {
      console.log(`[HCS-10] 🎯 Message has 'to' field: ${targetAccountId} - Subject: ${subject}`);
    } else {
      console.log(`[HCS-10] 📢 Message has NO 'to' field - will broadcast - Subject: ${subject}`);
    }
  }

  // Only broadcast if NO target is specified (for JobOfferRequest to WorkerAgents)
  if (!targetAccountId) {
    // Broadcast to all agents (only for messages without 'to' field)
    if (verboseLogging) {
      console.log(`[HCS-10] 📢 Broadcasting message to all agents (no 'to' field specified) - Subject: ${subject}`);
    }
    let sent = 0;
    for (const agentInfo of knownAgents) {
      const agentEnvAccountId = process.env[`${agentInfo.envKey}_ACCOUNT_ID`];
      if (agentEnvAccountId === agentAccountId) continue; // Skip ourselves
      
      const agentInboundTopic = process.env[`${agentInfo.envKey}_INBOUND_TOPIC`];
      
      if (!agentInboundTopic || !agentEnvAccountId) {
        if (verboseLogging) {
          console.warn(`[HCS-10] ⚠️  No inbound topic or account ID for ${agentInfo.name}, skipping`);
        }
        continue;
      }
      
      try {
        const result = await sendOffChainMessage(
          agentEnvAccountId, // Recipient's account ID (used for NATS topic)
          messageWithSubject,
          agentInboundTopic, // Post anchor to recipient's inbound topic
          agentAccountId!,
          agentPrivateKey!
        );
        if (verboseLogging) {
          console.log(`[HCS-10] ✅ Sent off-chain via NATS to ${agentInfo.name} (${agentEnvAccountId}) - Message ID: ${result.messageId}, Anchor TX: ${result.anchorTxId}`);
        }
        sent++;
      } catch (error: any) {
        console.error(`[HCS-10] ❌ Failed to send off-chain to ${agentInfo.name}:`, error.message);
      }
    }
    return { sent, method: 'offchain-nats' };
  } else {
    // Send to specific agent ONLY
    if (verboseLogging) {
      console.log(`[HCS-10] 🎯 Targeting specific agent: ${targetAccountId} - Subject: ${subject}`);
    }
    
    let targetFound = false;
    for (const agentInfo of knownAgents) {
      const agentEnvAccountId = process.env[`${agentInfo.envKey}_ACCOUNT_ID`];
      
      // Normalize account IDs for comparison (remove any whitespace, convert to string)
      const normalizedTarget = String(targetAccountId).trim();
      const normalizedEnv = agentEnvAccountId ? String(agentEnvAccountId).trim() : '';
      
      if (normalizedEnv === normalizedTarget) {
        targetFound = true;
        const agentInboundTopic = process.env[`${agentInfo.envKey}_INBOUND_TOPIC`];
        
        if (!agentInboundTopic) {
          throw new Error(`No inbound topic found for ${agentInfo.name}`);
        }
        
        const result = await sendOffChainMessage(
          agentEnvAccountId, // Recipient's account ID (used for NATS topic)
          messageWithSubject,
          agentInboundTopic, // Post anchor to recipient's inbound topic
          agentAccountId!,
          agentPrivateKey!
        );
        if (verboseLogging) {
          console.log(`[HCS-10] ✅ Sent off-chain via NATS to ${agentInfo.name} (${agentEnvAccountId}) - Message ID: ${result.messageId}, Anchor TX: ${result.anchorTxId}`);
        }
        return { success: true, messageId: result.messageId, anchorTxId: result.anchorTxId, method: 'offchain-nats' };
      }
    }
    
    // If target not found, log warning but don't broadcast
    console.warn(`[HCS-10] ⚠️  Target agent ${targetAccountId} not found in known agents. Message NOT sent.`);
    console.warn(`[HCS-10]    Available agents: ${knownAgents.map(a => `${a.name}(${process.env[`${a.envKey}_ACCOUNT_ID`] || 'N/A'})`).join(', ')}`);
    throw new Error(`Target agent ${targetAccountId} not found`);
  }
}

/**
 * Send A2A message directly via HCS (fallback/legacy method)
 */
async function sendA2ADirect(subject: string, message: any): Promise<SendResult> {
  // Extract target agent from subject or message
  const targetAccountId = message.to || message.targetAccountId;
  
  if (!targetAccountId) {
    // Broadcast message - send directly to all known agents' inbound topics
    const knownAgents: AgentInfo[] = [
      { name: 'ClientAgent', envKey: 'CLIENT_AGENT' },
      { name: 'WorkerAgent', envKey: 'WORKER_AGENT' },
      { name: 'VerificationAgent', envKey: 'VERIFICATION_AGENT' },
      { name: 'ReputeAgent', envKey: 'REPUTE_AGENT' },
      { name: 'DisputeAgent', envKey: 'DISPUTE_AGENT' },
      { name: 'DataAgent', envKey: 'DATA_AGENT' },
      { name: 'EscrowAgent', envKey: 'ESCROW_AGENT' },
      { name: 'MarketplaceAgent', envKey: 'MARKETPLACE_AGENT' },
    ];
    
    let sent = 0;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const mainClient = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    const mainAccountId = process.env.HEDERA_ACCOUNT_ID;
    const mainPrivateKey = process.env.HEDERA_PRIVATE_KEY;
    
    if (mainAccountId && mainPrivateKey) {
      mainClient.setOperator(
        AccountId.fromString(mainAccountId),
        PrivateKey.fromStringECDSA(mainPrivateKey)
      );
    }
    
    const messageWithSubject = { ...message, subject, fromAccountId: agentAccountId };
    const messageJson = JSON.stringify(messageWithSubject);
    
    for (const agentInfo of knownAgents) {
      const agentEnvAccountId = process.env[`${agentInfo.envKey}_ACCOUNT_ID`];
      if (agentEnvAccountId === agentAccountId) continue;
      
      const agentInboundTopic = process.env[`${agentInfo.envKey}_INBOUND_TOPIC`];
      if (!agentInboundTopic) continue;
      
      try {
        const tx = new TopicMessageSubmitTransaction()
          .setTopicId(TopicId.fromString(agentInboundTopic))
          .setMessage(messageJson);
        
        const txResponse = await tx.execute(mainClient);
        await txResponse.getReceipt(mainClient);
        console.log(`[HCS-10] ✅ Sent (direct) to ${agentInfo.name} - TX: ${txResponse.transactionId.toString()}`);
        sent++;
      } catch (error: any) {
        console.error(`[HCS-10] ❌ Failed to send to ${agentInfo.name}:`, error.message);
      }
    }
    
    return { sent, method: 'direct' };
  }

  // Send to specific agent
  const knownAgents: AgentInfo[] = [
    { name: 'ClientAgent', envKey: 'CLIENT_AGENT' },
    { name: 'WorkerAgent', envKey: 'WORKER_AGENT' },
    { name: 'VerificationAgent', envKey: 'VERIFICATION_AGENT' },
    { name: 'ReputeAgent', envKey: 'REPUTE_AGENT' },
    { name: 'DisputeAgent', envKey: 'DISPUTE_AGENT' },
    { name: 'DataAgent', envKey: 'DATA_AGENT' },
    { name: 'EscrowAgent', envKey: 'ESCROW_AGENT' },
    { name: 'MarketplaceAgent', envKey: 'MARKETPLACE_AGENT' },
  ];
  
  let targetInboundTopic: string | null = null;
  for (const agentInfo of knownAgents) {
    const agentEnvAccountId = process.env[`${agentInfo.envKey}_ACCOUNT_ID`];
    if (agentEnvAccountId === targetAccountId) {
      targetInboundTopic = process.env[`${agentInfo.envKey}_INBOUND_TOPIC`] || null;
      break;
    }
  }
  
  if (targetInboundTopic) {
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const mainClient = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    const mainAccountId = process.env.HEDERA_ACCOUNT_ID;
    const mainPrivateKey = process.env.HEDERA_PRIVATE_KEY;
    
    if (mainAccountId && mainPrivateKey) {
      mainClient.setOperator(
        AccountId.fromString(mainAccountId),
        PrivateKey.fromStringECDSA(mainPrivateKey)
      );
      
      const messageWithSubject = { ...message, subject, fromAccountId: agentAccountId };
      const messageJson = JSON.stringify(messageWithSubject);
      
      const tx = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(targetInboundTopic))
        .setMessage(messageJson);
      
      const txResponse = await tx.execute(mainClient);
      await txResponse.getReceipt(mainClient);
      return { success: true, method: 'direct' };
    }
  }
  
  throw new Error(`Target agent ${targetAccountId} not found or no inbound topic available`);
}

/**
 * Subscribe to A2A messages on a subject
 */
export function subscribe(subject: string, handler: MessageHandler): void {
  if (!isInitialized) {
    throw new Error('Not initialized. Call init() first.');
  }

  // Register handler for this subject
  // Handlers will be called when messages arrive on any connection topic
  if (!subscriptions.has(subject)) {
    subscriptions.set(subject, []);
  }

  subscriptions.get(subject)!.push(handler);
  
  // Log subscription
  console.log(`[HCS-10] ✅ Subscribed to: ${subject} (${subscriptions.get(subject)!.length} handler(s))`);

  // Ensure all existing connection topics are being monitored
  for (const [connectionKey, connectionTopicId] of connectionTopics.entries()) {
    if (!connectionSubscriptions.has(connectionTopicId)) {
      startConnectionMonitoring(connectionTopicId);
    }
  }
}

/**
 * Close HCS-10 connection
 */
export async function close(): Promise<void> {
  // Clear all polling intervals
  for (const [connectionTopicId, subInfo] of connectionSubscriptions.entries()) {
    if (subInfo.pollInterval) {
      clearInterval(subInfo.pollInterval);
    }
  }
  
  // Clear subscriptions
  subscriptions.clear();
  connectionTopics.clear();
  connectionSubscriptions.clear();
  isInitialized = false;
  console.log('[HCS-10] Connection closed');
}

/**
 * Check if HCS-10 connection is active
 */
export function isConnected(): boolean {
  return isInitialized && hcs10Client !== null;
}

/**
 * Get HCS-10 client instance
 */
export function getClient(): any {
  return hcs10Client;
}

/**
 * Get agent account ID
 */
export function getAgentAccountId(): string | null {
  return agentAccountId;
}

/**
 * Get inbound topic ID
 */
export function getInboundTopicId(): string | null {
  return inboundTopicId;
}

/**
 * Get outbound topic ID
 */
export function getOutboundTopicId(): string | null {
  return outboundTopicId;
}

/**
 * Get connections manager
 */
export function getConnectionsManager(): any {
  return connectionsManager;
}

/**
 * Get connection status
 */
export function getConnectionStatus(): ConnectionStatus {
  return {
    isInitialized,
    agentAccountId,
    inboundTopicId,
    outboundTopicId,
    activeConnections: connectionTopics.size,
    connectionTopics: Array.from(connectionTopics.entries()).map(([key, topicId]) => ({
      key,
      topicId
    })),
    subscriptions: Array.from(subscriptions.keys())
  };
}

// Export getConnection as alias for getClient (for backward compatibility with a2a.ts)
export const getConnection = getClient;

