const nacl = require('tweetnacl');
const { encode: b64encode, decode: b64decode } = require('base64-arraybuffer');

/**
 * Sign a JSON payload using ed25519
 * @param {Object} payloadObj - The payload object to sign
 * @param {string} privateKeyBase64 - Base64 encoded private key
 * @returns {string} Base64 encoded signature
 */
function signJSON(payloadObj, privateKeyBase64) {
  // Deterministic property ordering: JSON.stringify with stable ordering
  const canonical = canonicalize(payloadObj);
  const pk = base64ToUint8Array(privateKeyBase64);
  const message = new TextEncoder().encode(canonical);
  const sig = nacl.sign.detached(message, pk);
  return b64encode(sig);
}

/**
 * Verify a JSON signature
 * @param {Object} payloadObj - The payload object that was signed
 * @param {string} signatureBase64 - Base64 encoded signature
 * @param {string} publicKeyBase64 - Base64 encoded public key
 * @returns {boolean} True if signature is valid
 */
function verifyJSON(payloadObj, signatureBase64, publicKeyBase64) {
  const canonical = canonicalize(payloadObj);
  const message = new TextEncoder().encode(canonical);
  const signature = base64ToUint8Array(signatureBase64);
  const publicKey = base64ToUint8Array(publicKeyBase64);
  return nacl.sign.detached.verify(message, signature, publicKey);
}

/**
 * Generate a new ed25519 keypair
 * @returns {Object} { publicKey: string, privateKey: string } in base64
 */
function generateKeypair() {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: b64encode(keypair.publicKey),
    privateKey: b64encode(keypair.secretKey),
  };
}

/**
 * Minimal canonicalizer for deterministic JSON
 */
function canonicalize(obj) {
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
function base64ToUint8Array(b64) {
  const binary = Buffer.from(b64, 'base64');
  return new Uint8Array(binary);
}

module.exports = {
  signJSON,
  verifyJSON,
  generateKeypair,
  canonicalize,
};

