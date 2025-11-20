/**
 * EscrowAgent - A2A Protocol Compliant (Enhanced)
 * Automated escrow operations, milestone management, and auto-release
 * Based: https://github.com/a2aproject/A2A
 */

import express, { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { sendA2A, subscribe, init as initA2A } from '../lib/a2a';
import 'dotenv/config';

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

const PORT = parseInt(process.env.ESCROW_AGENT_PORT || '3007', 10);
let hcs10Initialized = false;

// Type definitions
interface AgentCard {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  methods: Record<string, any>;
  transport: string;
  endpoint: string;
  protocols: string[];
}

interface Escrow {
  id: string | number;
  jobId?: string;
  client: string;
  worker?: string;
  freelancer?: string;
  amount?: string;
  totalAmount?: string;
  description?: string;
  status: string;
  autoRelease?: boolean;
  createdAt: number;
  onChainTx?: string;
  releasedAt?: number;
  releaseTxHash?: string;
  milestonesCount?: number;
}

interface Milestone {
  index: number;
  title: string;
  description: string;
  amount: string;
  deadline: number;
  completed: boolean;
  approved: boolean;
  released: boolean;
}

interface AutoReleaseQueueItem {
  escrowId: string;
  awaitingVerification: boolean;
}

// A2A Agent Card - Protocol Compliance
const AGENT_CARD: AgentCard = {
  name: 'EscrowAgent',
  version: '2.0.0',
  description: 'A2A-compliant enhanced escrow agent with automated operations and milestone management',
  capabilities: [
    'escrow.create',
    'escrow.fund',
    'escrow.release',
    'escrow.refund',
    'escrow.milestone.complete',
    'escrow.auto_release',
    'escrow.multi_party'
  ],
  methods: {
    'escrow.create': {
      description: 'Create a new escrow',
      params: {
        jobId: 'string',
        client: 'address',
        worker: 'address',
        amount: 'number',
        milestones: 'array (optional)'
      }
    },
    'escrow.release': {
      description: 'Release escrowed funds to worker',
      params: {
        escrowId: 'string',
        amount: 'number (optional - for partial release)'
      }
    },
    'escrow.auto_release': {
      description: 'Automatically release funds based on verification',
      params: {
        escrowId: 'string',
        verificationProof: 'string'
      }
    },
    'escrow.milestone.complete': {
      description: 'Mark milestone as complete and release funds',
      params: {
        escrowId: 'string',
        milestoneIndex: 'number'
      }
    }
  },
  transport: 'http',
  endpoint: `http://localhost:${PORT}`,
  protocols: ['A2A/1.0', 'JSON-RPC/2.0']
};

// Hedera connection
const provider = new ethers.providers.JsonRpcProvider(process.env.HEDERA_JSON_RPC_RELAY || process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api');
let wallet: ethers.Wallet | null = null;
if (process.env.HEDERA_PRIVATE_KEY || process.env.PRIVATE_KEY) {
  wallet = new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY || process.env.PRIVATE_KEY!, provider);
} else {
  console.warn('[EscrowAgent] No private key found. Wallet operations will be limited.');
}

// Contract connections
let escrowManagerContract: ethers.Contract | null = null;
let milestoneEscrowContract: ethers.Contract | null = null;

// In-memory escrow tracking
const escrows = new Map<string | number, Escrow>();
const milestones = new Map<string, Milestone[]>();
const autoReleaseQueue = new Map<string, AutoReleaseQueueItem>();

// Escrow status
const EscrowStatus = {
  CREATED: 'created',
  FUNDED: 'funded',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed'
} as const;

async function initContracts(): Promise<void> {
  try {
    const escrowManagerAddress = process.env.ESCROW_MANAGER_ADDRESS;
    if (!escrowManagerAddress) {
      console.warn('[EscrowAgent] ESCROW_MANAGER_ADDRESS not set. Contract operations will be limited.');
      return;
    }
    
    // Standard EscrowManager
    const escrowManagerABI = [
      'function createEscrow(address worker, string description) external payable returns (uint256)',
      'function releasePayment(uint256 escrowId) external',
      'function refund(uint256 escrowId) external',
      'function getEscrow(uint256 escrowId) external view returns (tuple(address client, address worker, uint256 amount, bool completed, bool refunded))',
      'event EscrowCreated(uint256 indexed escrowId, address indexed client, address indexed worker, uint256 amount)',
      'event PaymentReleased(uint256 indexed escrowId, address indexed worker, uint256 amount)',
      'event PaymentRefunded(uint256 indexed escrowId, address indexed client, uint256 amount)'
    ];

    // Use provider if wallet is null (read-only)
    const signerOrProvider = wallet || provider;
    escrowManagerContract = new ethers.Contract(
      escrowManagerAddress,
      escrowManagerABI,
      signerOrProvider
    );
    console.log('✅ EscrowManager contract initialized');

    // MilestoneEscrow (new)
    const milestoneEscrowABI = [
      'function createEscrow(bytes32 escrowId, address freelancer, string[] titles, string[] descriptions, uint256[] amounts, uint256[] deadlines) external payable',
      'function completeMilestone(bytes32 escrowId, uint256 milestoneIndex) external',
      'function approveMilestone(bytes32 escrowId, uint256 milestoneIndex) external',
      'function releaseMilestone(bytes32 escrowId, uint256 milestoneIndex) external',
      'function getEscrow(bytes32 escrowId) external view returns (tuple(address client, address freelancer, uint256 totalAmount, uint256 releasedAmount, bool completed))',
      'function getMilestone(bytes32 escrowId, uint256 index) external view returns (tuple(string title, string description, uint256 amount, uint256 deadline, bool completed, bool approved, bool released))'
    ];

    const milestoneEscrowAddress = process.env.MILESTONE_ESCROW_ADDRESS;
    if (milestoneEscrowAddress) {
      milestoneEscrowContract = new ethers.Contract(
        milestoneEscrowAddress,
        milestoneEscrowABI,
        signerOrProvider
      );
      console.log('✅ MilestoneEscrow contract initialized');
    }

    console.log('✅ Escrow contracts initialized');
  } catch (error: any) {
    console.error('❌ Contract initialization error:', error.message);
  }
}

async function initHCS10Connection(): Promise<void> {
  try {
    await initA2A(undefined, { agentName: 'EscrowAgent' });
    hcs10Initialized = true;
    console.log('✅ Connected to HCS-10 network');

    // Subscribe to A2A channels using HCS-10
    subscribe('aexowork.escrow.requests', async (data: any) => {
      try {
        console.log('[A2A] Escrow request received:', data.jobId);
        await handleEscrowRequest(data);
      } catch (error: any) {
        console.error('[A2A] Escrow request handling error:', error);
      }
    });

    subscribe('aexowork.escrow.created', async (data: any) => {
      try {
        console.log('[A2A] Escrow created notification:', data.escrowId);
        
        // Store escrow info for tracking
        const escrow: Escrow = {
          id: data.escrowId,
          jobId: data.jobId,
          client: data.client,
          worker: data.worker,
          amount: data.amount,
          description: `Job: ${data.jobId}`,
          status: EscrowStatus.FUNDED,
          autoRelease: data.autoRelease || false,
          createdAt: data.timestamp || Date.now(),
          onChainTx: data.onChainTx
        };
        
        escrows.set(data.escrowId, escrow);
        
        // Add to auto-release queue if enabled
        if (data.autoRelease) {
          autoReleaseQueue.set(data.escrowId, {
            escrowId: data.escrowId,
            awaitingVerification: true
          });
        }
        
        console.log(`✅ Escrow tracked: ${data.escrowId} - ${data.amount} HBAR`);
      } catch (error: any) {
        console.error('[A2A] Escrow created notification error:', error);
      }
    });

    subscribe('aexowork.escrow.released', async (data: any) => {
      try {
        console.log('[A2A] Escrow released notification:', data.escrowId);
        
        // Update escrow status to completed
        const escrowIdStr = data.escrowId.toString();
        let escrow = escrows.get(escrowIdStr);
        
        // Try to find by numeric ID if string lookup fails
        if (!escrow) {
          for (const [id, e] of escrows.entries()) {
            if (id.toString() === escrowIdStr || e.id === escrowIdStr) {
              escrow = e;
              break;
            }
          }
        }
        
        if (escrow) {
          escrow.status = EscrowStatus.COMPLETED;
          escrow.releasedAt = data.timestamp || Date.now();
          escrow.releaseTxHash = data.txHash;
          escrows.set(escrow.id || escrowIdStr, escrow);
          
          // Remove from auto-release queue if present
          autoReleaseQueue.delete(escrow.id?.toString() || escrowIdStr);
          
          console.log(`✅ Escrow status updated to COMPLETED: ${data.escrowId}`);
          console.log(`   Released to: ${data.worker}`);
          console.log(`   Transaction: ${data.txHash || 'N/A'}`);
        } else {
          console.warn(`⚠️  Escrow ${data.escrowId} not found in tracking, but release notification received`);
        }
      } catch (error: any) {
        console.error('[A2A] Escrow released notification error:', error);
      }
    });

    subscribe('aexowork.verification.complete', async (data: any) => {
      try {
        console.log('[A2A] Verification complete:', data.escrowId);
        await handleAutoRelease(data);
      } catch (error: any) {
        console.error('[A2A] Auto-release error:', error);
      }
    });

    subscribe('aexowork.milestone.complete', async (data: any) => {
      try {
        console.log('[A2A] Milestone complete:', data.escrowId, data.milestoneIndex);
        await handleMilestoneComplete(data);
      } catch (error: any) {
        console.error('[A2A] Milestone handling error:', error);
      }
    });

    console.log('[A2A] Subscribed to escrow channels');
  } catch (error: any) {
    console.error('❌ HCS-10 connection failed:', error.message);
  }
}

// A2A Protocol: Health check & Agent Card
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    agent: 'EscrowAgent',
    protocol: 'A2A/2.0',
    version: '2.0.0',
    agentCard: AGENT_CARD,
    stats: {
      totalEscrows: escrows.size,
      active: Array.from(escrows.values()).filter(e => e.status === EscrowStatus.IN_PROGRESS).length,
      completed: Array.from(escrows.values()).filter(e => e.status === EscrowStatus.COMPLETED).length,
      totalValue: Array.from(escrows.values()).reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0),
      autoReleaseQueue: autoReleaseQueue.size
    },
    contracts: {
      escrowManager: process.env.ESCROW_MANAGER_ADDRESS,
      milestoneEscrow: process.env.MILESTONE_ESCROW_ADDRESS
    }
  });
});

