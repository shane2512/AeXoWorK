/**
 * DataAgent - A2A Protocol Compliant
 * Manages dataset marketplace, micropayments, and A2A data purchases
 * Based on: https://github.com/a2aproject/A2A
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { sendA2A, subscribe, init as initA2A } from '../lib/a2a';

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

const PORT = parseInt(process.env.DATA_AGENT_PORT || '3006', 10);
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

interface Listing {
  id: string | number;
  name: string;
  description: string;
  dataHash: string;
  pricingModel: number;
  price: string;
  provider: string;
  active: boolean;
  totalSales: number;
  revenue: number;
  createdAt: number;
}

interface Purchase {
  id: string;
  listingId: string | number;
  datasetName: string;
  buyer: string;
  price: string;
  purchasedAt: number;
  expiresAt: number | null;
  active: boolean;
  onChainTx?: string;
}

// A2A Agent Card - Protocol Compliance
const AGENT_CARD: AgentCard = {
  name: 'DataAgent',
  version: '1.0.0',
  description: 'A2A-compliant data marketplace agent for automated dataset purchases and micropayments',
  capabilities: [
    'data.list',
    'data.purchase',
    'data.register',
    'data.access',
    'data.micropayment'
  ],
  methods: {
    'data.list': {
      description: 'List available datasets',
      params: {
        category: 'string (optional)',
        maxPrice: 'number (optional)'
      }
    },
    'data.purchase': {
      description: 'Purchase dataset access via A2A micropayment',
      params: {
        listingId: 'string',
        buyer: 'address',
        duration: 'number (optional)'
      }
    },
    'data.register': {
      description: 'Register a new dataset',
      params: {
        name: 'string',
        description: 'string',
        price: 'number',
        dataHash: 'string',
        provider: 'address'
      }
    },
    'data.access': {
      description: 'Get access credentials for purchased data',
      params: {
        purchaseId: 'string',
        buyer: 'address'
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
  console.warn('[DataAgent] No private key found. Wallet operations will be limited.');
}

// Contract connection
let dataMarketplaceContract: ethers.Contract | null = null;

// In-memory data storage
const listings = new Map<string | number, Listing>();
const purchases = new Map<string, Purchase>();
const accessTokens = new Map<string, string>();

// Pricing models from DataMarketplace contract
const PricingModel = {
  ONE_TIME: 0,
  SUBSCRIPTION: 1,
  PAY_PER_USE: 2
} as const;

async function initContracts(): Promise<void> {
  try {
    const dataMarketplaceAddress = process.env.DATA_MARKETPLACE_ADDRESS;
    if (!dataMarketplaceAddress) {
      console.warn('[DataAgent] DATA_MARKETPLACE_ADDRESS not set. Contract operations will be limited.');
      return;
    }
    
    const dataMarketplaceABI = [
      'function listData(string name, string description, string dataHash, uint8 pricingModel, uint256 price) external returns (uint256)',
      'function purchaseData(uint256 listingId) external payable',
      'function getListing(uint256 listingId) external view returns (tuple(address provider, string name, string description, string dataHash, uint8 pricingModel, uint256 price, bool active, uint256 totalSales, uint256 revenue))',
      'function getProviderListings(address provider) external view returns (uint256[])',
      'event DataListed(uint256 indexed listingId, address indexed provider, string name, uint256 price)',
      'event DataPurchased(uint256 indexed listingId, address indexed buyer, uint256 price)'
    ];

    // Use provider if wallet is null (read-only)
    const signerOrProvider = wallet || provider;
    dataMarketplaceContract = new ethers.Contract(
      dataMarketplaceAddress,
      dataMarketplaceABI,
      signerOrProvider
    );

    console.log('✅ DataMarketplace contract initialized');
  } catch (error: any) {
    console.error('❌ Contract initialization error:', error.message);
  }
}

async function initHCS10Connection(): Promise<void> {
  try {
    await initA2A(undefined, { agentName: 'DataAgent' });
    hcs10Initialized = true;
    console.log('✅ Connected to HCS-10 network');

    // Subscribe to A2A channels using HCS-10
    subscribe('aexowork.data.requests', async (data: any) => {
      try {
        console.log('[A2A] Data request received:', data.requester);
        await handleDataRequest(data);
      } catch (error: any) {
        console.error('[A2A] Data request handling error:', error);
      }
    });

    subscribe('aexowork.data.purchases', async (data: any) => {
      try {
        console.log('[A2A] Purchase confirmation:', data.purchaseId);
        await handlePurchaseConfirmation(data);
      } catch (error: any) {
        console.error('[A2A] Purchase handling error:', error);
      }
    });

    console.log('[A2A] Subscribed to data marketplace channels');
  } catch (error: any) {
    console.error('❌ HCS-10 connection failed:', error.message);
  }
}

// A2A Protocol: Health check & Agent Card
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    agent: 'DataAgent',
    protocol: 'A2A/1.0',
    version: '1.0.0',
    agentCard: AGENT_CARD,
    stats: {
      totalListings: listings.size,
      totalPurchases: purchases.size,
      activeTokens: accessTokens.size,
      revenue: Array.from(purchases.values()).reduce((sum, p) => sum + parseFloat(p.price), 0)
    },
    contracts: {
      dataMarketplace: process.env.DATA_MARKETPLACE_ADDRESS
    }
  });
});

// A2A Protocol: Get Agent Card
app.get('/agent-card', (req: Request, res: Response) => {
  res.json(AGENT_CARD);
});

// Register dataset (A2A method: data.register)
app.post(['/register-data', '/api/data/register'], async (req: Request, res: Response) => {
  try {
    const { name, description, dataHash, pricingModel, price, provider } = req.body;

    if (!dataMarketplaceContract) {
      return res.status(500).json({ error: 'DataMarketplace contract not initialized' });
    }

    // Validate pricing model
    const model = PricingModel[pricingModel as keyof typeof PricingModel] !== undefined 
      ? PricingModel[pricingModel as keyof typeof PricingModel] 
      : PricingModel.ONE_TIME;

    // Register on-chain
    const priceWei = ethers.utils.parseEther(price.toString());
    const tx = await dataMarketplaceContract.listData(
      name,
      description,
      dataHash,
      model,
      priceWei
    );

    const receipt = await tx.wait();
    
    // Extract listing ID from events
    let listingId: string | number = `listing_${Date.now()}`;
    const dataListedEvent = receipt.events?.find((e: any) => e.event === 'DataListed');
    if (dataListedEvent) {
      listingId = dataListedEvent.args.listingId.toNumber();
    }

    // Store in local cache
    const listing: Listing = {
      id: listingId,
      name,
      description,
      dataHash,
      pricingModel: model,
      price,
      provider: provider || (wallet ? wallet.address : '0x0000000000000000000000000000000000000000'),
      active: true,
      totalSales: 0,
      revenue: 0,
      createdAt: Date.now()
    };

    listings.set(listingId, listing);

    // A2A: Broadcast new listing
    if (hcs10Initialized) {
      await sendA2A('aexowork.data.listed', {
        type: 'data.listed',
        listingId,
        name,
        price,
        pricingModel: model,
        provider: listing.provider
      });
    }

    console.log(`✅ Dataset registered: ${listingId} - ${name}`);

    res.json({
      success: true,
      listingId,
      name,
      price,
      onChainTx: tx.hash,
      message: 'Dataset registered successfully'
    });
  } catch (error: any) {
    console.error('❌ Error registering data:', error);
    res.status(500).json({ error: error.message });
  }
});

// List datasets (A2A method: data.list)
app.get(['/datasets', '/api/data/list'], async (req: Request, res: Response) => {
  try {
    const { category, maxPrice, provider } = req.query;

    let datasetList = Array.from(listings.values()).filter(l => l.active);

    // Apply filters
    if (maxPrice) {
      datasetList = datasetList.filter(l => parseFloat(l.price) <= parseFloat(maxPrice as string));
    }

    if (provider) {
      datasetList = datasetList.filter(l => l.provider.toLowerCase() === (provider as string).toLowerCase());
    }

    res.json({
      total: datasetList.length,
      datasets: datasetList.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        price: d.price,
        pricingModel: Object.keys(PricingModel)[d.pricingModel],
        provider: d.provider,
        totalSales: d.totalSales,
        dataHash: d.dataHash.substring(0, 20) + '...' // Partial hash for preview
      }))
    });
  } catch (error: any) {
    console.error('❌ Error listing datasets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Purchase dataset (A2A method: data.purchase)
app.post(['/purchase', '/api/data/purchase'], async (req: Request, res: Response) => {
  try {
    const { listingId, buyer, duration } = req.body;

    if (!dataMarketplaceContract) {
      return res.status(500).json({ error: 'DataMarketplace contract not initialized' });
    }

    const listing = listings.get(parseInt(listingId));
    if (!listing) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (!listing.active) {
      return res.status(400).json({ error: 'Dataset is no longer available' });
    }

    // Execute on-chain purchase
    const priceWei = ethers.utils.parseEther(listing.price.toString());
    const tx = await dataMarketplaceContract.purchaseData(listingId, {
      value: priceWei
    });

    const receipt = await tx.wait();

    // Generate purchase record
    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const purchase: Purchase = {
      id: purchaseId,
      listingId,
      datasetName: listing.name,
      buyer: buyer || (wallet ? wallet.address : '0x0000000000000000000000000000000000000000'),
      price: listing.price,
      purchasedAt: Date.now(),
      expiresAt: duration ? Date.now() + (duration * 86400000) : null, // duration in days
      active: true,
      onChainTx: tx.hash
    };

    purchases.set(purchaseId, purchase);

    // Update listing stats
    listing.totalSales += 1;
    listing.revenue += parseFloat(listing.price);
    listings.set(listingId, listing);

    // Generate access token
    const accessToken = generateAccessToken(purchaseId, purchase.buyer);
    accessTokens.set(purchaseId, accessToken);

    // A2A: Broadcast purchase
    if (hcs10Initialized) {
      await sendA2A('aexowork.data.purchases', {
        type: 'data.purchased',
        purchaseId,
        listingId,
        buyer: purchase.buyer,
        price: listing.price,
        timestamp: Date.now()
      });
    }

    console.log(`✅ Dataset purchased: ${purchaseId} by ${purchase.buyer}`);

    res.json({
      success: true,
      purchaseId,
      accessToken,
      dataHash: listing.dataHash,
      expiresAt: purchase.expiresAt,
      onChainTx: tx.hash,
      message: 'Dataset purchased successfully'
    });
  } catch (error: any) {
    console.error('❌ Error purchasing data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get access to purchased data (A2A method: data.access)
app.get(['/access/:purchaseId', '/api/data/access/:purchaseId'], (req: Request, res: Response) => {
  try {
    const { purchaseId } = req.params;
    const { buyer } = req.query;

    const purchase = purchases.get(purchaseId);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    // Verify buyer
    if (buyer && purchase.buyer.toLowerCase() !== (buyer as string).toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Check expiration
    if (purchase.expiresAt && Date.now() > purchase.expiresAt) {
      return res.status(403).json({ error: 'Access expired' });
    }

    const accessToken = accessTokens.get(purchaseId);
    const listing = listings.get(parseInt(purchase.listingId.toString()));

    res.json({
      success: true,
      purchaseId,
      datasetName: purchase.datasetName,
      accessToken,
      dataHash: listing ? listing.dataHash : null,
      expiresAt: purchase.expiresAt,
      message: 'Access granted'
    });
  } catch (error: any) {
    console.error('❌ Error accessing data:', error);
    res.status(500).json({ error: error.message });
  }
});

// A2A: Handle data request from another agent
async function handleDataRequest(data: any): Promise<void> {
  const { requester, requirements, maxPrice, from } = data;

  // Find matching datasets
  const matches = Array.from(listings.values()).filter(l => {
    return l.active && 
           (maxPrice ? parseFloat(l.price) <= parseFloat(maxPrice) : true);
  });

  // Respond with A2A message
  const response = {
    type: 'data.response',
    to: from || requester,
    agent: 'DataAgent',
    matches: matches.map(m => ({
      listingId: m.id,
      name: m.name,
      description: m.description,
      price: m.price,
      pricingModel: Object.keys(PricingModel)[m.pricingModel]
    })),
    timestamp: Date.now()
  };

  // Reply to requester
  if ((from || requester) && hcs10Initialized) {
    await sendA2A('aexowork.data.response', response);
  }

  console.log(`✅ Sent ${matches.length} dataset matches to ${requester || from}`);
}

// Handle purchase confirmation
async function handlePurchaseConfirmation(data: any): Promise<void> {
  const { purchaseId, buyer, listingId } = data;

  // Verify purchase exists
  if (purchases.has(purchaseId)) {
    console.log(`✅ Purchase confirmed: ${purchaseId}`);
  } else {
    console.log(`⚠️ Unknown purchase confirmation: ${purchaseId}`);
  }
}

// Generate access token for data access
function generateAccessToken(purchaseId: string, buyer: string): string {
  const tokenData = {
    purchaseId,
    buyer,
    issuedAt: Date.now(),
    issuer: 'DataAgent'
  };

  // Simple token (in production, use JWT or similar)
  const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
  return token;
}

// Get purchase history
app.get(['/purchases', '/api/data/purchases'], (req: Request, res: Response) => {
  const { buyer } = req.query;

  let purchaseList = Array.from(purchases.values());

  if (buyer) {
    purchaseList = purchaseList.filter(p => p.buyer.toLowerCase() === (buyer as string).toLowerCase());
  }

  res.json({
    total: purchaseList.length,
    purchases: purchaseList
  });
});

// Get provider revenue
app.get(['/revenue/:provider', '/api/data/revenue/:provider'], (req: Request, res: Response) => {
  const { provider } = req.params;

  const providerListings = Array.from(listings.values()).filter(
    l => l.provider.toLowerCase() === provider.toLowerCase()
  );

  const totalRevenue = providerListings.reduce((sum, l) => sum + l.revenue, 0);
  const totalSales = providerListings.reduce((sum, l) => sum + l.totalSales, 0);

  res.json({
    provider,
    totalListings: providerListings.length,
    totalSales,
    totalRevenue,
    listings: providerListings.map(l => ({
      id: l.id,
      name: l.name,
      sales: l.totalSales,
      revenue: l.revenue
    }))
  });
});

// Start server
async function start(): Promise<void> {
  await initContracts();
  await initHCS10Connection();

  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════╗`);
    console.log(`║   DataAgent (A2A Protocol)             ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`✅ Running on port ${PORT}`);
    console.log(`📡 A2A Protocol: v1.0`);
    console.log(`🔗 Endpoint: http://localhost:${PORT}`);
    console.log(`📄 Agent Card: http://localhost:${PORT}/agent-card\n`);
  });
}

start().catch(console.error);

export { app, AGENT_CARD };


