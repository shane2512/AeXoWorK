import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { signJSON } from '../lib/signer';
import { uploadJSON, downloadJSON } from '../lib/ipfs';
import { sendA2A, subscribe, init as initA2A } from '../lib/a2a';
import { createEscrow, fundEscrow, getContract } from '../lib/hedera';
import { getConnectionStatus } from '../lib/hcs10';

/**
 * ClientAgent - Posts jobs, accepts offers, manages escrow
 */

const app = express();
app.use(express.json());

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Type definitions
interface Job {
  title: string;
  description: string;
  budgetHBAR: string;
  requiredSkills?: string[];
  deadline?: number | null;
  createdAt: number;
  clientDID?: string;
  jobId?: string;
  jobCID?: string;
  status?: string;
  assignedWorker?: string;
  escrowId?: string;
  deliveryCID?: string;
  verificationScore?: number;
  verificationPassed?: boolean;
  deliveryReceivedAt?: number;
  verificationType?: string;
}

interface Offer {
  type: string;
  jobId: string;
  offerId?: string;
  workerAddress?: string;
  price?: string;
  eta?: string;
  sla?: any;
  reputationScore?: number;
  [key: string]: any;
}

interface AgentData {
  owner: string;
  did: string;
  metadataCID: string;
  agentType: number;
  status: number;
}

// Store active jobs and offers
const activeJobs = new Map<string, Job>();
const receivedOffers = new Map<string, Offer[]>();

/**
 * GET /
 * Health check and status
 */
app.get('/', (req: Request, res: Response) => {
  const hcs10Status = getConnectionStatus();
  
  res.json({
    status: 'running',
    agent: 'ClientAgent',
    version: '1.0.0',
    endpoints: {
      'POST /post-job': 'Create a new job posting',
      'GET /jobs': 'List all active jobs',
      'GET /offers/:jobId': 'Get offers for a job',
      'POST /accept-offer': 'Accept a worker offer',
      'POST /approve-work': 'Approve delivered work'
    },
    stats: {
      activeJobs: activeJobs.size,
      totalOffers: Array.from(receivedOffers.values()).reduce((sum, arr) => sum + arr.length, 0)
    },
    contracts: {
      marketplace: process.env.MARKETPLACE_ADDRESS,
      escrowManager: process.env.ESCROW_MANAGER_ADDRESS
    },
    hcs10: hcs10Status
  });
});

/**
 * POST /api/ipfs/upload
 * Upload JSON data to IPFS
 */
