import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ClientIcon, WorkerIcon, CheckIcon, StarIcon, ScaleIcon, DatabaseIcon, MoneyIcon, WrenchIcon, AgentIcon, RefreshIcon, XIcon } from './icons/Icons';

const AgentMonitor = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);

  const AGENT_ENDPOINTS = [
    { name: 'ClientAgent', port: 3001, type: 'core', icon: ClientIcon },
    { name: 'WorkerAgent', port: 3002, type: 'core', icon: WorkerIcon },
    { name: 'VerificationAgent', port: 3003, type: 'core', icon: CheckIcon },
    { name: 'ReputeAgent', port: 3004, type: 'a2a', icon: StarIcon },
    { name: 'DisputeAgent', port: 3005, type: 'a2a', icon: ScaleIcon },
    { name: 'DataAgent', port: 3006, type: 'a2a', icon: DatabaseIcon },
    { name: 'EscrowAgent', port: 3007, type: 'a2a', icon: MoneyIcon },
    { name: 'MarketplaceAgent', port: 3008, type: 'marketplace', icon: AgentIcon }
  ];

  useEffect(() => {
    checkAgents();
    const interval = setInterval(checkAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkAgents = async () => {
    setLoading(true);
    const statuses = await Promise.all(
      AGENT_ENDPOINTS.map(async (agent) => {
        try {
          const response = await axios.get(`http://localhost:${agent.port}`, {
            timeout: 3000
          });
          return {
            ...agent,
            status: 'online',
            data: response.data,
            lastChecked: Date.now()
          };
        } catch (error) {
          return {
            ...agent,
            status: 'offline',
            error: error.message,
            lastChecked: Date.now()
          };
        }
      })
    );
    setAgents(statuses);
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    return status === 'online' 
      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
      : 'bg-red-500/20 text-red-400 border border-red-500/30';
  };

  const getTypeBadge = (type) => {
    const colors = {
      core: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      a2a: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      marketplace: 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
    };
    return colors[type] || 'bg-white/5 text-white/60 border border-white/10';
  };

  const onlineCount = agents.filter(a => a.status === 'online').length;
  const offlineCount = agents.filter(a => a.status === 'offline').length;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
            Agent Monitor
          </h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Real-time monitoring of all A2A agents
          </p>
        </div>
        <button
          onClick={checkAgents}
          disabled={loading}
          className="btn-ghost flex items-center gap-2"
        >
          {loading ? (
            'Refreshing...'
          ) : (
            <>
              <RefreshIcon className="w-4 h-4" />
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        <div className="card-hover">
          <div className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Total Agents</div>
          <div className="text-5xl font-bold text-gradient-purple">{agents.length}</div>
        </div>
        <div className="card-hover">
          <div className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Online</div>
          <div className="text-5xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">{onlineCount}</div>
        </div>
        <div className="card-hover">
          <div className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Offline</div>
          <div className="text-5xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">{offlineCount}</div>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.port}
            onClick={() => setSelectedAgent(selectedAgent === agent.port ? null : agent.port)}
            className="card-hover cursor-pointer"
          >
            {/* Agent Header */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <agent.icon className="w-12 h-12 text-white/80" />
                <div className={`w-3 h-3 rounded-full ${agent.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
              <p className="text-sm text-white/60">Port {agent.port}</p>
            </div>

            {/* Agent Body */}
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeBadge(agent.type)}`}>
                  {agent.type.toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(agent.status)}`}>
                  {agent.status.toUpperCase()}
                </span>
              </div>

              {agent.status === 'online' && agent.data && (
                <div className="space-y-2 pt-3 border-t border-white/10">
                  {agent.data.stats && (
                    <div className="text-xs text-white/60">
                      <p className="font-semibold mb-2 text-white/80">Stats:</p>
                      {Object.entries(agent.data.stats).slice(0, 3).map(([key, value]) => (
                        <p key={key} className="truncate mb-1">
                          • {key}: <span className="font-medium text-white/90">{value}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {agent.status === 'offline' && (
                <div className="pt-3 border-t border-white/10">
                  <p className="text-xs text-white/50">
                    {agent.error || 'Agent unavailable'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Agent Details */}
      {selectedAgent && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Agent Details</h2>
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          {agents.find(a => a.port === selectedAgent)?.data && (
            <div className="space-y-4">
              <pre className="bg-white/5 p-4 rounded-xl border border-white/10 text-xs text-white/80 overflow-auto max-h-96">
                {JSON.stringify(agents.find(a => a.port === selectedAgent)?.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentMonitor;
