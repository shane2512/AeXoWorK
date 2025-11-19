#!/usr/bin/env node
/**
 * Setup local environment - Auto-configure .env file
 * Run: node setup-local-env.js
 */

const fs = require('fs');
const { ethers } = require('ethers');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('🔧 AexoWork Local Environment Setup\n');
  
  // Get Hedera credentials
  console.log('📝 Enter your Hedera credentials:\n');
  
  const accountId = await question('Hedera Account ID (e.g., 0.0.12345): ');
  const privateKey = await question('Hedera Private Key (ECDSA format): ');
  
  console.log('\n✅ Credentials received!\n');
  
  // Derive EVM address from private key
  let evmAddress = '';
  try {
    const wallet = new ethers.Wallet(privateKey);
    evmAddress = wallet.address;
    console.log('✅ Derived EVM Address:', evmAddress);
  } catch (error) {
    console.log('⚠️  Could not derive EVM address. Will use placeholder.');
    evmAddress = '0x0000000000000000000000000000000000000001';
  }
  
  // Read template
  const template = fs.readFileSync('env.local.template', 'utf8');
  
  // Replace values
  let envContent = template
    .replace('0.0.YOUR_ACCOUNT_ID_HERE', accountId)
    .replace('YOUR_PRIVATE_KEY_HERE', privateKey)
    .replace(/FEE_RECIPIENT_ADDRESS=\s*$/m, `FEE_RECIPIENT_ADDRESS=${evmAddress}`)
    .replace(/WORKER_ADDRESS=\s*$/m, `WORKER_ADDRESS=${evmAddress}`);
  
  // Write .env file
  fs.writeFileSync('.env', envContent);
  
  console.log('\n✅ Created .env file with your credentials!\n');
  
  // Also create frontend .env
  const frontendEnv = `
# Frontend Local Environment
VITE_HEDERA_NETWORK=testnet
VITE_HEDERA_RPC_URL=https://testnet.hashio.io/api
VITE_CHAIN_ID=296

# Local API endpoints
VITE_CLIENT_AGENT_URL=http://localhost:3001
VITE_WORKER_AGENT_URL=http://localhost:3002
VITE_VERIFICATION_AGENT_URL=http://localhost:3003
VITE_X402_URL=http://localhost:4000
VITE_AP2_URL=http://localhost:4100

# Contract addresses (fill after deployment)
VITE_AGENT_REGISTRY_ADDRESS=
VITE_ESCROW_MANAGER_ADDRESS=
VITE_REPUTATION_MANAGER_ADDRESS=
VITE_MARKETPLACE_ADDRESS=
VITE_PROOFS_ADDRESS=
VITE_ARBITRATION_ADDRESS=
`.trim();
  
  fs.writeFileSync('frontend/.env.local', frontendEnv);
  console.log('✅ Created frontend/.env.local\n');
  
  // Instructions
  console.log('📋 Next steps:\n');
  console.log('1. Deploy contracts:');
  console.log('   npm run compile');
  console.log('   npm run deploy\n');
  console.log('2. Update .env with deployed contract addresses\n');
  console.log('3. Start local services:');
  console.log('   npm install -g nats-server  # If not installed');
  console.log('   nats-server &               # Start NATS');
  console.log('   # IPFS: Use Helia (built-in) or run ipfs daemon\n');
  console.log('4. Start agents:');
  console.log('   node agent-sdk/agents/clientAgent.js');
  console.log('   node agent-sdk/agents/workerAgent.js');
  console.log('   node agent-sdk/agents/verificationAgent.js\n');
  console.log('5. Start frontend:');
  console.log('   cd frontend && npm run dev\n');
  
  rl.close();
}

setup().catch(console.error);

