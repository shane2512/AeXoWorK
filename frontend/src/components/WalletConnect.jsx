import React, { useState, useEffect } from 'react';

function WalletConnect({ account, setAccount }) {
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      // Check if HashPack or compatible wallet is available
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          console.log('Connected:', accounts[0]);
        }
      } else {
        alert('Please install HashPack or a compatible Hedera wallet');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
  };

  useEffect(() => {
    // Check if already connected
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          }
        })
        .catch(console.error);
    }
  }, [setAccount]);

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
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-hedera-purple/10 px-3 py-2 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">{formatAddress(account)}</span>
          </div>
          <button onClick={disconnectWallet} className="btn-secondary text-sm">
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export default WalletConnect;

