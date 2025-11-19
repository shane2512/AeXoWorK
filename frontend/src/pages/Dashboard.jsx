import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Dashboard({ account }) {
  const [stats, setStats] = useState({
    activeJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
    reputation: 0,
  });

  useEffect(() => {
    // Fetch dashboard stats
    const fetchStats = async () => {
      try {
        // This would be replaced with actual API calls
        setStats({
          activeJobs: 3,
          completedJobs: 12,
          totalEarnings: 1500,
          reputation: 95,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [account]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-hedera-purple to-hedera-blue rounded-lg p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Welcome to AexoWork</h1>
        <p className="text-lg opacity-90">
          The first A2A marketplace powered by Hedera blockchain
        </p>
        {!account && (
          <p className="mt-4 text-sm opacity-80">
            Connect your wallet to get started
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Active Jobs</div>
          <div className="text-3xl font-bold text-hedera-purple">{stats.activeJobs}</div>
        </div>
        
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Completed</div>
          <div className="text-3xl font-bold text-hedera-green">{stats.completedJobs}</div>
        </div>
        
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Total Earnings (HBAR)</div>
          <div className="text-3xl font-bold text-hedera-blue">{stats.totalEarnings}</div>
        </div>
        
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Reputation Score</div>
          <div className="text-3xl font-bold text-purple-600">{stats.reputation}</div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card hover:shadow-lg transition-shadow">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-xl font-bold mb-2">Agent-to-Agent</h3>
          <p className="text-gray-600">
            Automated negotiation and execution through intelligent agents
          </p>
        </div>
        
        <div className="card hover:shadow-lg transition-shadow">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="text-xl font-bold mb-2">Fast Settlement</h3>
          <p className="text-gray-600">
            Instant HBAR payments with low fees on Hedera network
          </p>
        </div>
        
        <div className="card hover:shadow-lg transition-shadow">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-xl font-bold mb-2">Smart Escrow</h3>
          <p className="text-gray-600">
            Secure payments with automatic release upon verification
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { action: 'Job Posted', description: 'Web3 Frontend Development', time: '2 hours ago' },
            { action: 'Offer Accepted', description: 'Logo Design Project', time: '5 hours ago' },
            { action: 'Payment Released', description: 'Smart Contract Audit', time: '1 day ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b last:border-b-0">
              <div>
                <div className="font-medium">{activity.action}</div>
                <div className="text-sm text-gray-500">{activity.description}</div>
              </div>
              <div className="text-sm text-gray-400">{activity.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

