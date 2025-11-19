import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AgentMonitor = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);

  const AGENT_ENDPOINTS = [
    { name: 'ClientAgent', port: 3001, type: 'core', icon: '👤' },
    { name: 'WorkerAgent', port: 3002, type: 'core', icon: '🔧' },
    { name: 'VerificationAgent', port: 3003, type: 'core', icon: '✅' },
    { name: 'ReputeAgent', port: 3004, type: 'a2a', icon: '⭐' },
    { name: 'DisputeAgent', port: 3005, type: 'a2a', icon: '⚖️' },
    { name: 'DataAgent', port: 3006, type: 'a2a', icon: '🗄️' },
    { name: 'EscrowAgent', port: 3007, type: 'a2a', icon: '💰' },
    { name: 'MarketplaceAgent', port: 3008, type: 'marketplace', icon: '🏪' }
  ];

  useEffect(() => {
    checkAgents();
    const interval = setInterval(checkAgents, 5000); // Check every 5 seconds
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

  const getStatusColor = (status) => {
    return status === 'online' ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusBadge = (status) => {
    const colors = {
      online: 'bg-green-100 text-green-800',
      offline: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const colors = {
      core: 'bg-blue-100 text-blue-800',
      a2a: 'bg-purple-100 text-purple-800',
      marketplace: 'bg-orange-100 text-orange-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[type]}`}>
        {type.toUpperCase()}
      </span>
    );
  };

  const onlineCount = agents.filter(a => a.status === 'online').length;
  const offlineCount = agents.filter(a => a.status === 'offline').length;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🤖 Agent Monitor
        </h1>
        <p className="text-gray-600">
          Real-time monitoring of all A2A agents
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm font-medium mb-1">Total Agents</p>
          <p className="text-4xl font-bold text-gray-900">{agents.length}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm font-medium mb-1">Online</p>
          <p className="text-4xl font-bold text-green-600">{onlineCount}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <p className="text-gray-500 text-sm font-medium mb-1">Offline</p>
          <p className="text-4xl font-bold text-red-600">{offlineCount}</p>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={checkAgents}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? '🔄 Checking...' : '🔄 Refresh Status'}
        </button>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.port}
            onClick={() => setSelectedAgent(agent)}
            className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer border-2 ${
              agent.status === 'online' ? 'border-green-200' : 'border-red-200'
            }`}
          >
            {/* Agent Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">{agent.icon}</span>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)} animate-pulse`}></div>
              </div>
              <h3 className="font-bold text-gray-900">{agent.name}</h3>
              <p className="text-sm text-gray-500">Port {agent.port}</p>
            </div>

            {/* Agent Body */}
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                {getTypeBadge(agent.type)}
                {getStatusBadge(agent.status)}
              </div>

              {agent.status === 'online' && agent.data && (
                <div className="space-y-2">
                  {agent.data.stats && (
                    <div className="text-xs text-gray-600">
                      <p className="font-semibold mb-1">Stats:</p>
                      {Object.entries(agent.data.stats).slice(0, 3).map(([key, value]) => (
                        <p key={key} className="truncate">
                          • {key}: <span className="font-medium">{value}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {agent.status === 'offline' && (
                <p className="text-xs text-red-600">❌ Not responding</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-3xl">{selectedAgent.icon}</span>
                {selectedAgent.name}
              </h2>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedAgent.status)}`}></div>
                  <span className="font-semibold">{selectedAgent.status.toUpperCase()}</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Endpoint</p>
                <p className="font-mono text-sm">http://localhost:{selectedAgent.port}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-semibold">{selectedAgent.type.toUpperCase()}</p>
              </div>

              {selectedAgent.status === 'online' && selectedAgent.data && (
                <>
                  {selectedAgent.data.protocol && (
                    <div>
                      <p className="text-sm text-gray-500">Protocol</p>
                      <p className="font-semibold">{selectedAgent.data.protocol}</p>
                    </div>
                  )}

                  {selectedAgent.data.version && (
                    <div>
                      <p className="text-sm text-gray-500">Version</p>
                      <p className="font-semibold">{selectedAgent.data.version}</p>
                    </div>
                  )}

                  {selectedAgent.data.stats && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Statistics</p>
                      <div className="bg-gray-50 rounded-md p-3 space-y-1">
                        {Object.entries(selectedAgent.data.stats).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-600">{key}:</span>
                            <span className="font-semibold">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAgent.data.agentCard && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Capabilities</p>
                      <div className="bg-blue-50 rounded-md p-3">
                        {selectedAgent.data.agentCard.capabilities && (
                          <div className="flex flex-wrap gap-2">
                            {selectedAgent.data.agentCard.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedAgent.data.contracts && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Connected Contracts</p>
                      <div className="bg-gray-50 rounded-md p-3 space-y-1">
                        {Object.entries(selectedAgent.data.contracts).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-600">{key}:</span>
                            <p className="font-mono text-gray-800 break-all">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedAgent.status === 'offline' && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-800">
                    <strong>Error:</strong> {selectedAgent.error}
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    Make sure the agent is running: <code>npm run agent:{selectedAgent.name.toLowerCase().replace('agent', '')}</code>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setSelectedAgent(null)}
                className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentMonitor;