app.post('/api/ipfs/upload', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const cid = await uploadJSON(data);
    res.json({ success: true, cid });
  } catch (error: any) {
    console.error('[ClientAgent] Error uploading to IPFS:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agents
 * Get all registered agents from AgentRegistry
 */
app.get('/api/agents', async (req: Request, res: Response) => {
  try {
    const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || "0xCdB11f8D0Cba2b4e0fa8114Ec660bda8081E7197";
    const agentRegistryABI = [
      "function agents(uint256) view returns (address owner, string did, string metadataCID, uint8 agentType, uint8 status)",
      "function nextAgentId() view returns (uint256)"
    ];
    
    const contract = getContract(AGENT_REGISTRY_ADDRESS, agentRegistryABI);
    const nextId = await contract.nextAgentId();
    
    const agents: any[] = [];
    
    // Fetch all agents (from ID 1 to nextId-1)
    for (let i = 1; i < nextId.toNumber(); i++) {
      try {
        const agentData = await contract.agents(i) as AgentData;
        
        // Download metadata from IPFS
        let metadata: any = null;
        if (agentData.metadataCID && !agentData.metadataCID.startsWith('fallback_')) {
          try {
            metadata = await downloadJSON(agentData.metadataCID);
          } catch (ipfsError: any) {
            console.warn(`[ClientAgent] Could not download metadata for agent ${i}:`, ipfsError.message);
          }
        }
        
        agents.push({
          id: i.toString(),
          agentId: i.toString(),
          owner: agentData.owner,
          did: agentData.did,
          metadataCID: agentData.metadataCID,
          agentType: agentData.agentType === 0 ? 'client' : 'worker',
          status: agentData.status,
          name: metadata?.name || 'Unnamed Agent',
          description: metadata?.description || '',
          ...metadata
        });
      } catch (error: any) {
        console.warn(`[ClientAgent] Error fetching agent ${i}:`, error.message);
        // Continue with next agent
      }
    }
    
    res.json({ success: true, agents, count: agents.length });
  } catch (error: any) {
    console.error('[ClientAgent] Error fetching agents:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agents/:agentId
 * Get specific agent details
 */
app.get('/api/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    
    const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || "0xCdB11f8D0Cba2b4e0fa8114Ec660bda8081E7197";
    const agentRegistryABI = [
      "function agents(uint256) view returns (address owner, string did, string metadataCID, uint8 agentType, uint8 status)"
    ];
    
    const contract = getContract(AGENT_REGISTRY_ADDRESS, agentRegistryABI);
    const agentData = await contract.agents(agentId) as AgentData;
    
    // Download metadata from IPFS
    let metadata: any = null;
    if (agentData.metadataCID && !agentData.metadataCID.startsWith('fallback_')) {
      try {
        metadata = await downloadJSON(agentData.metadataCID);
      } catch (ipfsError: any) {
        console.warn(`[ClientAgent] Could not download metadata:`, ipfsError.message);
      }
    }
    
    const agent = {
      id: agentId,
      agentId: agentId,
      owner: agentData.owner,
      did: agentData.did,
      metadataCID: agentData.metadataCID,
      agentType: agentData.agentType === 0 ? 'client' : 'worker',
      status: agentData.status,
      name: metadata?.name || 'Unnamed Agent',
      description: metadata?.description || '',
      ...metadata
    };
    
    res.json({ success: true, agent });
  } catch (error: any) {
    console.error('[ClientAgent] Error fetching agent:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /post-job (also handle /api/client/post-job for frontend proxy)
 * Create a new job posting
 */
app.post(['/post-job', '/api/client/post-job'], async (req: Request, res: Response) => {
  try {
    const { title, description, budgetHBAR, requiredSkills, deadline } = req.body;
    
    if (!title || !description || !budgetHBAR) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create job object
    const job: Job = {
      title,
      description,
      budgetHBAR,
      requiredSkills: requiredSkills || [],
      deadline: deadline || null,
      createdAt: Date.now(),
      clientDID: process.env.AGENT_DID,
    };
    
    // Upload to IPFS (handle errors gracefully)
    let jobCID: string;
    try {
      jobCID = await uploadJSON(job);
    } catch (ipfsError: any) {
      console.warn('[ClientAgent] IPFS upload failed, using fallback CID:', ipfsError.message);
      // Use a fallback CID if IPFS fails
      jobCID = 'ipfs://fallback-' + ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(job)));
    }
    
    // Generate job ID
    const jobId = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(jobCID + Date.now())
    );
    
    // Store locally
    activeJobs.set(jobId, {
      ...job,
      jobId,
      jobCID,
      status: 'open',
    });
    
    // Optional: Post to marketplace contract (handle errors gracefully)
    if (process.env.MARKETPLACE_ADDRESS) {
      try {
        const marketplaceAbi = [
          'function postJob(bytes32 jobId, string calldata jobCID, uint256 budget) external',
        ];
        const marketplace = getContract(process.env.MARKETPLACE_ADDRESS, marketplaceAbi);
        const tx = await marketplace.postJob(jobId, jobCID, budgetHBAR);
        await tx.wait();
      } catch (contractError: any) {
        console.warn('[ClientAgent] Marketplace contract post failed:', contractError.message);
        // Continue without on-chain posting
      }
    }
    
    // Broadcast via A2A (JobOfferRequest per user flow spec)
    const message: any = {
      type: 'JobOfferRequest', // Updated to match user flow specification
      jobId,
      jobCID,
      title: job.title,
      description: job.description,
      budgetHBAR,
      requiredSkills: job.requiredSkills,
      deadline: job.deadline,
      verificationType: job.verificationType || 'auto', // AI verify, human verify, double-check agent
      fromDid: process.env.AGENT_DID || 'did:hedera:testnet:client',
      clientAddress: process.env.CLIENT_ADDRESS || ethers.Wallet.createRandom().address,
      timestamp: Date.now(),
    };
    
    // Sign message if private key is available (optional for testing)
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        message.signature = signJSON(message, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError: any) {
      console.warn('[ClientAgent] Could not sign message:', signError.message);
    }
    
    // Ensure A2A is initialized before sending
    // sendA2A will handle initialization if needed, but we can check here too
    try {
      // JobOfferRequest is broadcast to all WorkerAgents (they subscribe to aexowork.jobs)
      // No 'to' field needed - WorkerAgents will filter by subscription
      console.log(`[ClientAgent] Broadcasting JobOfferRequest via A2A to WorkerAgents (aexowork.jobs)...`);
      console.log(`[ClientAgent] Message:`, { type: message.type, jobId, requiredSkills: message.requiredSkills });
      await sendA2A('aexowork.jobs', message);
      console.log(`[ClientAgent] ✅ JobOfferRequest broadcasted to WorkerAgents: ${jobId}`);
    } catch (a2aError: any) {
      console.error('[ClientAgent] A2A send error:', a2aError.message);
      // Continue anyway - job is still posted locally
      console.log(`[ClientAgent] Job posted locally (A2A failed): ${jobId}`);
    }
    
    res.json({
      ok: true,
      jobId,
      jobCID,
      message: 'Job posted successfully',
    });
  } catch (error: any) {
    console.error('[ClientAgent] Error posting job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /jobs
 * List all active jobs
 */
app.get('/jobs', (req: Request, res: Response) => {
  const jobs = Array.from(activeJobs.values());
  res.json({ count: jobs.length, jobs });
});

/**
 * GET /offers/:jobId
 * Get offers for a specific job
 */
app.get('/offers/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const offers = receivedOffers.get(jobId) || [];
  res.json({ jobId, count: offers.length, offers });
});

/**
 * POST /accept-offer
 * Accept a worker's offer and create escrow
 */
app.post('/accept-offer', async (req: Request, res: Response) => {
  try {
    const { jobId, offerId, workerAddress } = req.body;
    
    if (!jobId || !offerId || !workerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const job = activeJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // STEP 4: Auto-Setup Escrow - ClientAgent creates and funds escrow directly
    // Generate escrow ID
    const escrowId = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(jobId + offerId + Date.now())
    );
    
    // Create and fund escrow on-chain using ClientAgent's wallet
    let escrowCreated = false;
    let actualEscrowId = escrowId; // Use generated ID as default
    let createTx: ethers.ContractTransaction | undefined;
    let fundTx: ethers.ContractTransaction | undefined;
    const account = process.env.CLIENT_ADDRESS || process.env.HEDERA_ACCOUNT_ID || 'unknown';
    
    try {
      if (process.env.ESCROW_MANAGER_ADDRESS) {
        const amountWei = ethers.BigNumber.from(job.budgetHBAR); // Already in wei format
        const escrowAbi = [
          'function createEscrow(bytes32 escrowId, address payable freelancer)',
          'function fundEscrow(bytes32 escrowId) payable',
          'event EscrowCreated(bytes32 indexed escrowId, address indexed client, address indexed freelancer, uint256 amount)',
          'event EscrowFunded(bytes32 indexed escrowId, uint256 amount)',
        ];
        const escrowManager = getContract(process.env.ESCROW_MANAGER_ADDRESS, escrowAbi);
        
        console.log(`[ClientAgent] Creating escrow ${escrowId}...`);
        
        // Step 1: Create escrow
        createTx = await escrowManager.createEscrow(escrowId, workerAddress, {
          gasLimit: 200000
        }) as ethers.ContractTransaction;
        const createReceipt = await createTx.wait();
        console.log(`[ClientAgent] Escrow created, funding with ${ethers.utils.formatEther(amountWei)} HBAR...`);
        
        // Step 2: Fund escrow
        fundTx = await escrowManager.fundEscrow(escrowId, {
          value: amountWei,
          gasLimit: 200000
        }) as ethers.ContractTransaction;
        const fundReceipt = await fundTx.wait();
        
        // Check for funding event
        const fundedEvent = fundReceipt.events?.find((e: any) => e.event === 'EscrowFunded');
        if (fundedEvent) {
          console.log(`[ClientAgent] ✅ Escrow created and funded: ${escrowId}`);
          console.log(`[ClientAgent] 📝 Create Transaction: ${createTx.hash}`);
          console.log(`[ClientAgent] 💰 Fund Transaction: ${fundTx.hash}`);
          console.log(`[ClientAgent] 🔗 View on HashScan: https://hashscan.io/testnet/transaction/${fundTx.hash}`);
          escrowCreated = true;
          actualEscrowId = escrowId; // Use the ID we generated
        } else {
          console.warn('[ClientAgent] Escrow funded but no event found');
          console.log(`[ClientAgent] 📝 Create Transaction: ${createTx.hash}`);
          console.log(`[ClientAgent] 💰 Fund Transaction: ${fundTx.hash}`);
          console.log(`[ClientAgent] 🔗 View on HashScan: https://hashscan.io/testnet/transaction/${fundTx.hash}`);
          escrowCreated = true;
        }
        
        // Notify EscrowAgent via A2A for tracking (target EscrowAgent only)
        const amountHBAR = parseFloat(job.budgetHBAR) / 1e18;
        const escrowNotification: any = {
          type: 'escrow.created',
          escrowId: actualEscrowId.toString(),
          jobId,
          client: account,
          worker: workerAddress,
          amount: amountHBAR.toFixed(18), // Use fixed decimal format, not scientific notation
          autoRelease: true,
          onChainTx: fundTx.hash,
          createTxHash: createTx.hash,
          fundTxHash: fundTx.hash,
          timestamp: Date.now(),
          to: process.env.ESCROW_AGENT_ACCOUNT_ID, // Target EscrowAgent only
        };
        try {
          if (process.env.AGENT_PRIVATE_KEY_BASE64) {
            escrowNotification.signature = signJSON(escrowNotification, process.env.AGENT_PRIVATE_KEY_BASE64);
          }
        } catch (signError: any) {
          console.warn('[ClientAgent] Could not sign escrow notification:', signError.message);
        }
        await sendA2A('aexowork.escrow.created', escrowNotification);
        console.log(`[ClientAgent] 📤 Escrow notification sent to EscrowAgent (${process.env.ESCROW_AGENT_ACCOUNT_ID || 'broadcast'})`);
      } else {
        console.warn('[ClientAgent] ESCROW_MANAGER_ADDRESS not set, skipping on-chain escrow');
      }
    } catch (escrowError: any) {
      console.error('[ClientAgent] Error creating/funding escrow:', escrowError.message);
      // Continue with off-chain escrow ID for A2A messaging
    }
    
    // Update job status
    job.status = 'assigned';
    job.assignedWorker = workerAddress;
    job.escrowId = actualEscrowId.toString(); // Use actual escrow ID
    activeJobs.set(jobId, job);
    
    // Notify worker via A2A (target WorkerAgent only)
    const message: any = {
      type: 'OfferAccepted',
      jobId,
      offerId,
      escrowId: actualEscrowId.toString(), // Use actual escrow ID
      fromDid: process.env.AGENT_DID,
      timestamp: Date.now(),
      to: process.env.WORKER_AGENT_ACCOUNT_ID, // Target WorkerAgent only
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        message.signature = signJSON(message, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError: any) {
      console.warn('[ClientAgent] Could not sign message:', signError.message);
    }
    await sendA2A('aexowork.offers.accepted', message);
    console.log(`[ClientAgent] 📤 OfferAccepted sent to WorkerAgent (${process.env.WORKER_AGENT_ACCOUNT_ID || 'broadcast'})`);
    
    console.log(`[ClientAgent] Offer accepted for job ${jobId}, escrow ${escrowId}`);
    
    res.json({
      ok: true,
      escrowId: actualEscrowId.toString(),
      message: escrowCreated ? 'Offer accepted, escrow created and funded' : 'Offer accepted, escrow created (funding pending)',
      escrowCreated,
      createTxHash: escrowCreated && process.env.ESCROW_MANAGER_ADDRESS && createTx ? createTx.hash : null,
      fundTxHash: escrowCreated && process.env.ESCROW_MANAGER_ADDRESS && fundTx ? fundTx.hash : null,
      hashScanUrl: escrowCreated && process.env.ESCROW_MANAGER_ADDRESS && fundTx ? `https://hashscan.io/testnet/transaction/${fundTx.hash}` : null,
    });
  } catch (error: any) {
    console.error('[ClientAgent] Error accepting offer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /approve-work
 * Approve delivered work and release escrow
 */
app.post('/approve-work', async (req: Request, res: Response) => {
  try {
    const { escrowId, workerAddress: providedWorkerAddress } = req.body;
    
    if (!escrowId) {
      return res.status(400).json({ error: 'Missing escrowId' });
    }
    
    // Find job by escrowId to get worker address
    const job = Array.from(activeJobs.values()).find(j => j.escrowId === escrowId || j.escrowId === escrowId.toString());
    const workerAddress = providedWorkerAddress || job?.assignedWorker || 'unknown';
    
    if (workerAddress === 'unknown') {
      console.warn(`[ClientAgent] ⚠️  Worker address not found for escrow ${escrowId}, using 'unknown'`);
    }
    
    // Approve work on-chain
    const abi = ['function approveWork(bytes32 escrowId)'];
    const escrowManager = getContract(process.env.ESCROW_MANAGER_ADDRESS!, abi);
    const tx = await escrowManager.approveWork(escrowId);
    const receipt = await tx.wait();
    
    console.log(`[ClientAgent] ✅ Work approved on-chain, transaction: ${tx.hash}`);
    
    const account = process.env.CLIENT_ADDRESS || process.env.HEDERA_ACCOUNT_ID || 'unknown';
    
    // Notify EscrowAgent about fund release via A2A
    const escrowReleaseNotification: any = {
      type: 'escrow.released',
      escrowId: escrowId.toString(),
      worker: workerAddress,
      client: process.env.CLIENT_ADDRESS || account, // Use Ethereum address
      txHash: tx.hash,
      timestamp: Date.now(),
      to: process.env.ESCROW_AGENT_ACCOUNT_ID, // Target EscrowAgent only
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        escrowReleaseNotification.signature = signJSON(escrowReleaseNotification, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError: any) {
      console.warn('[ClientAgent] Could not sign escrow release notification:', signError.message);
    }
    await sendA2A('aexowork.escrow.released', escrowReleaseNotification);
    console.log(`[ClientAgent] 📤 Notified EscrowAgent (${process.env.ESCROW_AGENT_ACCOUNT_ID || 'broadcast'}) about fund release for escrow ${escrowId}`);
    
    // STEP 9: Auto-Update Reputation via ReputeAgent (A2A Protocol)
    // ClientAgent automatically triggers ReputeAgent to update reputation scores
    const reputationUpdate: any = {
      type: 'reputation.update',
      event: 'job_completed',
      escrowId: escrowId.toString(),
      client: process.env.CLIENT_ADDRESS || account, // Use Ethereum address, not DID
      worker: workerAddress,
      scores: {
        worker: 5, // +5 for successful delivery
        client: 3, // +3 for fair dealing
        verification: job?.verificationPassed ? 1 : 0 // +1 for correct validation (if verification passed)
      },
      timestamp: Date.now(),
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        reputationUpdate.signature = signJSON(reputationUpdate, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError: any) {
      console.warn('[ClientAgent] Could not sign reputation update:', signError.message);
    }
    
    // Send reputation update to ReputeAgent via A2A (target ReputeAgent only)
    reputationUpdate.to = process.env.REPUTE_AGENT_ACCOUNT_ID; // Target ReputeAgent only
    
    console.log(`[ClientAgent] 📤 Sending reputation update to ReputeAgent...`);
    console.log(`[ClientAgent]    Target: ${process.env.REPUTE_AGENT_ACCOUNT_ID || 'broadcast'}`);
    console.log(`[ClientAgent]    Worker: ${workerAddress}`);
    console.log(`[ClientAgent]    Client: ${reputationUpdate.client}`);
    console.log(`[ClientAgent]    Scores: worker=${reputationUpdate.scores.worker}, client=${reputationUpdate.scores.client}, verification=${reputationUpdate.scores.verification}`);
    console.log(`[ClientAgent]    Full message:`, JSON.stringify(reputationUpdate, null, 2));
    
    try {
      const result = await sendA2A('aexowork.reputation.updates', reputationUpdate);
      console.log(`[ClientAgent] ✅ Reputation update sent successfully! Result:`, result);
    } catch (a2aError: any) {
      console.error(`[ClientAgent] ❌ Failed to send reputation update:`, a2aError.message);
      console.error(`[ClientAgent]    Stack:`, a2aError.stack);
    }
    
    console.log(`[ClientAgent] ✅ Work approved for escrow ${escrowId}, payment released, reputation updated`);
    
    res.json({
      ok: true,
      message: 'Work approved, payment released, reputation updated',
    });
  } catch (error: any) {
    console.error('[ClientAgent] Error approving work:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Initialize ClientAgent
 */
export async function init(): Promise<void> {
  try {
    // Connect to A2A message bus FIRST (now uses HCS-10)
    console.log('[ClientAgent] Initializing HCS-10 connection...');
    await initA2A(undefined, { agentName: 'ClientAgent' });
    console.log('[ClientAgent] HCS-10 connection established');
    
    // Subscribe to offers (OfferMessage messages)
    subscribe('aexowork.offers', async (msg: any) => {
      console.log('[ClientAgent] ✅ Subscribed to aexowork.offers for OfferMessage messages');
      // Support both old 'Offer' and new 'OfferMessage' types for backward compatibility
      if (msg.type === 'Offer' || msg.type === 'OfferMessage') {
        console.log(`[ClientAgent] 📨 Received offer for job ${msg.jobId}`);
        
        if (!receivedOffers.has(msg.jobId)) {
          receivedOffers.set(msg.jobId, []);
        }
        receivedOffers.get(msg.jobId)!.push(msg);
        console.log(`[ClientAgent] ✅ Offer stored for job ${msg.jobId} (total: ${receivedOffers.get(msg.jobId)!.length})`);
      }
    });
    
    // Subscribe to verified deliveries from VerificationAgent (per user flow spec)
    subscribe('aexowork.deliveries', async (msg: any) => {
      if (msg.type === 'DeliveryReceipt') {
        console.log(`[ClientAgent] 📨 Received verified delivery from VerificationAgent for escrow ${msg.escrowId}`);
        console.log(`[ClientAgent]    Verification Score: ${msg.verificationScore || 'N/A'}`);
        console.log(`[ClientAgent]    Verification Passed: ${msg.verificationPassed || 'N/A'}`);
        console.log(`[ClientAgent]    Delivery CID: ${msg.deliveryCID}`);
        
        // Store delivery for client review
        const job = Array.from(activeJobs.values()).find(j => j.jobId === msg.jobId);
        if (job) {
          job.deliveryCID = msg.deliveryCID;
          job.verificationScore = msg.verificationScore;
          job.verificationPassed = msg.verificationPassed;
          job.deliveryReceivedAt = Date.now();
          activeJobs.set(msg.jobId, job);
          console.log(`[ClientAgent] ✅ Delivery stored for job ${msg.jobId}, ready for client approval`);
        }
      }
    });
    
    // Start HTTP server
    const port = process.env.CLIENT_AGENT_PORT || 3001;
    app.listen(port, () => {
      console.log(`[ClientAgent] Running on port ${port}`);
      console.log(`[ClientAgent] Ready to post jobs and send A2A messages`);
    });
  } catch (error: any) {
    console.error('[ClientAgent] Initialization error:', error);
    throw error;
  }
}

// Start if run directly
if (require.main === module) {
  init().catch(console.error);
}

export { app };

