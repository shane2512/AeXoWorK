const NATS = require('nats');

let nc = null;
let sc = null;

/**
 * Initialize NATS connection
 * @param {string} url - NATS server URL
 */
async function init(url) {
  if (nc) return;
  nc = await NATS.connect({ servers: url || process.env.NATS_URL });
  sc = NATS.StringCodec();
  console.log('Connected to NATS server');
}

/**
 * Send A2A message to a subject/topic
 * @param {string} subject - The NATS subject/topic
 * @param {Object} message - The message object to send
 */
async function sendA2A(subject, message) {
  if (!nc) {
    await init();
  }
  
  // Ensure connection is ready
  if (!nc || nc.isClosed()) {
    // Connection might be closing, wait a bit and reinit
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!nc || nc.isClosed()) {
      await init();
    }
  }
  
  try {
    const payload = JSON.stringify(message);
    nc.publish(subject, sc.encode(payload));
    console.log(`[A2A] Published to ${subject}:`, message.type || 'message');
    console.log(`[A2A] Message details:`, { type: message.type, jobId: message.jobId || 'N/A' });
  } catch (error) {
    console.error(`[A2A] Failed to publish to ${subject}:`, error.message);
    throw error;
  }
}

/**
 * Subscribe to A2A messages on a subject
 * @param {string} subject - The NATS subject/topic
 * @param {Function} handler - Async handler function (message) => {}
 */
function subscribe(subject, handler) {
  if (!nc) throw new Error('Not connected. Call init() first.');
  
  const sub = nc.subscribe(subject);
  
  // Start processing messages (don't await - let it run in background)
  (async () => {
    console.log(`[A2A] Subscribed to ${subject}`);
    try {
      for await (const m of sub) {
        try {
          const data = sc.decode(m.data);
          const msg = JSON.parse(data);
          console.log(`[A2A] Received message on ${subject}:`, msg.type || 'message');
          await handler(msg);
        } catch (e) {
          console.error(`[A2A] Handler error on ${subject}:`, e.message);
        }
      }
    } catch (err) {
      console.error(`[A2A] Subscription error on ${subject}:`, err.message);
    }
  })().catch(err => {
    console.error(`[A2A] Subscription setup error on ${subject}:`, err);
  });
  
  return sub;
}

/**
 * Close NATS connection
 */
async function close() {
  if (nc) {
    await nc.close();
    nc = null;
    console.log('[A2A] Connection closed');
  }
}

/**
 * Check if NATS connection is active
 */
function isConnected() {
  try {
    return nc !== null && nc !== undefined && !nc.isClosed();
  } catch (e) {
    return false;
  }
}

/**
 * Get NATS connection object
 */
function getConnection() {
  return nc;
}

module.exports = {
  init,
  sendA2A,
  subscribe,
  close,
  isConnected,
  getConnection,
  nc, // Export for direct access if needed
};

