/**
 * Off-Chain Messaging with HCS Anchoring (using NATS)
 * 
 * Agents exchange data off-chain (NATS) but post hash/timestamp/signature on HCS for verification.
 */

import 'dotenv/config';
import * as crypto from 'crypto';
import { connect, StringCodec, NatsConnection, Subscription } from 'nats';
import axios from 'axios';
import { Client, PrivateKey, AccountId, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';

// NATS connection
let nc: NatsConnection | null = null;
const sc = StringCodec();
const messageStore = new Map<string, any>(); // Store messages temporarily: messageId -> message
const messageVerificationCache = new Map<string, boolean>(); // Cache verified messages: hash -> true
let agentAccountId: string | null = null; // Current agent's account ID
let messageHandler: ((messageId: string, fromAccountId: string) => Promise<void>) | null = null; // Handler for incoming messages

/**
 * Check if a message exists in the store
 */
export function hasMessage(messageId: string): boolean {
  return messageStore.has(messageId);
}

interface StoredMessage {
  encryptedPayload: string;
  hash: string;
  timestamp: number;
  signature: string;
  fromAccountId: string;
  receivedAt: number;
}

interface VerifiedMessage {
  message: any;
  hash: string;
  timestamp: number;
  signature: string;
  fromAccountId: string;
  verified: boolean;
}

/**
 * Initialize NATS connection for off-chain messaging
 */
export async function initMessageServer(accountId: string): Promise<void> {
  if (nc && !nc.isClosed()) {
    agentAccountId = accountId;
    return;
  }

  try {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    // Add timeout and reconnect options
    nc = await connect({ 
      servers: natsUrl,
      timeout: 5000, // 5 second timeout
      reconnect: true,
      maxReconnectAttempts: 5,
      reconnectTimeWait: 2000
    });
    agentAccountId = accountId;
    
    // Subscribe to our agent's off-chain message topic
    const subscriptionTopic = `offchain.${accountId}`;
    const sub = nc.subscribe(subscriptionTopic);
    
    console.log(`[OffChain/NATS] ✅ Connected to NATS server: ${natsUrl}`);
    console.log(`[OffChain/NATS] 📡 Subscribed to: ${subscriptionTopic}`);
    
    // Process incoming messages
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          const { messageId, encryptedPayload, hash, timestamp, signature, fromAccountId } = data;
          
          if (!messageId || !encryptedPayload || !hash || !timestamp || !signature) {
            console.error('[OffChain/NATS] Invalid message format');
            continue;
          }
          
          // Verify hash matches payload
          const payloadHash = crypto.createHash('sha256').update(encryptedPayload).digest('hex');
          if (payloadHash !== hash) {
            console.error('[OffChain/NATS] Hash mismatch for message:', messageId);
            continue;
          }
          
          // Store message temporarily
          messageStore.set(messageId, {
            encryptedPayload,
            hash,
            timestamp,
            signature,
            fromAccountId,
            receivedAt: Date.now()
          } as StoredMessage);
          
          console.log(`[OffChain/NATS] ✅ Stored message ${messageId} in messageStore`);
          
          // If handler is set, call it (async)
          if (messageHandler) {
            console.log(`[OffChain/NATS] 🔔 Calling message handler for ${messageId}`);
            // Call handler asynchronously (don't block message processing)
            messageHandler(messageId, fromAccountId).catch(error => {
              console.error(`[OffChain/NATS] ❌ Error in message handler:`, error);
              console.error(`[OffChain/NATS] Error stack:`, (error as Error).stack);
            });
          } else {
            console.log(`[OffChain/NATS] ⚠️  No message handler set - message will be processed when HCS anchor is detected`);
          }
        } catch (error: any) {
          console.error('[OffChain/NATS] Error processing message:', error.message);
          console.error('[OffChain/NATS] Error stack:', error.stack);
        }
      }
    })().catch(err => {
      console.error('[OffChain/NATS] Subscription error:', err);
    });
    
  } catch (error: any) {
    console.error('[OffChain/NATS] Failed to connect:', error.message);
    throw error;
  }
}

