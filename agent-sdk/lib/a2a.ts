import 'dotenv/config';
// This file now uses HCS-10 instead of NATS for backward compatibility
import { 
  init as initHCS10, 
  sendA2A as sendHCS10, 
  subscribe as subscribeHCS10, 
  isConnected as isHCS10Connected, 
  close as closeHCS10, 
  getConnection as getHCS10Client 
} from './hcs10';

// Type definitions
interface InitOptions {
  agentName?: string;
  agentDescription?: string;
  capabilities?: any[];
}

type MessageHandler = (message: any, metadata?: any) => Promise<void> | void;

let initialized = false;

/**
 * Initialize HCS-10 connection (replaces NATS)
 * @param url - Ignored (kept for backward compatibility)
 * @param options - Optional agent configuration
 */
export async function init(url?: string | null, options: InitOptions = {}): Promise<void> {
  if (initialized) return;
  
  try {
    // Try to detect agent name from calling file or use provided name
    const agentName = options.agentName || process.env.AGENT_NAME || 'A2A Agent';
    
    await initHCS10({
      network: (process.env.HEDERA_NETWORK || 'testnet') as 'testnet' | 'mainnet',
      agentName: agentName,
      agentDescription: options.agentDescription || process.env.AGENT_DESCRIPTION || 'A2A-compliant agent using HCS-10',
      capabilities: options.capabilities,
    });
    initialized = true;
    console.log(`[A2A] ✅ Connected to HCS-10 network (replacing NATS)`);
  } catch (error: any) {
    console.error(`[A2A] ❌ Failed to connect to HCS-10: ${error.message}`);
    throw error;
  }
}

/**
 * Send A2A message to a subject/topic (maps to HCS-10)
 */
export async function sendA2A(subject: string, message: any): Promise<void> {
  if (!initialized) {
    await init();
  }
  
  try {
    await sendHCS10(subject, message);
  } catch (error: any) {
    console.error(`[A2A] Failed to publish to ${subject}:`, error.message);
    throw error;
  }
}

/**
 * Subscribe to A2A messages on a subject (maps to HCS-10)
 */
export function subscribe(subject: string, handler: MessageHandler): void {
  if (!initialized) {
    throw new Error('Not connected. Call init() first.');
  }
  
  subscribeHCS10(subject, handler);
}

/**
 * Close HCS-10 connection
 */
export async function close(): Promise<void> {
  if (initialized) {
    await closeHCS10();
    initialized = false;
    console.log('[A2A] Connection closed');
  }
}

/**
 * Check if HCS-10 connection is active
 */
export function isConnected(): boolean {
  return initialized && isHCS10Connected();
}

/**
 * Get HCS-10 client (replaces NATS connection object)
 */
export function getConnection(): any {
  return getHCS10Client();
}

// Export for backward compatibility
export const nc: any = null; // Deprecated - use getConnection() instead
export const sc: any = null; // Deprecated - not needed with HCS-10
