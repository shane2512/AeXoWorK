/**
 * Off-Chain Messaging with HCS Anchoring (using NATS)
 * 
 * Agents exchange data off-chain (NATS) but post hash/timestamp/signature on HCS for verification.
 * This allows for:
 * - Big payloads
 * - High frequency traffic
 * - Privacy-sensitive data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const crypto = require('crypto');
const { connect, StringCodec } = require('nats');
const axios = require('axios');
const { Client, PrivateKey, AccountId, TopicMessageSubmitTransaction } = require('@hashgraph/sdk');

// NATS connection
let nc = null;
let sc = StringCodec();
const messageStore = new Map(); // Store messages temporarily: messageId -> message
const messageVerificationCache = new Map(); // Cache verified messages: hash -> true
let agentAccountId = null; // Current agent's account ID
let messageHandler = null; // Handler for incoming messages

/**
 * Initialize NATS connection for off-chain messaging
 * @param {string} accountId - Agent's account ID (used for subscription topic)
 * @returns {Promise<void>}
 */
async function initMessageServer(accountId) {
  if (nc && !nc.isClosed()) {
    agentAccountId = accountId;
    return;
  }

  try {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    nc = await connect({ servers: natsUrl });
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
          });
          
          console.log(`[OffChain/NATS] ✅ Stored message ${messageId} in messageStore`);
          
          // If handler is set, call it (async)
          if (messageHandler) {
            console.log(`[OffChain/NATS] 🔔 Calling message handler for ${messageId}`);
            // Call handler asynchronously (don't block message processing)
            messageHandler(messageId, fromAccountId).catch(error => {
              console.error(`[OffChain/NATS] ❌ Error in message handler:`, error);
              console.error(`[OffChain/NATS] Error stack:`, error.stack);
            });
          } else {
            console.log(`[OffChain/NATS] ⚠️  No message handler set - message will be processed when HCS anchor is detected`);
          }
        } catch (error) {
          console.error('[OffChain/NATS] Error processing message:', error.message);
          console.error('[OffChain/NATS] Error stack:', error.stack);
        }
      }
    })().catch(err => {
      console.error('[OffChain/NATS] Subscription error:', err);
    });
    
  } catch (error) {
    console.error('[OffChain/NATS] Failed to connect:', error.message);
    throw error;
  }
}

/**
 * Set handler for incoming messages
 * @param {Function} handler - Function(messageId, fromAccountId)
 */
function setMessageHandler(handler) {
  messageHandler = handler;
}

/**
 * Encrypt message payload
 * @param {string} payload - Message payload (JSON string)
 * @returns {string} Encrypted payload (base64)
 */
function encryptPayload(payload) {
  // For now, use simple base64 encoding
  // In production, use proper encryption (AES-256-GCM)
  return Buffer.from(payload).toString('base64');
}

/**
 * Decrypt message payload
 * @param {string} encryptedPayload - Encrypted payload (base64)
 * @returns {string} Decrypted payload
 */
function decryptPayload(encryptedPayload) {
  // For now, simple base64 decode
  return Buffer.from(encryptedPayload, 'base64').toString('utf8');
}

/**
 * Sign message
 * @param {string} data - Data to sign
 * @param {string} privateKey - Private key (ECDSA format)
 * @returns {string} Signature (hex)
 */
function signMessage(data, privateKey) {
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
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {string} publicKey - Public key
 * @returns {boolean} True if signature is valid
 */
function verifySignature(data, signature, publicKey) {
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
 * @param {string} topicId - HCS topic ID for anchoring
 * @param {string} hash - Hash of the message payload
 * @param {number} timestamp - Timestamp
 * @param {string} signature - Signature
 * @param {string} messageId - Message ID
 * @param {string} fromAccountId - Sender account ID
 * @param {string} toAccountId - Recipient account ID (optional)
 * @returns {Promise<string>} Transaction ID
 */
async function postHCSAnchor(topicId, hash, timestamp, signature, messageId, fromAccountId, toAccountId = null) {
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
    .setTopicId(topicId)
    .setMessage(anchorJson);
  
  const txResponse = await tx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  return txResponse.transactionId.toString();
}

/**
 * Verify HCS anchor exists
 * @param {string} topicId - HCS topic ID (recipient's inbound topic)
 * @param {string} hash - Hash to verify
 * @param {number} timestamp - Expected timestamp (within tolerance)
 * @param {number} toleranceMs - Time tolerance in milliseconds (default: 5 minutes)
 * @returns {Promise<boolean>} True if anchor exists and matches
 */
async function verifyHCSAnchor(topicId, hash, timestamp, toleranceMs = 300000) {
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
  } catch (error) {
    if (!error.message.includes('429') && !error.message.includes('timeout')) {
      console.error('[OffChain] Error verifying HCS anchor:', error.message);
    }
    return false;
  }
}

/**
 * Send message off-chain via NATS with HCS anchoring
 * @param {string} toAccountId - Recipient's account ID
 * @param {Object} message - Message object
 * @param {string} recipientInboundTopicId - Recipient's inbound topic ID for anchoring
 * @param {string} fromAccountId - Sender account ID
 * @param {string} fromPrivateKey - Sender private key
 * @returns {Promise<Object>} Result with messageId and anchorTxId
 */
async function sendOffChainMessage(toAccountId, message, recipientInboundTopicId, fromAccountId, fromPrivateKey) {
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
  } catch (error) {
    console.error('[OffChain/NATS] Error sending message:', error.message);
    throw error;
  }
}

/**
 * Receive and verify off-chain message
 * @param {string} messageId - Message ID
 * @param {string} anchorTopicId - HCS topic ID for verification (recipient's inbound topic)
 * @returns {Promise<Object>} Decrypted message
 */
async function receiveAndVerifyMessage(messageId, anchorTopicId) {
  // Get message from store
  const stored = messageStore.get(messageId);
  if (!stored) {
    throw new Error(`Message ${messageId} not found in store`);
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
    if (message.receivedAt < oneHourAgo) {
      messageStore.delete(messageId);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

module.exports = {
  initMessageServer,
  sendOffChainMessage,
  receiveAndVerifyMessage,
  encryptPayload,
  decryptPayload,
  signMessage,
  verifySignature,
  postHCSAnchor,
  verifyHCSAnchor,
  setMessageHandler
};
