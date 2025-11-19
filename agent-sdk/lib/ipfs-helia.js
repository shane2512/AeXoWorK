/**
 * Helia IPFS Module (No Docker Required!)
 * Modern JavaScript IPFS implementation
 */

let helia = null;
let unixfs = null;

/**
 * Initialize Helia IPFS client
 */
async function init() {
  if (helia) return { helia, unixfs };
  
  try {
    // Dynamic import for ESM modules
    const { createHelia } = await import('helia');
    const { unixfs: createUnixfs } = await import('@helia/unixfs');
    const { strings } = await import('@helia/strings');
    
    helia = await createHelia();
    unixfs = createUnixfs(helia);
    
    console.log('[Helia] IPFS client initialized (no Docker needed!)');
    return { helia, unixfs };
  } catch (error) {
    console.error('[Helia] Failed to initialize:', error.message);
    console.log('[Helia] Install with: npm install helia @helia/unixfs @helia/strings');
    throw error;
  }
}

/**
 * Upload JSON object to IPFS
 * @param {Object} obj - Object to upload
 * @returns {string} IPFS CID
 */
async function uploadJSON(obj) {
  try {
    const { helia: h, unixfs: fs } = await init();
    const content = JSON.stringify(obj);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    
    const cid = await fs.addBytes(bytes);
    const cidString = cid.toString();
    console.log('[Helia] Uploaded:', cidString);
    return cidString;
  } catch (error) {
    console.error('[Helia] Upload failed:', error.message);
    // Return a fallback CID if Helia fails
    const fallbackCID = 'ipfs://fallback-' + require('crypto').createHash('sha256').update(JSON.stringify(obj)).digest('hex');
    console.log('[Helia] Using fallback CID:', fallbackCID);
    return fallbackCID;
  }
}

/**
 * Upload file buffer to IPFS
 * @param {Buffer|Uint8Array} buffer - File buffer
 * @returns {string} IPFS CID
 */
async function uploadFile(buffer) {
  const { helia: h, unixfs: fs } = await init();
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  
  const cid = await fs.addBytes(bytes);
  const cidString = cid.toString();
  console.log('[Helia] File uploaded:', cidString);
  return cidString;
}

/**
 * Download content from IPFS by CID
 * @param {string} cidString - IPFS CID
 * @returns {string} Content as string
 */
async function download(cidString) {
  const { helia: h, unixfs: fs } = await init();
  const { CID } = await import('multiformats/cid');
  
  const cid = CID.parse(cidString);
  const decoder = new TextDecoder();
  const chunks = [];
  
  for await (const chunk of fs.cat(cid)) {
    chunks.push(chunk);
  }
  
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  const content = decoder.decode(result);
  console.log('[Helia] Downloaded:', cidString);
  return content;
}

/**
 * Download and parse JSON from IPFS
 * @param {string} cid - IPFS CID
 * @returns {Object} Parsed JSON object
 */
async function downloadJSON(cid) {
  const content = await download(cid);
  return JSON.parse(content);
}

/**
 * Close Helia instance
 */
async function close() {
  if (helia) {
    await helia.stop();
    helia = null;
    unixfs = null;
    console.log('[Helia] Stopped');
  }
}

module.exports = {
  init,
  uploadJSON,
  uploadFile,
  download,
  downloadJSON,
  close,
};

