/**
 * DisputeAgent - A2A Protocol Compliant
 * Handles disputes, evidence collection, weighted voting, and resolution
 * Based on: https://github.com/a2aproject/A2A
 */

const express = require('express');
const { ethers } = require('ethers');
const { sendA2A, subscribe, init: initA2A } = require('../lib/a2a');
require('dotenv').config();

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

const PORT = process.env.DISPUTE_AGENT_PORT || 3005;
let sc = null; // Will be initialized in initNATS

// A2A Agent Card - Protocol Compliance
const AGENT_CARD = {
  name: 'DisputeAgent',
  version: '1.0.0',
  description: 'A2A-compliant dispute resolution agent with weighted voting and evidence collection',
  capabilities: [
    'dispute.create',
    'dispute.submit_evidence',
    'dispute.vote',
    'dispute.resolve',
    'dispute.appeal'
  ],
  methods: {
    'dispute.create': {
      description: 'Create a new dispute',
      params: {
        escrowId: 'string',
        reason: 'string',
        initiator: 'address',
        defendant: 'address'
      }
    },
    'dispute.submit_evidence': {
      description: 'Submit evidence for a dispute',
      params: {
        disputeId: 'string',
        evidence: 'object',
        submitter: 'address'
      }
    },
    'dispute.vote': {
      description: 'Cast a weighted vote on a dispute',
      params: {
        disputeId: 'string',
        decision: 'string',
        voter: 'address'
      }
    },
    'dispute.resolve': {
      description: 'Automatically resolve a dispute',
      params: {
        disputeId: 'string'
      }
    }
  },
  transport: 'http',
  endpoint: `http://localhost:${PORT}`,
  protocols: ['A2A/1.0', 'JSON-RPC/2.0']
};

// Hedera connection
const provider = new ethers.providers.JsonRpcProvider(process.env.HEDERA_JSON_RPC_RELAY || process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api');
let wallet = null;
if (process.env.HEDERA_PRIVATE_KEY || process.env.PRIVATE_KEY) {
  wallet = new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY || process.env.PRIVATE_KEY, provider);
} else {
  console.warn('[DisputeAgent] No private key found. Wallet operations will be limited.');
}

// Contract connections
let arbitrationContract;
let reputationContract;
let escrowContract;

// In-memory dispute storage
const disputes = new Map();
const evidenceStore = new Map();
const votes = new Map();

// Dispute status enum
const DisputeStatus = {
  PENDING: 'pending',
  EVIDENCE_COLLECTION: 'evidence_collection',
  VOTING: 'voting',
  RESOLVED: 'resolved',
  APPEALED: 'appealed'
};

// Resolution decisions
const Decision = {
  FAVOR_CLIENT: 'favor_client',
  FAVOR_WORKER: 'favor_worker',
  SPLIT: 'split',
  ESCALATE: 'escalate'
};

// NATS connection
let nc;

async function initContracts() {
  try {
    // Arbitration contract
    const arbitrationAddress = process.env.ARBITRATION_ADDRESS;
    if (!arbitrationAddress) {
      console.warn('[DisputeAgent] ARBITRATION_ADDRESS not set. Contract operations will be limited.');
      return;
    }
    
    const arbitrationABI = [
      'function raiseDispute(uint256 escrowId, string reason) external returns (uint256)',
      'function resolveDispute(uint256 disputeId, bool favorClient) external',
      'function getDispute(uint256 disputeId) external view returns (tuple(uint256 escrowId, address client, address worker, bool resolved, bool favorClient))'
    ];
    
    // Use provider if wallet is null (read-only)
    const signerOrProvider = wallet || provider;
    arbitrationContract = new ethers.Contract(
      arbitrationAddress,
      arbitrationABI,
      signerOrProvider
    );
    console.log('✅ Arbitration contract initialized');

    // Reputation contract
    const reputationAddress = process.env.REPUTATION_MANAGER_ADDRESS;
    if (reputationAddress) {
      const reputationABI = [
        'function getReputation(address agent) external view returns (uint256)',
        'function updateReputation(address agent, int256 change) external'
      ];
      reputationContract = new ethers.Contract(
        reputationAddress,
        reputationABI,
        signerOrProvider
      );
    }

    // Escrow contract
    const escrowABI = [
      'function releasePayment(uint256 escrowId) external',
      'function refund(uint256 escrowId) external',
      'function getEscrow(uint256 escrowId) external view returns (tuple(address client, address worker, uint256 amount, bool completed, bool refunded))'
    ];
    escrowContract = new ethers.Contract(
      process.env.ESCROW_MANAGER_ADDRESS,
      escrowABI,
      wallet
    );

    console.log('✅ Contracts initialized');
  } catch (error) {
    console.error('❌ Contract initialization error:', error.message);
  }
}

