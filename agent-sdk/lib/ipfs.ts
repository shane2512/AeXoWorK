import * as crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';

let ipfs: any = null;
let ipfsModule: any = null;
let isPinata = false;

interface PinataClient {
  isPinata: boolean;
}

/**
 * Initialize IPFS client
 */
export async function init(url?: string): Promise<any> {
  if (ipfs) return ipfs;
  
  try {
    // Check if using Pinata (check PINATA_API_KEY first)
    if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
      isPinata = true;
      console.log('[IPFS] Using Pinata service (API keys detected)');
      return { isPinata: true } as PinataClient;
    }
    
    const ipfsUrl = url || process.env.IPFS_URL || 'http://localhost:5001';
    
    // Check if URL contains pinata
    if (ipfsUrl.includes('pinata.cloud')) {
      isPinata = true;
      console.log('[IPFS] Using Pinata service (URL detected)');
      return { isPinata: true } as PinataClient;
    }
    
    // Dynamic import for ESM module
    if (!ipfsModule) {
      ipfsModule = await import('ipfs-http-client');
    }
    
    ipfs = ipfsModule.create({ url: ipfsUrl });
    console.log('[IPFS] Client initialized:', ipfsUrl);
    return ipfs;
  } catch (error: any) {
    console.warn('[IPFS] Failed to initialize (no IPFS server):', error.message);
    return null;
  }
}

/**
 * Upload to Pinata using their API
 */
async function uploadToPinata(obj: any): Promise<string> {
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
  } catch (error: any) {
    console.error('[IPFS/Pinata] Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Upload JSON object to IPFS (supports Pinata and standard IPFS)
 */
export async function uploadJSON(obj: any): Promise<string> {
  try {
    const client = await init();
    if (!client) {
      throw new Error('IPFS client not available');
    }
    
    // Handle Pinata upload
    if ((client as PinataClient).isPinata || isPinata) {
      return await uploadToPinata(obj);
    }
    
    // Standard IPFS upload
    const content = JSON.stringify(obj);
    const { cid } = await client.add(content);
    const cidString = cid.toString();
    console.log('[IPFS] Uploaded:', cidString);
    return cidString;
  } catch (error: any) {
    console.warn('[IPFS] Upload failed, using fallback CID:', error.message);
    // Return a fallback CID if IPFS server is not available
    const fallbackCID = 'ipfs://fallback-' + crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
    console.log('[IPFS] Using fallback CID:', fallbackCID);
    return fallbackCID;
  }
}

/**
 * Upload file buffer to IPFS
 */
export async function uploadFile(buffer: Buffer): Promise<string> {
  const client = await init();
  const { cid } = await client.add(buffer);
  const cidString = cid.toString();
  console.log('[IPFS] File uploaded:', cidString);
  return cidString;
}

/**
 * Download from Pinata gateway
 */
async function downloadFromPinata(cid: string): Promise<string> {
  // Use custom gateway if provided, otherwise use public Pinata gateway
  const gatewayUrl = process.env.PINATA_GATEWAY_URL || 
                     (process.env.IPFS_URL?.replace('api.pinata.cloud', 'gateway.pinata.cloud')) ||
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
  } catch (error: any) {
    console.error('[IPFS/Pinata] Download failed:', error.message);
    throw error;
  }
}

/**
 * Download content from IPFS by CID (supports Pinata gateway)
 */
export async function download(cid: string): Promise<string> {
  try {
    const client = await init();
    
    // Handle Pinata gateway
    if ((client as PinataClient)?.isPinata || isPinata || process.env.PINATA_GATEWAY_URL) {
      return await downloadFromPinata(cid);
    }
    
    // Standard IPFS download
    if (!client) {
      throw new Error('IPFS client not available');
    }
    
    const chunks: Buffer[] = [];
    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString();
    console.log('[IPFS] Downloaded:', cid);
    return content;
  } catch (error: any) {
    console.error('[IPFS] Download failed:', error.message);
    throw error;
  }
}

/**
 * Download and parse JSON from IPFS
 */
export async function downloadJSON(cid: string): Promise<any> {
  const content = await download(cid);
  return JSON.parse(content);
}


