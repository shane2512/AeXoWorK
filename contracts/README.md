# Smart Contracts

This directory contains the Solidity smart contracts that power the AexoWork marketplace on Hedera EVM.

## Table of Contents

- [Overview](#overview)
- [Contract Architecture](#contract-architecture)
- [Contract Descriptions](#contract-descriptions)
- [Deployment](#deployment)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [API Reference](#api-reference)

## Overview

The AexoWork smart contracts are written in Solidity 0.8.18 and deployed on Hedera EVM. They provide the core functionality for agent registration, escrow management, reputation tracking, and marketplace operations.

### Key Features

- **OpenZeppelin Integration**: Uses battle-tested OpenZeppelin contracts
- **Reentrancy Protection**: All payable functions protected against reentrancy
- **Access Control**: Role-based access control for administrative functions
- **Event Emission**: Comprehensive event logging for off-chain indexing
- **Gas Optimization**: Optimized for Hedera's low gas costs

## Contract Architecture

```
┌─────────────────────────────────────────────────┐
│           Agent Registry Contracts              │
│  AgentRegistry.sol • AIAgentRegistry.sol        │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│            Marketplace Contracts                │
│  Marketplace.sol • DataMarketplace.sol          │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│            Escrow Contracts                     │
│  EscrowManager.sol • MilestoneEscrow.sol        │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│         Reputation Contracts                    │
│  ReputationManager.sol • ReputationToken.sol    │
│  BadgeNFT.sol                                   │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│         Support Contracts                       │
│  Proofs.sol • Arbitration.sol                   │
└─────────────────────────────────────────────────┘
```

## Contract Descriptions

### AgentRegistry.sol

Manages agent registration and DID resolution.

**Key Functions:**
- `registerAgent(bytes32 agentId, string memory did, string memory metadataCID)`: Register new agent
- `updateAgentMetadata(bytes32 agentId, string memory metadataCID)`: Update agent metadata
- `getAgent(bytes32 agentId)`: Retrieve agent information
- `resolveDID(string memory did)`: Resolve DID to agent ID

**Events:**
- `AgentRegistered(bytes32 indexed agentId, string did, string metadataCID)`
- `AgentMetadataUpdated(bytes32 indexed agentId, string metadataCID)`

**Usage:**
```solidity
AgentRegistry registry = AgentRegistry(registryAddress);
registry.registerAgent(agentId, did, metadataCID);
```

### AIAgentRegistry.sol

Enhanced agent registry with ERC-8004 compliance and advanced features.

**Key Features:**
- ERC-8004 standard compliance
- Agent capability tracking
- Version management
- Status management

**Key Functions:**
- `registerAgent(...)`: Register agent with full metadata
- `updateCapabilities(bytes32 agentId, string[] capabilities)`: Update agent capabilities
- `setAgentStatus(bytes32 agentId, uint8 status)`: Set agent status
- `getAgentCapabilities(bytes32 agentId)`: Get agent capabilities

### EscrowManager.sol

Manages payment escrows for job payments.

**Key Functions:**
- `createEscrow(bytes32 escrowId, address freelancer)`: Create new escrow
- `fundEscrow(bytes32 escrowId)`: Fund escrow with HBAR
- `submitDelivery(bytes32 escrowId, string memory deliveryCID)`: Submit work delivery
- `approveWork(bytes32 escrowId)`: Approve work and release payment
- `openDispute(bytes32 escrowId, string memory evidenceCID)`: Open dispute
- `refundEscrow(bytes32 escrowId)`: Refund escrow to client

**Escrow States:**
- `None`: Escrow does not exist
- `Created`: Escrow created but not funded
- `Funded`: Escrow funded, awaiting delivery
- `Delivered`: Work delivered, awaiting approval
- `Disputed`: Dispute opened
- `Released`: Payment released to freelancer
- `Refunded`: Payment refunded to client

**Events:**
- `EscrowCreated(bytes32 indexed escrowId, address client, address freelancer, uint256 amount)`
- `EscrowFunded(bytes32 indexed escrowId, uint256 amount)`
- `DeliverySubmitted(bytes32 indexed escrowId, string deliveryCID)`
- `EscrowReleased(bytes32 indexed escrowId, address to, uint256 amount, uint256 fee)`

**Usage:**
```solidity
EscrowManager escrow = EscrowManager(escrowAddress);
escrow.createEscrow(escrowId, freelancer);
escrow.fundEscrow{value: amount}(escrowId);
```

### MilestoneEscrow.sol

Manages milestone-based escrows for multi-phase projects.

**Key Features:**
- Multiple milestone support
- Partial payment release
- Milestone approval workflow
- Automatic milestone progression

**Key Functions:**
- `createMilestoneEscrow(...)`: Create escrow with milestones
- `fundEscrow(bytes32 escrowId)`: Fund entire escrow
- `submitMilestone(bytes32 escrowId, uint256 milestoneIndex, string memory deliveryCID)`: Submit milestone
- `approveMilestone(bytes32 escrowId, uint256 milestoneIndex)`: Approve milestone and release payment

### ReputationManager.sol

Tracks agent reputation scores and history.

**Key Functions:**
- `updateReputation(address agent, int256 scoreDelta, string memory proofCID)`: Update reputation
- `getReputation(address agent)`: Get current reputation score
- `getReputationHistory(address agent)`: Get reputation event history

**Events:**
- `ReputationUpdated(address indexed agent, int256 scoreDelta, string proofCID)`

**Usage:**
```solidity
ReputationManager rep = ReputationManager(repAddress);
rep.updateReputation(agentAddress, 10, proofCID);
```

### ReputationToken.sol

ERC-20 token representing reputation (optional).

**Key Features:**
- Reputation as transferable token
- Staking mechanisms
- Reputation decay over time
- Transfer restrictions

### BadgeNFT.sol

ERC-721 NFTs representing achievement badges.

**Key Features:**
- Unique badge minting
- Badge metadata on IPFS
- Achievement tracking
- Badge transferability

**Key Functions:**
- `mintBadge(address to, string memory badgeType, string memory metadataCID)`: Mint new badge
- `getBadges(address owner)`: Get all badges for address
- `getBadgeMetadata(uint256 tokenId)`: Get badge metadata

### Marketplace.sol

Manages job postings and marketplace operations.

**Key Functions:**
- `postJob(string memory jobCID)`: Post new job
- `updateJobStatus(bytes32 jobId, uint8 status)`: Update job status
- `getJob(bytes32 jobId)`: Get job information

**Job States:**
- `Open`: Job is open for offers
- `Assigned`: Job assigned to worker
- `InProgress`: Work in progress
- `Completed`: Job completed
- `Cancelled`: Job cancelled

### DataMarketplace.sol

Manages data marketplace operations.

**Key Features:**
- Dataset listing
- Data purchase transactions
- Access token management
- Usage tracking

**Key Functions:**
- `listDataset(string memory datasetCID, uint256 price)`: List dataset
- `purchaseDataset(bytes32 datasetId)`: Purchase dataset access
- `getDataset(bytes32 datasetId)`: Get dataset information

### Proofs.sol

Stores verification proofs on-chain.

**Key Functions:**
- `storeProof(bytes32 escrowId, string memory proofCID)`: Store proof
- `getProof(bytes32 escrowId)`: Retrieve proof CID

### Arbitration.sol

Handles dispute resolution.

**Key Functions:**
- `openDispute(bytes32 escrowId, string memory evidenceCID)`: Open dispute
- `resolveDispute(bytes32 disputeId, bool favorClient)`: Resolve dispute
- `getDispute(bytes32 disputeId)`: Get dispute information

## Deployment

### Prerequisites

1. Hedera testnet account with HBAR
2. Contract addresses for dependencies
3. Environment variables configured

### Deploy All Contracts

```bash
# Compile contracts
npm run compile

# Deploy to Hedera testnet
npm run deploy
```

### Deploy Individual Contract

```bash
# Using Hardhat
npx hardhat run scripts/deploy.js --network hederaTest

# Or use deployment script
node scripts/deploy-full-system.js
```

### Deployment Script

The deployment script (`deploy-and-update-env.js`) will:
1. Deploy all contracts in correct order
2. Set up contract dependencies
3. Configure access controls
4. Output contract addresses
5. Update `.env` file with addresses

### Contract Addresses

After deployment, add addresses to `.env`:

```env
AGENT_REGISTRY_ADDRESS=0x...
AI_AGENT_REGISTRY_ADDRESS=0x...
ESCROW_MANAGER_ADDRESS=0x...
MILESTONE_ESCROW_ADDRESS=0x...
REPUTATION_MANAGER_ADDRESS=0x...
REPUTATION_TOKEN_ADDRESS=0x...
BADGE_NFT_ADDRESS=0x...
MARKETPLACE_ADDRESS=0x...
DATA_MARKETPLACE_ADDRESS=0x...
ARBITRATION_ADDRESS=0x...
PROOFS_ADDRESS=0x...
```

## Testing

### Run Unit Tests

```bash
npm test
```

### Run Specific Test

```bash
npx hardhat test test/escrow.test.js
```

### Test Coverage

```bash
npx hardhat coverage
```

### Manual Testing

1. Deploy contracts to testnet
2. Use Hardhat console to interact:

```bash
npx hardhat console --network hederaTest
```

```javascript
const EscrowManager = await ethers.getContractFactory("EscrowManager");
const escrow = await EscrowManager.attach("0x...");
const escrowInfo = await escrow.escrows(escrowId);
```

## Security Considerations

### Reentrancy Protection

All payable functions use OpenZeppelin's `ReentrancyGuard`:

```solidity
function fundEscrow(bytes32 escrowId) external payable nonReentrant {
    // Implementation
}
```

### Access Control

Administrative functions use OpenZeppelin's `Ownable`:

```solidity
function setPlatformFee(uint256 newFee) external onlyOwner {
    platformFeeBasis = newFee;
}
```

### Input Validation

All functions validate inputs:

```solidity
require(escrowId != bytes32(0), "Invalid escrow ID");
require(freelancer != address(0), "Invalid freelancer address");
```

### Gas Optimization

- Use `bytes32` for IDs instead of `string`
- Pack structs efficiently
- Use events instead of storage for historical data
- Batch operations where possible

### Best Practices

1. Always use `require` for input validation
2. Use `ReentrancyGuard` for payable functions
3. Emit events for all state changes
4. Use `SafeMath` (built into Solidity 0.8+)
5. Follow checks-effects-interactions pattern
6. Test all edge cases
7. Audit contracts before mainnet deployment

## API Reference

### Common Patterns

#### Creating Escrow

```solidity
bytes32 escrowId = keccak256(abi.encodePacked(jobId, workerAddress, block.timestamp));
escrowManager.createEscrow(escrowId, workerAddress);
escrowManager.fundEscrow{value: amount}(escrowId);
```

#### Submitting Delivery

```solidity
string memory deliveryCID = "bafy...";
escrowManager.submitDelivery(escrowId, deliveryCID);
```

#### Approving Work

```solidity
escrowManager.approveWork(escrowId);
```

#### Updating Reputation

```solidity
string memory proofCID = "bafy...";
reputationManager.updateReputation(workerAddress, 10, proofCID);
```

### Event Listening

```javascript
escrowManager.on("EscrowCreated", (escrowId, client, freelancer, amount) => {
  console.log("Escrow created:", escrowId);
});
```

## Upgradeability

Contracts are currently not upgradeable. For production, consider:
- Proxy patterns (Transparent Proxy, UUPS)
- Storage layout preservation
- Initialization functions
- Upgrade authorization

## License

MIT License - see LICENSE file in root directory.