async function initNATS() {
  try {
    await initA2A(process.env.NATS_URL || 'nats://localhost:4222');
    nc = getConnection();
    sc = StringCodec();
    console.log('✅ Connected to NATS server via A2A library');

    // Subscribe to A2A channels
    const disputes_sub = nc.subscribe('aexowork.disputes');
    const evidence_sub = nc.subscribe('aexowork.evidence');
    const resolution_sub = nc.subscribe('aexowork.resolution');

    // Handle incoming disputes
    (async () => {
      for await (const msg of disputes_sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          console.log('[A2A] Dispute received:', data.disputeId);
          await handleIncomingDispute(data);
        } catch (error) {
          console.error('[A2A] Dispute handling error:', error);
        }
      }
    })();

    // Handle evidence submissions
    (async () => {
      for await (const msg of evidence_sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          console.log('[A2A] Evidence received:', data.disputeId);
          await handleIncomingEvidence(data);
        } catch (error) {
          console.error('[A2A] Evidence handling error:', error);
        }
      }
    })();

    // Handle resolution requests
    (async () => {
      for await (const msg of resolution_sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          console.log('[A2A] Resolution request:', data.disputeId);
          await autoResolveDispute(data.disputeId);
        } catch (error) {
          console.error('[A2A] Resolution error:', error);
        }
      }
    })();

    console.log('[A2A] Subscribed to dispute channels');
  } catch (error) {
    console.error('❌ NATS connection failed:', error.message);
  }
}

// A2A Protocol: Health check & Agent Card
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    agent: 'DisputeAgent',
    protocol: 'A2A/1.0',
    version: '1.0.0',
    agentCard: AGENT_CARD,
    stats: {
      totalDisputes: disputes.size,
      pending: Array.from(disputes.values()).filter(d => d.status === DisputeStatus.PENDING).length,
      resolved: Array.from(disputes.values()).filter(d => d.status === DisputeStatus.RESOLVED).length,
      evidenceCount: evidenceStore.size,
      votesCount: votes.size
    },
    contracts: {
      arbitration: process.env.ARBITRATION_ADDRESS,
      reputation: process.env.REPUTATION_MANAGER_ADDRESS,
      escrow: process.env.ESCROW_MANAGER_ADDRESS
    }
  });
});

// A2A Protocol: Get Agent Card
app.get('/agent-card', (req, res) => {
  res.json(AGENT_CARD);
});

