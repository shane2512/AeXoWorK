import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PostJob from './pages/PostJob';
import Marketplace from './pages/Marketplace';
import JobDetail from './pages/JobDetail';
import DataMarketplace from './components/DataMarketplace';
import ProviderDashboard from './components/ProviderDashboard';
import AgentMonitor from './components/AgentMonitor';
import BadgeGallery from './components/BadgeGallery';
import ReputationDashboard from './components/ReputationDashboard';
import JobTracker from './components/JobTracker';
import VerificationDashboard from './components/VerificationDashboard';
import WalletConnect from './components/WalletConnect';

function App() {
  const [account, setAccount] = useState(null);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center space-x-8">
                <Link to="/" className="flex items-center">
                  <span className="text-2xl font-bold text-hedera-purple">AexoWork</span>
                  <span className="ml-2 text-sm text-gray-500">A2A Marketplace</span>
                </Link>
                
                <div className="hidden md:flex space-x-4">
                  <Link to="/" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    Dashboard
                  </Link>
                  <Link to="/jobs" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    📋 Jobs
                  </Link>
                  <Link to="/marketplace" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    🛒 Market
                  </Link>
                  <Link to="/data-marketplace" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    🗄️ Data
                  </Link>
                  <Link to="/reputation" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    ⭐ Reputation
                  </Link>
                  <Link to="/badges" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    🏆 Badges
                  </Link>
                  <Link to="/verification" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    🔍 Verify
                  </Link>
                  <Link to="/agents" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    🤖 Agents
                  </Link>
                </div>
              </div>
              
              <WalletConnect account={account} setAccount={setAccount} />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard account={account} />} />
            <Route path="/post-job" element={<PostJob account={account} />} />
            <Route path="/marketplace" element={<Marketplace account={account} />} />
            <Route path="/job/:jobId" element={<JobDetail account={account} />} />
            <Route path="/jobs" element={<JobTracker wallet={account} />} />
            <Route path="/data-marketplace" element={<DataMarketplace wallet={account} />} />
            <Route path="/provider" element={<ProviderDashboard wallet={account} />} />
            <Route path="/reputation" element={<ReputationDashboard wallet={account} />} />
            <Route path="/badges" element={<BadgeGallery wallet={account} />} />
            <Route path="/verification" element={<VerificationDashboard wallet={account} />} />
            <Route path="/agents" element={<AgentMonitor />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-gray-500 text-sm">
              <p>Built on Hedera • Powered by A2A Agents • Secured by HBAR</p>
              <p className="mt-2">© 2025 AexoWork. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

