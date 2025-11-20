require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const { signJSON } = require('../lib/signer');
const { downloadJSON } = require('../lib/ipfs');
const { subscribe, sendA2A, init: initA2A } = require('../lib/a2a');
const { submitHCSMessage } = require('../lib/hedera');

/**
 * VerificationAgent - Validates work quality and authenticity
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

// Store verification results
const verificationResults = new Map();

/**
 * GET /
 * Health check and status
 */
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    agent: 'VerificationAgent',
    version: '1.0.0',
    endpoints: {
      'POST /verify': 'Manually verify work',
      'GET /verifications': 'List all verifications',
      'GET /verification/:escrowId': 'Get specific verification'
    },
    stats: {
      totalVerifications: verificationResults.size,
      passed: Array.from(verificationResults.values()).filter(v => v.passed).length,
      failed: Array.from(verificationResults.values()).filter(v => !v.passed).length
    }
  });
});

/**
 * Perform verification checks on delivered work
 * @param {Object} delivery - Delivery object
 * @returns {Object} Verification result
 */
async function performVerification(delivery) {
  // Simulated verification logic
  // In production, this would include:
  // - Plagiarism checks
  // - Quality scoring
  // - Completeness validation
  // - Deadline compliance
  
  const checks = {
    plagiarism: Math.random() > 0.1, // 90% pass rate
    quality: Math.floor(Math.random() * 30) + 70, // 70-100 score
    completeness: Math.random() > 0.2, // 80% pass rate
    deadlineCompliance: true,
  };
  
  const passed = checks.plagiarism && checks.completeness && checks.quality >= 70;
  
  return {
    passed,
    score: checks.quality,
    checks,
    verifiedAt: Date.now(),
    verifier: process.env.AGENT_DID,
  };
}

/**
 * Handle work deliveries and verify them
 */
async function handleWorkDelivery(msg) {
  console.log(`[VerificationAgent] 📨 Received message:`, {
    type: msg.type,
    escrowId: msg.escrowId,
    jobId: msg.jobId,
    deliveryCID: msg.deliveryCID
  });
  
  // Handle both WorkDelivered and verification.request types
  if (msg.type !== 'WorkDelivered' && msg.type !== 'verification.request') {
    console.log(`[VerificationAgent] ⚠️  Ignoring message type: ${msg.type}`);
    return;
  }
  
  const escrowId = msg.escrowId;
  const jobId = msg.jobId;
  const deliveryCID = msg.deliveryCID;
  
  if (!escrowId || !deliveryCID) {
    console.error(`[VerificationAgent] ❌ Missing required fields: escrowId=${escrowId}, deliveryCID=${deliveryCID}`);
    return;
  }
  
  console.log(`[VerificationAgent] 🔍 Starting verification for escrow ${escrowId}`);
  console.log(`[VerificationAgent]    Delivery CID: ${deliveryCID}`);
  console.log(`[VerificationAgent]    Job ID: ${jobId || 'N/A'}`);
  
  try {
    // Download delivery from IPFS
    console.log(`[VerificationAgent] 📥 Downloading delivery from IPFS...`);
    const delivery = await downloadJSON(deliveryCID);
    console.log(`[VerificationAgent] ✅ Delivery downloaded successfully`);
    
    // Perform verification
    console.log(`[VerificationAgent] 🔎 Performing verification checks...`);
    const verification = await performVerification(delivery);
    console.log(`[VerificationAgent] ✅ Verification complete:`, {
      passed: verification.passed,
      score: verification.score,
      checks: verification.checks
    });
    
    // Create verification attestation
    const attestation = {
      type: 'VerificationAttestation',
      escrowId,
      jobId: jobId || delivery.jobId,
      deliveryCID,
      ...verification,
      timestamp: Date.now(),
    };
    
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        attestation.signature = signJSON(attestation, process.env.AGENT_PRIVATE_KEY_BASE64);
      } else {
        console.warn(`[VerificationAgent] ⚠️  AGENT_PRIVATE_KEY_BASE64 not set, skipping signature`);
      }
    } catch (signError) {
      console.warn(`[VerificationAgent] ⚠️  Could not sign attestation: ${signError.message}`);
    }
    
    // Store result
    verificationResults.set(escrowId, attestation);
    console.log(`[VerificationAgent] 💾 Verification result stored for escrow ${escrowId}`);
    
    // Optionally: Store proof on HCS
    if (process.env.HCS_TOPIC_ID) {
      try {
        const proofMessage = JSON.stringify({
          escrowId,
          passed: verification.passed,
          score: verification.score,
          verifier: process.env.AGENT_DID,
          timestamp: Date.now(),
        });
        
        await submitHCSMessage(process.env.HCS_TOPIC_ID, proofMessage);
        console.log(`[VerificationAgent] ✅ Proof anchored to HCS topic ${process.env.HCS_TOPIC_ID}`);
      } catch (hcsError) {
        console.warn(`[VerificationAgent] ⚠️  HCS submission failed: ${hcsError.message}`);
      }
    }
    
    // Send verified delivery to ClientAgent (per user flow spec)
    // VerificationAgent verifies work, then sends verified delivery + score to ClientAgent
    const verifiedDelivery = {
      type: 'DeliveryReceipt', // Send as DeliveryReceipt to ClientAgent
      escrowId,
      jobId: jobId || delivery.jobId,
      deliveryCID,
      verificationScore: verification.score,
      verificationPassed: verification.passed,
      verificationChecks: verification.checks,
      verificationProofCID: null, // Could store proof on IPFS if needed
      fromDid: process.env.AGENT_DID,
      verifiedBy: 'VerificationAgent',
      timestamp: Date.now(),
    };
    
    try {
      if (process.env.AGENT_PRIVATE_KEY_BASE64) {
        verifiedDelivery.signature = signJSON(verifiedDelivery, process.env.AGENT_PRIVATE_KEY_BASE64);
      }
    } catch (signError) {
      console.warn(`[VerificationAgent] ⚠️  Could not sign verified delivery: ${signError.message}`);
    }
    
    // Send verified delivery to ClientAgent
    try {
      await sendA2A('aexowork.deliveries', verifiedDelivery);
      console.log(`[VerificationAgent] 📤 Verified delivery sent to ClientAgent (score: ${verification.score}, passed: ${verification.passed})`);
    } catch (a2aError) {
      console.warn(`[VerificationAgent] ⚠️  Failed to send verified delivery to ClientAgent: ${a2aError.message}`);
    }
    
    // Also broadcast verification result for other agents (optional)
    try {
      await sendA2A('aexowork.verifications', attestation);
      console.log(`[VerificationAgent] 📤 Verification attestation broadcasted via A2A`);
    } catch (a2aError) {
      console.warn(`[VerificationAgent] ⚠️  A2A broadcast failed: ${a2aError.message}`);
    }
    
    console.log(
      `[VerificationAgent] ✅ Verification complete for ${escrowId}: ${
        verification.passed ? '✅ PASSED' : '❌ FAILED'
      } (score: ${verification.score})`
    );
  } catch (error) {
    console.error(`[VerificationAgent] ❌ Verification error for escrow ${escrowId}:`, error.message);
    console.error(`[VerificationAgent]    Stack: ${error.stack || 'No stack trace'}`);
  }
}