/**
 * Set handler for incoming messages
 */
export function setMessageHandler(handler: (messageId: string, fromAccountId: string) => Promise<void>): void {
  messageHandler = handler;
}

/**
 * Encrypt message payload
 */
export function encryptPayload(payload: string): string {
  // For now, use simple base64 encoding
  // In production, use proper encryption (AES-256-GCM)
  return Buffer.from(payload).toString('base64');
}

/**
 * Decrypt message payload
 */
export function decryptPayload(encryptedPayload: string): string {
  // For now, simple base64 decode
  return Buffer.from(encryptedPayload, 'base64').toString('utf8');
}

/**
 * Sign message
 */
export function signMessage(data: string, privateKey: string): string {
  try {
    const key = PrivateKey.fromStringECDSA(privateKey);
    const signature = key.sign(Buffer.from(data));
    return signature.toString('hex');
  } catch (error) {
    // Fallback to simple hash if signing fails
    return crypto.createHash('sha256').update(data + privateKey).digest('hex');
  }
}

/**
 * Verify signature
 */
export function verifySignature(data: string, signature: string, publicKey: string): boolean {
  try {
    // TODO: Implement proper signature verification
    // For now, return true (assume valid)
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Post HCS anchor (hash, timestamp, signature)
 */
export async function postHCSAnchor(
  topicId: string,
  hash: string,
  timestamp: number,
  signature: string,
  messageId: string,
  fromAccountId: string,
  toAccountId: string | null = null
): Promise<string> {
  const network = process.env.HEDERA_NETWORK || 'testnet';
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  
  const mainAccountId = process.env.HEDERA_ACCOUNT_ID;
  const mainPrivateKey = process.env.HEDERA_PRIVATE_KEY;
  
  if (!mainAccountId || !mainPrivateKey) {
    throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set');
  }

  client.setOperator(
    AccountId.fromString(mainAccountId),
    PrivateKey.fromStringECDSA(mainPrivateKey)
  );

  const anchor = {
    type: 'message_anchor',
    messageId,
    hash,
    timestamp,
    signature,
    fromAccountId,
    toAccountId,
    version: '1.0'
  };

  const anchorJson = JSON.stringify(anchor);
  
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(anchorJson);
  
  const txResponse = await tx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  return txResponse.transactionId.toString();
}

/**
 * Verify HCS anchor exists
 */
export async function verifyHCSAnchor(
  topicId: string,
  hash: string,
  timestamp: number,
  toleranceMs: number = 300000
): Promise<boolean> {
  // Check cache first
  if (messageVerificationCache.has(hash)) {
    return true;
  }

  try {
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const mirrorNodeUrl = network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    // Query mirror node for recent messages (last 100)
    const response = await axios.get(`${mirrorNodeUrl}/api/v1/topics/${topicId}/messages`, {
      params: {
        limit: 100,
        order: 'desc'
      },
      timeout: 10000
    });

    const messages = response.data.messages || [];
    
    // Look for matching anchor
    for (const msg of messages) {
      try {
        const content = Buffer.from(msg.message, 'base64').toString('utf8');
        const anchor = JSON.parse(content);
        
        if (anchor.type === 'message_anchor' && 
            anchor.hash === hash &&
            Math.abs(anchor.timestamp - timestamp) < toleranceMs) {
          // Found matching anchor
          messageVerificationCache.set(hash, true);
          return true;
        }
      } catch (e) {
        // Skip invalid messages
        continue;
      }
    }

    return false;
  } catch (error: any) {
    if (!error.message.includes('429') && !error.message.includes('timeout')) {
      console.error('[OffChain] Error verifying HCS anchor:', error.message);
    }
    return false;
  }
}

/**
 * Send message off-chain via NATS with HCS anchoring
 */
export async function sendOffChainMessage(
  toAccountId: string,
  message: any,
  recipientInboundTopicId: string,
  fromAccountId: string,
  fromPrivateKey: string
): Promise<{ success: boolean; messageId: string; anchorTxId: string; hash: string }> {
  if (!nc || nc.isClosed()) {
    throw new Error('NATS connection not initialized');
  }

  const messageId = crypto.randomBytes(16).toString('hex');
  const messageJson = JSON.stringify(message);
  const timestamp = Date.now();
  
  // Encrypt payload
  const encryptedPayload = encryptPayload(messageJson);
  
  // Calculate hash
  const hash = crypto.createHash('sha256').update(encryptedPayload).digest('hex');
  
  // Sign hash + timestamp
  const signature = signMessage(hash + timestamp, fromPrivateKey);
  
  // Publish to NATS topic: offchain.{toAccountId}
  const natsTopic = `offchain.${toAccountId}`;
  const natsMessage = {
    messageId,
    encryptedPayload,
    hash,
    timestamp,
    signature,
    fromAccountId
  };
  
  try {
    // Send off-chain message via NATS
    nc.publish(natsTopic, sc.encode(JSON.stringify(natsMessage)));
    
    // Post HCS anchor to recipient's inbound topic (so they can verify)
    const anchorTxId = await postHCSAnchor(
      recipientInboundTopicId,
      hash,
      timestamp,
      signature,
      messageId,
      fromAccountId,
      toAccountId
    );

    return {
      success: true,
      messageId,
      anchorTxId,
      hash
    };
  } catch (error: any) {
    console.error('[OffChain/NATS] Error sending message:', error.message);
    throw error;
  }
}

/**
 * Receive and verify off-chain message
 */
export async function receiveAndVerifyMessage(
  messageId: string,
  anchorTopicId: string
): Promise<VerifiedMessage> {
  // Get message from store - wait a bit if not found (NATS message might arrive slightly after HCS anchor)
  let stored = messageStore.get(messageId) as StoredMessage | undefined;
  if (!stored) {
    // Wait up to 2 seconds for NATS message to arrive
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      stored = messageStore.get(messageId) as StoredMessage | undefined;
      if (stored) break;
    }
  }
  
  if (!stored) {
    // Message not in store - might be from another agent or not received via NATS yet
    // Don't throw error, just return null/undefined and let caller handle it
    throw new Error(`Message ${messageId} not found in store (may be from another agent or not received via NATS yet)`);
  }

  const { encryptedPayload, hash, timestamp, signature, fromAccountId } = stored;

  // Verify hash matches payload
  const payloadHash = crypto.createHash('sha256').update(encryptedPayload).digest('hex');
  if (payloadHash !== hash) {
    throw new Error('Payload hash mismatch');
  }

  // Verify HCS anchor exists on-chain
  // Try multiple times with increasing delays (anchor might not be indexed yet)
  let anchorVerified = false;
  const maxRetries = 5;
  const retryDelays = [2000, 3000, 5000, 5000, 5000]; // 2s, 3s, 5s, 5s, 5s
  
  for (let i = 0; i < maxRetries; i++) {
    anchorVerified = await verifyHCSAnchor(anchorTopicId, hash, timestamp);
    if (anchorVerified) {
      console.log(`[OffChain] ✅ HCS anchor verified for message ${messageId} (attempt ${i + 1})`);
      break;
    }
    
    if (i < maxRetries - 1) {
      console.log(`[OffChain] ⏳ HCS anchor not found yet for message ${messageId} (attempt ${i + 1}/${maxRetries}), retrying in ${retryDelays[i]}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
    }
  }
  
  if (!anchorVerified) {
    throw new Error(`HCS anchor verification failed - anchor not found on-chain after ${maxRetries} attempts`);
  }

  // Decrypt payload
  const decrypted = decryptPayload(encryptedPayload);
  const message = JSON.parse(decrypted);

  // Remove from store after successful verification
  messageStore.delete(messageId);

  return {
    message,
    hash,
    timestamp,
    signature,
    fromAccountId,
    verified: true
  };
}

// Cleanup old messages (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [messageId, message] of messageStore.entries()) {
    if ((message as StoredMessage).receivedAt < oneHourAgo) {
      messageStore.delete(messageId);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

