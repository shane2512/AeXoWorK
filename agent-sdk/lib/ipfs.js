let ipfs = null;
let ipfsModule = null;
let isPinata = false;

/**
 * Initialize IPFS client
 * @param {string} url - IPFS API URL (optional)
 */
async function init(url) {
  if (ipfs) return ipfs;
  
  try {
    // Check if using Pinata (check PINATA_API_KEY first)
    if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
      isPinata = true;
      console.log('[IPFS] Using Pinata service (API keys detected)');
      return { isPinata: true }; // Return special marker for Pinata
    }
    
    const ipfsUrl = url || process.env.IPFS_URL || 'http://localhost:5001';
    
    // Check if URL contains pinata
    if (ipfsUrl.includes('pinata.cloud')) {
      isPinata = true;
      console.log('[IPFS] Using Pinata service (URL detected)');
      return { isPinata: true }; // Return special marker for Pinata
    }
    
    // Dynamic import for ESM module
    if (!ipfsModule) {
      ipfsModule = await import('ipfs-http-client');
    }
    
    ipfs = ipfsModule.create({ url: ipfsUrl });
    console.log('[IPFS] Client initialized:', ipfsUrl);
    return ipfs;
  } catch (error) {
    console.warn('[IPFS] Failed to initialize (no IPFS server):', error.message);
    // Return null to indicate IPFS is not available
    return null;
  }
}

/**
 * Upload JSON object to IPFS (supports Pinata and standard IPFS)
 * @param {Object} obj - Object to upload
 * @returns {string} IPFS CID
 */
async function uploadJSON(obj) {
  try {
    const client = await init();
    if (!client) {
      throw new Error('IPFS client not available');
    }
    
    // Handle Pinata upload
    if (client.isPinata || isPinata) {
      return await uploadToPinata(obj);
    }
    
    // Standard IPFS upload
    const content = JSON.stringify(obj);
    const { cid } = await client.add(content);
    const cidString = cid.toString();
    console.log('[IPFS] Uploaded:', cidString);
    return cidString;
  } catch (error) {
    console.warn('[IPFS] Upload failed, using fallback CID:', error.message);
    // Return a fallback CID if IPFS server is not available
    const crypto = require('crypto');
    const fallbackCID = 'ipfs://fallback-' + crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
    console.log('[IPFS] Using fallback CID:', fallbackCID);
    return fallbackCID;
  }
}

/**
 * Upload to Pinata using their API
 * @param {Object} obj - Object to upload
 * @returns {string} IPFS CID
 */
async function uploadToPinata(obj) {
  const axios = require('axios');
  const FormData = require('form-data');
  
  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretKey = process.env.PINATA_SECRET_KEY;
  
  if (!pinataApiKey || !pinataSecretKey) {
    throw new Error('Pinata API key and secret key required in .env');
  }
  
  try {
    const content = JSON.stringify(obj);
    const formData = new FormData();
    formData.append('file', Buffer.from(content), {
      filename: 'data.json',
      contentType: 'application/json'
    });
    
    // Pinata metadata (optional)
    const metadata = JSON.stringify({
      name: 'ReputeFlow Data',
      keyvalues: {
        timestamp: Date.now().toString()
      }
    });
    formData.append('pinataMetadata', metadata);
    
    // Pinata options (optional)
    const options = JSON.stringify({
      cidVersion: 0
    });
    formData.append('pinataOptions', options);
    
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretKey,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    const cid = response.data.IpfsHash;
    console.log('[IPFS/Pinata] Uploaded:', cid);
    return cid;
  } catch (error) {
    console.error('[IPFS/Pinata] Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Upload file buffer to IPFS
 * @param {Buffer} buffer - File buffer
 * @returns {string} IPFS CID
 */
async function uploadFile(buffer) {
  const client = await init();
  const { cid } = await client.add(buffer);
  const cidString = cid.toString();
  console.log('[IPFS] File uploaded:', cidString);
  return cidString;
}

/**
 * Download content from IPFS by CID (supports Pinata gateway)
 * @param {string} cid - IPFS CID
 * @returns {string} Content as string
 */
async function download(cid) {
  try {
    const client = await init();
    
    // Handle Pinata gateway
    if (client?.isPinata || isPinata || process.env.PINATA_GATEWAY_URL) {
      return await downloadFromPinata(cid);
    }
    
    // Standard IPFS download
    if (!client) {
      throw new Error('IPFS client not available');
    }
    
    const chunks = [];
    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString();
    console.log('[IPFS] Downloaded:', cid);
    return content;
  } catch (error) {
    console.error('[IPFS] Download failed:', error.message);
    throw error;
  }
}

/**
 * Download from Pinata gateway
 * @param {string} cid - IPFS CID
 * @returns {string} Content as string
 */
async function downloadFromPinata(cid) {
  const axios = require('axios');
  
  // Use custom gateway if provided, otherwise use public Pinata gateway
  const gatewayUrl = process.env.PINATA_GATEWAY_URL || 
                     process.env.IPFS_URL?.replace('api.pinata.cloud', 'gateway.pinata.cloud') ||
                     'https://gateway.pinata.cloud/ipfs/';
  
  // Clean CID (remove ipfs:// prefix if present)
  const cleanCid = cid.replace('ipfs://', '').replace('/ipfs/', '');
  const url = gatewayUrl.endsWith('/') ? gatewayUrl + cleanCid : gatewayUrl + '/' + cleanCid;
  
  try {
    const response = await axios.get(url, {
      timeout: 10000
    });
    console.log('[IPFS/Pinata] Downloaded:', cid);
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  } catch (error) {
    console.error('[IPFS/Pinata] Download failed:', error.message);
    throw error;
  }
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

module.exports = {
  init,
  uploadJSON,
  uploadFile,
  download,
  downloadJSON,
};

