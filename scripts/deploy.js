const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const deployedAddresses = {};

  // 1. Deploy AgentRegistry
  console.log("\n1. Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.deployed();
  console.log("AgentRegistry deployed to:", agentRegistry.address);
  deployedAddresses.AGENT_REGISTRY_ADDRESS = agentRegistry.address;

  // 2. Deploy EscrowManager
  console.log("\n2. Deploying EscrowManager...");
  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS || deployer.address;
  const EscrowManager = await hre.ethers.getContractFactory("EscrowManager");
  const escrowManager = await EscrowManager.deploy(feeRecipient);
  await escrowManager.deployed();
  console.log("EscrowManager deployed to:", escrowManager.address);
  deployedAddresses.ESCROW_MANAGER_ADDRESS = escrowManager.address;

  // 3. Deploy ReputationManager
  console.log("\n3. Deploying ReputationManager...");
  const ReputationManager = await hre.ethers.getContractFactory(
    "ReputationManager"
  );
  const reputationManager = await ReputationManager.deploy();
  await reputationManager.deployed();
  console.log("ReputationManager deployed to:", reputationManager.address);
  deployedAddresses.REPUTATION_MANAGER_ADDRESS = reputationManager.address;

  // 4. Deploy Marketplace
  console.log("\n4. Deploying Marketplace...");
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.deployed();
  console.log("Marketplace deployed to:", marketplace.address);
  deployedAddresses.MARKETPLACE_ADDRESS = marketplace.address;

  // 5. Deploy Proofs
  console.log("\n5. Deploying Proofs...");
  const Proofs = await hre.ethers.getContractFactory("Proofs");
  const proofs = await Proofs.deploy();
  await proofs.deployed();
  console.log("Proofs deployed to:", proofs.address);
  deployedAddresses.PROOFS_ADDRESS = proofs.address;

  // 6. Deploy Arbitration
  console.log("\n6. Deploying Arbitration...");
  const Arbitration = await hre.ethers.getContractFactory("Arbitration");
  const arbitration = await Arbitration.deploy();
  await arbitration.deployed();
  console.log("Arbitration deployed to:", arbitration.address);
  deployedAddresses.ARBITRATION_ADDRESS = arbitration.address;

  // Save deployed addresses
  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deployedAddresses, null, 2));

  // Write to file
  const addressesFile = "./deployed-addresses.json";
  fs.writeFileSync(addressesFile, JSON.stringify(deployedAddresses, null, 2));
  console.log(`\nDeployed addresses saved to ${addressesFile}`);

  // Generate .env additions
  console.log("\n=== Add these to your .env file ===");
  Object.entries(deployedAddresses).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

