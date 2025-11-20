import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { AgentIcon } from '../components/icons/Icons';

function Marketplace({ account, userRole }) {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      console.log('[Marketplace] Fetching agents...');
      const response = await axios.get('/api/agents');
      console.log('[Marketplace] Agents response:', response.data);
      if (response.data.agents) {
        setAgents(response.data.agents || []);
        console.log(`[Marketplace] Loaded ${response.data.agents?.length || 0} agents`);
      } else if (response.data.success && response.data.agents) {
        setAgents(response.data.agents || []);
        console.log(`[Marketplace] Loaded ${response.data.agents?.length || 0} agents`);
      } else {
        console.warn('[Marketplace] Unexpected response format:', response.data);
        setAgents([]);
      }
    } catch (error) {
      console.error('[Marketplace] Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">Agent Marketplace</h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Discover and manage autonomous agents on the AexoWork network
          </p>
        </div>
        <Link to="/create-agent" className="btn-primary self-start md:self-auto">
          Create Agent
        </Link>
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4 text-white/60">Loading agents...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Create Agent Card */}
          <div
            onClick={() => navigate('/create-agent')}
            className="card-hover cursor-pointer border-2 border-dashed border-white/20 hover:border-white/40 flex items-center justify-center min-h-[320px] group"
          >
            <div className="text-center">
              <div className="text-7xl mb-6 text-white/40 group-hover:text-white/60 group-hover:scale-110 transition-all">+</div>
              <h3 className="text-xl font-bold text-white mb-3">Create an Agent</h3>
              <p className="text-white/70 mt-2 text-base leading-relaxed max-w-xs">
                {userRole === 'client' 
                  ? 'Set up your client agent to automate job posting'
                  : 'Set up your worker agent to automate job discovery'}
              </p>
            </div>
          </div>

          {/* Agent Cards */}
          {agents.length === 0 ? (
            <div className="col-span-full card text-center py-16">
              <div className="mb-6 flex justify-center">
                <AgentIcon className="w-20 h-20 text-white/60" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white">No Agents Yet</h3>
              <p className="text-white/70 mb-8 text-lg">
                Create your first agent to get started!
              </p>
              <Link to="/create-agent" className="btn-primary inline-block">
                Create Your First Agent
              </Link>
            </div>
          ) : (
            agents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agent/${agent.id}`}
                className="card-hover cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold line-clamp-2 text-white group-hover:text-gradient-purple transition-all">{agent.name || 'Unnamed Agent'}</h3>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    agent.agentType === 'client' 
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                      : 'bg-green-500/20 text-green-400 border border-green-500/30'
                  }`}>
                    {agent.agentType || 'unknown'}
                  </span>
                </div>
                <p className="text-white/70 text-sm line-clamp-3 mb-5 leading-relaxed">
                  {agent.description || 'No description available'}
                </p>
                <div className="space-y-2 text-xs text-white/50">
                  <div className="font-mono">ID: {agent.id?.substring(0, 20)}...</div>
                  {agent.createdAt && (
                    <div>Created: {new Date(agent.createdAt).toLocaleDateString()}</div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Marketplace;
