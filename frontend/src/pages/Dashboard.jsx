import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { DocumentIcon, AgentIcon, RocketIcon } from '../components/icons/Icons';

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
    const fetchStats = async () => {
      try {
        if (userRole === 'client') {
          const CLIENT_AGENT_URL = 'http://localhost:3001';
          const jobsResponse = await axios.get(`${CLIENT_AGENT_URL}/jobs`).catch(() => ({ data: { jobs: [] } }));
          const jobs = jobsResponse.data.jobs || [];
          
          setStats({
            activeJobs: jobs.filter(j => j.status === 'open' || j.status === 'assigned').length,
            completedJobs: jobs.filter(j => j.status === 'completed').length,
            totalSpent: 0,
            totalEarnings: 0,
            reputation: 0,
            activeOffers: 0,
          });
        } else if (userRole === 'freelancer') {
          const WORKER_AGENT_URL = 'http://localhost:3002';
          const workResponse = await axios.get(`${WORKER_AGENT_URL}/work`).catch(() => ({ data: { work: [] } }));
          const work = workResponse.data.work || [];
          
          // Calculate total earnings from completed work
          const completedWork = work.filter(w => w.status === 'delivered' || w.status === 'completed');
          const totalEarnings = completedWork.reduce((sum, w) => {
            // budgetHBAR is in wei (string), convert to HBAR
            const budgetHBAR = w.job?.budgetHBAR || w.job?.priceHBAR || '0';
            const amountInHBAR = parseFloat(budgetHBAR) / 1e18;
            return sum + (isNaN(amountInHBAR) ? 0 : amountInHBAR);
          }, 0);
          
          setStats({
            activeJobs: work.filter(w => w.status === 'in_progress').length,
            completedJobs: completedWork.length,
            totalEarnings: parseFloat(totalEarnings.toFixed(4)), // Round to 4 decimal places
            totalSpent: 0,
            reputation: 0,
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
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl card p-10 md:p-14">
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gradient">
            Welcome {userRole === 'client' ? 'Client' : 'Freelancer'}
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-3xl leading-relaxed">
            {userRole === 'client' 
              ? 'Manage your projects and hire talented freelancers through autonomous agents'
              : 'Find jobs and grow your freelance career with AI-powered agents'}
          </p>
          {!account && (
            <div className="mt-8">
              <p className="text-base text-white/60">Connect your wallet to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {userRole === 'client' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <div className="card-hover">
            <div className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">Active Jobs</div>
            <div className="text-5xl md:text-6xl font-bold text-gradient-purple">{stats.activeJobs}</div>
          </div>
          <div className="card-hover">
            <div className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">Completed Jobs</div>
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">{stats.completedJobs}</div>
          </div>
          <div className="card-hover">
            <div className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">Total Spent</div>
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{stats.totalSpent} <span className="text-2xl">HBAR</span></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <div className="card-hover">
            <div className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">Active Jobs</div>
            <div className="text-5xl md:text-6xl font-bold text-gradient-purple">{stats.activeJobs}</div>
          </div>
          <div className="card-hover">
            <div className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">Completed Jobs</div>
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">{stats.completedJobs}</div>
          </div>
          <div className="card-hover">
            <div className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">Total Earnings</div>
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{stats.totalEarnings} <span className="text-2xl">HBAR</span></div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {userRole === 'client' ? (
          <>
            <Link to="/post-job" className="card-hover group">
              <div className="mb-6 transform group-hover:scale-110 transition-transform flex justify-center">
                <DocumentIcon className="w-16 h-16 text-white/80" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gradient-purple transition-all">Post a Job</h3>
              <p className="text-white/70 leading-relaxed">Create a new job and let agents find the perfect match</p>
            </Link>
            <Link to="/marketplace" className="card-hover group">
              <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">🛒</div>
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gradient-purple transition-all">Browse Marketplace</h3>
              <p className="text-white/70 leading-relaxed">Explore available agents and services</p>
            </Link>
            <Link to="/agents" className="card-hover group">
              <div className="mb-6 transform group-hover:scale-110 transition-transform flex justify-center">
                <AgentIcon className="w-16 h-16 text-white/80" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gradient-purple transition-all">Manage Agents</h3>
              <p className="text-white/70 leading-relaxed">View and manage your deployed agents</p>
            </Link>
          </>
        ) : (
          <>
            <Link to="/marketplace" className="card-hover group">
              <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">🔍</div>
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gradient-purple transition-all">Find Jobs</h3>
              <p className="text-white/70 leading-relaxed">Discover jobs matching your skills</p>
            </Link>
            <Link to="/jobs" className="card-hover group">
              <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">💼</div>
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gradient-purple transition-all">My Work</h3>
              <p className="text-white/70 leading-relaxed">Track your active and completed jobs</p>
            </Link>
            <Link to="/create-agent" className="card-hover group">
              <div className="mb-6 transform group-hover:scale-110 transition-transform flex justify-center">
                <RocketIcon className="w-16 h-16 text-white/80" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-gradient-purple transition-all">Create Agent</h3>
              <p className="text-white/70 leading-relaxed">Deploy your worker agent to automate job discovery</p>
            </Link>
          </>
        )}
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        <div className="card-hover group">
          <div className="mb-6 transform group-hover:scale-110 transition-transform flex justify-center">
            <AgentIcon className="w-16 h-16 text-white/80" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-white">Agent-to-Agent</h3>
          <p className="text-white/70 leading-relaxed">Automated negotiation and execution through intelligent agents</p>
        </div>
        <div className="card-hover group">
          <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">⚡</div>
          <h3 className="text-xl font-bold mb-3 text-white">Fast Settlement</h3>
          <p className="text-white/70 leading-relaxed">Instant HBAR payments with low fees on Hedera network</p>
        </div>
        <div className="card-hover group">
          <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform">🔒</div>
          <h3 className="text-xl font-bold mb-3 text-white">Smart Escrow</h3>
          <p className="text-white/70 leading-relaxed">Secure payments with automatic release upon verification</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-white">Recent Activity</h2>
        <div className="space-y-6">
          {userRole === 'client' ? (
            <>
              <div className="flex items-center justify-between py-5 border-b border-white/10 last:border-b-0">
                <div>
                  <div className="font-semibold text-white text-lg mb-1">Job Posted</div>
                  <div className="text-sm text-white/60">Your posted jobs will appear here</div>
                </div>
                <div className="text-sm text-white/40">-</div>
              </div>
              <div className="flex items-center justify-between py-5 border-b border-white/10 last:border-b-0">
                <div>
                  <div className="font-semibold text-white text-lg mb-1">Offer Accepted</div>
                  <div className="text-sm text-white/60">Accepted offers will appear here</div>
                </div>
                <div className="text-sm text-white/40">-</div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between py-5 border-b border-white/10 last:border-b-0">
                <div>
                  <div className="font-semibold text-white text-lg mb-1">Job Discovered</div>
                  <div className="text-sm text-white/60">New jobs matching your skills</div>
                </div>
                <div className="text-sm text-white/40">-</div>
              </div>
              <div className="flex items-center justify-between py-5 border-b border-white/10 last:border-b-0">
                <div>
                  <div className="font-semibold text-white text-lg mb-1">Work Delivered</div>
                  <div className="text-sm text-white/60">Your completed work</div>
                </div>
                <div className="text-sm text-white/40">-</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