// A2A Protocol: Get Agent Card
app.get('/agent-card', (req: Request, res: Response) => {
  res.json(AGENT_CARD);
});

// Create standard escrow (A2A method: escrow.create)
app.post(['/create-escrow', '/api/escrow/create'], async (req: Request, res: Response) => {
  try {
    const { jobId, client, worker, amount, description, autoRelease } = req.body;

    if (!escrowManagerContract) {
      return res.status(500).json({ error: 'EscrowManager contract not initialized' });
    }

    const amountWei = ethers.utils.parseEther(amount.toString());

    // Create on-chain escrow
    const tx = await escrowManagerContract.createEscrow(worker, description || `Job ${jobId}`, {
      value: amountWei
    });

    const receipt = await tx.wait();

    // Extract escrow ID from events
    let escrowId: string | number = `escrow_${Date.now()}`;
    const escrowCreatedEvent = receipt.events?.find((e: any) => e.event === 'EscrowCreated');
    if (escrowCreatedEvent) {
      escrowId = escrowCreatedEvent.args.escrowId.toNumber();
    }

    // Store escrow info
    const escrow: Escrow = {
      id: escrowId,
      jobId,
      client: client || (wallet ? wallet.address : '0x0000000000000000000000000000000000000000'),
      worker,
      amount,
      description,
      status: EscrowStatus.FUNDED,
      autoRelease: autoRelease || false,
      createdAt: Date.now(),
      onChainTx: tx.hash
    };

    escrows.set(escrowId, escrow);

    // Add to auto-release queue if enabled
    if (autoRelease) {
      autoReleaseQueue.set(escrowId.toString(), {
        escrowId: escrowId.toString(),
        awaitingVerification: true
      });
    }

    // A2A: Broadcast escrow creation
    if (hcs10Initialized) {
      await sendA2A('aexowork.escrow.created', {
        type: 'escrow.created',
        escrowId,
        jobId,
        client: escrow.client,
        worker,
        amount,
        autoRelease,
        timestamp: Date.now()
      });
    }

    console.log(`✅ Escrow created: ${escrowId} - ${amount} HBAR`);

    res.json({
      success: true,
      escrowId,
      amount,
      status: escrow.status,
      autoRelease,
      onChainTx: tx.hash,
      message: 'Escrow created and funded'
    });
  } catch (error: any) {
    console.error('❌ Error creating escrow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create milestone-based escrow (A2A method: escrow.create with milestones)
app.post(['/create-milestone-escrow', '/api/escrow/milestone/create'], async (req: Request, res: Response) => {
  try {
    const { jobId, client, freelancer, milestones: milestonesData } = req.body;

    if (!milestoneEscrowContract) {
      return res.status(500).json({ error: 'MilestoneEscrow contract not initialized' });
    }

    // Generate escrow ID
    const escrowId = ethers.utils.id(`escrow_${jobId}_${Date.now()}`);

    // Parse milestones
    const titles = milestonesData.map((m: any) => m.title);
    const descriptions = milestonesData.map((m: any) => m.description);
    const amounts = milestonesData.map((m: any) => ethers.utils.parseEther(m.amount.toString()));
    const deadlines = milestonesData.map((m: any) => Math.floor(m.deadline / 1000)); // Convert to seconds

    const totalAmount = amounts.reduce((sum, amt) => sum.add(amt), ethers.BigNumber.from(0));

    // Create on-chain milestone escrow
    const tx = await milestoneEscrowContract.createEscrow(
      escrowId,
      freelancer,
      titles,
      descriptions,
      amounts,
      deadlines,
      { 
        value: totalAmount,
        gasLimit: 1000000
      }
    );

    await tx.wait();

    // Store escrow info
    const escrow: Escrow = {
      id: escrowId,
      jobId,
      client: client || (wallet ? wallet.address : '0x0000000000000000000000000000000000000000'),
      freelancer,
      totalAmount: ethers.utils.formatEther(totalAmount),
      milestonesCount: milestonesData.length,
      status: EscrowStatus.IN_PROGRESS,
      createdAt: Date.now(),
      onChainTx: tx.hash
    };

    escrows.set(escrowId, escrow);

    // Store milestones
    milestones.set(escrowId, milestonesData.map((m: any, idx: number) => ({
      index: idx,
      title: m.title,
      description: m.description,
      amount: m.amount,
      deadline: m.deadline,
      completed: false,
      approved: false,
      released: false
    })));

    // A2A: Broadcast milestone escrow creation
    if (hcs10Initialized) {
      await sendA2A('aexowork.escrow.created', {
        type: 'escrow.milestone.created',
        escrowId,
        jobId,
        client: escrow.client,
        freelancer,
        totalAmount: escrow.totalAmount,
        milestonesCount: milestonesData.length,
        timestamp: Date.now()
      });
    }

    console.log(`✅ Milestone escrow created: ${escrowId} - ${escrow.totalAmount} HBAR`);

    res.json({
      success: true,
      escrowId,
      totalAmount: escrow.totalAmount,
      milestonesCount: milestonesData.length,
      status: escrow.status,
      onChainTx: tx.hash,
      message: 'Milestone escrow created'
    });
  } catch (error: any) {
    console.error('❌ Error creating milestone escrow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Release payment (A2A method: escrow.release)
app.post(['/release', '/api/escrow/release'], async (req: Request, res: Response) => {
  try {
    const { escrowId } = req.body;

    if (!escrowManagerContract) {
      return res.status(500).json({ error: 'EscrowManager contract not initialized' });
    }

    const escrow = escrows.get(parseInt(escrowId));
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // Release on-chain
    const tx = await escrowManagerContract.releasePayment(escrowId);
    await tx.wait();

    // Update status
    escrow.status = EscrowStatus.COMPLETED;
    escrow.releasedAt = Date.now();
    escrows.set(parseInt(escrowId), escrow);

    // Remove from auto-release queue
    autoReleaseQueue.delete(escrowId);

    // A2A: Broadcast release
    if (hcs10Initialized) {
      await sendA2A('aexowork.escrow.released', {
        type: 'escrow.released',
        escrowId,
        worker: escrow.worker,
        amount: escrow.amount,
        timestamp: Date.now()
      });
    }

    console.log(`✅ Escrow released: ${escrowId} to ${escrow.worker}`);

    res.json({
      success: true,
      escrowId,
      status: escrow.status,
      worker: escrow.worker,
      amount: escrow.amount,
      message: 'Payment released to worker'
    });
  } catch (error: any) {
    console.error('❌ Error releasing escrow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete milestone (A2A method: escrow.milestone.complete)
app.post(['/milestone/complete', '/api/escrow/milestone/complete'], async (req: Request, res: Response) => {
  try {
    const { escrowId, milestoneIndex } = req.body;

    if (!milestoneEscrowContract) {
      return res.status(500).json({ error: 'MilestoneEscrow contract not initialized' });
    }

    // Complete on-chain
    const tx = await milestoneEscrowContract.completeMilestone(escrowId, milestoneIndex, {
      gasLimit: 500000
    });
    await tx.wait();

    // Update local milestone
    const escrowMilestones = milestones.get(escrowId);
    if (escrowMilestones && escrowMilestones[milestoneIndex]) {
      escrowMilestones[milestoneIndex].completed = true;
      milestones.set(escrowId, escrowMilestones);
    }

    console.log(`✅ Milestone completed: ${escrowId} - Milestone ${milestoneIndex}`);

    res.json({
      success: true,
      escrowId,
      milestoneIndex,
      message: 'Milestone marked as complete'
    });
  } catch (error: any) {
    console.error('❌ Error completing milestone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve and release milestone
app.post(['/milestone/approve', '/api/escrow/milestone/approve'], async (req: Request, res: Response) => {
  try {
    const { escrowId, milestoneIndex } = req.body;

    if (!milestoneEscrowContract) {
      return res.status(500).json({ error: 'MilestoneEscrow contract not initialized' });
    }

    // Approve on-chain
    const tx = await milestoneEscrowContract.approveMilestone(escrowId, milestoneIndex, {
      gasLimit: 500000
    });
    await tx.wait();

    // Update local milestone
    const escrowMilestones = milestones.get(escrowId);
    if (escrowMilestones && escrowMilestones[milestoneIndex]) {
      escrowMilestones[milestoneIndex].approved = true;
      escrowMilestones[milestoneIndex].released = true;
      milestones.set(escrowId, escrowMilestones);
    }

    // A2A: Broadcast milestone release
    if (hcs10Initialized) {
      await sendA2A('aexowork.milestone.released', {
        type: 'milestone.released',
        escrowId,
        milestoneIndex,
        timestamp: Date.now()
      });
    }

    console.log(`✅ Milestone approved & released: ${escrowId} - Milestone ${milestoneIndex}`);

    res.json({
      success: true,
      escrowId,
      milestoneIndex,
      message: 'Milestone approved and payment released'
    });
  } catch (error: any) {
    console.error('❌ Error approving milestone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get escrow details
app.get(['/escrow/:escrowId', '/api/escrow/:escrowId'], (req: Request, res: Response) => {
  const { escrowId } = req.params;
  const escrow = escrows.get(parseInt(escrowId)) || escrows.get(escrowId);

  if (!escrow) {
    return res.status(404).json({ error: 'Escrow not found' });
  }

  const escrowMilestones = milestones.get(escrowId);

  res.json({
    escrow,
    milestones: escrowMilestones || null
  });
});

// List all escrows
app.get(['/escrows', '/api/escrows'], (req: Request, res: Response) => {
  const { status, client, worker } = req.query;

  let escrowList = Array.from(escrows.values());

  if (status) {
    escrowList = escrowList.filter(e => e.status === status);
  }

  if (client) {
    escrowList = escrowList.filter(e => e.client.toLowerCase() === (client as string).toLowerCase());
  }

  if (worker) {
    escrowList = escrowList.filter(e => e.worker && e.worker.toLowerCase() === (worker as string).toLowerCase());
  }

  res.json({
    total: escrowList.length,
    escrows: escrowList
  });
});

// A2A: Handle escrow request from another agent
async function handleEscrowRequest(data: any): Promise<void> {
  const { jobId, client, worker, amount, autoRelease, from } = data;

  if (!escrowManagerContract) {
    console.error('❌ EscrowManager contract not initialized');
    return;
  }

  try {
    // Auto-create escrow
    // Handle amount conversion - ensure it's a valid number string
    let amountWei: ethers.BigNumber;
    if (typeof amount === 'string' && amount.includes('e')) {
      // Handle scientific notation by converting to fixed decimal
      const numAmount = parseFloat(amount);
      amountWei = ethers.utils.parseEther(numAmount.toFixed(18));
    } else {
      // Normal number string
      const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error(`Invalid amount: ${amount}`);
      }
      amountWei = ethers.utils.parseEther(numAmount.toString());
    }
    
    const tx = await escrowManagerContract.createEscrow(worker, `Job ${jobId}`, {
      value: amountWei
    });

    const receipt = await tx.wait();
    let escrowId: string | number = `escrow_${Date.now()}`;

    const escrowCreatedEvent = receipt.events?.find((e: any) => e.event === 'EscrowCreated');
    if (escrowCreatedEvent) {
      escrowId = escrowCreatedEvent.args.escrowId.toNumber();
    }

    // Reply with A2A message
    if (from && hcs10Initialized) {
      const response = {
        type: 'escrow.created',
        to: from,
        escrowId,
        success: true,
        amount,
        timestamp: Date.now()
      };
      await sendA2A('aexowork.escrow.response', response);
    }

    console.log(`✅ A2A escrow created: ${escrowId}`);
  } catch (error: any) {
    console.error('❌ A2A escrow creation failed:', error);
  }
}

// A2A: Handle auto-release based on verification
async function handleAutoRelease(data: any): Promise<void> {
  const { escrowId, passed, score } = data;

  if (!escrowManagerContract) {
    console.error('❌ EscrowManager contract not initialized');
    return;
  }

  const autoRelease = autoReleaseQueue.get(escrowId);
  if (!autoRelease) {
    console.log(`⚠️ Escrow ${escrowId} not in auto-release queue`);
    return;
  }

  if (!passed || score < 70) {
    console.log(`⚠️ Verification failed for escrow ${escrowId}. Manual review required.`);
    return;
  }

  // Auto-release payment
  try {
    const tx = await escrowManagerContract.releasePayment(escrowId);
    await tx.wait();

    const escrow = escrows.get(parseInt(escrowId));
    if (escrow) {
      escrow.status = EscrowStatus.COMPLETED;
      escrow.releasedAt = Date.now();
      escrows.set(parseInt(escrowId), escrow);
    }

    autoReleaseQueue.delete(escrowId);

    console.log(`✅ Auto-released escrow: ${escrowId}`);

    // A2A: Broadcast auto-release
    if (hcs10Initialized) {
      await sendA2A('aexowork.escrow.auto_released', {
        type: 'escrow.auto_released',
        escrowId,
        score,
        timestamp: Date.now()
      });
    }
  } catch (error: any) {
    console.error(`❌ Auto-release failed for ${escrowId}:`, error);
  }
}

// A2A: Handle milestone completion
async function handleMilestoneComplete(data: any): Promise<void> {
  const { escrowId, milestoneIndex } = data;

  if (!milestoneEscrowContract) {
    console.error('❌ MilestoneEscrow contract not initialized');
    return;
  }

  try {
    const tx = await milestoneEscrowContract.completeMilestone(escrowId, milestoneIndex, {
      gasLimit: 500000
    });
    await tx.wait();

    console.log(`✅ A2A milestone completed: ${escrowId} - Milestone ${milestoneIndex}`);
  } catch (error: any) {
    console.error('❌ A2A milestone completion failed:', error);
  }
}

// Start server
async function start(): Promise<void> {
  await initContracts();
  await initHCS10Connection();

  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   EscrowAgent (A2A Protocol v2.0)      ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`✅ Running on port ${PORT}`);
    console.log(`📡 A2A Protocol: v2.0`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}`);
    console.log(`📄 Agent Card: http://localhost:${PORT}/agent-card\n`);
  });
}

start().catch(console.error);

export { app, AGENT_CARD };


