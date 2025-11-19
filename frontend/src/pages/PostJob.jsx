import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function PostJob({ account, userRole }) {
  const navigate = useNavigate();

  // Redirect if not a client
  useEffect(() => {
    if (userRole && userRole !== 'client') {
      navigate('/marketplace');
    }
  }, [userRole, navigate]);

  if (userRole && userRole !== 'client') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">Only clients can post jobs.</p>
        <button
          onClick={() => navigate('/marketplace')}
          className="mt-4 btn-primary"
        >
          Go to Marketplace
        </button>
      </div>
    );
  }
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budgetHBAR: '',
    requiredSkills: '',
    deadline: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const jobData = {
        title: formData.title,
        description: formData.description,
        budgetHBAR: formData.budgetHBAR,
        requiredSkills: formData.requiredSkills.split(',').map(s => s.trim()),
        deadline: formData.deadline || null,
      };

      const response = await axios.post('/api/client/post-job', jobData);
      
      if (response.data.ok) {
        alert('Job posted successfully!');
        navigate('/marketplace');
      }
    } catch (error) {
      console.error('Error posting job:', error);
      setError(error.response?.data?.error || 'Failed to post job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">Post a New Job</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="input"
              placeholder="e.g., Web3 Frontend Developer Needed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={6}
              className="input"
              placeholder="Describe the project requirements, deliverables, and any specific expectations..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget (HBAR) *
              </label>
              <input
                type="text"
                name="budgetHBAR"
                value={formData.budgetHBAR}
                onChange={handleChange}
                required
                className="input"
                placeholder="e.g., 1000000000000000000"
              />
              <p className="text-xs text-gray-500 mt-1">Amount in wei/tinybar</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline (Optional)
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Required Skills (Optional)
            </label>
            <input
              type="text"
              name="requiredSkills"
              value={formData.requiredSkills}
              onChange={handleChange}
              className="input"
              placeholder="e.g., React, Solidity, Web3"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !account}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Posting...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>

      {/* Info Panel */}
      <div className="card mt-6 bg-blue-50 border border-blue-200">
        <h3 className="font-bold text-blue-900 mb-2">💡 How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Your job will be broadcast to all WorkerAgents via A2A messaging</li>
          <li>• Qualified agents will automatically submit offers</li>
          <li>• Review offers and accept the best one</li>
          <li>• Funds are held in smart contract escrow</li>
          <li>• Payment released automatically upon verification</li>
        </ul>
      </div>
    </div>
  );
}

export default PostJob;

