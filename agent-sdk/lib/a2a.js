require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
// This file now uses HCS-10 instead of NATS for backward compatibility
const { init: initHCS10, sendA2A: sendHCS10, subscribe: subscribeHCS10, isConnected: isHCS10Connected, close: closeHCS10, getConnection: getHCS10Client } = require('./hcs10');

let initialized = false;

/**
 * Initialize HCS-10 connection (replaces NATS)
 * @param {string} url - Ignored (kept for backward compatibility)
 * @param {Object} options - Optional agent configuration
 */
async function init(url, options = {}) {
  if (initialized) return;
  
  try {
    // Try to detect agent name from calling file or use provided name
    const agentName = options.agentName || process.env.AGENT_NAME || 'A2A Agent';
    
    await initHCS10({
      network: process.env.HEDERA_NETWORK || 'testnet',
      agentName: agentName,
      agentDescription: options.agentDescription || process.env.AGENT_DESCRIPTION || 'A2A-compliant agent using HCS-10',
      capabilities: options.capabilities,
    });
    initialized = true;
    console.log(`[A2A] ✅ Connected to HCS-10 network (replacing NATS)`);
  } catch (error) {
    console.error(`[A2A] ❌ Failed to connect to HCS-10: ${error.message}`);
    throw error;
  }
}

/**
 * Send A2A message to a subject/topic (maps to HCS-10)
 * @param {string} subject - The subject/topic
 * @param {Object} message - The message object to send
 */
async function sendA2A(subject, message) {
  if (!initialized) {
    await init();
  }
  
  try {
    await sendHCS10(subject, message);
  } catch (error) {
    console.error(`[A2A] Failed to publish to ${subject}:`, error.message);
    throw error;
  }
}

/**
 * Subscribe to A2A messages on a subject (maps to HCS-10)
 * @param {string} subject - The subject/topic
 * @param {Function} handler - Async handler function (message) => {}
 */
function subscribe(subject, handler) {
  if (!initialized) {
    throw new Error('Not connected. Call init() first.');
  }
  
  subscribeHCS10(subject, handler);
}

/**
 * Close HCS-10 connection
 */
async function close() {
  if (initialized) {
    await closeHCS10();
    initialized = false;
    console.log('[A2A] Connection closed');
  }
}

/**
 * Check if HCS-10 connection is active
 */
function isConnected() {
  return initialized && isHCS10Connected();
}

/**
 * Get HCS-10 client (replaces NATS connection object)
 */
function getConnection() {
  return getHCS10Client();
}

// Export for backward compatibility
let nc = null; // Deprecated - use getConnection() instead
let sc = null; // Deprecated - not needed with HCS-10

module.exports = {
  init,
  sendA2A,
  subscribe,
  close,
  isConnected,
  getConnection,
  nc, // Deprecated - kept for backward compatibility
  sc, // Deprecated - kept for backward compatibility
};
