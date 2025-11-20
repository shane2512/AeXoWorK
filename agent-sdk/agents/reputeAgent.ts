import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { signJSON } from '../lib/signer';
import { sendA2A, subscribe, init as initA2A } from '../lib/a2a';
import axios from 'axios';

/**
 * ReputeAgent - Reputation Management System
 * 
 * Responsibilities:
 * - Calculate multi-dimensional reputation scores
 * - Issue NFT badges based on achievements
 * - Anchor reputation on-chain (hash-only for privacy)
 * - Handle reputation decay over time
 * - Provide reputation API for other agents
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
interface UserStats {
  totalJobs?: number;
  successfulJobs?: number;
  totalResponseTime?: number;
  qualityRatings?: number[];
  stakedRepute?: number;
  accountAge?: number;
  reputationScore?: number;
}

interface ReputationResult {
  reputationScore: number;
  breakdown: {
    successRate: number;
    responseScore: number;
    qualityScore: number;
    consistencyScore: number;
    stakingBonus: number;
  };
  metadata: {
    totalJobs: number;
    successfulJobs: number;
    avgResponseTime: number;
    avgQuality: number;
    stakedRepute: number;
    qualityRatings?: number[];
  };
  calculatedAt?: number;
  tokenBalance?: number;
  staked?: number;
}

interface Badge {
  type: number;
  name: string;
  description?: string;
  proof?: string;
  criteria?: string;
}

interface BadgeIssuance {
  badge: string;
  type: number;
  issuedAt: number;
}

// In-memory reputation cache
const reputationCache = new Map<string, ReputationResult>();
const badgeIssuanceHistory = new Map<string, BadgeIssuance[]>();

// Reputation scoring weights
const REPUTATION_WEIGHTS = {
  successRate: 0.35,      // 35% - Job completion success rate
  responseTime: 0.20,     // 20% - Speed of response/delivery
  qualityScore: 0.25,     // 25% - Average quality ratings
  consistency: 0.10,      // 10% - Consistency over time
  stakingBonus: 0.10      // 10% - REPUTE tokens staked
};

// Badge criteria
const BADGE_CRITERIA = {
  FIRST_JOB: { jobs: 1, type: 0 },
  TEN_JOBS: { jobs: 10, type: 1 },
  HUNDRED_JOBS: { jobs: 100, type: 2 },
  TOP_RATED: { score: 9000, type: 3 }, // 90%+
  SPECIALIST: { jobsInSkill: 20, type: 4 },
  RELIABLE: { successRate: 0.95, jobs: 10, type: 5 },
  FAST_DELIVERY: { avgDeliveryTime: 0.8, jobs: 10, type: 6 }, // 80% of deadline
  DATA_PROVIDER: { datasetsUploaded: 10, type: 7 },
  VERIFIER: { verifications: 100, type: 8 },
  DISPUTE_WINNER: { disputesWon: 5, type: 9 },
  EARLY_ADOPTER: { registeredBefore: Date.now() + 30 * 24 * 60 * 60 * 1000, type: 10 }
};

/**
 * GET / - Health check
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    agent: 'ReputeAgent',
    version: '1.0.0',
    endpoints: {
      'POST /calculate-reputation': 'Calculate reputation for an agent',
      'POST /issue-badge': 'Issue achievement badge',
      'GET /reputation/:address': 'Get reputation score',
      'GET /badges/:address': 'Get user badges',
      'POST /update-reputation': 'Update reputation after job'
    },
    stats: {
      cachedReputation: reputationCache.size,
      badgesIssued: badgeIssuanceHistory.size
    },
    contracts: {
      reputationToken: process.env.REPUTATION_TOKEN_ADDRESS,
      badgeNFT: process.env.BADGE_NFT_ADDRESS,
      reputationManager: process.env.REPUTATION_MANAGER_ADDRESS
    }
  });
});

/**
 * Calculate multi-dimensional reputation score
 */
