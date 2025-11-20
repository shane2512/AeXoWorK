/**
 * Enhanced VerificationAgent - Multi-Verification Types & Quality Scoring
 * Supports: AI verification, plagiarism checking, quality scoring, multi-verifier consensus
 */

const express = require('express');
const { ethers } = require('ethers');
const { sendA2A, subscribe, init: initA2A } = require('../lib/a2a');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.VERIFICATION_AGENT_PORT || 3003;

// A2A Agent Card
const AGENT_CARD = {
  name: 'EnhancedVerificationAgent',
  version: '2.0.0',
  description: 'Multi-verification agent with AI, plagiarism, quality scoring, and consensus',
  capabilities: [
    'verification.ai',
    'verification.plagiarism',
    'verification.quality',
    'verification.consensus',
    'verification.multi_verifier'
  ],
  methods: {
    'verification.ai': {
      description: 'AI-powered content verification',
      params: { content: 'string', jobType: 'string' }
    },
    'verification.plagiarism': {
      description: 'Plagiarism detection check',
      params: { content: 'string', threshold: 'number' }
    },
    'verification.quality': {
      description: 'Quality scoring algorithm',
      params: { content: 'string', criteria: 'array' }
    },
    'verification.consensus': {
      description: 'Multi-verifier consensus',
      params: { escrowId: 'string', verifiers: 'array' }
    }
  },
  transport: 'http',
  endpoint: `http://localhost:${PORT}`,
  protocols: ['A2A/1.0', 'JSON-RPC/2.0']
};

// Verification types
const VerificationType = {
  AI: 'ai',
  PLAGIARISM: 'plagiarism',
  QUALITY: 'quality',
  COMPLETENESS: 'completeness',
  DEADLINE: 'deadline',
  CODE_QUALITY: 'code_quality',
  DESIGN_QUALITY: 'design_quality'
};

// Store verification results
const verificationResults = new Map();
const multiVerifierResults = new Map(); // For consensus tracking

// HCS-10 connection
let hcs10Initialized = false;

async function initHCS10Connection() {
  try {
    await initA2A(null, { agentName: 'EnhancedVerificationAgent' });
    hcs10Initialized = true;
    console.log('✅ Connected to HCS-10 network');

    // Subscribe to verification requests
    subscribe('aexowork.verification.requests', async (data) => {
      try {
        console.log('[A2A] Verification request:', data.escrowId);
        await handleVerificationRequest(data);
      } catch (error) {
        console.error('[A2A] Verification error:', error);
      }
    });

    // Subscribe to consensus requests
    subscribe('aexowork.verification.consensus', async (data) => {
      try {
        console.log('[A2A] Consensus request:', data.escrowId);
        await handleConsensusRequest(data);
      } catch (error) {
        console.error('[A2A] Consensus error:', error);
      }
    });

    console.log('[A2A] Subscribed to verification channels');
  } catch (error) {
    console.error('❌ HCS-10 connection failed:', error.message);
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    agent: 'EnhancedVerificationAgent',
    protocol: 'A2A/2.0',
    version: '2.0.0',
    agentCard: AGENT_CARD,
    stats: {
      totalVerifications: verificationResults.size,
      passed: Array.from(verificationResults.values()).filter(v => v.passed).length,
      failed: Array.from(verificationResults.values()).filter(v => !v.passed).length,
      multiVerifier: multiVerifierResults.size
    },
    verificationTypes: Object.values(VerificationType)
  });
});

// AI Verification
async function performAIVerification(content, jobType) {
  // Simulate AI model verification
  // In production, this would call GPT-4, Claude, or custom models
  
  const scores = {
    relevance: Math.floor(Math.random() * 20) + 80, // 80-100
    accuracy: Math.floor(Math.random() * 15) + 85,  // 85-100
    completeness: Math.floor(Math.random() * 20) + 80,
    clarity: Math.floor(Math.random() * 20) + 80
  };

  const overallScore = Math.round(
    (scores.relevance * 0.3 + scores.accuracy * 0.3 + 
     scores.completeness * 0.2 + scores.clarity * 0.2)
  );

  return {
    type: VerificationType.AI,
    passed: overallScore >= 75,
    score: overallScore,
    breakdown: scores,
    model: 'gpt-4-simulated',
    confidence: Math.floor(Math.random() * 15) + 85
  };
}

// Plagiarism Check
async function performPlagiarismCheck(content, threshold = 90) {
  // Simulate plagiarism detection
  // In production, this would use Copyscape, Turnitin API, or similar
  
  const similarity = Math.random() * 20; // 0-20% (low plagiarism)
  const passed = similarity < (100 - threshold);

  return {
    type: VerificationType.PLAGIARISM,
    passed,
    similarity: Math.round(similarity * 10) / 10,
    threshold,
    sources: passed ? [] : [
      { url: 'example.com/source1', similarity: 15 },
      { url: 'example.com/source2', similarity: 8 }
    ]
  };
}

