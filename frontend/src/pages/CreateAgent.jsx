import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { registerAgentOnChain, uploadMetadataToIPFS } from '../utils/agentRegistry';
import { ensureHederaTestnet } from '../utils/hederaNetwork';

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

      // Upload metadata to IPFS
      const metadataCID = await uploadMetadataToIPFS(metadata);

      // Ensure wallet is on Hedera Testnet before registering
      const provider = await ensureHederaTestnet();
      const signer = provider.getSigner();
      
      const agentTypeCode = agentType === 'client' ? 0 : 1;
      const result = await registerAgentOnChain(
        provider,
        signer,
        formData.did,
        metadataCID,
        agentTypeCode
      );

      setSuccess({
        agentId: result.agentId,
        txHash: result.txHash,
        did: formData.did,
        metadataCID,
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
          <h2 className="text-2xl font-bold mb-4">Agent Created Successfully!</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">Agent ID:</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.agentId}
                </div>
              </div>
              <div>
                <span className="text-gray-600">DID:</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.did}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Metadata CID:</span>
                <div className="font-mono text-sm bg-white p-2 rounded mt-1 break-all">
                  {success.metadataCID}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Transaction Hash:</span>
                <a
                  href={`https://hashscan.io/testnet/transaction/${success.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-hedera-blue hover:underline block mt-1 break-all"
                >
                  {success.txHash}
                </a>
              </div>
            </div>
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

