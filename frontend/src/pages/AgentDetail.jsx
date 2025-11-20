import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ClientIcon, WorkerIcon } from '../components/icons/Icons';

function AgentDetail({ account }) {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAgentDetails();
  }, [agentId]);

  const fetchAgentDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/agents/${agentId}`);
      if (response.data.success) {
        setAgent(response.data.agent);
      } else {
        setError('Agent not found');
      }
    } catch (err) {
      console.error('Error fetching agent details:', err);
      setError(err.response?.data?.error || 'Failed to load agent details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <p className="mt-4 text-white/60">Loading agent details...</p>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-16">
          <div className="text-6xl mb-6">❌</div>
          <h3 className="text-2xl font-bold mb-3 text-white">Agent Not Found</h3>
          <p className="text-white/70 mb-8">{error || 'The agent you are looking for does not exist.'}</p>
          <Link to="/marketplace" className="btn-primary inline-block">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button
        onClick={() => navigate('/marketplace')}
        className="text-white/70 hover:text-white transition-colors flex items-center gap-2"
      >
        <span>←</span> Back to Marketplace
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">{agent.name || 'Unnamed Agent'}</h1>
          <p className="text-lg text-white/70">Agent Details</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
          agent.agentType === 'client' 
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
            : 'bg-green-500/20 text-green-400 border border-green-500/30'
        }`}>
          <span className="flex items-center gap-2">
            {agent.agentType === 'client' ? (
              <>
                <ClientIcon className="w-5 h-5" />
                Client Agent
              </>
            ) : (
              <>
                <WorkerIcon className="w-5 h-5" />
                Worker Agent
              </>
            )}
          </span>
        </span>
      </div>

      {/* Main Info Card */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-6 text-white">Basic Information</h2>
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Description</label>
            <p className="text-white/90 text-base leading-relaxed">{agent.description || 'No description provided'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Agent ID</label>
              <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">{agent.id}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Status</label>
              <p className="mt-1">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  agent.status === 0 || agent.status === 1
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {agent.status === 0 || agent.status === 1 ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Account ID</label>
              <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">{agent.accountId || agent.id}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Endpoint</label>
              <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">{agent.endpoint || 'N/A'}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">DID (Decentralized Identifier)</label>
            <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">{agent.did}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Owner Address</label>
            <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
              {agent.owner}
              {account && account.toLowerCase() === agent.owner?.toLowerCase() && (
                <span className="ml-3 text-xs text-green-400 font-semibold">(You)</span>
              )}
            </p>
          </div>

          {agent.metadataCID && (
            <div>
              <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Metadata CID (IPFS)</label>
              <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                {agent.metadataCID}
                {agent.metadataCID && !agent.metadataCID.startsWith('fallback_') && (
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${agent.metadataCID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View on IPFS →
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Client-Specific Information */}
      {agent.agentType === 'client' && (agent.budgetRange || agent.preferredSkills) && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 text-white">Client Preferences</h2>
          <div className="space-y-6">
            {agent.budgetRange && (
              <div>
                <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Budget Range</label>
                <p className="text-white/90 text-lg font-semibold">{agent.budgetRange} HBAR</p>
              </div>
            )}
            {agent.preferredSkills && agent.preferredSkills.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-3">Preferred Skills</label>
                <div className="flex flex-wrap gap-2">
                  {agent.preferredSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium border border-blue-500/30"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Worker-Specific Information */}
      {agent.agentType === 'worker' && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 text-white">Worker Capabilities</h2>
          <div className="space-y-6">
            {agent.skills && agent.skills.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-3">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {agent.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium border border-green-500/30"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(agent.minPrice || agent.maxPrice) && (
              <div className="grid grid-cols-2 gap-6">
                {agent.minPrice && (
                  <div>
                    <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Min Price</label>
                    <p className="text-white/90 text-lg font-semibold">{agent.minPrice} HBAR</p>
                  </div>
                )}
                {agent.maxPrice && (
                  <div>
                    <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Max Price</label>
                    <p className="text-white/90 text-lg font-semibold">{agent.maxPrice} HBAR</p>
                  </div>
                )}
              </div>
            )}
            {agent.availability && (
              <div>
                <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Availability</label>
                <p className="text-white/90 text-lg font-semibold capitalize">{agent.availability}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HCS Topic Information */}
      {(agent.inboundTopicId || agent.outboundTopicId || agent.profileTopicId) && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-6 text-white">HCS Topics</h2>
          <div className="space-y-4">
            {agent.inboundTopicId && (
              <div>
                <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Inbound Topic ID</label>
                <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">{agent.inboundTopicId}</p>
              </div>
            )}
            {agent.outboundTopicId && (
              <div>
                <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Outbound Topic ID</label>
                <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">{agent.outboundTopicId}</p>
              </div>
            )}
            {agent.profileTopicId && (
              <div>
                <label className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Profile Topic ID</label>
                <p className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">{agent.profileTopicId}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Additional Metadata */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-6 text-white">Registration Info</h2>
        <div className="space-y-3">
          {agent.createdAt && (
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">Created At:</span>
              <span className="text-white/90 font-medium">
                {new Date(agent.createdAt).toLocaleString()}
              </span>
            </div>
          )}
          {agent.startedAt && (
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">Started At:</span>
              <span className="text-white/90 font-medium">
                {new Date(agent.startedAt).toLocaleString()}
              </span>
            </div>
          )}
          {agent.stoppedAt && (
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">Stopped At:</span>
              <span className="text-white/90 font-medium">
                {new Date(agent.stoppedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/marketplace" className="btn-secondary">
          Back to Marketplace
        </Link>
        {account && account.toLowerCase() === agent.owner?.toLowerCase() && (
          <button className="btn-primary" disabled>
            Edit Agent (Coming Soon)
          </button>
        )}
      </div>
    </div>
  );
}

export default AgentDetail;
