import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PostJob from './pages/PostJob';
import Marketplace from './pages/Marketplace';
import JobDetail from './pages/JobDetail';
import CreateAgent from './pages/CreateAgent';
import AgentDetail from './pages/AgentDetail';
import ProviderDashboard from './components/ProviderDashboard';
import AgentMonitor from './components/AgentMonitor';
import JobTracker from './components/JobTracker';
import WalletConnect from './components/WalletConnect';
import RoleSelector from './components/RoleSelector';

function App() {
  const [account, setAccount] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Load role from localStorage on mount
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    if (savedRole) {
      setUserRole(savedRole);
    }
  }, []);

  const handleRoleSelect = (role) => {
    setUserRole(role);
    localStorage.setItem('userRole', role);
  };

  // Show role selector if no role is selected
  if (!userRole) {
    return <RoleSelector onRoleSelect={handleRoleSelect} />;
  }

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
                    📋 {userRole === 'client' ? 'My Jobs' : 'My Work'}
                  </Link>
                  <Link to="/marketplace" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    🛒 Market
                  </Link>
                  <Link to="/agents" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                    🤖 Agents
                  </Link>
                  {userRole === 'client' && (
                    <Link to="/post-job" className="text-gray-700 hover:text-hedera-purple px-3 py-2">
                      ➕ Post Job
                    </Link>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">
                    {userRole === 'client' ? '👔 Client' : '👷 Freelancer'}
                  </span>
                  <button
                    onClick={() => {
                      localStorage.removeItem('userRole');
                      setUserRole(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                    title="Change role"
                  >
                    Change
                  </button>
                </div>
                <WalletConnect account={account} setAccount={setAccount} />
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard account={account} userRole={userRole} />} />
            <Route path="/post-job" element={<PostJob account={account} userRole={userRole} />} />
            <Route path="/marketplace" element={<Marketplace account={account} userRole={userRole} />} />
            <Route path="/create-agent" element={<CreateAgent account={account} userRole={userRole} />} />
            <Route path="/agent/:agentId" element={<AgentDetail account={account} userRole={userRole} />} />
            <Route path="/job/:jobId" element={<JobDetail account={account} userRole={userRole} />} />
            <Route path="/jobs" element={<JobTracker wallet={account} userRole={userRole} />} />
            <Route path="/provider" element={<ProviderDashboard wallet={account} userRole={userRole} />} />
            <Route path="/agents" element={<AgentMonitor userRole={userRole} />} />
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

