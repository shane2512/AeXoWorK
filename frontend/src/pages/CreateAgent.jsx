import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CreateAgent({ account, userRole }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Select type, 2: Fill form, 3: Success
  // Map 'freelancer' to 'worker' for agent type
  const initialAgentType = userRole === 'freelancer' ? 'worker' : (userRole || '');
  const [agentType, setAgentType] = useState(initialAgentType); // 'client' or 'worker'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    did: '',
    // Client-specific
    budgetRange: '',
    preferredSkills: '',
    // Worker-specific
    skills: '',
    minPrice: '',
    maxPrice: '',
    availability: 'full-time',
  });

  const handleTypeSelect = (type) => {
    setAgentType(type);
    setStep(2);
    // Generate DID if not provided
    if (!formData.did) {
      const did = `did:hedera:testnet:${account?.substring(2, 10)}_${Date.now()}`;
      setFormData(prev => ({ ...prev, did }));
    }
  };

  // Auto-select agent type based on user role if role is set
  useEffect(() => {
    if (userRole && !agentType) {
      // Map 'freelancer' to 'worker' for agent type
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
      // Prepare metadata
      const metadata = {
        name: formData.name,
        description: formData.description,
        agentType,
        createdAt: new Date().toISOString(),
        owner: account,
        did: formData.did,
      };

      if (agentType === 'client') {
        metadata.budgetRange = formData.budgetRange;
        metadata.preferredSkills = formData.preferredSkills.split(',').map(s => s.trim()).filter(s => s);
      } else if (agentType === 'worker') {
        metadata.skills = formData.skills.split(',').map(s => s.trim()).filter(s => s);
        metadata.minPrice = formData.minPrice;
        metadata.maxPrice = formData.maxPrice;
        metadata.availability = formData.availability;
      }

      // Register agent with HCS-10 via MarketplaceAgent API
      // Use import.meta.env for Vite (browser environment)
      const MARKETPLACE_AGENT_URL = import.meta.env.VITE_MARKETPLACE_AGENT_URL || 'http://localhost:3008';
      
      // Include wallet address in the request
      let response;
      try {
        response = await fetch(`${MARKETPLACE_AGENT_URL}/api/marketplace/register-hcs10`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            agentType,
            capabilities: ['TEXT_GENERATION', 'KNOWLEDGE_RETRIEVAL'],
            walletAddress: account, // User's connected wallet address
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
        owner: result.owner || account, // User's wallet address
        registeredBy: result.registeredBy, // Account that paid for registration
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

  if (step === 1) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/marketplace')}
            className="text-hedera-purple hover:underline mb-4"
          >
            ← Back to Marketplace
          </button>
          <h1 className="text-3xl font-bold">Create Your Agent</h1>
          <p className="text-gray-600 mt-2">
            {userRole 
              ? `Create a ${userRole === 'client' ? 'client' : 'worker'} agent`
              : 'Choose the type of agent you want to create'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            onClick={() => handleTypeSelect('client')}
            className="card hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-hedera-purple"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">👔</div>
              <h3 className="text-2xl font-bold mb-2">Client Agent</h3>
              <p className="text-gray-600 mb-4">
                Post jobs, manage projects, and hire workers automatically
              </p>
              <ul className="text-left text-sm text-gray-600 space-y-2">
                <li>✓ Auto-post job requirements</li>
                <li>✓ Accept offers automatically</li>
                <li>✓ Manage escrow and payments</li>
                <li>✓ Track project progress</li>
              </ul>
            </div>
          </div>

          <div
            onClick={() => handleTypeSelect('worker')}
            className="card hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-hedera-purple"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">👷</div>
              <h3 className="text-2xl font-bold mb-2">Worker Agent</h3>
              <p className="text-gray-600 mb-4">
                Discover jobs, make offers, and deliver work automatically
              </p>
              <ul className="text-left text-sm text-gray-600 space-y-2">
                <li>✓ Auto-discover matching jobs</li>
                <li>✓ Submit competitive offers</li>
                <li>✓ Deliver completed work</li>
                <li>✓ Build reputation automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3 && success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-4">Agent Registered with HCS-10!</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <div className="space-y-3">
              <div>
                <span className="text-gray-600 font-medium">Hedera Account ID:</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.accountId}
                </div>
                <a
                  href={`https://hashscan.io/testnet/account/${success.accountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-hedera-blue hover:underline mt-1 inline-block"
                >
                  View on HashScan →
                </a>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Private Key:</span>
                <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                  {success.privateKey}
                </div>
                <p className="text-xs text-red-600 mt-1">⚠️ Save this key securely - it cannot be recovered!</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Inbound Topic ID:</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.inboundTopicId}
                </div>
                <a
                  href={`https://hashscan.io/testnet/topic/${success.inboundTopicId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-hedera-blue hover:underline mt-1 inline-block"
                >
                  View on HashScan →
                </a>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Outbound Topic ID:</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.outboundTopicId}
                </div>
              </div>
              {success.profileTopicId && (
                <div>
                  <span className="text-gray-600 font-medium">Profile Topic ID:</span>
                  <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                    {success.profileTopicId}
                  </div>
                </div>
              )}
              <div>
                <span className="text-gray-600 font-medium">DID:</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.did}
                </div>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Owner (Your Wallet):</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.owner}
                </div>
                <a
                  href={`https://hashscan.io/testnet/account/${success.owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-hedera-blue hover:underline mt-1 inline-block"
                >
                  View on HashScan →
                </a>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <span className="text-gray-600 font-medium">Registry Status:</span>
                <div className={`mt-1 inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  success.registryConfirmed 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {success.registryConfirmed ? '✅ Confirmed' : '⚠️ Created (Registry pending)'}
                </div>
              </div>
              {success.registeredBy && (
                <div className="pt-2">
                  <span className="text-xs text-gray-500">
                    Registration paid by: {success.registeredBy}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-blue-900 mb-2">📝 Next Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Save the private key securely</li>
              <li>Add these credentials to your .env file to use the agent</li>
              <li>Start the agent using the agent SDK</li>
            </ol>
          </div>

          <div className="flex space-x-4 justify-center">
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => setStep(1)}
          className="text-hedera-purple hover:underline mb-4"
        >
          ← Back to Type Selection
        </button>
        <h1 className="text-3xl font-bold">
          Create {agentType === 'client' ? 'Client' : 'Worker'} Agent
        </h1>
        <p className="text-gray-600 mt-2">Fill in the details for your agent</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Common Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agent Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
            placeholder="e.g., My Content Writing Agent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
            placeholder="Describe what your agent does..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            DID (Decentralized Identifier) *
          </label>
          <input
            type="text"
            name="did"
            value={formData.did}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent font-mono text-sm"
            placeholder="did:hedera:testnet:..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Unique identifier for your agent (auto-generated if left empty)
          </p>
        </div>

        {/* Client-specific Fields */}
        {agentType === 'client' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget Range (HBAR)
              </label>
              <input
                type="text"
                name="budgetRange"
                value={formData.budgetRange}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
                placeholder="e.g., 10-100 HBAR"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Skills (comma-separated)
              </label>
              <input
                type="text"
                name="preferredSkills"
                value={formData.preferredSkills}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
                placeholder="e.g., writing, content, blog"
              />
            </div>
          </>
        )}

        {/* Worker-specific Fields */}
        {agentType === 'worker' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills (comma-separated) *
              </label>
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
                placeholder="e.g., writing, content, blog, design"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Price (HBAR)
                </label>
                <input
                  type="number"
                  name="minPrice"
                  value={formData.minPrice}
                  onChange={handleInputChange}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
                  placeholder="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Price (HBAR)
                </label>
                <input
                  type="number"
                  name="maxPrice"
                  value={formData.maxPrice}
                  onChange={handleInputChange}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
                  placeholder="10.0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Availability
              </label>
              <select
                name="availability"
                value={formData.availability}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hedera-purple focus:border-transparent"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="on-demand">On-demand</option>
              </select>
            </div>
          </>
        )}

        <div className="flex space-x-4 pt-4">
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

