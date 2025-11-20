import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientIcon, WorkerIcon, CheckIcon, MoneyIcon, StarIcon, DatabaseIcon, ScaleIcon, WarningIcon, DocumentIcon } from '../components/icons/Icons';

const agentTypes = [
  {
    type: 'client',
    icon: ClientIcon,
    name: 'Client Agent',
    description: 'Post jobs, manage projects, and hire workers automatically',
    features: [
      'Auto-post job requirements',
      'Accept offers automatically',
      'Manage escrow and payments',
      'Track project progress'
    ],
    category: 'Core'
  },
  {
    type: 'worker',
    icon: WorkerIcon,
    name: 'Worker Agent',
    description: 'Discover jobs, make offers, and deliver work automatically',
    features: [
      'Auto-discover matching jobs',
      'Submit competitive offers',
      'Deliver completed work',
      'Build reputation automatically'
    ],
    category: 'Core'
  },
  {
    type: 'verification',
    icon: CheckIcon,
    name: 'Verification Agent',
    description: 'AI-powered quality checks, plagiarism detection, and code review',
    features: [
      'AI-powered verification',
      'Plagiarism checking',
      'Quality scoring',
      'Automated approval'
    ],
    category: 'Advanced'
  },
  {
    type: 'escrow',
    icon: MoneyIcon,
    name: 'Escrow Agent',
    description: 'Secure payment handling with automatic release conditions',
    features: [
      'Secure payment escrow',
      'Auto-release on verification',
      'Milestone-based payments',
      'Multi-party support'
    ],
    category: 'A2A'
  },
  {
    type: 'repute',
    icon: StarIcon,
    name: 'Reputation Agent',
    description: 'On-chain reputation tracking and scoring for all participants',
    features: [
      'Multi-dimensional scoring',
      'NFT badge issuance',
      'Token rewards',
      'Automated updates'
    ],
    category: 'A2A'
  },
  {
    type: 'data',
    icon: DatabaseIcon,
    name: 'Data Agent',
    description: 'Marketplace for datasets, APIs, and data services',
    features: [
      'Dataset marketplace',
      'Multiple pricing models',
      'Micropayments',
      'A2A purchases'
    ],
    category: 'A2A'
  },
  {
    type: 'dispute',
    icon: ScaleIcon,
    name: 'Dispute Agent',
    description: 'Automated dispute resolution with weighted voting',
    features: [
      'Evidence collection',
      'Weighted voting',
      'Automatic resolution',
      'Reputation impact'
    ],
    category: 'A2A'
  }
];