export function calculateReputation(userStats: UserStats): ReputationResult {
  const {
    totalJobs = 0,
    successfulJobs = 0,
    totalResponseTime = 0,
    qualityRatings = [],
    stakedRepute = 0,
    accountAge = 0
  } = userStats;

  // Success rate (0-100)
  const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 50;

  // Response time score (0-100, lower is better)
  const avgResponseTime = totalJobs > 0 ? totalResponseTime / totalJobs : 24;
  const responseScore = Math.max(0, 100 - (avgResponseTime / 48) * 100);

  // Quality score (0-100)
  const qualityScore = qualityRatings.length > 0
    ? qualityRatings.reduce((sum, r) => sum + r, 0) / qualityRatings.length
    : 75;

  // Consistency score (based on activity over time)
  const consistencyScore = Math.min(100, (accountAge / (365 * 24 * 60 * 60 * 1000)) * 100);

  // Staking bonus (0-100)
  const stakingBonus = Math.min(100, (stakedRepute / 1000) * 100);

  // Calculate weighted score
  const reputationScore = Math.round(
    successRate * REPUTATION_WEIGHTS.successRate +
    responseScore * REPUTATION_WEIGHTS.responseTime +
    qualityScore * REPUTATION_WEIGHTS.qualityScore +
    consistencyScore * REPUTATION_WEIGHTS.consistency +
    stakingBonus * REPUTATION_WEIGHTS.stakingBonus
  );

  return {
    reputationScore,
    breakdown: {
      successRate: Math.round(successRate),
      responseScore: Math.round(responseScore),
      qualityScore: Math.round(qualityScore),
      consistencyScore: Math.round(consistencyScore),
      stakingBonus: Math.round(stakingBonus)
    },
    metadata: {
      totalJobs,
      successfulJobs,
      avgResponseTime: Math.round(avgResponseTime),
      avgQuality: Math.round(qualityScore),
      stakedRepute,
      qualityRatings
    }
  };
}

/**
 * Check if user qualifies for badges
 */
async function checkBadgeEligibility(userStats: UserStats, address: string): Promise<Badge[]> {
  const qualified: Badge[] = [];

  // First Job
  if ((userStats.totalJobs || 0) >= BADGE_CRITERIA.FIRST_JOB.jobs) {
    qualified.push({
      type: BADGE_CRITERIA.FIRST_JOB.type,
      name: 'First Job Complete',
      criteria: 'firstJob'
    });
  }

  // Ten Jobs
  if ((userStats.totalJobs || 0) >= BADGE_CRITERIA.TEN_JOBS.jobs) {
    qualified.push({
      type: BADGE_CRITERIA.TEN_JOBS.type,
      name: '10 Jobs Milestone',
      criteria: 'tenJobs'
    });
  }

  // Top Rated
  if ((userStats.reputationScore || 0) >= BADGE_CRITERIA.TOP_RATED.score) {
    qualified.push({
      type: BADGE_CRITERIA.TOP_RATED.type,
      name: 'Top Rated',
      criteria: 'topRated'
    });
  }

  // Reliable
  const successRate = (userStats.totalJobs || 0) > 0
    ? (userStats.successfulJobs || 0) / (userStats.totalJobs || 1)
    : 0;
  if (successRate >= BADGE_CRITERIA.RELIABLE.successRate &&
      (userStats.totalJobs || 0) >= BADGE_CRITERIA.RELIABLE.jobs) {
    qualified.push({
      type: BADGE_CRITERIA.RELIABLE.type,
      name: 'Reliable',
      criteria: 'reliable'
    });
  }

  return qualified;
}

/**
 * Issue reputation tokens to user
 */
async function mintReputationTokens(address: string, amount: number, reason: string): Promise<boolean> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.HEDERA_RPC_URL || process.env.HEDERA_JSON_RPC_RELAY || 'https://testnet.hashio.io/api');
    const wallet = process.env.HEDERA_PRIVATE_KEY ? new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY, provider) : null;

    if (!wallet || !process.env.REPUTATION_TOKEN_ADDRESS) {
      console.warn('[ReputeAgent] Wallet or token address not configured');
      return false;
    }

    const tokenAbi = [
      'function mintReputation(address to, uint256 amount, string reason) external'
    ];

    const token = new ethers.Contract(
      process.env.REPUTATION_TOKEN_ADDRESS,
      tokenAbi,
      wallet
    );

    const tx = await token.mintReputation(
      address,
      ethers.utils.parseEther(amount.toString()),
      reason
    );

    await tx.wait();
    console.log(`[ReputeAgent] Minted ${amount} REPUTE to ${address}: ${reason}`);

    return true;
  } catch (error: any) {
    console.error('[ReputeAgent] Error minting tokens:', error.message);
    return false;
  }
}

