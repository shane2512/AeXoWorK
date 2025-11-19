/**
 * Interactive .env Configuration Script
 * Helps set up all environment variables for ReputeFlow
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${prompt}${colors.reset}`, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   ReputeFlow .env Configuration       ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');

  const config = {};

  // ============================================
  // Hedera Network Configuration
  // ============================================
  log('📡 Hedera Network Configuration', 'yellow');
  log('─────────────────────────────────────────\n', 'cyan');

  config.HEDERA_NETWORK = await question('Hedera Network (testnet/mainnet) [testnet]: ') || 'testnet';
  
  if (config.HEDERA_NETWORK === 'testnet') {
    config.HEDERA_JSON_RPC_RELAY = await question('JSON-RPC Relay URL [https://testnet.hashio.io/api]: ') || 'https://testnet.hashio.io/api';
  } else {
    config.HEDERA_JSON_RPC_RELAY = await question('JSON-RPC Relay URL [https://mainnet.hashio.io/api]: ') || 'https://mainnet.hashio.io/api';
  }

  log('\n💼 Hedera Account Credentials', 'yellow');
  log('─────────────────────────────────────────\n', 'cyan');
  
  config.HEDERA_ACCOUNT_ID = await question('Hedera Account ID (e.g., 0.0.1234567): ');
  
  if (!config.HEDERA_ACCOUNT_ID) {
    log('❌ Account ID is required!', 'red');
    process.exit(1);
  }

  // Private key input
  log('\n⚠️  Private Key Options:', 'yellow');
  log('  1. Enter private key directly (0x... or mnemonic)', 'cyan');
  log('  2. Use existing .env file', 'cyan');
  log('  3. Skip (you can add it manually later)', 'cyan');
  
  const keyOption = await question('\nChoose option (1/2/3) [1]: ') || '1';

  if (keyOption === '1') {
    config.HEDERA_PRIVATE_KEY = await question('Private Key (with 0x prefix) or Mnemonic: ');
    if (!config.HEDERA_PRIVATE_KEY) {
      log('⚠️  Private key not provided. You can add it manually later.', 'yellow');
    }
  } else if (keyOption === '2') {
    const existingEnv = path.join(__dirname, '.env');
    if (fs.existsSync(existingEnv)) {
      const envContent = fs.readFileSync(existingEnv, 'utf8');
      const match = envContent.match(/HEDERA_PRIVATE_KEY=(.+)/);
      if (match) {
        config.HEDERA_PRIVATE_KEY = match[1].trim();
        log('✅ Found existing private key in .env', 'green');
      } else {
        log('⚠️  No private key found in existing .env', 'yellow');
      }
    } else {
      log('⚠️  No existing .env file found', 'yellow');
    }
  }

  // ============================================
  // NATS Configuration
  // ============================================
  log('\n📡 NATS Configuration', 'yellow');
  log('─────────────────────────────────────────\n', 'cyan');
  
  config.NATS_URL = await question('NATS Server URL [nats://localhost:4222]: ') || 'nats://localhost:4222';

  // ============================================
  // Agent Ports
  // ============================================
  log('\n🔌 Agent Ports (Press Enter for defaults)', 'yellow');
  log('─────────────────────────────────────────\n', 'cyan');
  
  config.CLIENT_AGENT_PORT = await question('Client Agent Port [3001]: ') || '3001';
  config.WORKER_AGENT_PORT = await question('Worker Agent Port [3002]: ') || '3002';
  config.VERIFICATION_AGENT_PORT = await question('Verification Agent Port [3003]: ') || '3003';
  config.REPUTE_AGENT_PORT = await question('Repute Agent Port [3004]: ') || '3004';
  config.DISPUTE_AGENT_PORT = await question('Dispute Agent Port [3005]: ') || '3005';
  config.DATA_AGENT_PORT = await question('Data Agent Port [3006]: ') || '3006';
  config.ESCROW_AGENT_PORT = await question('Escrow Agent Port [3007]: ') || '3007';
  config.MARKETPLACE_AGENT_PORT = await question('Marketplace Agent Port [3008]: ') || '3008';

  // ============================================
  // Agent Configuration
  // ============================================
  log('\n🤖 Agent Configuration', 'yellow');
  log('─────────────────────────────────────────\n', 'cyan');
  
  config.AGENT_DID = await question(`Agent DID [did:hedera:${config.HEDERA_NETWORK}:${config.HEDERA_ACCOUNT_ID}]: `) || 
    `did:hedera:${config.HEDERA_NETWORK}:${config.HEDERA_ACCOUNT_ID}`;
  
  config.AGENT_SKILLS = await question('Agent Skills (comma-separated) [writing,design,coding]: ') || 'writing,design,coding';
  config.REPUTATION_THRESHOLD = await question('Reputation Threshold [10]: ') || '10';

  // ============================================
  // IPFS Configuration (Optional)
  // ============================================
  log('\n📦 IPFS Configuration (Optional)', 'yellow');
  log('─────────────────────────────────────────\n', 'cyan');
  
  const useIPFS = await question('Use IPFS? (yes/no) [no]: ') || 'no';
  
  if (useIPFS.toLowerCase() === 'yes') {
    config.IPFS_HOST = await question('IPFS Host [localhost]: ') || 'localhost';
    config.IPFS_PORT = await question('IPFS Port [5001]: ') || '5001';
    config.IPFS_PROTOCOL = await question('IPFS Protocol (http/https) [http]: ') || 'http';
  }

  // ============================================
  // Smart Contract Addresses
  // ============================================
  log('\n📋 Smart Contract Addresses', 'yellow');
  log('─────────────────────────────────────────\n', 'cyan');
  log('These will be filled automatically after contract deployment.', 'cyan');
  log('You can also add them manually if contracts are already deployed.\n', 'cyan');
  
  const hasContracts = await question('Do you have existing contract addresses? (yes/no) [no]: ') || 'no';
  
  if (hasContracts.toLowerCase() === 'yes') {
    log('\nEnter contract addresses (press Enter to skip):\n', 'cyan');
    
    config.AGENT_REGISTRY_ADDRESS = await question('Agent Registry Address: ') || '';
    config.ESCROW_MANAGER_ADDRESS = await question('Escrow Manager Address: ') || '';
    config.REPUTATION_MANAGER_ADDRESS = await question('Reputation Manager Address: ') || '';
    config.MARKETPLACE_ADDRESS = await question('Marketplace Address: ') || '';
    config.PROOFS_ADDRESS = await question('Proofs Address: ') || '';
    config.ARBITRATION_ADDRESS = await question('Arbitration Address: ') || '';
    config.AI_AGENT_REGISTRY_ADDRESS = await question('AI Agent Registry Address: ') || '';
    config.REPUTATION_TOKEN_ADDRESS = await question('Reputation Token Address: ') || '';
    config.BADGE_NFT_ADDRESS = await question('Badge NFT Address: ') || '';
    config.DATA_MARKETPLACE_ADDRESS = await question('Data Marketplace Address: ') || '';
    config.MILESTONE_ESCROW_ADDRESS = await question('Milestone Escrow Address: ') || '';
  } else {
    // Set empty placeholders
    config.AGENT_REGISTRY_ADDRESS = '';
    config.ESCROW_MANAGER_ADDRESS = '';
    config.REPUTATION_MANAGER_ADDRESS = '';
    config.MARKETPLACE_ADDRESS = '';
    config.PROOFS_ADDRESS = '';
    config.ARBITRATION_ADDRESS = '';
    config.AI_AGENT_REGISTRY_ADDRESS = '';
    config.REPUTATION_TOKEN_ADDRESS = '';
    config.BADGE_NFT_ADDRESS = '';
    config.DATA_MARKETPLACE_ADDRESS = '';
    config.MILESTONE_ESCROW_ADDRESS = '';
  }

  // ============================================
  // Generate .env file
  // ============================================
  log('\n📝 Generating .env file...\n', 'yellow');

  const envContent = `# Hedera Network Configuration
HEDERA_NETWORK=${config.HEDERA_NETWORK}
HEDERA_JSON_RPC_RELAY=${config.HEDERA_JSON_RPC_RELAY}
HEDERA_ACCOUNT_ID=${config.HEDERA_ACCOUNT_ID}
HEDERA_PRIVATE_KEY=${config.HEDERA_PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE'}

# NATS Configuration
NATS_URL=${config.NATS_URL}

# Agent Ports (A2A Protocol)
CLIENT_AGENT_PORT=${config.CLIENT_AGENT_PORT}
WORKER_AGENT_PORT=${config.WORKER_AGENT_PORT}
VERIFICATION_AGENT_PORT=${config.VERIFICATION_AGENT_PORT}
REPUTE_AGENT_PORT=${config.REPUTE_AGENT_PORT}
DISPUTE_AGENT_PORT=${config.DISPUTE_AGENT_PORT}
DATA_AGENT_PORT=${config.DATA_AGENT_PORT}
ESCROW_AGENT_PORT=${config.ESCROW_AGENT_PORT}
MARKETPLACE_AGENT_PORT=${config.MARKETPLACE_AGENT_PORT}

# Smart Contract Addresses (filled after deployment)
AGENT_REGISTRY_ADDRESS=${config.AGENT_REGISTRY_ADDRESS}
ESCROW_MANAGER_ADDRESS=${config.ESCROW_MANAGER_ADDRESS}
REPUTATION_MANAGER_ADDRESS=${config.REPUTATION_MANAGER_ADDRESS}
MARKETPLACE_ADDRESS=${config.MARKETPLACE_ADDRESS}
PROOFS_ADDRESS=${config.PROOFS_ADDRESS}
ARBITRATION_ADDRESS=${config.ARBITRATION_ADDRESS}
AI_AGENT_REGISTRY_ADDRESS=${config.AI_AGENT_REGISTRY_ADDRESS}
REPUTATION_TOKEN_ADDRESS=${config.REPUTATION_TOKEN_ADDRESS}
BADGE_NFT_ADDRESS=${config.BADGE_NFT_ADDRESS}
DATA_MARKETPLACE_ADDRESS=${config.DATA_MARKETPLACE_ADDRESS}
MILESTONE_ESCROW_ADDRESS=${config.MILESTONE_ESCROW_ADDRESS}

# Agent Configuration
AGENT_DID=${config.AGENT_DID}
AGENT_SKILLS=${config.AGENT_SKILLS}
REPUTATION_THRESHOLD=${config.REPUTATION_THRESHOLD}

# IPFS Configuration${useIPFS.toLowerCase() === 'yes' ? `
IPFS_HOST=${config.IPFS_HOST}
IPFS_PORT=${config.IPFS_PORT}
IPFS_PROTOCOL=${config.IPFS_PROTOCOL}` : `
# IPFS_HOST=localhost
# IPFS_PORT=5001
# IPFS_PROTOCOL=http`}
`;

  const envPath = path.join(__dirname, '.env');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const overwrite = await question('\n⚠️  .env file already exists. Overwrite? (yes/no) [no]: ') || 'no';
    if (overwrite.toLowerCase() !== 'yes') {
      log('\n❌ Configuration cancelled. Existing .env file preserved.', 'yellow');
      rl.close();
      return;
    }
  }

  // Write .env file
  fs.writeFileSync(envPath, envContent);
  
  log('\n✅ .env file created successfully!', 'green');
  log(`   Location: ${envPath}\n`, 'cyan');

  // Summary
  log('╔════════════════════════════════════════╗', 'green');
  log('║   Configuration Summary                ║', 'green');
  log('╚════════════════════════════════════════╝\n', 'green');
  
  log(`Network: ${config.HEDERA_NETWORK}`, 'cyan');
  log(`Account ID: ${config.HEDERA_ACCOUNT_ID}`, 'cyan');
  log(`Private Key: ${config.HEDERA_PRIVATE_KEY ? '✅ Set' : '❌ Not set'}`, config.HEDERA_PRIVATE_KEY ? 'green' : 'yellow');
  log(`NATS URL: ${config.NATS_URL}`, 'cyan');
  log(`Agent Ports: ${config.CLIENT_AGENT_PORT}-${config.MARKETPLACE_AGENT_PORT}`, 'cyan');
  log(`Contract Addresses: ${hasContracts.toLowerCase() === 'yes' ? '✅ Provided' : '⏳ Will be filled after deployment'}`, hasContracts.toLowerCase() === 'yes' ? 'green' : 'yellow');

  log('\n📋 Next Steps:', 'yellow');
  log('  1. Review the .env file', 'cyan');
  log('  2. Add/update PRIVATE_KEY if needed', 'cyan');
  log('  3. Deploy contracts: npm run deploy', 'cyan');
  log('  4. Start services: npm start', 'cyan');
  log('');

  rl.close();
}

main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});