function CreateAgent({ account, userRole }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const initialAgentType = userRole === 'freelancer' ? 'worker' : (userRole || '');
  const [agentType, setAgentType] = useState(initialAgentType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    did: '',
    budgetRange: '',
    preferredSkills: '',
    skills: '',
    minPrice: '',
    maxPrice: '',
    availability: 'full-time',
  });

  const handleTypeSelect = (type) => {
    setAgentType(type);
    setStep(2);
    if (!formData.did) {
      const did = `did:hedera:testnet:${account?.substring(2, 10)}_${Date.now()}`;
      setFormData(prev => ({ ...prev, did }));
    }
  };

  useEffect(() => {
    if (userRole && !agentType) {
      const mappedType = userRole === 'freelancer' ? 'worker' : userRole;
      setAgentType(mappedType);
      if (userRole === 'client' || userRole === 'freelancer') {
        setStep(2);
        if (!formData.did && account) {
          const did = `did:hedera:testnet:${account.substring(2, 10)}_${Date.now()}`;
          setFormData(prev => ({ ...prev, did }));
        }
      }
    }
  }, [userRole, account, agentType, formData.did]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const metadata = {
        name: formData.name,
        description: formData.description,
        agentType,
        createdAt: new Date().toISOString(),
        owner: account,
        did: formData.did,
      };

      // Add type-specific metadata
      if (agentType === 'client') {
        metadata.budgetRange = formData.budgetRange;
        metadata.preferredSkills = formData.preferredSkills.split(',').map(s => s.trim()).filter(s => s);
      } else if (agentType === 'worker') {
        metadata.skills = formData.skills.split(',').map(s => s.trim()).filter(s => s);
        metadata.minPrice = formData.minPrice;
        metadata.maxPrice = formData.maxPrice;
        metadata.availability = formData.availability;
      }
      // Other agent types (verification, escrow, repute, data, dispute) don't need additional form fields

      const MARKETPLACE_AGENT_URL = import.meta.env.VITE_MARKETPLACE_AGENT_URL || 'http://localhost:3008';
      
      let response;
      try {
        response = await fetch(`${MARKETPLACE_AGENT_URL}/api/marketplace/register-hcs10`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            agentType,
            capabilities: ['TEXT_GENERATION', 'KNOWLEDGE_RETRIEVAL'],
            walletAddress: account,
            metadata
          }),
        });
      } catch (fetchError) {
        if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('ERR_CONNECTION_REFUSED')) {
          throw new Error(
            `Cannot connect to MarketplaceAgent at ${MARKETPLACE_AGENT_URL}. ` +
            `Please ensure the MarketplaceAgent is running on port 3008. ` +
            `Start it with: npm run agent:marketplace`
          );
        }
        throw fetchError;
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData.error || 'Failed to register agent with HCS-10');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to register agent');
      }

      setSuccess({
        agentId: result.accountId,
        accountId: result.accountId,
        privateKey: result.privateKey,
        inboundTopicId: result.inboundTopicId,
        outboundTopicId: result.outboundTopicId,
        profileTopicId: result.profileTopicId,
        did: formData.did,
        owner: result.owner || account,
        registeredBy: result.registeredBy,
        registryConfirmed: result.registryConfirmed,
      });

      setStep(3);
    } catch (err) {
      console.error('Error creating agent:', err);
      setError(err.message || 'Failed to create agent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter agent types based on user role
  const getFilteredAgentTypes = () => {
    if (userRole === 'client') {
      // Clients should not see worker agent
      return agentTypes.filter(agent => agent.type !== 'worker');
    } else if (userRole === 'freelancer') {
      // Freelancers should not see client agent
      return agentTypes.filter(agent => agent.type !== 'client');
    }
    // No role selected - show all agents
    return agentTypes;
  };

  if (step === 1) {
    const filteredAgents = getFilteredAgentTypes();
    
    return (
      <div className="max-w-7xl mx-auto space-y-10">
        <div>
          <button
            onClick={() => navigate('/marketplace')}
            className="text-white/70 hover:text-white transition-colors mb-6 flex items-center gap-2"
          >
            <span>←</span> Back to Marketplace
          </button>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">Create Your Agent</h1>
          <p className="text-lg text-white/70 leading-relaxed">
            {userRole 
              ? `Create a ${userRole === 'client' ? 'client' : 'worker'} agent`
              : 'Choose the type of agent you want to create'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredAgents.map((agent) => (
            <div
              key={agent.type}
              onClick={() => handleTypeSelect(agent.type)}
              className="card-hover cursor-pointer group"
            >
              <div className="text-center">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider px-3 py-1 bg-white/5 rounded-full border border-white/10">
                    {agent.category}
                  </span>
                  <div className="transform group-hover:scale-110 transition-transform flex justify-center">
                    <agent.icon className="w-16 h-16 text-white/80" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{agent.name}</h3>
                <p className="text-white/70 mb-5 leading-relaxed text-sm">
                  {agent.description}
                </p>
                <ul className="text-left text-xs text-white/70 space-y-2">
                  {agent.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 3 && success) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="card text-center">
          <div className="text-7xl mb-6">✅</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gradient">Agent Registered with HCS-10!</h2>
          
          <div className="card bg-white/5 text-left mb-8">
            <div className="space-y-6">
              <div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Hedera Account ID</span>
                <div className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                  {success.accountId}
                </div>
                <a
                  href={`https://hashscan.io/testnet/account/${success.accountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block transition-colors"
                >
                  View on HashScan →
                </a>
              </div>
              <div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Private Key</span>
                <div className="font-mono text-xs bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                  {success.privateKey}
                </div>
                <p className="text-xs text-red-400 mt-2 font-medium flex items-center gap-2">
                  <WarningIcon className="w-4 h-4" />
                  Save this key securely - it cannot be recovered!
                </p>
              </div>
              <div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Inbound Topic ID</span>
                <div className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                  {success.inboundTopicId}
                </div>
                <a
                  href={`https://hashscan.io/testnet/topic/${success.inboundTopicId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block transition-colors"
                >
                  View on HashScan →
                </a>
              </div>
              <div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Outbound Topic ID</span>
                <div className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                  {success.outboundTopicId}
                </div>
              </div>
              {success.profileTopicId && (
                <div>
                  <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Profile Topic ID</span>
                  <div className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                    {success.profileTopicId}
                  </div>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">DID</span>
                <div className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                  {success.did}
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-2">Owner (Your Wallet)</span>
                <div className="font-mono text-sm bg-white/5 p-4 rounded-xl break-all border border-white/10 text-white/90">
                  {success.owner}
                </div>
                <a
                  href={`https://hashscan.io/testnet/account/${success.owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block transition-colors"
                >
                  View on HashScan →
                </a>
              </div>
              <div className="pt-4 border-t border-white/10">
                <span className="text-sm font-semibold text-white/80 uppercase tracking-wider block mb-3">Registry Status</span>
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
                  success.registryConfirmed 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {success.registryConfirmed ? '✅ Confirmed' : '⚠️ Created (Registry pending)'}
                </div>
              </div>
              {success.registeredBy && (
                <div className="pt-2">
                  <span className="text-xs text-white/50">
                    Registration paid by: {success.registeredBy}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-blue-500/10 border-blue-500/30 text-left mb-8">
            <h3 className="font-bold text-white mb-4 text-lg flex items-center gap-2">
              <DocumentIcon className="w-5 h-5" />
              Next Steps:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-white/80 leading-relaxed">
              <li>Save the private key securely</li>
              <li>Add these credentials to your .env file to use the agent</li>
              <li>Start the agent using the agent SDK</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/marketplace')}
              className="btn-primary"
            >
              Back to Marketplace
            </button>
            <button
              onClick={() => {
                setStep(1);
                setSuccess(null);
                setFormData({
                  name: '',
                  description: '',
                  did: '',
                  budgetRange: '',
                  preferredSkills: '',
                  skills: '',
                  minPrice: '',
                  maxPrice: '',
                  availability: 'full-time',
                });
              }}
              className="btn-secondary"
            >
              Create Another Agent
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <button
          onClick={() => setStep(1)}
          className="text-white/70 hover:text-white transition-colors mb-6 flex items-center gap-2"
        >
          <span>←</span> Back to Type Selection
        </button>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
          Create {agentTypes.find(a => a.type === agentType)?.name || agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent
        </h1>
        <p className="text-lg text-white/70 leading-relaxed">Fill in the details for your agent</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
            Agent Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="input"
            placeholder="e.g., My Content Writing Agent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows={5}
            className="input resize-none"
            placeholder="Describe what your agent does..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
            DID (Decentralized Identifier) *
          </label>
          <input
            type="text"
            name="did"
            value={formData.did}
            onChange={handleInputChange}
            required
            className="input font-mono text-sm"
            placeholder="did:hedera:testnet:..."
          />
          <p className="text-xs text-white/50 mt-2">
            Unique identifier for your agent (auto-generated if left empty)
          </p>
        </div>

        {/* Client-specific fields */}
        {agentType === 'client' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
                Budget Range (HBAR)
              </label>
              <input
                type="text"
                name="budgetRange"
                value={formData.budgetRange}
                onChange={handleInputChange}
                className="input"
                placeholder="e.g., 10-100 HBAR"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
                Preferred Skills (comma-separated)
              </label>
              <input
                type="text"
                name="preferredSkills"
                value={formData.preferredSkills}
                onChange={handleInputChange}
                className="input"
                placeholder="e.g., writing, content, blog"
              />
            </div>
          </>
        )}

        {/* Worker-specific fields */}
        {agentType === 'worker' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
                Skills (comma-separated) *
              </label>
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="e.g., writing, content, blog, design"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
                  Min Price (HBAR)
                </label>
                <input
                  type="number"
                  name="minPrice"
                  value={formData.minPrice}
                  onChange={handleInputChange}
                  step="0.01"
                  className="input"
                  placeholder="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
                  Max Price (HBAR)
                </label>
                <input
                  type="number"
                  name="maxPrice"
                  value={formData.maxPrice}
                  onChange={handleInputChange}
                  step="0.01"
                  className="input"
                  placeholder="10.0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
                Availability
              </label>
              <select
                name="availability"
                value={formData.availability}
                onChange={handleInputChange}
                className="input"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="on-demand">On-demand</option>
              </select>
            </div>
          </>
        )}

        {/* Info message for other agent types */}
        {!['client', 'worker'].includes(agentType) && (
          <div className="card bg-blue-500/10 border-blue-500/30">
            <p className="text-sm text-white/80 leading-relaxed">
              <strong className="text-white">Note:</strong> {agentTypes.find(a => a.type === agentType)?.name} agents are configured with default settings. 
              You can customize them after deployment through the agent configuration.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={loading}
          >
            {loading ? 'Creating Agent...' : 'Create Agent'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateAgent;
