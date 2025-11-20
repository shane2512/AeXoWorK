import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import PostJob from './pages/PostJob';
import Marketplace from './pages/Marketplace';
import JobDetail from './pages/JobDetail';
import CreateAgent from './pages/CreateAgent';
import AgentDetail from './pages/AgentDetail';
import ProviderDashboard from './components/ProviderDashboard';
import AgentMonitor from './components/AgentMonitor';
import JobTracker from './components/JobTracker';
import Navigation from './components/Navigation';
import RoleSelector from './components/RoleSelector';
import Chat from './pages/Chat';
import Documentation from './pages/Documentation';

// Layout component for authenticated routes
function AppLayout({ account, setAccount, userRole, setUserRole, children }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation account={account} setAccount={setAccount} userRole={userRole} setUserRole={setUserRole} />
      <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
          {children}
        </div>
      </main>
      <footer className="relative py-12 bg-black border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center text-white/60 text-sm">
            <p>Built on Hedera • Powered by A2A Agents • Secured by HBAR</p>
            <p className="mt-2">© 2025 AexoWork. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ userRole, setUserRole, account, setAccount, children }) {
  if (!userRole) {
    return <RoleSelector onRoleSelect={setUserRole} />;
  }
  return (
    <AppLayout account={account} setAccount={setAccount} userRole={userRole} setUserRole={setUserRole}>
      {children}
    </AppLayout>
  );
}

function App() {
  const [account, setAccount] = useState(null);
  const [userRole, setUserRole] = useState(null);

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

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing account={account} setAccount={setAccount} />} />
        <Route path="/dashboard" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><Dashboard account={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/post-job" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><PostJob account={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/marketplace" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><Marketplace account={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/create-agent" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><CreateAgent account={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/agent/:agentId" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><AgentDetail account={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/job/:jobId" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><JobDetail account={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><JobTracker wallet={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/provider" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><ProviderDashboard wallet={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/agents" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><AgentMonitor userRole={userRole} /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute userRole={userRole} setUserRole={handleRoleSelect} account={account} setAccount={setAccount}><Chat account={account} userRole={userRole} /></ProtectedRoute>} />
        <Route path="/docs" element={<AppLayout account={account} setAccount={setAccount} userRole={userRole} setUserRole={handleRoleSelect}><Documentation /></AppLayout>} />
      </Routes>
    </Router>
  );
}

export default App;