/**
 * Issue NFT badge to user
 */
export async function issueBadge(address: string, badge: Badge): Promise<boolean> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.HEDERA_RPC_URL || process.env.HEDERA_JSON_RPC_RELAY || 'https://testnet.hashio.io/api');
    const wallet = process.env.HEDERA_PRIVATE_KEY ? new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY, provider) : null;

    if (!wallet || !process.env.BADGE_NFT_ADDRESS) {
      console.warn('[ReputeAgent] Wallet or badge NFT address not configured');
      return false;
    }

    const badgeAbi = [
      'function issueBadge(address recipient, uint8 badgeType, string name, string description, string tokenURI, string criteriaMetURI, bool soulbound) external returns (uint256)',
      'function hasType(address user, uint8 badgeType) external view returns (bool)'
    ];

    const badgeNFT = new ethers.Contract(
      process.env.BADGE_NFT_ADDRESS,
      badgeAbi,
      wallet
    );

    // Check if already has this badge type
    const hasType = await badgeNFT.hasType(address, badge.type);
    if (hasType) {
      console.log(`[ReputeAgent] User already has ${badge.name} badge`);
      return false;
    }

    const tx = await badgeNFT.issueBadge(
      address,
      badge.type,
      badge.name,
      badge.description || `Earned ${badge.name} badge`,
      `ipfs://badge-${badge.type}`,
      badge.proof || `ipfs://proof-${Date.now()}`,
      true // soulbound
    );

    const receipt = await tx.wait();
    console.log(`[ReputeAgent] Issued ${badge.name} badge to ${address}`);

    // Track issuance
    if (!badgeIssuanceHistory.has(address)) {
      badgeIssuanceHistory.set(address, []);
    }
    badgeIssuanceHistory.get(address)!.push({
      badge: badge.name,
      type: badge.type,
      issuedAt: Date.now()
    });

    return true;
  } catch (error: any) {
    console.error(`[ReputeAgent] Error issuing badge:`, error.message);
    return false;
  }
}

/**
 * POST /calculate-reputation
 * Calculate reputation score for a user
 */
