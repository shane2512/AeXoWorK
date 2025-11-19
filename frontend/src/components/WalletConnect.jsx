import React, { useState, useEffect } from 'react';
import { ensureHederaTestnet } from '../utils/hederaNetwork';

function WalletConnect({ account, setAccount }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      // Check if HashPack or compatible wallet is available
      if (window.ethereum) {
        // Ensure we're on Hedera Testnet
        try {
          await ensureHederaTestnet();
        } catch (networkError) {
          console.warn('Network switch warning:', networkError.message);
          // Continue anyway - user might have manually switched
        }
        
        // Request permissions first - this will show account selection in MetaMask
        // if there are multiple accounts or if permissions haven't been granted
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (permError) {
          // If user rejects or permissions already exist, continue
          if (permError.code === 4001) {
            throw new Error('Connection rejected by user');
          }
          console.log('Permissions:', permError.message);
        }
        
        // Request accounts - MetaMask should show account picker if multiple accounts exist
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          console.log('Connected:', accounts[0]);
        } else {
          throw new Error('No accounts found. Please unlock your wallet.');
        }
      } else {
        alert('Please install HashPack or a compatible Hedera wallet (MetaMask, etc.)');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      if (error.code === 4001) {
        alert('Connection rejected. Please approve the connection request.');
      } else {
        alert('Failed to connect wallet: ' + (error.message || error.toString()));
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setShowAccountMenu(false);
  };

  const switchAccount = async () => {
    setIsConnecting(true);
    try {
      // Request permissions again to show account selection
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      
      // Get the newly selected account
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setShowAccountMenu(false);
      }
    } catch (error) {
      console.error('Error switching account:', error);
      if (error.code !== 4001) { // User rejection is okay
        alert('Failed to switch account: ' + error.message);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    // Check if already connected (but don't auto-connect - let user choose)
    // This just checks for existing connection without prompting
    if (window.ethereum && account) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (accounts.length > 0 && accounts[0] !== account) {
            // Account changed, update it
            setAccount(accounts[0]);
          } else if (accounts.length === 0) {
            // Disconnected
            setAccount(null);
          }
        })
        .catch(console.error);
    }

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
        }
        setShowAccountMenu(false);
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => {
        // Reload page on chain change to ensure proper network
        window.location.reload();
      });

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [account, setAccount]);

  // Close menu when clicking outside
  useEffect(() => {
    if (showAccountMenu) {
      const handleClickOutside = (event) => {
        if (!event.target.closest('.relative')) {
          setShowAccountMenu(false);
        }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showAccountMenu]);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div>
      {!account ? (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="btn-primary"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="relative flex items-center space-x-3">
          <div 
            className="flex items-center space-x-2 bg-hedera-purple/10 px-3 py-2 rounded-lg cursor-pointer hover:bg-hedera-purple/20 transition-colors"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">{formatAddress(account)}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {showAccountMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-2">
                <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                  Connected Account
                </div>
                <div className="px-3 py-2 text-sm font-mono">
                  {formatAddress(account)}
                </div>
                <button
                  onClick={switchAccount}
                  disabled={isConnecting}
                  className="w-full mt-2 px-3 py-2 text-sm text-left hover:bg-gray-50 rounded transition-colors"
                >
                  {isConnecting ? 'Switching...' : '🔄 Switch Account'}
                </button>
                <button
                  onClick={disconnectWallet}
                  className="w-full mt-1 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WalletConnect;