// Create dispute (A2A method: dispute.create)
app.post(['/create-dispute', '/api/dispute/create'], async (req, res) => {
  try {
    const { escrowId, reason, initiator, defendant, evidence } = req.body;

    const disputeId = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const dispute = {
      id: disputeId,
      escrowId,
      reason,
      initiator,
      defendant,
      status: DisputeStatus.EVIDENCE_COLLECTION,
      createdAt: Date.now(),
      evidenceDeadline: Date.now() + 86400000, // 24 hours
      votingDeadline: null,
      resolution: null,
      onChainDisputeId: null
    };

    disputes.set(disputeId, dispute);

    // Store initial evidence
    if (evidence) {
      evidenceStore.set(disputeId, [{
        submitter: initiator,
        content: evidence,
        timestamp: Date.now()
      }]);
    } else {
      evidenceStore.set(disputeId, []);
    }

    // Raise on-chain dispute
    try {
      const tx = await arbitrationContract.raiseDispute(escrowId, reason);
      const receipt = await tx.wait();
      
      // Extract dispute ID from events
      const disputeEvent = receipt.events?.find(e => e.event === 'DisputeRaised');
      if (disputeEvent) {
        dispute.onChainDisputeId = disputeEvent.args.disputeId.toNumber();
      }
    } catch (error) {
      console.error('⚠️ On-chain dispute creation failed:', error.message);
    }

    // A2A: Broadcast dispute creation
    if (nc) {
      nc.publish('aexowork.disputes', sc.encode(JSON.stringify({
        type: 'dispute.created',
        disputeId,
        escrowId,
        initiator,
        defendant,
        reason,
        evidenceDeadline: dispute.evidenceDeadline
      })));
    }

    console.log(`✅ Dispute created: ${disputeId}`);

    res.json({
      success: true,
      disputeId,
      status: dispute.status,
      evidenceDeadline: dispute.evidenceDeadline,
      message: 'Dispute created. Evidence collection phase started.'
    });
  } catch (error) {
    console.error('❌ Error creating dispute:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit evidence (A2A method: dispute.submit_evidence)
app.post(['/submit-evidence', '/api/dispute/evidence'], async (req, res) => {
  try {
    const { disputeId, evidence, submitter } = req.body;

    const dispute = disputes.get(disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    if (dispute.status !== DisputeStatus.EVIDENCE_COLLECTION) {
      return res.status(400).json({ error: 'Evidence submission period has ended' });
    }

    if (Date.now() > dispute.evidenceDeadline) {
      // Move to voting phase
      dispute.status = DisputeStatus.VOTING;
      dispute.votingDeadline = Date.now() + 43200000; // 12 hours
      disputes.set(disputeId, dispute);
      return res.status(400).json({ error: 'Evidence deadline passed. Moving to voting phase.' });
    }

    // Store evidence
    const evidenceList = evidenceStore.get(disputeId) || [];
    evidenceList.push({
      submitter,
      content: evidence,
      timestamp: Date.now()
    });
    evidenceStore.set(disputeId, evidenceList);

    // A2A: Broadcast evidence submission
    if (nc) {
      nc.publish('aexowork.evidence', sc.encode(JSON.stringify({
        type: 'evidence.submitted',
        disputeId,
        submitter,
        timestamp: Date.now()
      })));
    }

    console.log(`✅ Evidence submitted for dispute: ${disputeId}`);

    res.json({
      success: true,
      disputeId,
      evidenceCount: evidenceList.length,
      message: 'Evidence submitted successfully'
    });
  } catch (error) {
    console.error('❌ Error submitting evidence:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vote on dispute (A2A method: dispute.vote)
app.post(['/vote', '/api/dispute/vote'], async (req, res) => {
  try {
    const { disputeId, decision, voter } = req.body;

    const dispute = disputes.get(disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    if (dispute.status !== DisputeStatus.VOTING) {
      return res.status(400).json({ error: 'Dispute is not in voting phase' });
    }

    // Get voter's reputation weight
    let weight = 1;
    try {
      const reputation = await reputationContract.getReputation(voter);
      weight = Math.max(1, Math.floor(reputation.toNumber() / 100));
    } catch (error) {
      console.log('⚠️ Could not fetch reputation, using default weight');
    }

    // Store vote
    const voteList = votes.get(disputeId) || [];
    voteList.push({
      voter,
      decision,
      weight,
      timestamp: Date.now()
    });
    votes.set(disputeId, voteList);

    console.log(`✅ Vote recorded: ${voter} -> ${decision} (weight: ${weight})`);

    // Check if voting should end
    if (Date.now() > dispute.votingDeadline || voteList.length >= 5) {
      await autoResolveDispute(disputeId);
    }

    res.json({
      success: true,
      disputeId,
      voteRecorded: true,
      weight,
      totalVotes: voteList.length
    });
  } catch (error) {
    console.error('❌ Error recording vote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dispute details
app.get(['/dispute/:disputeId', '/api/dispute/:disputeId'], (req, res) => {
  const { disputeId } = req.params;
  const dispute = disputes.get(disputeId);

  if (!dispute) {
    return res.status(404).json({ error: 'Dispute not found' });
  }

  const evidence = evidenceStore.get(disputeId) || [];
  const disputeVotes = votes.get(disputeId) || [];

  res.json({
    dispute,
    evidenceCount: evidence.length,
    votesCount: disputeVotes.length,
    evidence: evidence.map(e => ({
      submitter: e.submitter,
      timestamp: e.timestamp
      // Don't expose full evidence content in public API
    })),
    votes: disputeVotes.map(v => ({
      decision: v.decision,
      weight: v.weight,
      timestamp: v.timestamp
      // Don't expose voter identity in public API
    }))
  });
});

// Auto-resolve dispute based on votes and evidence
async function autoResolveDispute(disputeId) {
  try {
    const dispute = disputes.get(disputeId);
    if (!dispute) {
      console.error('Dispute not found:', disputeId);
      return;
    }

    const disputeVotes = votes.get(disputeId) || [];
    const evidence = evidenceStore.get(disputeId) || [];

    console.log(`\n🔍 Resolving dispute: ${disputeId}`);
    console.log(`   Evidence count: ${evidence.length}`);
    console.log(`   Votes count: ${disputeVotes.length}`);

    // Calculate weighted vote totals
    let favorClientWeight = 0;
    let favorWorkerWeight = 0;
    let splitWeight = 0;

    for (const vote of disputeVotes) {
      if (vote.decision === Decision.FAVOR_CLIENT) {
        favorClientWeight += vote.weight;
      } else if (vote.decision === Decision.FAVOR_WORKER) {
        favorWorkerWeight += vote.weight;
      } else if (vote.decision === Decision.SPLIT) {
        splitWeight += vote.weight;
      }
    }

    console.log(`   Votes: Client=${favorClientWeight}, Worker=${favorWorkerWeight}, Split=${splitWeight}`);

    // Determine resolution
    let resolution;
    if (favorClientWeight > favorWorkerWeight && favorClientWeight > splitWeight) {
      resolution = Decision.FAVOR_CLIENT;
    } else if (favorWorkerWeight > favorClientWeight && favorWorkerWeight > splitWeight) {
      resolution = Decision.FAVOR_WORKER;
    } else if (splitWeight >= favorClientWeight && splitWeight >= favorWorkerWeight) {
      resolution = Decision.SPLIT;
    } else {
      resolution = Decision.ESCALATE;
    }

    console.log(`   ✅ Resolution: ${resolution}`);

    // Update dispute
    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolution;
    dispute.resolvedAt = Date.now();
    disputes.set(disputeId, dispute);

    // Execute on-chain resolution
    try {
      if (dispute.onChainDisputeId !== null) {
        const favorClient = resolution === Decision.FAVOR_CLIENT;
        const tx = await arbitrationContract.resolveDispute(dispute.onChainDisputeId, favorClient);
        await tx.wait();
        console.log('   ✅ On-chain resolution executed');
      }
    } catch (error) {
      console.error('   ⚠️ On-chain resolution failed:', error.message);
    }

    // Update reputations
    await updateReputationsAfterDispute(dispute, resolution);

    // A2A: Broadcast resolution
    if (nc) {
      nc.publish('aexowork.resolution', sc.encode(JSON.stringify({
        type: 'dispute.resolved',
        disputeId,
        resolution,
        timestamp: Date.now()
      })));
    }

    return resolution;
  } catch (error) {
    console.error('❌ Error resolving dispute:', error);
    throw error;
  }
}

// Update reputations based on dispute outcome
async function updateReputationsAfterDispute(dispute, resolution) {
  try {
    const { initiator, defendant } = dispute;

    let initiatorChange = 0;
    let defendantChange = 0;

    switch (resolution) {
      case Decision.FAVOR_CLIENT:
        if (initiator === dispute.initiator) {
          initiatorChange = 5;  // Won dispute
          defendantChange = -10; // Lost dispute
        }
        break;
      case Decision.FAVOR_WORKER:
        if (defendant === dispute.defendant) {
          defendantChange = 5;   // Won dispute
          initiatorChange = -5;  // Lost dispute (less penalty for initiating)
        }
        break;
      case Decision.SPLIT:
        initiatorChange = -2;  // Small penalty for both
        defendantChange = -2;
        break;
      case Decision.ESCALATE:
        // No reputation change for escalated disputes
        break;
    }

    // Update on-chain reputations
    if (initiatorChange !== 0) {
      try {
        const tx1 = await reputationContract.updateReputation(initiator, initiatorChange);
        await tx1.wait();
        console.log(`   ✅ Reputation updated: ${initiator} ${initiatorChange > 0 ? '+' : ''}${initiatorChange}`);
      } catch (error) {
        console.error('   ⚠️ Failed to update initiator reputation:', error.message);
      }
    }

    if (defendantChange !== 0) {
      try {
        const tx2 = await reputationContract.updateReputation(defendant, defendantChange);
        await tx2.wait();
        console.log(`   ✅ Reputation updated: ${defendant} ${defendantChange > 0 ? '+' : ''}${defendantChange}`);
      } catch (error) {
        console.error('   ⚠️ Failed to update defendant reputation:', error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error updating reputations:', error);
  }
}

// Handle incoming dispute from A2A network
async function handleIncomingDispute(data) {
  const { disputeId, escrowId, initiator, defendant, reason } = data;
  
  if (!disputes.has(disputeId)) {
    const dispute = {
      id: disputeId,
      escrowId,
      reason,
      initiator,
      defendant,
      status: DisputeStatus.EVIDENCE_COLLECTION,
      createdAt: Date.now(),
      evidenceDeadline: data.evidenceDeadline,
      votingDeadline: null,
      resolution: null,
      onChainDisputeId: null
    };
    
    disputes.set(disputeId, dispute);
    evidenceStore.set(disputeId, []);
    console.log(`✅ A2A dispute registered: ${disputeId}`);
  }
}

// Handle incoming evidence from A2A network
async function handleIncomingEvidence(data) {
  const { disputeId, submitter, evidence } = data;
  
  const evidenceList = evidenceStore.get(disputeId) || [];
  evidenceList.push({
    submitter,
    content: evidence,
    timestamp: Date.now()
  });
  evidenceStore.set(disputeId, evidenceList);
  console.log(`✅ A2A evidence added: ${disputeId}`);
}

// List all disputes
app.get(['/disputes', '/api/disputes'], (req, res) => {
  const allDisputes = Array.from(disputes.values()).map(d => ({
    ...d,
    evidenceCount: (evidenceStore.get(d.id) || []).length,
    votesCount: (votes.get(d.id) || []).length
  }));

  res.json({
    total: allDisputes.length,
    disputes: allDisputes
  });
});

// Appeal a dispute
app.post(['/appeal', '/api/dispute/appeal'], async (req, res) => {
  try {
    const { disputeId, appellant, reason } = req.body;

    const dispute = disputes.get(disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    if (dispute.status !== DisputeStatus.RESOLVED) {
      return res.status(400).json({ error: 'Only resolved disputes can be appealed' });
    }

    // Create appeal (essentially a new dispute)
    const appealId = `appeal_${disputeId}_${Date.now()}`;
    
    const appeal = {
      ...dispute,
      id: appealId,
      originalDisputeId: disputeId,
      appellant,
      appealReason: reason,
      status: DisputeStatus.EVIDENCE_COLLECTION,
      createdAt: Date.now(),
      evidenceDeadline: Date.now() + 86400000
    };

    disputes.set(appealId, appeal);
    dispute.status = DisputeStatus.APPEALED;
    disputes.set(disputeId, dispute);

    console.log(`✅ Appeal created: ${appealId}`);

    res.json({
      success: true,
      appealId,
      message: 'Appeal created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating appeal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function start() {
  await initContracts();
  await initNATS();

  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   DisputeAgent (A2A Protocol)          ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`✅ Running on port ${PORT}`);
    console.log(`📡 A2A Protocol: v1.0`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}`);
    console.log(`📄 Agent Card: http://localhost:${PORT}/agent-card\n`);
  });
}

start().catch(console.error);

module.exports = { app, AGENT_CARD };

