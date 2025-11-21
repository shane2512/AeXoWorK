import { ethers } from 'ethers';

// Hedera Testnet configuration
const HEDERA_TESTNET = {
  chainId: '0x128', // 296 in hex
  chainName: 'Hedera Testnet',
  nativeCurrency: {
    name: 'HBAR',
    symbol: 'HBAR',
    decimals: 18,
  },
  rpcUrls: ['https://testnet.hashio.io/api'],
  blockExplorerUrls: ['https://hashscan.io/testnet'],
};

/**
 * Ensure wallet is connected to Hedera Testnet
 * If not, prompt user to switch networks
 */
export async function ensureHederaTestnet() {
  if (!window.ethereum) {
    throw new Error('No wallet detected. Please install HashPack or MetaMask.');
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const network = await provider.getNetwork();

  // Check if already on Hedera Testnet (Chain ID 296)
  if (network.chainId === 296) {
    return provider;
  }

  // Try to switch to Hedera Testnet
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HEDERA_TESTNET.chainId }],
    });
    
    // Wait a bit for the switch to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the switch
    const newProvider = new ethers.providers.Web3Provider(window.ethereum);
    const newNetwork = await newProvider.getNetwork();
    
    if (newNetwork.chainId !== 296) {
      throw new Error('Failed to switch to Hedera Testnet');
    }
    
    return newProvider;
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        // Add Hedera Testnet to wallet
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [HEDERA_TESTNET],
        });
        
        // Wait for the addition to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newProvider = new ethers.providers.Web3Provider(window.ethereum);
        return newProvider;
      } catch (addError) {
        throw new Error('Failed to add Hedera Testnet to wallet. Please add it manually.');
      }
    } else if (switchError.code === 4001) {
      // User rejected the request
      throw new Error('Please switch to Hedera Testnet to continue.');
    } else {
      throw new Error(`Failed to switch network: ${switchError.message}`);
    }
  }
}

/**
 * Get provider for Hedera Testnet
 * Uses JsonRpcProvider if wallet is not available
 */
export function getHederaProvider() {
  if (window.ethereum) {
    return new ethers.providers.Web3Provider(window.ethereum);
  }
  
  // Fallback to direct RPC connection
  return new ethers.providers.JsonRpcProvider('https://testnet.hashio.io/api');
}







