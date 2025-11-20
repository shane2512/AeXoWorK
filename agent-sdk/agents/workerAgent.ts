import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { signJSON } from '../lib/signer';
import { uploadJSON } from '../lib/ipfs';
import { sendA2A, subscribe, init as initA2A } from '../lib/a2a';
import { getContract, initEVM } from '../lib/hedera';
import axios from 'axios';

/**
 * WorkerAgent - Discovers jobs, makes offers, delivers work
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
  jobId: string;
  jobCID?: string;
  title?: string;
  description?: string;
  budgetHBAR?: string;
  requiredSkills?: string[];
  deadline?: number | null;
  clientAddress?: string;
  [key: string]: any;
}

interface Work {
  jobId: string;
  job: Job;
  escrowId: string;
  status: string;
  startedAt: number;
  deliveryCID?: string;
}

// Store available jobs and accepted work
const availableJobs = new Map<string, Job>();
const acceptedWork = new Map<string, Work>();

/**
 * GET /
 * Health check and status
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    agent: 'WorkerAgent',
    version: '1.0.0',
    endpoints: {
      'GET /work': 'List accepted work',
      'GET /available-jobs': 'List available jobs'
    },
    stats: {
      availableJobs: availableJobs.size,
      acceptedWork: acceptedWork.size,
      skills: process.env.AGENT_SKILLS || 'writing,design,coding,UIUX,Figma,Framer,React,SQL'
    },
    contracts: {
      escrowManager: process.env.ESCROW_MANAGER_ADDRESS
    }
  });
});

/**
 * Evaluate if we should bid on a job
 */
function shouldBidOnJob(job: Job): boolean {
  // Simple logic: check if we have required skills
  const mySkills = (process.env.AGENT_SKILLS || 'writing,design,coding,UIUX,Figma,Framer,React,SQL').split(',');
  
  if (!job.requiredSkills || job.requiredSkills.length === 0) {
    return true; // No specific requirements
  }
  
  // Check if we have at least one required skill
  return job.requiredSkills.some((skill) =>
    mySkills.some((mySkill) =>
      mySkill.toLowerCase().includes(skill.toLowerCase())
    )
  );
}

/**
 * Handle incoming job postings (JobOfferRequest per user flow spec)
 */
