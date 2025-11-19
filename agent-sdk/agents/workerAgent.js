require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const { ethers } = require('ethers');
const { signJSON } = require('../lib/signer');
const { uploadJSON } = require('../lib/ipfs');
const { sendA2A, subscribe, init: initA2A } = require('../lib/a2a');
const { getContract } = require('../lib/hedera');
const axios = require('axios');

/**
 * WorkerAgent - Discovers jobs, makes offers, delivers work
 */

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Store available jobs and accepted work
const availableJobs = new Map();
const acceptedWork = new Map();

/**
 * GET /
 * Health check and status
 */
app.get('/', (req, res) => {
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
 * @param {Object} job - Job details
 * @returns {boolean}
 */
function shouldBidOnJob(job) {
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
 * Handle incoming job postings
 */
async function handleJobPost(msg) {
  if (msg.type !== 'JobPost') return;
  
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
  if (msg.requiredSkills && msg.requiredSkills.some(skill => ['data', 'dataset', 'api', 'model'].includes(skill.toLowerCase()))) {
    // Request data from DataAgent via A2A
    const dataRequest = {
      type: 'data.request',
      jobId: msg.jobId,
      requiredData: msg.requiredSkills.filter(s => ['data', 'dataset', 'api'].includes(s.toLowerCase())),
      budget: parseFloat(msg.budgetHBAR) / 1e18 * 0.1, // 10% of job budget for data
      timestamp: Date.now(),
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        dataRequest.signature = signJSON(dataRequest, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError) {
      console.warn('[WorkerAgent] Could not sign data request:', signError.message);
    }
    
    // Send data request (async - will be handled separately)
    sendA2A('aexowork.data.requests', dataRequest).catch(err => {
      console.log(`[WorkerAgent] Data request failed (optional): ${err.message}`);
    });
    
    dataAccess = 'requested';
  }
  
  // Create offer
  const offer = {
    type: 'Offer',
    offerId: 'offer-' + Date.now(),
    jobId: msg.jobId,
    priceHBAR: msg.budgetHBAR, // Match the budget for simplicity
    eta: '48h',
    proposedDeadline: Date.now() + 48 * 60 * 60 * 1000,
    fromDid: process.env.AGENT_DID,
    workerAddress: process.env.WORKER_ADDRESS || ethers.Wallet.createRandom().address,
    timestamp: Date.now(),
  };
  
  try {
    if (process.env.AGENT_PRIVATE_KEY_BASE64) {
      offer.signature = signJSON(offer, process.env.AGENT_PRIVATE_KEY_BASE64);
    }
  } catch (signError) {
    console.warn('[WorkerAgent] Could not sign offer:', signError.message);
  }
  
  // Send offer
  await sendA2A('aexowork.offers', offer);
  
  console.log(`[WorkerAgent] Sent offer ${offer.offerId} for job ${msg.jobId}`);
}

/**
 * Handle offer acceptance
 */
async function handleOfferAccepted(msg) {
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
        const { provider } = require('../lib/hedera').initEVM();
        const escrowManager = new ethers.Contract(process.env.ESCROW_MANAGER_ADDRESS, escrowAbi, provider);
        
        try {
          // Convert escrowId to bytes32 if it's a string
          let escrowIdBytes32 = msg.escrowId;
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
        } catch (e) {
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
    } catch (error) {
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
async function deliverWork(escrowId) {
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
      const escrowManager = getContract(process.env.ESCROW_MANAGER_ADDRESS, escrowAbi, workerPrivateKey);
      
      // Check escrow status using escrows mapping
      let escrowInfo;
      try {
        // Convert escrowId to bytes32 if needed
        let escrowIdBytes32 = escrowId;
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
      } catch (checkError) {
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
        const { provider } = require('../lib/hedera').initEVM();
        const workerWallet = new ethers.Wallet(workerPrivateKey, provider);
        const workerAddressFromKey = workerWallet.address.toLowerCase();
        
        console.log(`[WorkerAgent]    Worker wallet address: ${workerAddressFromKey}`);
        console.log(`[WorkerAgent]    Wallet matches freelancer: ${freelancerAddress === workerAddressFromKey}`);
        
        if (freelancerAddress !== workerAddressFromKey) {
          throw new Error(`Worker wallet address (${workerAddressFromKey}) does not match escrow freelancer (${escrowInfo.freelancer}). Please set WORKER_PRIVATE_KEY to the freelancer's private key.`);
        }
        
        const escrowManagerWithWorkerWallet = new ethers.Contract(
          process.env.ESCROW_MANAGER_ADDRESS,
          escrowAbi,
          workerWallet
        );
        
        // Convert escrowId to bytes32 for submission
        let escrowIdBytes32 = escrowId;
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
        const deliveryEvent = receipt.events?.find(e => e.event === 'DeliverySubmitted' || e.event === 'WorkDelivered');
        if (deliveryEvent) {
          console.log(`[WorkerAgent]    Delivery event confirmed`);
        }
      } else {
        console.warn(`[WorkerAgent] Escrow ${escrowId} not funded yet (status: ${escrowInfo?.status || 'not found'}), delivering off-chain only`);
        // Continue with off-chain delivery (A2A messaging still works)
      }
    } catch (onChainError) {
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
    
    // STEP 6: Auto-Verify Work via VerificationAgent (A2A Protocol)
    // WorkerAgent automatically triggers VerificationAgent to validate work
    const verificationRequest = {
      type: 'verification.request',
      escrowId,
      jobId: work.jobId,
      deliveryCID,
      workType: work.job.requiredSkills?.[0] || 'general',
      checks: ['plagiarism', 'quality', 'deadline', 'completeness'],
      timestamp: Date.now(),
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        verificationRequest.signature = signJSON(verificationRequest, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError) {
      console.warn('[WorkerAgent] Could not sign verification request:', signError.message);
    }
    
    // Send verification request to VerificationAgent via A2A
    await sendA2A('aexowork.verification.requests', verificationRequest);
    
    // Notify client via A2A
    const message = {
      type: 'WorkDelivered',
      escrowId,
      jobId: work.jobId,
      deliveryCID,
      verificationRequested: true,
      fromDid: process.env.AGENT_DID,
      timestamp: Date.now(),
    };
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        message.signature = signJSON(message, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError) {
      console.warn('[WorkerAgent] Could not sign delivery message:', signError.message);
    }
    await sendA2A('aexowork.deliveries', message);
    
    console.log(`[WorkerAgent] Work delivered for escrow ${escrowId}, CID: ${deliveryCID}, verification requested`);
  } catch (error) {
    console.error('[WorkerAgent] Error delivering work:', error);
  }
}

/**
 * GET /work (also /api/worker/work)
 * List accepted work
 */
app.get(['/work', '/api/worker/work'], (req, res) => {
  const work = Array.from(acceptedWork.values());
  res.json({ count: work.length, work });
});

/**
 * GET /available-jobs (also /api/worker/available-jobs)
 * List available jobs
 */
app.get(['/available-jobs', '/api/worker/available-jobs'], (req, res) => {
  const jobs = Array.from(availableJobs.values());
  res.json({ count: jobs.length, jobs });
});

/**
 * Initialize WorkerAgent
 */
async function init() {
  // Connect to A2A message bus
  await initA2A(process.env.NATS_URL);
  
  // Subscribe to job postings
  subscribe('aexowork.jobs', handleJobPost);
  
  // Subscribe to offer acceptances
  subscribe('aexowork.offers.accepted', handleOfferAccepted);
  
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

module.exports = { app, init };