app.post('/calculate-reputation', async (req: Request, res: Response) => {
  try {
    const { address, userStats } = req.body;

    if (!address || !userStats) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const reputation = calculateReputation(userStats);

    // Cache the result
    reputationCache.set(address, {
      ...reputation,
      calculatedAt: Date.now()
    });

    res.json({
      ok: true,
      address,
      ...reputation
    });
  } catch (error: any) {
    console.error('[ReputeAgent] Error calculating reputation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /issue-badge
 * Manually issue a badge
 */
app.post('/issue-badge', async (req: Request, res: Response) => {
  try {
    const { address, badgeType, name, description } = req.body;

    if (!address || badgeType === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const badge: Badge = {
      type: badgeType,
      name: name || 'Achievement Badge',
      description: description || 'Earned achievement badge',
      proof: `ipfs://proof-${Date.now()}`
    };

    const issued = await issueBadge(address, badge);

    if (issued) {
      res.json({
        ok: true,
        message: 'Badge issued successfully',
        badge
      });
    } else {
      res.status(400).json({ error: 'Badge already exists or failed to issue' });
    }
  } catch (error: any) {
    console.error('[ReputeAgent] Error issuing badge:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /reputation/:address
 * Get reputation score for a user
 */
app.get('/reputation/:address', (req: Request, res: Response) => {
  const { address } = req.params;
  const cached = reputationCache.get(address);

  if (cached) {
    res.json({
      ok: true,
      address,
      reputation: cached,
      tokenBalance: cached.tokenBalance || 0,
      staked: cached.staked || 0
    });
  } else {
    // Return default reputation instead of 404
    const defaultReputation = {
      reputationScore: 0,
      successRate: 0,
      totalJobs: 0,
      completedJobs: 0,
      avgResponseTime: 0,
      avgQualityScore: 0,
      tokenBalance: 0,
      staked: 0
    };
    res.json({
      ok: true,
      address,
      reputation: defaultReputation,
      tokenBalance: 0,
      staked: 0,
      message: 'New user - no reputation data yet'
    });
  }
});

/**
 * POST /update-reputation
 * Update reputation after job completion (called by other agents)
 */
app.post('/update-reputation', async (req: Request, res: Response) => {
  try {
    const { address, jobSuccess, responseTime, qualityRating } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Missing address' });
    }

    // Get current stats (from cache or defaults)
    const cached = reputationCache.get(address) || {
      metadata: {
        totalJobs: 0,
        successfulJobs: 0,
        avgResponseTime: 0,
        qualityRatings: [],
        stakedRepute: 0
      }
    };

    // Update stats
    const previousTotalJobs = cached.metadata?.totalJobs || 0;
    const previousAvgResponseTime = cached.metadata?.avgResponseTime || 0;
    const previousTotalResponseTime = previousAvgResponseTime * previousTotalJobs; // Calculate previous total
    
    const userStats: UserStats = {
      totalJobs: previousTotalJobs + 1,
      successfulJobs: (cached.metadata?.successfulJobs || 0) + (jobSuccess ? 1 : 0),
      totalResponseTime: previousTotalResponseTime + (responseTime || 24), // Add new response time to total
      qualityRatings: [...(cached.metadata?.qualityRatings || []), qualityRating || 75],
      stakedRepute: cached.metadata?.stakedRepute || 0,
      accountAge: (cached as any).accountAge || Date.now() - (30 * 24 * 60 * 60 * 1000)
    };
    
    console.log(`[ReputeAgent] 📊 Updating reputation for ${address}:`);
    console.log(`[ReputeAgent]    Previous: ${previousTotalJobs} jobs, ${previousAvgResponseTime.toFixed(1)}h avg response`);
    console.log(`[ReputeAgent]    New: ${userStats.totalJobs} jobs, ${userStats.successfulJobs} successful, ${responseTime || 24}h response time`);

    // Recalculate reputation
    const reputation = calculateReputation(userStats);
    reputation.metadata.qualityRatings = userStats.qualityRatings;

    // Cache updated reputation
    reputationCache.set(address, {
      ...reputation,
      calculatedAt: Date.now()
    });

    // Mint reputation tokens as reward (1 token per successful job)
    if (jobSuccess) {
      await mintReputationTokens(address, 1, 'Job completed successfully');
    }

    // Check and issue badges
    const qualifiedBadges = await checkBadgeEligibility({
      ...userStats,
      reputationScore: reputation.reputationScore
    }, address);

    for (const badge of qualifiedBadges) {
      await issueBadge(address, badge);
    }

    res.json({
      ok: true,
      address,
      ...reputation,
      badgesEarned: qualifiedBadges.length
    });
  } catch (error: any) {
    console.error('[ReputeAgent] Error updating reputation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Initialize ReputeAgent
 */
export async function init(): Promise<void> {
  console.log('[ReputeAgent] Starting...');

  // Connect to A2A message bus
  await initA2A(undefined, { agentName: 'ReputeAgent' });
  
  // Wait a bit for connection to stabilize
  await new Promise(resolve => setTimeout(resolve, 500));

  // Subscribe to reputation update events from ClientAgent
  console.log('[ReputeAgent] 📡 Subscribing to aexowork.reputation.updates...');
  subscribe('aexowork.reputation.updates', async (msg: any) => {
    const startTime = Date.now();
    console.log(`[ReputeAgent] 📨 Received message on aexowork.reputation.updates at ${new Date().toISOString()}:`, {
      type: msg.type,
      escrowId: msg.escrowId,
      worker: msg.worker,
      client: msg.client,
      scores: msg.scores
    });
    
    if (msg.type === 'reputation.update') {
      console.log(`[ReputeAgent] ✅ Processing reputation update for escrow ${msg.escrowId}`);
      console.log(`[ReputeAgent]    Worker: ${msg.worker}`);
      console.log(`[ReputeAgent]    Client: ${msg.client}`);
      console.log(`[ReputeAgent]    Scores:`, JSON.stringify(msg.scores));
      
      try {
        // Update worker reputation
        if (msg.worker && msg.worker !== 'unknown') {
          // Normalize address - handle DID format or Ethereum address
          let workerAddress = msg.worker;
          
          // If it's a DID, try to extract address or use DID as-is
          if (workerAddress.startsWith('did:')) {
            console.log(`[ReputeAgent] ⚠️  Worker address is a DID: ${workerAddress}, using as-is`);
          } else if (!workerAddress.startsWith('0x')) {
            // Not a valid Ethereum address, skip
            console.warn(`[ReputeAgent] ⚠️  Worker address format not recognized: ${workerAddress}`);
            workerAddress = null;
          }
          
          if (workerAddress) {
            const workerUpdate = {
              address: workerAddress,
              jobSuccess: true,
              responseTime: 24, // Default response time in hours
              qualityRating: msg.scores.worker * 15 // Convert score to rating (5 * 15 = 75)
            };
            
            console.log(`[ReputeAgent] 📝 Updating worker reputation for: ${workerAddress}`);
            
            // Update reputation directly (faster than HTTP call to self)
            console.log(`[ReputeAgent] 📝 Updating worker reputation directly for: ${workerAddress}`);
            const updateStartTime = Date.now();
            
            // Get current stats
            const cached = reputationCache.get(workerAddress) || {
              metadata: {
                totalJobs: 0,
                successfulJobs: 0,
                avgResponseTime: 0,
                qualityRatings: [],
                stakedRepute: 0
              }
            };

            // Update stats
            const previousTotalJobs = cached.metadata?.totalJobs || 0;
            const previousAvgResponseTime = cached.metadata?.avgResponseTime || 0;
            const previousTotalResponseTime = previousAvgResponseTime * previousTotalJobs;
            
            const userStats: UserStats = {
              totalJobs: previousTotalJobs + 1,
              successfulJobs: (cached.metadata?.successfulJobs || 0) + 1,
              totalResponseTime: previousTotalResponseTime + (workerUpdate.responseTime || 24),
              qualityRatings: [...(cached.metadata?.qualityRatings || []), workerUpdate.qualityRating || 75],
              stakedRepute: cached.metadata?.stakedRepute || 0,
              accountAge: (cached as any).accountAge || Date.now() - (30 * 24 * 60 * 60 * 1000)
            };
            
            // Recalculate reputation
            const reputation = calculateReputation(userStats);
            reputation.metadata.qualityRatings = userStats.qualityRatings;

            // Cache updated reputation
            reputationCache.set(workerAddress, {
              ...reputation,
              calculatedAt: Date.now()
            });
            
            const updateTime = Date.now() - updateStartTime;
            console.log(`[ReputeAgent] ✅ Updated worker reputation: ${workerAddress} (took ${updateTime}ms)`);
            console.log(`[ReputeAgent]    New score: ${reputation.reputationScore}`);
            console.log(`[ReputeAgent]    Total jobs: ${reputation.metadata.totalJobs}`);
            console.log(`[ReputeAgent]    Successful jobs: ${reputation.metadata.successfulJobs}`);
          }
        } else {
          console.warn(`[ReputeAgent] ⚠️  Worker address is missing or 'unknown': ${msg.worker}`);
        }
        
        // Update client reputation
        if (msg.client && msg.client !== 'unknown') {
          // Handle both DID and Ethereum addresses
          let clientAddress = msg.client;
          
          if (clientAddress.startsWith('did:')) {
            console.log(`[ReputeAgent] ⚠️  Client address is a DID: ${clientAddress}, using as-is`);
          } else if (!clientAddress.startsWith('0x')) {
            // Not a valid Ethereum address, skip
            console.warn(`[ReputeAgent] ⚠️  Client address format not recognized: ${clientAddress}`);
            clientAddress = null;
          }
          
          if (clientAddress) {
            const clientUpdate = {
              address: clientAddress,
              jobSuccess: true,
              responseTime: 12,
              qualityRating: msg.scores.client * 15
            };
            
            console.log(`[ReputeAgent] 📝 Updating client reputation directly for: ${clientAddress}`);
            const clientUpdateStartTime = Date.now();
            
            // Get current stats
            const clientCached = reputationCache.get(clientAddress) || {
              metadata: {
                totalJobs: 0,
                successfulJobs: 0,
                avgResponseTime: 0,
                qualityRatings: [],
                stakedRepute: 0
              }
            };

            // Update stats
            const clientPreviousTotalJobs = clientCached.metadata?.totalJobs || 0;
            const clientPreviousAvgResponseTime = clientCached.metadata?.avgResponseTime || 0;
            const clientPreviousTotalResponseTime = clientPreviousAvgResponseTime * clientPreviousTotalJobs;
            
            const clientUserStats: UserStats = {
              totalJobs: clientPreviousTotalJobs + 1,
              successfulJobs: (clientCached.metadata?.successfulJobs || 0) + 1,
              totalResponseTime: clientPreviousTotalResponseTime + (clientUpdate.responseTime || 12),
              qualityRatings: [...(clientCached.metadata?.qualityRatings || []), clientUpdate.qualityRating || 75],
              stakedRepute: clientCached.metadata?.stakedRepute || 0,
              accountAge: (clientCached as any).accountAge || Date.now() - (30 * 24 * 60 * 60 * 1000)
            };
            
            // Recalculate reputation
            const clientReputation = calculateReputation(clientUserStats);
            clientReputation.metadata.qualityRatings = clientUserStats.qualityRatings;

            // Cache updated reputation
            reputationCache.set(clientAddress, {
              ...clientReputation,
              calculatedAt: Date.now()
            });
            
            const clientUpdateTime = Date.now() - clientUpdateStartTime;
            console.log(`[ReputeAgent] ✅ Updated client reputation: ${clientAddress} (took ${clientUpdateTime}ms)`);
            console.log(`[ReputeAgent]    New score: ${clientReputation.reputationScore}`);
            console.log(`[ReputeAgent]    Total jobs: ${clientReputation.metadata.totalJobs}`);
          }
        } else {
          console.warn(`[ReputeAgent] ⚠️  Client address is missing or 'unknown': ${msg.client}`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`[ReputeAgent] ✅ Reputation update processed for escrow ${msg.escrowId} (total time: ${totalTime}ms)`);
        
        // Send confirmation back to ClientAgent (optional - for tracking)
        try {
          await sendA2A('aexowork.reputation.updated', {
            type: 'reputation.updated',
            escrowId: msg.escrowId,
            worker: msg.worker,
            client: msg.client,
            processedAt: Date.now(),
            processingTime: totalTime,
            to: msg.fromAccountId || process.env.CLIENT_AGENT_ACCOUNT_ID
          });
          console.log(`[ReputeAgent] 📤 Sent confirmation to ClientAgent`);
        } catch (confirmError: any) {
          // Non-critical, just log
          console.log(`[ReputeAgent] ⚠️  Could not send confirmation: ${confirmError.message}`);
        }
      } catch (error: any) {
        const totalTime = Date.now() - startTime;
        console.error(`[ReputeAgent] ❌ Error processing reputation update (after ${totalTime}ms):`, error);
        console.error(`[ReputeAgent]    Stack:`, error.stack);
      }
    } else {
      console.log(`[ReputeAgent] ⚠️  Ignoring message type: ${msg.type}`);
    }
  });

  // Subscribe to job completion events (legacy)
  subscribe('aexowork.job.completed', async (msg: any) => {
    if (msg.type === 'JobCompleted') {
      console.log(`[ReputeAgent] Job completed: ${msg.jobId}`);
      // Update reputation for both parties
      // This would be triggered by EscrowAgent or similar
    }
  });

  // Start HTTP server
  const port = parseInt(process.env.REPUTE_AGENT_PORT || '3004', 10);
  app.listen(port, () => {
    console.log(`[ReputeAgent] Running on port ${port}`);
    console.log(`[ReputeAgent] Reputation Token: ${process.env.REPUTATION_TOKEN_ADDRESS}`);
    console.log(`[ReputeAgent] Badge NFT: ${process.env.BADGE_NFT_ADDRESS}`);
  });
}

// Start if run directly
if (require.main === module) {
  init().catch(console.error);
}

export { app };

