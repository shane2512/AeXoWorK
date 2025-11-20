import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

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
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-hedera-purple"></div>
          <p className="mt-4 text-gray-600">Loading agent details...</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-xl font-bold mb-2">Agent Not Found</h3>
          <p className="text-gray-600 mb-6">{error || 'The agent you are looking for does not exist.'}</p>
          <Link to="/marketplace" className="btn-primary inline-block">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/marketplace')}
          className="text-hedera-purple hover:underline mb-4"
        >
          ← Back to Marketplace
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{agent.name || 'Unnamed Agent'}</h1>
            <p className="text-gray-600 mt-1">Agent Details</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            agent.agentType === 'client' 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {agent.agentType === 'client' ? '👔 Client Agent' : '👷 Worker Agent'}
          </span>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Description</label>
            <p className="mt-1 text-gray-900">{agent.description || 'No description provided'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Agent ID</label>
              <p className="mt-1 font-mono text-sm bg-gray-50 p-2 rounded break-all">{agent.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className="mt-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  agent.status === 0 ? 'bg-gray-100 text-gray-800' :
                  agent.status === 1 ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {agent.status === 0 ? 'Active' : agent.status === 1 ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">DID (Decentralized Identifier)</label>
            <p className="mt-1 font-mono text-sm bg-gray-50 p-2 rounded break-all">{agent.did}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Owner Address</label>
            <p className="mt-1 font-mono text-sm bg-gray-50 p-2 rounded break-all">
              {agent.owner}
              {account && account.toLowerCase() === agent.owner?.toLowerCase() && (
                <span className="ml-2 text-xs text-green-600">(You)</span>
              )}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Metadata CID (IPFS)</label>
            <p className="mt-1 font-mono text-sm bg-gray-50 p-2 rounded break-all">
              {agent.metadataCID}
              {agent.metadataCID && !agent.metadataCID.startsWith('fallback_') && (
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${agent.metadataCID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-hedera-blue hover:underline text-xs"
                >
                  View on IPFS →
                </a>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Client-Specific Information */}
      {agent.agentType === 'client' && (agent.budgetRange || agent.preferredSkills) && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Client Preferences</h2>
          <div className="space-y-4">
            {agent.budgetRange && (
              <div>
                <label className="text-sm font-medium text-gray-500">Budget Range</label>
                <p className="mt-1 text-gray-900">{agent.budgetRange} HBAR</p>
              </div>
            )}
            {agent.preferredSkills && agent.preferredSkills.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-500">Preferred Skills</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {agent.preferredSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
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
          <h2 className="text-xl font-bold mb-4">Worker Capabilities</h2>
          <div className="space-y-4">
            {agent.skills && agent.skills.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-500">Skills</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {agent.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(agent.minPrice || agent.maxPrice) && (
              <div className="grid grid-cols-2 gap-4">
                {agent.minPrice && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Min Price</label>
                    <p className="mt-1 text-gray-900">{agent.minPrice} HBAR</p>
                  </div>
                )}
                {agent.maxPrice && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Max Price</label>
                    <p className="mt-1 text-gray-900">{agent.maxPrice} HBAR</p>
                  </div>
                )}
              </div>
            )}
            {agent.availability && (
              <div>
                <label className="text-sm font-medium text-gray-500">Availability</label>
                <p className="mt-1 text-gray-900 capitalize">{agent.availability}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Additional Metadata */}
      {agent.createdAt && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Registration Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Created At:</span>
              <span className="text-gray-900">
                {new Date(agent.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-4">
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




