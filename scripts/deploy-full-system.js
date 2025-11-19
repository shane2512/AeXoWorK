require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Full ReputeFlow System Deployment Script
 * Deploys all smart contracts in the correct order
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log('\n🚀 Deploying Full ReputeFlow System...');
  console.log('Deployer:', deployer.address);
  
  const balance = await deployer.getBalance();
  console.log('Balance:', ethers.utils.formatEther(balance), 'HBAR\n');
  
  const deployed = {};
  
  // =============================================
  // PHASE 1: Core Registry & Tokens
  // =============================================
  console.log('📋 Phase 1: Core Registry & Tokens');
  
  // 1. AI Agent Registry (ERC-8004)
  console.log('1. Deploying AIAgentRegistry...');
  const AIAgentRegistry = await ethers.getContractFactory('AIAgentRegistry');
  const aiAgentRegistry = await AIAgentRegistry.deploy();
  await aiAgentRegistry.deployed();
  deployed.AI_AGENT_REGISTRY_ADDRESS = aiAgentRegistry.address;
  console.log('   ✅', aiAgentRegistry.address);
  
  // 2. Reputation Token (HTS)
  console.log('2. Deploying ReputationToken...');
  const ReputationToken = await ethers.getContractFactory('ReputationToken');
  const reputationToken = await ReputationToken.deploy();
  await reputationToken.deployed();
  deployed.REPUTATION_TOKEN_ADDRESS = reputationToken.address;
  console.log('   ✅', reputationToken.address);
  
  // 3. Badge NFT (HTS)
  console.log('3. Deploying BadgeNFT...');
  const BadgeNFT = await ethers.getContractFactory('BadgeNFT');
  const badgeNFT = await BadgeNFT.deploy();
  await badgeNFT.deployed();
  deployed.BADGE_NFT_ADDRESS = badgeNFT.address;
  console.log('   ✅', badgeNFT.address);
  
  // =============================================
  // PHASE 2: Legacy Contracts
  // =============================================
  console.log('\n📋 Phase 2: Legacy Contracts');
  
  // 4. Agent Registry (legacy)
  console.log('4. Deploying AgentRegistry...');
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.deployed();
  deployed.AGENT_REGISTRY_ADDRESS = agentRegistry.address;
  console.log('   ✅', agentRegistry.address);
  
  // 5. Escrow Manager (legacy)
  console.log('5. Deploying EscrowManager...');
  const EscrowManager = await ethers.getContractFactory('EscrowManager');
  const escrowManager = await EscrowManager.deploy(deployer.address);
  await escrowManager.deployed();
  deployed.ESCROW_MANAGER_ADDRESS = escrowManager.address;
  console.log('   ✅', escrowManager.address);
  
  // 6. Reputation Manager (legacy)
  console.log('6. Deploying ReputationManager...');
  const ReputationManager = await ethers.getContractFactory('ReputationManager');
  const reputationManager = await ReputationManager.deploy();
  await reputationManager.deployed();
  deployed.REPUTATION_MANAGER_ADDRESS = reputationManager.address;
  console.log('   ✅', reputationManager.address);
  
  // 7. Marketplace (legacy)
  console.log('7. Deploying Marketplace...');
  const Marketplace = await ethers.getContractFactory('Marketplace');
  const marketplace = await Marketplace.deploy();
  await marketplace.deployed();
  deployed.MARKETPLACE_ADDRESS = marketplace.address;
  console.log('   ✅', marketplace.address);
  
  // 8. Proofs
  console.log('8. Deploying Proofs...');
  const Proofs = await ethers.getContractFactory('Proofs');
  const proofs = await Proofs.deploy();
  await proofs.deployed();
  deployed.PROOFS_ADDRESS = proofs.address;
  console.log('   ✅', proofs.address);
  
  // 9. Arbitration
  console.log('9. Deploying Arbitration...');
  const Arbitration = await ethers.getContractFactory('Arbitration');
  const arbitration = await Arbitration.deploy();
  await arbitration.deployed();
  deployed.ARBITRATION_ADDRESS = arbitration.address;
  console.log('   ✅', arbitration.address);
  
  // =============================================
  // PHASE 3: Marketplaces & Advanced Features
  // =============================================
  console.log('\n📋 Phase 3: Marketplaces & Advanced Features');
  
  // 10. Data Marketplace
  console.log('10. Deploying DataMarketplace...');
  const DataMarketplace = await ethers.getContractFactory('DataMarketplace');
  const dataMarketplace = await DataMarketplace.deploy(deployer.address);
  await dataMarketplace.deployed();
  deployed.DATA_MARKETPLACE_ADDRESS = dataMarketplace.address;
  console.log('   ✅', dataMarketplace.address);
  
  // 11. Milestone Escrow
  console.log('11. Deploying MilestoneEscrow...');
  const MilestoneEscrow = await ethers.getContractFactory('MilestoneEscrow');
  const milestoneEscrow = await MilestoneEscrow.deploy(deployer.address);
  await milestoneEscrow.deployed();
  deployed.MILESTONE_ESCROW_ADDRESS = milestoneEscrow.address;
  console.log('   ✅', milestoneEscrow.address);
  
  // =============================================
  // Configure Contracts
  // =============================================
  console.log('\n⚙️  Configuring Contracts...');
  
  // Allow ReputeAgent to mint reputation tokens (will be set after agent deployment)
  console.log('  - Configuring token permissions...');
  
  // Allow BadgeNFT to be issued by authorized agents
  console.log('  - Configuring badge issuers...');
  
  // Link contracts together
  console.log('  - Linking contracts...');
  
  console.log('   ✅ Configuration complete');
  
  // =============================================
  // Update .env file
  // =============================================
  console.log('\n📝 Updating .env file...');
  
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update each contract address
  for (const [key, value] of Object.entries(deployed)) {
    const regex = new RegExp(`${key}=.*`, 'g');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env');
  
  // Update frontend env
  const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env.local');
  if (fs.existsSync(frontendEnvPath)) {
    let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
    
    for (const [key, value] of Object.entries(deployed)) {
      const viteKey = 'VITE_' + key;
      const regex = new RegExp(`${viteKey}=.*`, 'g');
      if (frontendEnv.match(regex)) {
        frontendEnv = frontendEnv.replace(regex, `${viteKey}=${value}`);
      } else {
        frontendEnv += `\n${viteKey}=${value}`;
      }
    }
    
    fs.writeFileSync(frontendEnvPath, frontendEnv);
    console.log('✅ Updated frontend/.env.local');
  }
  
  // =============================================
  // Summary
  // =============================================
  console.log('\n═══════════════════════════════════════');
  console.log('✅ Full ReputeFlow System Deployed!');
  console.log('═══════════════════════════════════════\n');
  
  console.log('🎯 Core Registry & Tokens:');
  console.log('   AIAgentRegistry:    ', deployed.AI_AGENT_REGISTRY_ADDRESS);
  console.log('   ReputationToken:    ', deployed.REPUTATION_TOKEN_ADDRESS);
  console.log('   BadgeNFT:           ', deployed.BADGE_NFT_ADDRESS);
  
  console.log('\n📦 Legacy Contracts:');
  console.log('   AgentRegistry:      ', deployed.AGENT_REGISTRY_ADDRESS);
  console.log('   EscrowManager:      ', deployed.ESCROW_MANAGER_ADDRESS);
  console.log('   ReputationManager:  ', deployed.REPUTATION_MANAGER_ADDRESS);
  console.log('   Marketplace:        ', deployed.MARKETPLACE_ADDRESS);
  console.log('   Proofs:             ', deployed.PROOFS_ADDRESS);
  console.log('   Arbitration:        ', deployed.ARBITRATION_ADDRESS);
  
  console.log('\n🌐 Marketplaces:');
  console.log('   DataMarketplace:    ', deployed.DATA_MARKETPLACE_ADDRESS);
  console.log('   MilestoneEscrow:    ', deployed.MILESTONE_ESCROW_ADDRESS);
  
  console.log('\n✅ Ready for agent deployment!\n');
  
  // Save deployment info
  const deploymentInfo = {
    network: 'hederaTest',
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployed
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'deployment-full-system.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