async function handleJobPost(msg: any): Promise<void> {
  // Support both old 'JobPost' and new 'JobOfferRequest' types for backward compatibility
  if (msg.type !== 'JobPost' && msg.type !== 'JobOfferRequest') return;
  
  console.log(`[WorkerAgent] New job discovered: ${msg.jobId}`);
  
  // Store job
  availableJobs.set(msg.jobId, msg);
  
  // Evaluate if we should bid
  if (!shouldBidOnJob(msg)) {
    console.log(`[WorkerAgent] Skipping job ${msg.jobId} - no matching skills`);
    return;
  }
  
  // STEP 10 (OPTIONAL): Check if data marketplace access is needed
  // WorkerAgent can automatically purchase datasets/models/APIs if needed
  let dataAccess = null;
  if (msg.requiredSkills && msg.requiredSkills.some((skill: string) => ['data', 'dataset', 'api', 'model'].includes(skill.toLowerCase()))) {
    // Request data from DataAgent via A2A
    const dataRequest: any = {
      type: 'data.request',
      jobId: msg.jobId,
      requiredData: msg.requiredSkills.filter((s: string) => ['data', 'dataset', 'api'].includes(s.toLowerCase())),
      budget: parseFloat(msg.budgetHBAR) / 1e18 * 0.1, // 10% of job budget for data
      timestamp: Date.now(),
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        dataRequest.signature = signJSON(dataRequest, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError: any) {
      console.warn('[WorkerAgent] Could not sign data request:', signError.message);
    }
    
    // Send data request to DataAgent only (async - will be handled separately)
    dataRequest.to = process.env.DATA_AGENT_ACCOUNT_ID; // Target DataAgent only
    sendA2A('aexowork.data.requests', dataRequest).catch((err: any) => {
      console.log(`[WorkerAgent] Data request failed (optional): ${err.message}`);
    });
    
    dataAccess = 'requested';
  }
  
  // Create offer (OfferMessage per user flow spec)
  const offer: any = {
    type: 'OfferMessage', // Updated to match user flow specification
    offerId: 'offer-' + Date.now(),
    jobId: msg.jobId,
    price: msg.budgetHBAR, // Price in HBAR
    priceHBAR: msg.budgetHBAR, // Keep for backward compatibility
    eta: '48h',
    sla: {
      deliveryTime: 48 * 60 * 60 * 1000, // 48 hours in ms
      qualityGuarantee: true,
      revisionPolicy: '2 free revisions'
    },
    proposedDeadline: Date.now() + 48 * 60 * 60 * 1000,
    reputationScore: 85, // TODO: Get from ReputeAgent
    bundledServices: [], // Optional: e.g., ['plagiarism_check', 'ai_verification']
    fromDid: process.env.AGENT_DID,
    workerAddress: process.env.WORKER_ADDRESS || ethers.Wallet.createRandom().address,
    agentName: 'WorkerAgent',
    pastJobs: 0, // TODO: Get from ReputeAgent
    timestamp: Date.now(),
    to: msg.fromAccountId || process.env.CLIENT_AGENT_ACCOUNT_ID, // Target the ClientAgent that posted the job
  };
  
  try {
    if (process.env.AGENT_PRIVATE_KEY_BASE64) {
      offer.signature = signJSON(offer, process.env.AGENT_PRIVATE_KEY_BASE64);
    }
  } catch (signError: any) {
    console.warn('[WorkerAgent] Could not sign offer:', signError.message);
  }
  
  // Send offer to ClientAgent only
  await sendA2A('aexowork.offers', offer);
  
  console.log(`[WorkerAgent] 📤 Sent offer ${offer.offerId} for job ${msg.jobId} to ClientAgent (${offer.to || 'broadcast'})`);
}

/**
 * Handle offer acceptance
 */
async function handleOfferAccepted(msg: any): Promise<void> {
  if (msg.type !== 'OfferAccepted') return;
  
  console.log(`[WorkerAgent] 📨 Offer accepted message received`);
  console.log(`[WorkerAgent]    Job ID: ${msg.jobId}`);
  console.log(`[WorkerAgent]    Escrow ID: ${msg.escrowId}`);
  console.log(`[WorkerAgent]    Escrow ID type: ${typeof msg.escrowId}, length: ${msg.escrowId?.length || 'N/A'}`);
  
  const job = availableJobs.get(msg.jobId);
  if (!job) {
    console.error(`[WorkerAgent] ❌ Job ${msg.jobId} not found in availableJobs`);
    return;
  }
  
  // Store accepted work
  acceptedWork.set(msg.escrowId, {
    jobId: msg.jobId,
    job,
    escrowId: msg.escrowId,
    status: 'in_progress',
    startedAt: Date.now(),
  });
  
  console.log(`[WorkerAgent] ✅ Stored accepted work for escrow ${msg.escrowId}`);
  
  // Wait for escrow to be funded before delivering
  // Check escrow status periodically
  let retryCount = 0;
  const maxRetries = 30; // 30 retries * 5 seconds = 2.5 minutes max wait
  const checkEscrowAndDeliver = async () => {
    try {
      retryCount++;
      console.log(`[WorkerAgent] 🔍 Escrow check attempt ${retryCount}/${maxRetries} for ${msg.escrowId}`);
      
      if (process.env.ESCROW_MANAGER_ADDRESS) {
        const escrowAbi = [
          'function escrows(bytes32) view returns (address client, address payable freelancer, uint256 amount, uint8 status, address verifier, uint256 createdAt)',
        ];
        // Use read-only contract for checking (no wallet needed)
        const { provider } = initEVM();
        const escrowManager = new ethers.Contract(process.env.ESCROW_MANAGER_ADDRESS, escrowAbi, provider);
        
        try {
          // Convert escrowId to bytes32 if it's a string
          let escrowIdBytes32: string = msg.escrowId;
          console.log(`[WorkerAgent]    Original escrowId: ${escrowIdBytes32} (type: ${typeof escrowIdBytes32})`);
          
          if (typeof escrowIdBytes32 === 'string' && escrowIdBytes32.startsWith('0x')) {
            // Ensure it's exactly 32 bytes (66 chars: 0x + 64 hex chars)
            if (escrowIdBytes32.length === 66) {
              // Already valid bytes32 hex string
              console.log(`[WorkerAgent]    EscrowId is valid bytes32 (66 chars)`);
            } else {
              // Pad to 32 bytes
              console.log(`[WorkerAgent]    Padding escrowId from ${escrowIdBytes32.length} to 66 chars`);
              escrowIdBytes32 = ethers.utils.hexZeroPad(escrowIdBytes32, 32);
            }
          } else if (typeof escrowIdBytes32 === 'string') {
            // Convert string to bytes32
            console.log(`[WorkerAgent]    Converting string to bytes32`);
            escrowIdBytes32 = ethers.utils.formatBytes32String(escrowIdBytes32);
          }
          
          console.log(`[WorkerAgent]    Checking escrow with bytes32 ID: ${escrowIdBytes32}`);
          const escrowInfo = await escrowManager.escrows(escrowIdBytes32);
          
          // Status: 0=None, 1=Created, 2=Funded, 3=Delivered, 4=Disputed, 5=Released, 6=Refunded
          const isFunded = escrowInfo && escrowInfo.status >= 2 && escrowInfo.amount.gt(0);
          
          console.log(`[WorkerAgent]    Escrow info retrieved:`);
          console.log(`[WorkerAgent]      Status: ${escrowInfo?.status || 'N/A'} (0=None, 1=Created, 2=Funded, 3=Delivered)`);
          console.log(`[WorkerAgent]      Amount: ${escrowInfo ? ethers.utils.formatEther(escrowInfo.amount) : '0'} HBAR`);
          console.log(`[WorkerAgent]      Client: ${escrowInfo?.client || 'N/A'}`);
          console.log(`[WorkerAgent]      Freelancer: ${escrowInfo?.freelancer || 'N/A'}`);
          console.log(`[WorkerAgent]      Is Funded: ${isFunded}`);
          
          if (isFunded) {
            console.log(`[WorkerAgent] ✅ Escrow ${msg.escrowId} is funded! Delivering work...`);
            await deliverWork(msg.escrowId);
            return; // Stop retrying
          } else {
            console.log(`[WorkerAgent] ⏳ Escrow ${msg.escrowId} not ready yet (status: ${escrowInfo?.status || 'not found'}, need >= 2)`);
          }
        } catch (e: any) {
          // Escrow might not exist yet or wrong format
          console.log(`[WorkerAgent] ⚠️  Escrow check error: ${e.message}`);
          console.log(`[WorkerAgent]    Error details: ${e.stack || 'No stack trace'}`);
        }
      } else {
        console.warn(`[WorkerAgent] ⚠️  ESCROW_MANAGER_ADDRESS not set, cannot check on-chain escrow`);
      }
      
      // If escrow check fails or not funded, wait and retry
      if (retryCount < maxRetries) {
        console.log(`[WorkerAgent] ⏳ Waiting 5 seconds before retry ${retryCount + 1}/${maxRetries}...`);
        setTimeout(checkEscrowAndDeliver, 5000); // Retry after 5 seconds
      } else {
        console.error(`[WorkerAgent] ❌ Max retries (${maxRetries}) reached. Escrow ${msg.escrowId} may not be funded.`);
        console.error(`[WorkerAgent]    Please check HashScan to verify escrow status.`);
      }
    } catch (error: any) {
      console.warn(`[WorkerAgent] ❌ Error in checkEscrowAndDeliver: ${error.message}`);
      if (retryCount < maxRetries) {
        setTimeout(checkEscrowAndDeliver, 5000);
      }
    }
  };
  
  // Start checking after a short delay (3 seconds to allow transaction to be mined)
  console.log(`[WorkerAgent] ⏳ Starting escrow check in 3 seconds...`);
  setTimeout(checkEscrowAndDeliver, 3000);
}

/**
 * Deliver completed work
 */
async function deliverWork(escrowId: string): Promise<void> {
  try {
    const work = acceptedWork.get(escrowId);
    if (!work) {
      console.error('[WorkerAgent] Work not found');
      return;
    }
    
    // Create delivery artifact
    const delivery = {
      escrowId,
      jobId: work.jobId,
      deliveredAt: Date.now(),
      artifacts: {
        description: 'Completed work artifact',
        files: ['result.txt', 'output.pdf'],
        notes: 'All requirements met',
      },
    };
    
    // Upload delivery to IPFS
    const deliveryCID = await uploadJSON(delivery);
    
    // Submit delivery on-chain (only if escrow is funded)
    try {
      // First check if escrow exists and is funded
      const escrowAbi = [
        'function escrows(bytes32) view returns (address client, address payable freelancer, uint256 amount, uint8 status, address verifier, uint256 createdAt)',
        'function submitDelivery(bytes32 escrowId, string calldata deliveryCID)',
      ];
      
      // Use WorkerAgent's private key if available, otherwise use default
      // The contract requires msg.sender == freelancer, so we need the freelancer's wallet
      const workerPrivateKey = process.env.WORKER_PRIVATE_KEY || process.env.WORKER_HEDERA_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
      const escrowManager = getContract(process.env.ESCROW_MANAGER_ADDRESS!, escrowAbi, workerPrivateKey);
      
      // Check escrow status using escrows mapping
      let escrowInfo: any;
      try {
        // Convert escrowId to bytes32 if needed
        let escrowIdBytes32: string = escrowId;
        if (typeof escrowIdBytes32 === 'string' && escrowIdBytes32.startsWith('0x') && escrowIdBytes32.length === 66) {
          // Already valid bytes32 hex string
        } else if (typeof escrowIdBytes32 === 'string') {
          // Try to convert to bytes32 - if it's already a hex string, pad it
          if (escrowIdBytes32.startsWith('0x')) {
            escrowIdBytes32 = ethers.utils.hexZeroPad(escrowIdBytes32, 32);
          } else {
            // Convert string to bytes32
            escrowIdBytes32 = ethers.utils.formatBytes32String(escrowIdBytes32);
          }
        }
        
        escrowInfo = await escrowManager.escrows(escrowIdBytes32);
      } catch (checkError: any) {
        // Escrow might not exist yet, continue with off-chain delivery
        console.warn(`[WorkerAgent] Escrow ${escrowId} check failed: ${checkError.message}`);
        escrowInfo = null;
      }
      
      // If escrow exists and is funded (status >= 2), submit on-chain
      // Status: 0=None, 1=Created, 2=Funded, 3=Delivered, 4=Disputed, 5=Released, 6=Refunded
      if (escrowInfo && escrowInfo.status >= 2 && escrowInfo.amount.gt(0)) {
        // IMPORTANT: The contract requires msg.sender == freelancer
        // We need to use the freelancer's wallet (WorkerAgent's wallet)
        const freelancerAddress = escrowInfo.freelancer.toLowerCase();
        const workerAddress = (process.env.WORKER_ADDRESS || '').toLowerCase();
        
        console.log(`[WorkerAgent] Preparing on-chain delivery...`);
        console.log(`[WorkerAgent]    Escrow freelancer: ${escrowInfo.freelancer}`);
        console.log(`[WorkerAgent]    Worker address: ${process.env.WORKER_ADDRESS || 'NOT SET'}`);
        console.log(`[WorkerAgent]    Addresses match: ${freelancerAddress === workerAddress}`);
        
        // Use WorkerAgent's private key for submission (must match freelancer address)
        const workerPrivateKey = process.env.WORKER_PRIVATE_KEY || process.env.WORKER_HEDERA_PRIVATE_KEY;
        if (!workerPrivateKey) {
          throw new Error('WORKER_PRIVATE_KEY or WORKER_HEDERA_PRIVATE_KEY must be set for on-chain delivery');
        }
        
        // Create contract instance with worker's wallet
        const { provider } = initEVM();
        const workerWallet = new ethers.Wallet(workerPrivateKey, provider);
        const workerAddressFromKey = workerWallet.address.toLowerCase();
        
        console.log(`[WorkerAgent]    Worker wallet address: ${workerAddressFromKey}`);
        console.log(`[WorkerAgent]    Wallet matches freelancer: ${freelancerAddress === workerAddressFromKey}`);
        
        if (freelancerAddress !== workerAddressFromKey) {
          throw new Error(`Worker wallet address (${workerAddressFromKey}) does not match escrow freelancer (${escrowInfo.freelancer}). Please set WORKER_PRIVATE_KEY to the freelancer's private key.`);
        }
        
        const escrowManagerWithWorkerWallet = new ethers.Contract(
          process.env.ESCROW_MANAGER_ADDRESS!,
          escrowAbi,
          workerWallet
        );
        
        // Convert escrowId to bytes32 for submission
        let escrowIdBytes32: string = escrowId;
        if (typeof escrowIdBytes32 === 'string' && escrowIdBytes32.startsWith('0x') && escrowIdBytes32.length === 66) {
          // Already valid
        } else if (typeof escrowIdBytes32 === 'string') {
          if (escrowIdBytes32.startsWith('0x')) {
            escrowIdBytes32 = ethers.utils.hexZeroPad(escrowIdBytes32, 32);
          } else {
            escrowIdBytes32 = ethers.utils.formatBytes32String(escrowIdBytes32);
          }
        }
        
        console.log(`[WorkerAgent] Submitting delivery on-chain...`);
        console.log(`[WorkerAgent]    Escrow ID (bytes32): ${escrowIdBytes32}`);
        console.log(`[WorkerAgent]    Delivery CID: ${deliveryCID}`);
        console.log(`[WorkerAgent]    Using wallet: ${workerAddressFromKey}`);
        const tx = await escrowManagerWithWorkerWallet.submitDelivery(escrowIdBytes32, deliveryCID, {
          gasLimit: 500000 // Set explicit gas limit
        });
        const receipt = await tx.wait();
        console.log(`[WorkerAgent] ✅ Delivery submitted on-chain for escrow ${escrowId}`);
        console.log(`[WorkerAgent]    Transaction: ${tx.hash}`);
        console.log(`[WorkerAgent]    🔗 HashScan: https://hashscan.io/testnet/transaction/${tx.hash}`);
        
        // Check if delivery event was emitted
        const deliveryEvent = receipt.events?.find((e: any) => e.event === 'DeliverySubmitted' || e.event === 'WorkDelivered');
        if (deliveryEvent) {
          console.log(`[WorkerAgent]    Delivery event confirmed`);
        }
      } else {
        console.warn(`[WorkerAgent] Escrow ${escrowId} not funded yet (status: ${escrowInfo?.status || 'not found'}), delivering off-chain only`);
        // Continue with off-chain delivery (A2A messaging still works)
      }
    } catch (onChainError: any) {
      // If on-chain submission fails, continue with off-chain delivery
      console.warn(`[WorkerAgent] On-chain delivery failed: ${onChainError.message}`);
      console.log(`[WorkerAgent] Continuing with off-chain delivery via A2A`);
    }
    
    // Register delivery with x402 adapter (if available)
    if (process.env.X402_URL) {
      await axios.post(`${process.env.X402_URL}/register-delivery`, {
        escrowId,
        resourceCID: deliveryCID,
        amountHBAR: work.job.budgetHBAR,
      });
    }
    
    // Update status
    work.status = 'delivered';
    work.deliveryCID = deliveryCID;
    acceptedWork.set(escrowId, work);
    
    // STEP 6: Send deliverable to VerificationAgent FIRST (per user flow spec)
    // WorkerAgent sends deliverable to VerificationAgent for verification BEFORE sending to ClientAgent
    const verificationRequest: any = {
      type: 'verification.request',
      escrowId,
      jobId: work.jobId,
      deliveryCID,
      workType: work.job.requiredSkills?.[0] || 'general',
      checks: ['plagiarism', 'quality', 'deadline', 'completeness'],
      clientAccountId: work.job.clientAddress || process.env.CLIENT_AGENT_ACCOUNT_ID, // For VerificationAgent to forward to ClientAgent
      timestamp: Date.now(),
      to: process.env.VERIFICATION_AGENT_ACCOUNT_ID, // Target VerificationAgent only
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        verificationRequest.signature = signJSON(verificationRequest, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError: any) {
      console.warn('[WorkerAgent] Could not sign verification request:', signError.message);
    }
    
    // Send deliverable to VerificationAgent ONLY (not to ClientAgent directly)
    await sendA2A('aexowork.verification.requests', verificationRequest);
    console.log(`[WorkerAgent] ✅ Deliverable sent to VerificationAgent (${process.env.VERIFICATION_AGENT_ACCOUNT_ID || 'broadcast'}) for escrow ${escrowId}, CID: ${deliveryCID}`);
    console.log(`[WorkerAgent] ⏳ Waiting for VerificationAgent to verify and forward to ClientAgent...`);
  } catch (error: any) {
    console.error('[WorkerAgent] Error delivering work:', error);
  }
}

/**
 * GET /work (also /api/worker/work)
 * List accepted work
 */
app.get(['/work', '/api/worker/work'], (req: Request, res: Response) => {
  const work = Array.from(acceptedWork.values());
  res.json({ count: work.length, work });
});

/**
 * GET /available-jobs (also /api/worker/available-jobs)
 * List available jobs
 */
app.get(['/available-jobs', '/api/worker/available-jobs'], (req: Request, res: Response) => {
  const jobs = Array.from(availableJobs.values());
  res.json({ count: jobs.length, jobs });
});

/**
 * Initialize WorkerAgent
 */
export async function init(): Promise<void> {
  // Connect to A2A message bus
  await initA2A(undefined, { agentName: 'WorkerAgent' });
  
  // Subscribe to job postings (JobOfferRequest messages)
  subscribe('aexowork.jobs', handleJobPost);
  console.log('[WorkerAgent] ✅ Subscribed to aexowork.jobs for JobOfferRequest messages');
  
  // Subscribe to offer acceptances
  subscribe('aexowork.offers.accepted', handleOfferAccepted);
  console.log('[WorkerAgent] ✅ Subscribed to aexowork.offers.accepted for OfferAccepted messages');
  
  // Start HTTP server
  const port = process.env.WORKER_AGENT_PORT || 3002;
  app.listen(port, () => {
    console.log(`[WorkerAgent] Running on port ${port}`);
  });
}

// Start if run directly
if (require.main === module) {
  init().catch(console.error);
}

export { app };

