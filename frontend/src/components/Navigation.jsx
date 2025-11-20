import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import WalletConnect from './WalletConnect';
import { ClientIcon, WorkerIcon } from './icons/Icons';

function Navigation({ account, setAccount, userRole, setUserRole }) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  // Don't show navigation on landing page (it has its own)
  if (isLandingPage) {
    return null;
  }

  return (
    <nav className="bg-black/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center space-x-10">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 group-hover:scale-110 transition-transform" />
              <span className="text-lg font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">AexoWork</span>
            </Link>
            <div className="hidden md:flex space-x-1">
              <Link 
                to="/dashboard" 
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/dashboard' 
                    ? 'text-white bg-white/10' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                to="/marketplace" 
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/marketplace' 
                    ? 'text-white bg-white/10' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                Marketplace
              </Link>
              <Link 
                to="/agents" 
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/agents' 
                    ? 'text-white bg-white/10' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                Agents
              </Link>
              <Link 
                to="/jobs" 
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/jobs' 
                    ? 'text-white bg-white/10' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {userRole === 'client' ? 'My Jobs' : 'My Work'}
              </Link>
              <Link 
                to="/docs" 
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/docs' 
                    ? 'text-white bg-white/10' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                Docs
              </Link>
              {userRole === 'client' && (
                <Link 
                  to="/post-job" 
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    location.pathname === '/post-job' 
                      ? 'text-white bg-white/10' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Post Job
                </Link>
              )}
              <Link 
                to="/chat" 
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/chat' 
                    ? 'text-white bg-white/10' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                Chat
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userRole && (
              <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-2 rounded-full border border-white/20">
                <span className="text-xs font-semibold text-white">
                  <span className="flex items-center gap-2">
                    {userRole === 'client' ? (
                      <>
                        <ClientIcon className="w-4 h-4" />
                        Client
                      </>
                    ) : (
                      <>
                        <WorkerIcon className="w-4 h-4" />
                        Freelancer
                      </>
                    )}
                  </span>
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem('userRole');
                    setUserRole(null);
                  }}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                  title="Change role"
                >
                  Change
                </button>
              </div>
            )}
            <WalletConnect account={account} setAccount={setAccount} />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;

