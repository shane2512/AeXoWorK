import express, { Request, Response } from 'express';
import { checkEscrowPaid } from '../lib/hedera';
import { downloadJSON } from '../lib/ipfs';

/**
 * x402 Payment-Required HTTP Adapter
 * Implements HTTP 402 status code for payment-gated resources
 */

const app = express();
app.use(express.json());

// Type definitions
interface DeliveryResource {
  resourceCID: string;
  amountHBAR: string;
  createdAt: number;
}

// Store delivery resources in memory (in production, use DB or IPFS)
const deliveryStore = new Map<string, DeliveryResource>();

/**
 * Register a delivery resource with payment requirement
 */
export function registerDelivery(escrowId: string, resourceCID: string, amountHBAR: string): void {
  deliveryStore.set(escrowId, {
    resourceCID,
    amountHBAR,
    createdAt: Date.now(),
  });
  console.log(`[x402] Registered delivery for escrow ${escrowId}`);
}

/**
 * x402 endpoint: GET /deliver/:escrowId
 * Returns 402 Payment Required if not paid
 * Returns resource if payment confirmed on-chain
 */
app.get('/deliver/:escrowId', async (req: Request, res: Response) => {
  const { escrowId } = req.params;
  
  if (!deliveryStore.has(escrowId)) {
    return res.status(404).json({ error: 'Delivery not found' });
  }
  
  const delivery = deliveryStore.get(escrowId)!;
  const escrowManagerAddr = process.env.ESCROW_MANAGER_ADDRESS;
  
  try {
    // Check if escrow is funded on-chain
    const isPaid = await checkEscrowPaid(escrowManagerAddr!, escrowId);
    
    if (!isPaid) {
      // Return 402 Payment Required
      return res.status(402).json({
        error: 'Payment Required',
        invoiceId: escrowId,
        amountHBAR: delivery.amountHBAR,
        paymentInstructions: `Fund escrow ${escrowId} on Hedera EVM at ${escrowManagerAddr}`,
        escrowContract: escrowManagerAddr,
      });
    }
    
    // Payment confirmed - return resource
    const resourceContent = await downloadJSON(delivery.resourceCID);
    return res.json({
      status: 'delivered',
      escrowId,
      resource: resourceContent,
      cid: delivery.resourceCID,
    });
  } catch (error: any) {
    console.error('[x402] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /register-delivery
 * Register a new delivery resource (called by WorkerAgent)
 */
app.post('/register-delivery', (req: Request, res: Response) => {
  const { escrowId, resourceCID, amountHBAR } = req.body;
  
  if (!escrowId || !resourceCID || !amountHBAR) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  registerDelivery(escrowId, resourceCID, amountHBAR);
  
  res.json({
    ok: true,
    deliveryUrl: `${req.protocol}://${req.get('host')}/deliver/${escrowId}`,
  });
});

/**
 * Start the x402 adapter server
 */
export function start(port: number = 4000): void {
  app.listen(port, () => {
    console.log(`[x402] Server running on port ${port}`);
  });
}

// Auto-start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.X402_PORT || '4000', 10);
  start(port);
}

export { app };


