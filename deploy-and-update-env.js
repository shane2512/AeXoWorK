#!/usr/bin/env node
/**
 * Deploy contracts and automatically update .env file
 */

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("\n🚀 Deploying contracts to Hedera...");
  console.log("Account:", deployer.address);
  console.log("Balance:", (await deployer.getBalance()).toString(), "\n");

  const addresses = {};

  // Deploy all contracts
  console.log("1. Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.deployed();
  addresses.AGENT_REGISTRY_ADDRESS = agentRegistry.address;
  console.log("   ✅", agentRegistry.address);

  console.log("\n2. Deploying EscrowManager...");
  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS || deployer.address;
  const EscrowManager = await hre.ethers.getContractFactory("EscrowManager");
  const escrowManager = await EscrowManager.deploy(feeRecipient);
  await escrowManager.deployed();
  addresses.ESCROW_MANAGER_ADDRESS = escrowManager.address;
  console.log("   ✅", escrowManager.address);

  console.log("\n3. Deploying ReputationManager...");
  const ReputationManager = await hre.ethers.getContractFactory("ReputationManager");
  const reputationManager = await ReputationManager.deploy();
  await reputationManager.deployed();
  addresses.REPUTATION_MANAGER_ADDRESS = reputationManager.address;
  console.log("   ✅", reputationManager.address);

  console.log("\n4. Deploying Marketplace...");
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.deployed();
  addresses.MARKETPLACE_ADDRESS = marketplace.address;
  console.log("   ✅", marketplace.address);

  console.log("\n5. Deploying Proofs...");
  const Proofs = await hre.ethers.getContractFactory("Proofs");
  const proofs = await Proofs.deploy();
  await proofs.deployed();
  addresses.PROOFS_ADDRESS = proofs.address;
  console.log("   ✅", proofs.address);

  console.log("\n6. Deploying Arbitration...");
  const Arbitration = await hre.ethers.getContractFactory("Arbitration");
  const arbitration = await Arbitration.deploy();
  await arbitration.deployed();
  addresses.ARBITRATION_ADDRESS = arbitration.address;
  console.log("   ✅", arbitration.address);

  // Update .env file
  console.log("\n📝 Updating .env file...");
  
  if (fs.existsSync('.env')) {
    let envContent = fs.readFileSync('.env', 'utf8');
    
    Object.entries(addresses).forEach(([key, value]) => {
      const regex = new RegExp(`${key}=.*`, 'g');
      envContent = envContent.replace(regex, `${key}=${value}`);
    });
    
    fs.writeFileSync('.env', envContent);
    console.log("✅ Updated .env with contract addresses\n");
  }

  // Update frontend .env
  if (fs.existsSync('frontend/.env.local')) {
    let frontendEnv = fs.readFileSync('frontend/.env.local', 'utf8');
    
    Object.entries(addresses).forEach(([key, value]) => {
      const viteKey = `VITE_${key}`;
      const regex = new RegExp(`${viteKey}=.*`, 'g');
      frontendEnv = frontendEnv.replace(regex, `${viteKey}=${value}`);
    });
    
    fs.writeFileSync('frontend/.env.local', frontendEnv);
    console.log("✅ Updated frontend/.env.local\n");
  }

  // Save to JSON
  fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
  
  console.log("═══════════════════════════════════════");
  console.log("✅ All contracts deployed!");
  console.log("═══════════════════════════════════════\n");
  console.log(JSON.stringify(addresses, null, 2));
  console.log("\n✅ Ready to start agents!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

