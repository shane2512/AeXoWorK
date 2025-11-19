#!/usr/bin/env node

/**
 * Generate ed25519 keypair for agent signing
 * Run: node scripts/generate-keys.js
 */

const nacl = require('tweetnacl');

function generateKeypair() {
  const keypair = nacl.sign.keyPair();
  
  // Convert to base64
  const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
  const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
  
  // Generate DID
  const did = `did:hedera:testnet:z${publicKeyBase64.substring(0, 46)}`;
  
  console.log('\n=== Agent Keypair Generated ===\n');
  console.log('Public Key (base64):');
  console.log(publicKeyBase64);
  console.log('\nPrivate Key (base64):');
  console.log(privateKeyBase64);
  console.log('\nDID:');
  console.log(did);
  console.log('\n=== Add these to your .env file ===\n');
  console.log(`AGENT_DID="${did}"`);
  console.log(`AGENT_PRIVATE_KEY_BASE64="${privateKeyBase64}"`);
  console.log('\n');
}

generateKeypair();

