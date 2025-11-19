/**
 * Generate .env file with all contract addresses and configuration
 */

const fs = require('fs');
const path = require('path');

// Read deployment addresses
const deploymentFile = path.join(__dirname, 'deployment-full-system.json');
let contractAddresses = {};

if (fs.existsSync(deploymentFile)) {
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  contractAddresses = deployment.contracts || {};
}

// Your credentials (from earlier conversation)
const credentials = {
  HEDERA_ACCOUNT_ID: '0.0.7279839',
  HEDERA_PRIVATE_KEY: '0x87cc00a59a3c7fdba870fb6c7de940313a54ef114086e236b9dfae2db27387e9',
  EVM_ADDRESS: '0xD8b15838bA1aEeC79cC6B3f690075242728279dA' // From deployment file
};

// Generate .env content
const envContent = `# Hedera Network Configuration
HEDERA_NETWORK=testnet
HEDERA_JSON_RPC_RELAY=https://testnet.hashio.io/api
HEDERA_ACCOUNT_ID=${credentials.HEDERA_ACCOUNT_ID}
HEDERA_PRIVATE_KEY=${credentials.HEDERA_PRIVATE_KEY}

# NATS Configuration
NATS_URL=nats://localhost:4222

# Agent Ports (A2A Protocol)
CLIENT_AGENT_PORT=3001
WORKER_AGENT_PORT=3002
VERIFICATION_AGENT_PORT=3003
REPUTE_AGENT_PORT=3004
DISPUTE_AGENT_PORT=3005
DATA_AGENT_PORT=3006
ESCROW_AGENT_PORT=3007
MARKETPLACE_AGENT_PORT=3008

# Smart Contract Addresses (Deployed to Hedera Testnet)
# Phase 1: Core Registry & Tokens
AI_AGENT_REGISTRY_ADDRESS=${contractAddresses.AI_AGENT_REGISTRY_ADDRESS || ''}
REPUTATION_TOKEN_ADDRESS=${contractAddresses.REPUTATION_TOKEN_ADDRESS || ''}
BADGE_NFT_ADDRESS=${contractAddresses.BADGE_NFT_ADDRESS || ''}

# Legacy Contracts
AGENT_REGISTRY_ADDRESS=${contractAddresses.AGENT_REGISTRY_ADDRESS || ''}
ESCROW_MANAGER_ADDRESS=${contractAddresses.ESCROW_MANAGER_ADDRESS || ''}
REPUTATION_MANAGER_ADDRESS=${contractAddresses.REPUTATION_MANAGER_ADDRESS || ''}
MARKETPLACE_ADDRESS=${contractAddresses.MARKETPLACE_ADDRESS || ''}
PROOFS_ADDRESS=${contractAddresses.PROOFS_ADDRESS || ''}
ARBITRATION_ADDRESS=${contractAddresses.ARBITRATION_ADDRESS || ''}

# Phase 1: Marketplaces
DATA_MARKETPLACE_ADDRESS=${contractAddresses.DATA_MARKETPLACE_ADDRESS || ''}
MILESTONE_ESCROW_ADDRESS=${contractAddresses.MILESTONE_ESCROW_ADDRESS || ''}

# Agent Configuration
AGENT_DID=did:hedera:testnet:${credentials.HEDERA_ACCOUNT_ID}
AGENT_SKILLS=writing,design,coding
REPUTATION_THRESHOLD=10

# IPFS Configuration (Optional - can be configured later)
# IPFS_HOST=localhost
# IPFS_PORT=5001
# IPFS_PROTOCOL=http
# IPFS_URL=http://localhost:5001

# Pinata Configuration (Optional - for IPFS via Pinata)
# PINATA_API_KEY=your_pinata_api_key
# PINATA_SECRET_KEY=your_pinata_secret_key
# PINATA_GATEWAY_URL=https://your-gateway.mypinata.cloud/ipfs/

# Additional Hedera Configuration
CHAIN_ID=296
HEDERA_RPC_URL=https://testnet.hashio.io/api
`;

// Write .env file
const envPath = path.join(__dirname, '.env');

try {
  // Check if .env exists
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists.');
    console.log('Creating backup as .env.backup...');
    fs.copyFileSync(envPath, path.join(__dirname, '.env.backup'));
  }

  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ .env file generated successfully!');
  console.log(`   Location: ${envPath}\n`);
  
  console.log('📋 Configured Variables:');
  console.log('  ✓ Hedera Network: testnet');
  console.log(`  ✓ Account ID: ${credentials.HEDERA_ACCOUNT_ID}`);
  console.log('  ✓ Private Key: Configured');
  console.log('  ✓ NATS URL: nats://localhost:4222');
  console.log('  ✓ Agent Ports: 3001-3008');
  console.log(`  ✓ Contract Addresses: ${Object.keys(contractAddresses).length} contracts`);
  console.log('  ✓ Agent Configuration: Complete');
  
  console.log('\n📄 Contract Addresses:');
  Object.entries(contractAddresses).forEach(([key, value]) => {
    console.log(`  ✓ ${key}: ${value}`);
  });
  
  console.log('\n🚀 Next Steps:');
  console.log('  1. Review the .env file');
  console.log('  2. Start NATS: npm run nats');
  console.log('  3. Start all services: npm start');
  console.log('');
  
} catch (error) {
  console.error('❌ Error generating .env file:', error.message);
  process.exit(1);
}


