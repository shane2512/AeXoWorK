require('dotenv').config();
const { ethers } = require('ethers');
const {
  Client,
  PrivateKey,
  AccountId,
  TopicMessageSubmitTransaction,
} = require('@hashgraph/sdk');

// Ethers provider and wallet for EVM interactions
let provider = null;
let wallet = null;

// Hedera native SDK client for HCS
let hederaClient = null;

/**
 * Initialize Hedera EVM provider and wallet
 */
function initEVM() {
  if (provider) return { provider, wallet };
  
  provider = new ethers.providers.JsonRpcProvider(
    process.env.HEDERA_RPC_URL || process.env.HEDERA_JSON_RPC_RELAY || 'https://testnet.hashio.io/api'
  );
  
  if (process.env.HEDERA_PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.HEDERA_PRIVATE_KEY, provider);
    console.log('[Hedera EVM] Initialized with wallet:', wallet.address);
  } else {
    console.warn('[Hedera EVM] No HEDERA_PRIVATE_KEY found. Wallet operations will be limited.');
    wallet = null;
  }
  
  return { provider, wallet };
}

/**
 * Initialize Hedera native SDK client for HCS
 */
function initHCS() {
  if (hederaClient) return hederaClient;
  
  const network = process.env.HEDERA_NETWORK || 'testnet';
  hederaClient =
    network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  
  hederaClient.setOperator(
    AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
    PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
  );
  
  console.log('[Hedera HCS] Initialized for', network);
  return hederaClient;
}

/**
 * Get a contract instance
 * @param {string} address - Contract address
 * @param {Array} abi - Contract ABI
 * @param {string} privateKey - Optional private key to use (if not provided, uses default HEDERA_PRIVATE_KEY)
 * @returns {ethers.Contract}
 */
function getContract(address, abi, privateKey = null) {
  if (privateKey) {
    // Use provided private key
    const customProvider = new ethers.providers.JsonRpcProvider(
      process.env.HEDERA_RPC_URL || process.env.HEDERA_JSON_RPC_RELAY || 'https://testnet.hashio.io/api'
    );
    const customWallet = new ethers.Wallet(privateKey, customProvider);
    return new ethers.Contract(address, abi, customWallet);
  }
  const { provider: p, wallet: w } = initEVM();
  // If no wallet, use provider only (read-only operations)
  if (!w) {
    return new ethers.Contract(address, abi, p);
  }
  return new ethers.Contract(address, abi, w);
}

/**
 * Create an escrow on-chain
 * @param {string} escrowManagerAddr - EscrowManager contract address
 * @param {string} escrowId - Escrow ID (bytes32)
 * @param {string} freelancerAddr - Freelancer address
 */
async function createEscrow(escrowManagerAddr, escrowId, freelancerAddr) {
  const abi = [
    'function createEscrow(bytes32 escrowId, address payable freelancer)',
  ];
  const contract = getContract(escrowManagerAddr, abi);
  const tx = await contract.createEscrow(escrowId, freelancerAddr);
  const receipt = await tx.wait();
  console.log('[Hedera] Escrow created:', receipt.transactionHash);
  return receipt;
}

/**
 * Fund an escrow with HBAR
 * @param {string} escrowManagerAddr - EscrowManager contract address
 * @param {string} escrowId - Escrow ID (bytes32)
 * @param {string} amountHBAR - Amount in wei/tinybar
 */
async function fundEscrow(escrowManagerAddr, escrowId, amountHBAR) {
  const abi = ['function fundEscrow(bytes32 escrowId) payable'];
  const contract = getContract(escrowManagerAddr, abi);
  const tx = await contract.fundEscrow(escrowId, { value: amountHBAR });
  const receipt = await tx.wait();
  console.log('[Hedera] Escrow funded:', receipt.transactionHash);
  return receipt;
}

/**
 * Submit a message to Hedera Consensus Service (HCS)
 * @param {string} topicId - HCS topic ID (e.g., "0.0.12345")
 * @param {string} message - Message string to submit
 */
async function submitHCSMessage(topicId, message) {
  const client = initHCS();
  const tx = await new TopicMessageSubmitTransaction({
    topicId,
    message,
  }).execute(client);
  
  const receipt = await tx.getReceipt(client);
  console.log('[Hedera HCS] Message submitted to topic', topicId);
  return receipt;
}

/**
 * Check if escrow is funded (query on-chain)
 * @param {string} escrowManagerAddr - EscrowManager contract address
 * @param {string} escrowId - Escrow ID (bytes32)
 */
async function checkEscrowPaid(escrowManagerAddr, escrowId) {
  const abi = [
    'function escrows(bytes32) view returns (address, address, uint256, uint8, address, uint256)',
  ];
  const contract = getContract(escrowManagerAddr, abi);
  const escrow = await contract.escrows(escrowId);
  
  // escrow[2] is amount, escrow[3] is status
  // Status: 0=None, 1=Created, 2=Funded, 3=Delivered, 4=Disputed, 5=Released, 6=Refunded
  const isFunded = escrow[3] >= 2 && escrow[2].gt(0);
  return isFunded;
}

module.exports = {
  initEVM,
  initHCS,
  getContract,
  createEscrow,
  fundEscrow,
  submitHCSMessage,
  checkEscrowPaid,
};

