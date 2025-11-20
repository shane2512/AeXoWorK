import nacl from 'tweetnacl';
import { encode as b64encode, decode as b64decode } from 'base64-arraybuffer';

/**
 * Sign a JSON payload using ed25519
 */
export function signJSON(payloadObj: any, privateKeyBase64: string): string {
  // Deterministic property ordering: JSON.stringify with stable ordering
  const canonical = canonicalize(payloadObj);
  const pk = base64ToUint8Array(privateKeyBase64);
  const message = new TextEncoder().encode(canonical);
  const sig = nacl.sign.detached(message, pk);
  return b64encode(sig);
}

/**
 * Verify a JSON signature
 */
export function verifyJSON(payloadObj: any, signatureBase64: string, publicKeyBase64: string): boolean {
  const canonical = canonicalize(payloadObj);
  const message = new TextEncoder().encode(canonical);
  const signature = base64ToUint8Array(signatureBase64);
  const publicKey = base64ToUint8Array(publicKeyBase64);
  return nacl.sign.detached.verify(message, signature, publicKey);
}

/**
 * Generate a new ed25519 keypair
 */
export function generateKeypair(): { publicKey: string; privateKey: string } {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: b64encode(keypair.publicKey),
    privateKey: b64encode(keypair.secretKey),
  };
}

/**
 * Minimal canonicalizer for deterministic JSON
 */
export function canonicalize(obj: any): string {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') +
    '}'
  );
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = Buffer.from(b64, 'base64');
  return new Uint8Array(binary);
}