/**
 * POST /verify (also /api/verification/verify)
 * Manually trigger verification for an escrow
 */
app.post(['/verify', '/api/verification/verify'], async (req, res) => {
  try {
    const { escrowId, deliveryCID } = req.body;
    
    if (!escrowId || !deliveryCID) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const delivery = await downloadJSON(deliveryCID);
    const verification = await performVerification(delivery);
    
    const attestation = {
      type: 'VerificationAttestation',
      escrowId,
      deliveryCID,
      ...verification,
      timestamp: Date.now(),
    };
    
    attestation.signature = signJSON(attestation, process.env.AGENT_PRIVATE_KEY_BASE64);
    
    verificationResults.set(escrowId, attestation);
    
    res.json({
      ok: true,
      attestation,
    });
  } catch (error) {
    console.error('[VerificationAgent] Manual verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /verifications
 * List all verification results
 */
app.get('/verifications', (req, res) => {
  const results = Array.from(verificationResults.values());
  res.json({ count: results.length, results });
});

/**
 * GET /verification/:escrowId
 * Get verification result for specific escrow
 */
app.get('/verification/:escrowId', (req, res) => {
  const { escrowId } = req.params;
  const result = verificationResults.get(escrowId);
  
  if (!result) {
    return res.status(404).json({ error: 'Verification not found' });
  }
  
  res.json(result);
});

/**
 * Initialize VerificationAgent
 */
async function init() {
  // Connect to A2A message bus
  console.log(`[VerificationAgent] 🔌 Connecting to A2A message bus...`);
  await initA2A(null, { agentName: 'VerificationAgent' });
  console.log(`[VerificationAgent] ✅ Connected to A2A message bus`);
  
  // Subscribe to work deliveries (from WorkerAgent)
  console.log(`[VerificationAgent] 📡 Subscribing to aexowork.deliveries...`);
  subscribe('aexowork.deliveries', handleWorkDelivery);
  
  // Also subscribe to verification requests (alternative channel)
  console.log(`[VerificationAgent] 📡 Subscribing to aexowork.verification.requests...`);
  subscribe('aexowork.verification.requests', handleWorkDelivery);
  
  console.log(`[VerificationAgent] ✅ Subscribed to verification channels`);
  
  // Start HTTP server
  const port = process.env.VERIFICATION_AGENT_PORT || 3003;
  app.listen(port, () => {
    console.log(`[VerificationAgent] 🌐 HTTP server running on port ${port}`);
    console.log(`[VerificationAgent] ✅ VerificationAgent initialized and ready`);
  });
}

// Start if run directly
if (require.main === module) {
  init().catch(console.error);
}

module.exports = { app, init };