// Quality Scoring
async function performQualityScoring(content, criteria = []) {
  const defaultCriteria = [
    { name: 'Grammar', weight: 0.2 },
    { name: 'Structure', weight: 0.2 },
    { name: 'Originality', weight: 0.2 },
    { name: 'Relevance', weight: 0.2 },
    { name: 'Presentation', weight: 0.2 }
  ];

  const usedCriteria = criteria.length > 0 ? criteria : defaultCriteria;
  
  const scores = {};
  let totalWeight = 0;
  let weightedSum = 0;

  for (const criterion of usedCriteria) {
    const score = Math.floor(Math.random() * 30) + 70; // 70-100
    scores[criterion.name] = score;
    weightedSum += score * criterion.weight;
    totalWeight += criterion.weight;
  }

  const overallScore = Math.round(weightedSum / totalWeight);

  return {
    type: VerificationType.QUALITY,
    passed: overallScore >= 70,
    score: overallScore,
    breakdown: scores,
    criteria: usedCriteria
  };
}

// Code Quality Check (for coding jobs)
async function performCodeQualityCheck(code) {
  // Simulate code quality checks
  // In production: linting, test coverage, complexity analysis
  
  const metrics = {
    lintScore: Math.floor(Math.random() * 20) + 80,
    testCoverage: Math.floor(Math.random() * 30) + 70,
    complexity: Math.floor(Math.random() * 20) + 20, // Lower is better
    maintainability: Math.floor(Math.random() * 20) + 75
  };

  const overallScore = Math.round(
    (metrics.lintScore * 0.3 + metrics.testCoverage * 0.3 +
     (100 - metrics.complexity) * 0.2 + metrics.maintainability * 0.2)
  );

  return {
    type: VerificationType.CODE_QUALITY,
    passed: overallScore >= 70 && metrics.testCoverage >= 60,
    score: overallScore,
    metrics
  };
}

// Design Quality Check (for design jobs)
async function performDesignQualityCheck(design) {
  const metrics = {
    aesthetics: Math.floor(Math.random() * 20) + 80,
    usability: Math.floor(Math.random() * 20) + 75,
    originality: Math.floor(Math.random() * 20) + 80,
    consistency: Math.floor(Math.random() * 20) + 80
  };

  const overallScore = Math.round(
    (metrics.aesthetics * 0.3 + metrics.usability * 0.3 +
     metrics.originality * 0.2 + metrics.consistency * 0.2)
  );

  return {
    type: VerificationType.DESIGN_QUALITY,
    passed: overallScore >= 75,
    score: overallScore,
    metrics
  };
}

// Complete Verification (all types)
async function performCompleteVerification(delivery, jobType) {
  const { content, code, design, deadline, submittedAt } = delivery;
  
  const results = {
    timestamp: Date.now(),
    verifier: process.env.AGENT_DID || 'verification-agent-1',
    checks: {}
  };

  // AI Verification (for all content)
  if (content) {
    results.checks.ai = await performAIVerification(content, jobType);
    results.checks.plagiarism = await performPlagiarismCheck(content);
    results.checks.quality = await performQualityScoring(content);
  }

  // Code Quality (for coding jobs)
  if (code || jobType === 'coding') {
    results.checks.codeQuality = await performCodeQualityCheck(code || content);
  }

  // Design Quality (for design jobs)
  if (design || jobType === 'design') {
    results.checks.designQuality = await performDesignQualityCheck(design || content);
  }

  // Deadline Compliance
  results.checks.deadline = {
    type: VerificationType.DEADLINE,
    passed: !deadline || !submittedAt || submittedAt <= deadline,
    submittedAt,
    deadline,
    onTime: !deadline || !submittedAt || submittedAt <= deadline
  };

  // Overall Pass/Fail
  const allChecks = Object.values(results.checks);
  const passedChecks = allChecks.filter(c => c.passed).length;
  const totalChecks = allChecks.length;
  
  // Calculate overall score (weighted average)
  const scores = allChecks
    .filter(c => c.score !== undefined)
    .map(c => c.score);
  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : passedChecks === totalChecks ? 100 : 0;

  results.passed = passedChecks === totalChecks && overallScore >= 70;
  results.score = overallScore;
  results.passedChecks = passedChecks;
  results.totalChecks = totalChecks;

  return results;
}

