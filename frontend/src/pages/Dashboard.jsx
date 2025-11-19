import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Dashboard({ account, userRole }) {
  const [stats, setStats] = useState({
    activeJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
    totalSpent: 0,
    reputation: 0,
    activeOffers: 0,
  });

  useEffect(() => {
    // Fetch dashboard stats based on user role
    const fetchStats = async () => {
      try {
        if (userRole === 'client') {
          // Client-specific stats
          const CLIENT_AGENT_URL = 'http://localhost:3001';
          const jobsResponse = await axios.get(`${CLIENT_AGENT_URL}/jobs`).catch(() => ({ data: { jobs: [] } }));
          const jobs = jobsResponse.data.jobs || [];
          
          setStats({
            activeJobs: jobs.filter(j => j.status === 'open' || j.status === 'assigned').length,
            completedJobs: jobs.filter(j => j.status === 'completed').length,
            totalSpent: 0, // Calculate from completed jobs
            totalEarnings: 0, // Not applicable for clients
            reputation: 0, // Not shown for clients
            activeOffers: 0,
          });
        } else if (userRole === 'freelancer') {
          // Freelancer-specific stats
          const WORKER_AGENT_URL = 'http://localhost:3002';
          const workResponse = await axios.get(`${WORKER_AGENT_URL}/work`).catch(() => ({ data: { work: [] } }));
          const work = workResponse.data.work || [];
          
          setStats({
            activeJobs: work.filter(w => w.status === 'in_progress').length,
            completedJobs: work.filter(w => w.status === 'delivered' || w.status === 'completed').length,
            totalEarnings: 0, // Calculate from completed work
            totalSpent: 0, // Not applicable for freelancers
            reputation: 0, // Fetch from reputation API
            activeOffers: 0,
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    if (userRole) {
      fetchStats();
    }
  }, [account, userRole]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-hedera-purple to-hedera-blue rounded-lg p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">
          Welcome {userRole === 'client' ? 'Client' : 'Freelancer'}
        </h1>
        <p className="text-lg opacity-90">
          {userRole === 'client' 
            ? 'Manage your projects and hire talented freelancers'
            : 'Find jobs and grow your freelance career'}
        </p>
        {!account && (
          <p className="mt-4 text-sm opacity-80">
            Connect your wallet to get started
          </p>
        )}
      </div>

      {/* Stats Grid - Role Specific */}
      {userRole === 'client' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">Active Jobs</div>
            <div className="text-3xl font-bold text-hedera-purple">{stats.activeJobs}</div>
          </div>
          
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">Completed Jobs</div>
            <div className="text-3xl font-bold text-hedera-green">{stats.completedJobs}</div>
          </div>
          
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">Total Spent (HBAR)</div>
            <div className="text-3xl font-bold text-hedera-blue">{stats.totalSpent}</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">Active Jobs</div>
            <div className="text-3xl font-bold text-hedera-purple">{stats.activeJobs}</div>
          </div>
          
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">Completed Jobs</div>
            <div className="text-3xl font-bold text-hedera-green">{stats.completedJobs}</div>
          </div>
          
          <div className="card">
            <div className="text-sm text-gray-500 mb-1">Total Earnings (HBAR)</div>
            <div className="text-3xl font-bold text-hedera-blue">{stats.totalEarnings}</div>
          </div>
        </div>
      )}

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

      {/* Recent Activity - Role Specific */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {userRole === 'client' ? (
            <>
              <div className="flex items-center justify-between py-3 border-b last:border-b-0">
                <div>
                  <div className="font-medium">Job Posted</div>
                  <div className="text-sm text-gray-500">Your posted jobs will appear here</div>
                </div>
                <div className="text-sm text-gray-400">-</div>
              </div>
              <div className="flex items-center justify-between py-3 border-b last:border-b-0">
                <div>
                  <div className="font-medium">Offer Accepted</div>
                  <div className="text-sm text-gray-500">Accepted offers will appear here</div>
                </div>
                <div className="text-sm text-gray-400">-</div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between py-3 border-b last:border-b-0">
                <div>
                  <div className="font-medium">Job Discovered</div>
                  <div className="text-sm text-gray-500">New jobs matching your skills</div>
                </div>
                <div className="text-sm text-gray-400">-</div>
              </div>
              <div className="flex items-center justify-between py-3 border-b last:border-b-0">
                <div>
                  <div className="font-medium">Work Delivered</div>
                  <div className="text-sm text-gray-500">Your completed work</div>
                </div>
                <div className="text-sm text-gray-400">-</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

