# Frontend

The AexoWork frontend is a React-based web application that provides a user interface for interacting with the decentralized marketplace.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Building](#building)
- [Deployment](#deployment)
- [Components](#components)
- [Pages](#pages)
- [Utilities](#utilities)
- [Styling](#styling)

## Overview

The frontend is built with React 18, Vite, and Tailwind CSS. It provides interfaces for both clients (job posters) and freelancers (workers) to interact with the AexoWork marketplace.

### Key Features

- **Wallet Integration**: Connect Hedera wallets (HashPack, Blade)
- **Job Management**: Post, view, and manage jobs
- **Marketplace Browsing**: Discover available jobs and agents
- **Transaction Management**: View and track transactions
- **Reputation Dashboard**: View agent reputation and badges
- **Real-time Updates**: Live updates via WebSocket connections
- **Responsive Design**: Mobile-friendly interface

## Architecture

```
frontend/
├── src/
│   ├── components/        # Reusable React components
│   │   ├── Navigation.jsx
│   │   ├── WalletConnect.jsx
│   │   ├── JobTracker.jsx
│   │   └── ...
│   ├── pages/            # Page components
│   │   ├── Dashboard.jsx
│   │   ├── PostJob.jsx
│   │   ├── Marketplace.jsx
│   │   └── ...
│   ├── utils/            # Utility functions
│   │   ├── hederaNetwork.js
│   │   ├── agentRegistry.js
│   │   └── micropayments.js
│   ├── App.jsx           # Main app component
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind configuration
└── package.json          # Dependencies
```

## Installation

### Prerequisites

- Node.js 18.0 or higher
- npm 9.0 or higher

### Install Dependencies

```bash
cd frontend
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the `frontend` directory:

```env
# Agent API Endpoints
VITE_MARKETPLACE_AGENT_URL=http://localhost:3008
VITE_CLIENT_AGENT_URL=http://localhost:3001
VITE_WORKER_AGENT_URL=http://localhost:3002
VITE_VERIFICATION_AGENT_URL=http://localhost:3003
VITE_REPUTE_AGENT_URL=http://localhost:3004
VITE_DISPUTE_AGENT_URL=http://localhost:3005
VITE_DATA_AGENT_URL=http://localhost:3006
VITE_ESCROW_AGENT_URL=http://localhost:3007

# Protocol Adapters
VITE_X402_URL=http://localhost:4000
VITE_AP2_URL=http://localhost:4100

# Hedera Network
VITE_HEDERA_NETWORK=testnet
VITE_HEDERA_RPC_URL=https://testnet.hashio.io/api
VITE_CHAIN_ID=296

# Smart Contract Addresses (Hedera Testnet)
VITE_AGENT_REGISTRY_ADDRESS=0xCdB11f8D0Cba2b4e0fa8114Ec660bda8081E7197
VITE_ESCROW_MANAGER_ADDRESS=0x13a2C3aEF22555012f9251F621636Cc60c0cfbBB
VITE_REPUTATION_MANAGER_ADDRESS=0xD296a448Af0Ba1413EECe5d52C1112e420CF3c39
VITE_MARKETPLACE_ADDRESS=0xa99366835284E3a2D47df3f0d91152c8dE91984F
VITE_PROOFS_ADDRESS=0xF6564fd8FAdd61F4305e7eC6a4851eA0bF30b560
VITE_ARBITRATION_ADDRESS=0x0014954fB093ABb6eC2dC51ffEC51990615B258d
```

**Note**: All frontend environment variables must be prefixed with `VITE_` to be accessible in the browser.

### Production Configuration

For production, update URLs to production endpoints:

```env
VITE_CLIENT_AGENT_URL=https://client-agent.production.com
VITE_HEDERA_NETWORK=mainnet
VITE_HEDERA_RPC_URL=https://mainnet.hashio.io/api
VITE_CHAIN_ID=295
```

## Development

### Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Development Features

- **Hot Module Replacement**: Instant updates on file changes
- **Fast Refresh**: React component state preservation
- **Source Maps**: Easy debugging
- **TypeScript Support**: Type checking (if using TypeScript)

### Code Structure

#### Components

Components are located in `src/components/`:

- **Navigation.jsx**: Main navigation bar
- **WalletConnect.jsx**: Wallet connection component
- **JobTracker.jsx**: Job listing and tracking
- **ReputationDashboard.jsx**: Reputation display
- **AgentMonitor.jsx**: Agent status monitoring

#### Pages

Pages are located in `src/pages/`:

- **Dashboard.jsx**: Main dashboard for clients/freelancers
- **PostJob.jsx**: Job posting interface
- **Marketplace.jsx**: Job and agent marketplace
- **JobDetail.jsx**: Detailed job view
- **CreateAgent.jsx**: Agent creation interface

#### Utilities

Utilities are located in `src/utils/`:

- **hederaNetwork.js**: Hedera network configuration
- **agentRegistry.js**: Agent registry interactions
- **micropayments.js**: Payment utilities

## Building

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Build Options

```bash
# Build with source maps
npm run build -- --sourcemap

# Build with analysis
npm run build -- --mode analyze
```

### Preview Production Build

```bash
npm run preview
```

## Deployment

### Vercel Deployment

The project includes `vercel.json` for Vercel deployment:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "devCommand": "cd frontend && npm run dev",
  "installCommand": "cd frontend && npm install"
}
```

**Deploy to Vercel:**

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Other Platforms

#### Netlify

Create `netlify.toml`:

```toml
[build]
  command = "cd frontend && npm install && npm run build"
  publish = "frontend/dist"
```

#### GitHub Pages

```bash
npm run build
# Deploy dist/ directory to gh-pages branch
```

## Components

### WalletConnect

Handles Hedera wallet connection and authentication.

**Props:**
- `onConnect`: Callback when wallet connects
- `onDisconnect`: Callback when wallet disconnects

**Usage:**
```jsx
<WalletConnect 
  onConnect={(account) => console.log('Connected:', account)}
  onDisconnect={() => console.log('Disconnected')}
/>
```

### JobTracker

Displays and manages jobs.

**Props:**
- `userRole`: 'client' or 'freelancer'
- `account`: Connected wallet address

**Usage:**
```jsx
<JobTracker userRole="client" account={account} />
```

### ReputationDashboard

Displays agent reputation information.

**Props:**
- `agentAddress`: Agent wallet address
- `reputationData`: Reputation data object

**Usage:**
```jsx
<ReputationDashboard 
  agentAddress={address}
  reputationData={data}
/>
```

## Pages

### Dashboard

Main dashboard showing statistics and quick actions.

**Features:**
- Active jobs count
- Completed jobs count
- Total earnings/spent
- Quick action buttons
- Recent activity feed

### PostJob

Interface for posting new jobs.

**Form Fields:**
- Job title
- Description
- Budget (HBAR)
- Required skills
- Deadline (optional)

### Marketplace

Browse available jobs and agents.

**Features:**
- Job listings with filters
- Agent listings
- Search functionality
- Category filtering

### JobDetail

Detailed view of a specific job.

**Features:**
- Job information
- Offers list
- Accept offer button
- Work delivery status
- Payment status

## Utilities

### hederaNetwork.js

Hedera network configuration and utilities.

**Functions:**
- `getNetworkConfig()`: Get current network configuration
- `switchNetwork(network)`: Switch between testnet/mainnet
- `getRPCUrl()`: Get RPC URL for current network

### agentRegistry.js

Agent registry interactions.

**Functions:**
- `getAgent(agentId)`: Get agent information
- `registerAgent(metadata)`: Register new agent
- `updateAgent(agentId, metadata)`: Update agent metadata

### micropayments.js

Payment utilities.

**Functions:**
- `createMicropaymentTx(provider, from, to, amount)`: Create payment transaction
- `waitForMicropayment(tx, confirmations)`: Wait for payment confirmation
- `isValidHbarAmount(amount)`: Validate HBAR amount

## Styling

### Tailwind CSS

The project uses Tailwind CSS for styling. Configuration is in `tailwind.config.js`.

### Custom Classes

- `card`: Card container with background and padding
- `card-hover`: Card with hover effects
- `btn-primary`: Primary button style
- `text-gradient`: Gradient text effect

### Color Scheme

- Primary: Blue/Cyan gradients
- Success: Green
- Warning: Yellow
- Error: Red
- Background: Dark theme

### Responsive Design

Breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

## Performance Optimization

### Code Splitting

Routes are automatically code-split by Vite.

### Lazy Loading

Components can be lazy loaded:

```jsx
const LazyComponent = React.lazy(() => import('./Component'));
```

### Image Optimization

Use optimized image formats (WebP, AVIF) and lazy loading.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Wallet Connection Issues

- Ensure wallet extension is installed
- Check network configuration matches
- Verify RPC URL is accessible

### Build Errors

- Clear `node_modules` and reinstall
- Check Node.js version compatibility
- Verify all environment variables are set

### Runtime Errors

- Check browser console for errors
- Verify agent endpoints are running
- Check network connectivity

## License

MIT License - see LICENSE file in root directory.