// Multi-Verifier Consensus
async function performConsensus(escrowId, verifierResults) {
  // Weighted voting based on verifier reputation
  let totalWeight = 0;
  let weightedSum = 0;
  let passVotes = 0;
  let failVotes = 0;

  for (const result of verifierResults) {
    const weight = result.verifierReputation || 1; // Default weight 1
    totalWeight += weight;
    
    if (result.passed) {
      passVotes += weight;
      weightedSum += (result.score || 0) * weight;
    } else {
      failVotes += weight;
    }
  }

  const consensusScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const consensusPassed = passVotes > failVotes && consensusScore >= 70;
  const consensus = passVotes / totalWeight; // 0-1, percentage agreement

  return {
    escrowId,
    consensus,
    consensusPassed,
    consensusScore: Math.round(consensusScore),
    passVotes,
    failVotes,
    totalVerifiers: verifierResults.length,
    timestamp: Date.now()
  };
}

// POST /verify - Complete verification
app.post(['/verify', '/api/verification/verify'], async (req, res) => {
  try {
    const { escrowId, delivery, jobType, verificationTypes } = req.body;

    if (!escrowId || !delivery) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await performCompleteVerification(delivery, jobType || 'general');
    
    result.escrowId = escrowId;
    verificationResults.set(escrowId, result);

    // A2A: Broadcast verification result
    if (hcs10Initialized) {
      await sendA2A('aexowork.verification.complete', {
        type: 'verification.complete',
        escrowId,
        ...result,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      verification: result
    });
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /verify/ai - AI-only verification
app.post('/verify/ai', async (req, res) => {
  try {
    const { content, jobType } = req.body;
    const result = await performAIVerification(content, jobType);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /verify/plagiarism - Plagiarism-only check
app.post('/verify/plagiarism', async (req, res) => {
  try {
    const { content, threshold } = req.body;
    const result = await performPlagiarismCheck(content, threshold);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /verify/quality - Quality-only scoring
app.post('/verify/quality', async (req, res) => {
  try {
    const { content, criteria } = req.body;
    const result = await performQualityScoring(content, criteria);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /verify/consensus - Multi-verifier consensus
app.post('/verify/consensus', async (req, res) => {
  try {
    const { escrowId, verifierResults } = req.body;
    
    if (!escrowId || !verifierResults || !Array.isArray(verifierResults)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const consensus = await performConsensus(escrowId, verifierResults);
    multiVerifierResults.set(escrowId, consensus);

    // A2A: Broadcast consensus result
    if (hcs10Initialized) {
      await sendA2A('aexowork.verification.consensus', {
        type: 'verification.consensus',
        ...consensus,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      consensus
    });
  } catch (error) {
    console.error('❌ Consensus error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /verifications - List all
app.get('/verifications', (req, res) => {
  const results = Array.from(verificationResults.entries()).map(([id, result]) => ({
    escrowId: id,
    ...result
  }));
  res.json({ total: results.length, verifications: results });
});

// GET /verification/:escrowId - Get specific
app.get('/verification/:escrowId', (req, res) => {
  const { escrowId } = req.params;
  const result = verificationResults.get(escrowId);
  
  if (!result) {
    return res.status(404).json({ error: 'Verification not found' });
  }
  
  res.json({ escrowId, ...result });
});

// GET /consensus/:escrowId - Get consensus result
app.get('/consensus/:escrowId', (req, res) => {
  const { escrowId } = req.params;
  const consensus = multiVerifierResults.get(escrowId);
  
  if (!consensus) {
    return res.status(404).json({ error: 'Consensus not found' });
  }
  
  res.json(consensus);
});

// A2A: Handle verification request
async function handleVerificationRequest(data) {
  const { escrowId, delivery, jobType, from } = data;
  
  try {
    const result = await performCompleteVerification(delivery, jobType);
    result.escrowId = escrowId;
    verificationResults.set(escrowId, result);

    // Reply with result
    if (from && hcs10Initialized) {
      await sendA2A('aexowork.verification.response', {
        type: 'verification.response',
        to: from,
        escrowId,
        ...result
      });
    }
  } catch (error) {
    console.error('A2A verification error:', error);
  }
}

// A2A: Handle consensus request
async function handleConsensusRequest(data) {
  const { escrowId, verifierResults } = data;
  
  try {
    const consensus = await performConsensus(escrowId, verifierResults);
    multiVerifierResults.set(escrowId, consensus);
    console.log(`✅ Consensus reached for ${escrowId}: ${consensus.consensusPassed ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.error('A2A consensus error:', error);
  }
}

// Start server
async function start() {
  await initHCS10Connection();
  
  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   Enhanced VerificationAgent v2.0      ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`✅ Running on port ${PORT}`);
    console.log(`📡 A2A Protocol: v2.0 (HCS-10)`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}`);
    console.log(`🔍 Verification Types: ${Object.values(VerificationType).join(', ')}\n`);
  });
}

start().catch(console.error);

module.exports = { app, AGENT_CARD };



