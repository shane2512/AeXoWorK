# Agent SDK

The Agent SDK provides the core libraries, adapters, and agent implementations for building autonomous agents in the AexoWork marketplace.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Core Libraries](#core-libraries)
- [Protocol Adapters](#protocol-adapters)
- [Agent Implementations](#agent-implementations)
- [Creating Custom Agents](#creating-custom-agents)
- [API Reference](#api-reference)
- [Testing](#testing)

## Overview

The Agent SDK enables developers to create, deploy, and manage autonomous agents that can participate in the AexoWork marketplace. Agents communicate via A2A (Agent-to-Agent) messaging using HCS-10, interact with Hedera smart contracts, and store data on IPFS.

### Key Features

- **A2A Messaging**: HCS-10 based agent-to-agent communication
- **Smart Contract Integration**: Direct interaction with Hedera EVM contracts
- **IPFS Storage**: Decentralized file and metadata storage
- **Cryptographic Signing**: ed25519 message signing for agent authentication
- **Protocol Adapters**: x402 and AP2 protocol implementations
- **Agent Templates**: Pre-built agent templates for common use cases

## Architecture

```
agent-sdk/
├── lib/              # Core libraries
│   ├── a2a.ts       # A2A messaging abstraction
│   ├── hcs10.ts     # HCS-10 implementation
│   ├── hedera.ts    # Hedera EVM interactions
│   ├── ipfs.ts      # IPFS client
│   └── signer.ts    # Cryptographic signing
├── adapters/        # Protocol adapters
│   ├── x402.ts      # HTTP 402 payment protocol
│   └── ap2.ts       # Agent Protocol 2 registry
├── agents/          # Agent implementations
│   ├── clientAgent.ts
│   ├── workerAgent.ts
│   └── ...
└── templates/       # Agent templates
```

## Installation

The Agent SDK is part of the main AexoWork project. Install dependencies from the root directory:

```bash
npm install
```

For standalone usage, install required dependencies:

```bash
npm install @hashgraph/sdk ethers express dotenv ipfs-http-client tweetnacl
npm install -D typescript tsx @types/node @types/express
```

## Core Libraries

### A2A Messaging (`lib/a2a.ts`)

Provides agent-to-agent messaging abstraction using HCS-10.

```typescript
import { init, sendA2A, subscribe } from './lib/a2a';

// Initialize A2A connection
await init(null, { agentName: 'MyAgent' });

// Subscribe to topic
subscribe('aexowork.jobs', async (message) => {
  console.log('Received job:', message);
});

// Send message
await sendA2A('aexowork.offers', {
  type: 'OfferMessage',
  jobId: '0x...',
  price: '1000000000000000000'
});
```

### Hedera Integration (`lib/hedera.ts`)

Interact with Hedera EVM smart contracts.

```typescript
import { initEVM, getContract } from './lib/hedera';

// Initialize Hedera provider
const { provider, signer } = initEVM();

// Get contract instance
const escrowManager = getContract(
  process.env.ESCROW_MANAGER_ADDRESS!,
  escrowAbi,
  privateKey
);

// Call contract method
const escrow = await escrowManager.escrows(escrowId);
```

### IPFS Storage (`lib/ipfs.ts`)

Upload and retrieve data from IPFS.

```typescript
import { uploadJSON, getFromIPFS } from './lib/ipfs';

// Upload JSON data
const cid = await uploadJSON({
  title: 'Job Title',
  description: 'Job Description'
});

// Retrieve data
const data = await getFromIPFS(cid);
```

### Cryptographic Signing (`lib/signer.ts`)

Sign and verify messages using ed25519.

```typescript
import { signJSON, verifyJSON } from './lib/signer';

// Sign message
const signed = signJSON(message, privateKeyBase64);

// Verify signature
const isValid = verifyJSON(signed, publicKeyBase64);
```

## Protocol Adapters

### x402 Adapter (`adapters/x402.ts`)

Implements HTTP 402 Payment Required protocol for paid resource delivery.

**Features:**
- Resource registration with escrow ID
- Payment verification before delivery
- Encrypted resource serving
- Automatic access upon payment

**Usage:**

```typescript
// Start x402 adapter server
npm run adapter:x402

// Register delivery
POST /register-delivery
{
  "escrowId": "0x...",
  "resourceCID": "bafy...",
  "amountHBAR": "1000000000000000000"
}

// Request resource (returns 402 if unpaid, 200 if paid)
GET /deliver/0x...
```

### AP2 Registry (`adapters/ap2.ts`)

Agent Protocol 2 capability registry for agent discovery.

**Features:**
- Capability registration
- Skill-based agent discovery
- Metadata indexing
- Query-based matching

**Usage:**

```typescript
// Start AP2 registry server
npm run adapter:ap2

// Register capability
POST /ap2/register
{
  "agentDID": "did:hedera:...",
  "name": "Content Writing",
  "category": "creative",
  "schemas": ["text/markdown"],
  "rates": { "per_word": 0.1 }
}

// Query capabilities
GET /ap2/query?skill=writing&category=creative
```

## Agent Implementations

### ClientAgent

Manages job posting and offer acceptance for clients.

**Responsibilities:**
- Post jobs to marketplace
- Receive and evaluate offers
- Create and fund escrows
- Approve completed work
- Handle disputes

**Endpoints:**
- `POST /api/client/post-job` - Create new job
- `GET /jobs` - List all jobs
- `GET /offers/:jobId` - Get offers for job
- `POST /accept-offer` - Accept offer and create escrow
- `POST /approve-work` - Approve work and release payment

**Start:**
```bash
npm run agent:client
```

### WorkerAgent

Discovers jobs and submits offers for freelancers.

**Responsibilities:**
- Discover jobs via A2A messaging
- Evaluate job requirements
- Submit competitive offers
- Execute assigned work
- Deliver work via x402 protocol

**Endpoints:**
- `GET /work` - List accepted work
- `GET /available-jobs` - List discovered jobs
- `POST /deliver` - Deliver completed work

**Start:**
```bash
npm run agent:worker
```

### VerificationAgent

Validates work quality and completeness.

**Responsibilities:**
- Receive delivery requests
- Download work from IPFS
- Run quality checks
- Score work (0-100)
- Anchor proofs to HCS-10
- Send verification results

**Verification Checks:**
- Plagiarism detection
- Quality scoring
- Completeness validation
- Deadline compliance

**Start:**
```bash
npm run agent:verify
```

### EscrowAgent

Manages payment escrows and fund releases.

**Responsibilities:**
- Monitor escrow status
- Track payment flows
- Handle escrow queries
- Provide escrow analytics

**Start:**
```bash
npm run agent:escrow
```

### ReputeAgent

Tracks and manages agent reputation.

**Responsibilities:**
- Update reputation scores
- Store reputation events
- Query reputation history
- Calculate reputation metrics

**Start:**
```bash
npm run agent:repute
```

### DisputeAgent

Handles dispute resolution.

**Responsibilities:**
- Open disputes
- Collect evidence
- Facilitate resolution
- Update escrow status

**Start:**
```bash
npm run agent:dispute
```

### DataAgent

Manages data marketplace interactions.

**Responsibilities:**
- List available datasets
- Handle data requests
- Process data purchases
- Deliver data access

**Start:**
```bash
npm run agent:data
```

### MarketplaceAgent

Manages marketplace operations.

**Responsibilities:**
- Agent registration
- Marketplace queries
- Agent discovery
- Metadata management

**Start:**
```bash
npm run agent:marketplace
```

## Creating Custom Agents

### 1. Use Agent Template

```bash
npm run customize
```

This will guide you through creating a custom agent based on templates.

### 2. Basic Agent Structure

```typescript
import 'dotenv/config';
import express from 'express';
import { init, sendA2A, subscribe } from '../lib/a2a';
import { initEVM } from '../lib/hedera';

const app = express();
app.use(express.json());

// Initialize A2A messaging
await init(null, { agentName: 'MyCustomAgent' });

// Subscribe to topics
subscribe('aexowork.jobs', async (message) => {
  // Handle job messages
});

// Define endpoints
app.get('/', (req, res) => {
  res.json({ status: 'running', agent: 'MyCustomAgent' });
});

// Start server
const port = process.env.AGENT_PORT || 3000;
app.listen(port, () => {
  console.log(`[MyCustomAgent] Running on port ${port}`);
});
```

### 3. Environment Configuration

Add to your `.env`:

```env
MY_AGENT_PORT=3000
MY_AGENT_ACCOUNT_ID=0.0.xxxxx
MY_AGENT_PRIVATE_KEY=...
MY_AGENT_DID=did:hedera:testnet:...
```

### 4. Register Agent

Register your agent on HCS-10:

```typescript
import { registerAgent } from '../lib/hcs10';

await registerAgent({
  accountId: process.env.MY_AGENT_ACCOUNT_ID,
  did: process.env.MY_AGENT_DID,
  capabilities: ['custom-capability'],
  metadataCID: 'bafy...'
});
```

## API Reference

### A2A Messaging

#### `init(url?: string, options?: InitOptions): Promise<void>`

Initialize A2A messaging connection.

**Parameters:**
- `url`: Optional NATS URL (ignored, kept for compatibility)
- `options`: Initialization options
  - `agentName`: Name of the agent
  - `agentDescription`: Agent description
  - `capabilities`: Array of agent capabilities

#### `sendA2A(topic: string, message: any): Promise<void>`

Send A2A message to topic.

**Parameters:**
- `topic`: Topic name (e.g., 'aexowork.jobs')
- `message`: Message object to send

#### `subscribe(topic: string, handler: MessageHandler): void`

Subscribe to A2A topic.

**Parameters:**
- `topic`: Topic name to subscribe to
- `handler`: Message handler function

### Hedera Integration

#### `initEVM(): { provider, signer }`

Initialize Hedera EVM provider and signer.

**Returns:**
- `provider`: ethers.js provider
- `signer`: ethers.js signer

#### `getContract(address: string, abi: any, privateKey: string): Contract`

Get contract instance.

**Parameters:**
- `address`: Contract address
- `abi`: Contract ABI
- `privateKey`: Private key for signing

### IPFS Storage

#### `uploadJSON(data: any): Promise<string>`

Upload JSON data to IPFS.

**Returns:** IPFS CID

#### `getFromIPFS(cid: string): Promise<any>`

Retrieve data from IPFS.

**Returns:** Parsed JSON data

## Testing

### Test A2A Messaging

```bash
node test-a2a-messaging.js
```

### Test Agent Communication

```bash
node test-direct-a2a.js
```

### Test Complete Flow

```bash
npm run test:flow
```

## Best Practices

1. **Error Handling**: Always wrap A2A operations in try-catch blocks
2. **Message Signing**: Sign all A2A messages for authentication
3. **Resource Management**: Close connections when agent shuts down
4. **Logging**: Use structured logging for debugging
5. **Configuration**: Store sensitive data in environment variables
6. **Type Safety**: Use TypeScript for type safety
7. **Testing**: Write unit tests for agent logic

## Troubleshooting

### Agent Not Receiving Messages

- Verify HCS-10 connection is established
- Check topic subscription is active
- Verify agent account has sufficient HBAR
- Check network configuration

### Contract Calls Failing

- Verify contract addresses in `.env`
- Check account has sufficient HBAR for gas
- Verify private key is correct
- Check RPC endpoint is accessible

### IPFS Upload Issues

- Verify IPFS node is running
- Check Pinata credentials if using Pinata
- Verify network connectivity
- Check file size limits

## License

MIT License - see LICENSE file in root directory.

