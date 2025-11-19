import { ethers } from 'ethers';

const AGENT_REGISTRY_ABI = [
  "function registerAgent(string calldata did, string calldata metadataCID, uint8 agentType) external returns (uint256)",
  "function agents(uint256) view returns (address owner, string did, string metadataCID, uint8 agentType, uint8 status)",
  "function didToAgent(string) view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string did, string metadataCID, uint8 agentType)"
];

// Agent Registry contract address (from deployed-addresses.json)
// In Vite, use import.meta.env instead of process.env
const AGENT_REGISTRY_ADDRESS = import.meta.env.VITE_AGENT_REGISTRY_ADDRESS || "0xCdB11f8D0Cba2b4e0fa8114Ec660bda8081E7197";

export async function registerAgentOnChain(provider, signer, did, metadataCID, agentType) {
  try {
    const contract = new ethers.Contract(AGENT_REGISTRY_ADDRESS, AGENT_REGISTRY_ABI, signer);
    
    const tx = await contract.registerAgent(did, metadataCID, agentType);
    const receipt = await tx.wait();
    
    // Extract agent ID from event
    const event = receipt.events?.find(e => e.event === 'AgentRegistered');
    const agentId = event ? event.args.agentId.toString() : null;
    
    return {
      success: true,
      agentId,
      txHash: tx.hash,
      receipt
    };
  } catch (error) {
    console.error('Error registering agent on-chain:', error);
    throw error;
  }
}

export async function getAgentInfo(provider, agentId) {
  try {
    const contract = new ethers.Contract(AGENT_REGISTRY_ADDRESS, AGENT_REGISTRY_ABI, provider);
    const agent = await contract.agents(agentId);
    return {
      owner: agent.owner,
      did: agent.did,
      metadataCID: agent.metadataCID,
      agentType: agent.agentType,
      status: agent.status
    };
  } catch (error) {
    console.error('Error fetching agent info:', error);
    throw error;
  }
}

export async function uploadMetadataToIPFS(metadata) {
  try {
    console.log('[IPFS] Uploading metadata to IPFS...', metadata);
    
    // Upload metadata to IPFS via backend API
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    
    console.log('[IPFS] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[IPFS] Upload failed:', errorText);
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[IPFS] Upload successful, CID:', data.cid);
    
    if (!data.cid) {
      throw new Error('No CID returned from IPFS upload');
    }
    
    return data.cid;
  } catch (error) {
    console.error('[IPFS] Error uploading to IPFS:', error);
    console.error('[IPFS] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Fallback: generate a hash-based CID
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(metadata)));
    const fallbackCid = `fallback_${hash.substring(0, 20)}`;
    console.warn('[IPFS] Using fallback CID:', fallbackCid);
    return fallbackCid;
  }
}

