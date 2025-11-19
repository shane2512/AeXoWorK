import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function Marketplace({ account, userRole }) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, open, assigned, completed
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' or 'agents'

  useEffect(() => {
    fetchJobs();
    fetchAgents();
  }, []);

  // Refetch agents when switching to agents tab
  useEffect(() => {
    if (activeTab === 'agents') {
      fetchAgents();
    }
  }, [activeTab]);

  const fetchJobs = async () => {
    try {
      const response = await axios.get('/api/client/jobs');
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      console.log('[Marketplace] Fetching agents...');
      const response = await axios.get('/api/agents');
      console.log('[Marketplace] Agents response:', response.data);
      if (response.data.success) {
        setAgents(response.data.agents || []);
        console.log(`[Marketplace] Loaded ${response.data.agents?.length || 0} agents`);
      } else {
        console.warn('[Marketplace] Response not successful:', response.data);
        setAgents([]);
      }
    } catch (error) {
      console.error('[Marketplace] Error fetching agents:', error);
      console.error('[Marketplace] Error details:', error.response?.data || error.message);
      setAgents([]);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-green-100 text-green-800',
      assigned: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'client' 
              ? 'Browse jobs and manage your agents'
              : 'Discover jobs and manage your worker agents'}
          </p>
        </div>
        {activeTab === 'jobs' && userRole === 'client' && (
          <Link to="/post-job" className="btn-primary">
            Post New Job
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'jobs'
              ? 'text-hedera-purple border-b-2 border-hedera-purple'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 Jobs
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'agents'
              ? 'text-hedera-purple border-b-2 border-hedera-purple'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🤖 Agents
        </button>
      </div>

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Create Agent Card */}
          <div
            onClick={() => navigate('/create-agent')}
            className="card hover:shadow-xl transition-shadow cursor-pointer border-2 border-dashed border-gray-300 hover:border-hedera-purple flex items-center justify-center min-h-[300px]"
          >
            <div className="text-center">
              <div className="text-6xl mb-4 text-gray-400">+</div>
              <h3 className="text-xl font-bold text-gray-700">Create an Agent</h3>
              <p className="text-gray-500 mt-2 text-sm">
                {userRole === 'client' 
                  ? 'Set up your client agent to automate job posting'
                  : 'Set up your worker agent to automate job discovery'}
              </p>
            </div>
          </div>

          {/* Agent Cards */}
          {agents.length === 0 ? (
            <div className="col-span-full card text-center py-12">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold mb-2">No Agents Yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first agent to get started!
              </p>
            </div>
          ) : (
            agents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agent/${agent.id}`}
                className="card hover:shadow-xl transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold line-clamp-2">{agent.name || 'Unnamed Agent'}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    agent.agentType === 'client' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {agent.agentType || 'unknown'}
                  </span>
                </div>
                <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                  {agent.description || 'No description available'}
                </p>
                <div className="space-y-1 text-xs text-gray-400">
                  <div>DID: {agent.did?.substring(0, 30)}...</div>
                  <div>Owner: {agent.owner?.substring(0, 10)}...{agent.owner?.substring(agent.owner.length - 8)}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <>
          {/* Filters */}
          <div className="card">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              {['all', 'open', 'assigned', 'completed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-hedera-purple text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Jobs Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-hedera-purple"></div>
              <p className="mt-4 text-gray-600">Loading jobs...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-xl font-bold mb-2">No Jobs Found</h3>
              <p className="text-gray-600 mb-6">
                {filter === 'all'
                  ? 'Be the first to post a job!'
                  : `No ${filter} jobs at the moment.`}
              </p>
              <Link to="/post-job" className="btn-primary inline-block">
                Post a Job
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <Link
                  key={job.jobId}
                  to={`/job/${job.jobId}`}
                  className="card hover:shadow-xl transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold line-clamp-2">{job.title}</h3>
                    {getStatusBadge(job.status)}
                  </div>
                  
                  <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                    {job.description}
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Budget:</span>
                      <span className="font-medium text-hedera-blue">
                        {parseFloat(job.budgetHBAR) / 1e18} HBAR
                      </span>
                    </div>
                    
                    {job.requiredSkills && job.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.requiredSkills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-400">
                      Posted {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Marketplace;
