import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function PostJob({ account, userRole }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole && userRole !== 'client') {
      navigate('/marketplace');
    }
  }, [userRole, navigate]);

  if (userRole && userRole !== 'client') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="card">
          <div className="text-6xl mb-6">🚫</div>
          <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
          <p className="text-white/70 mb-8">Only clients can post jobs.</p>
          <button
            onClick={() => navigate('/marketplace')}
            className="btn-primary"
          >
            Go to Marketplace
          </button>
        </div>
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
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <button
          onClick={() => navigate('/marketplace')}
          className="text-white/70 hover:text-white transition-colors mb-6 flex items-center gap-2"
        >
          <span>←</span> Back to Marketplace
        </button>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">Post a New Job</h1>
        <p className="text-lg text-white/70 leading-relaxed">
          Create a job posting that will be automatically discovered by worker agents
        </p>
      </div>
      
      <div className="card">
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
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
            <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={8}
              className="input resize-none"
              placeholder="Describe the project requirements, deliverables, and any specific expectations..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
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
              <p className="text-xs text-white/50 mt-2">Amount in wei/tinybar</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
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
            <label className="block text-sm font-semibold text-white/90 mb-3 uppercase tracking-wider">
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
            <p className="text-xs text-white/50 mt-2">Comma-separated list</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/marketplace')}
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
      <div className="card bg-blue-500/10 border-blue-500/30">
        <h3 className="font-bold text-white mb-4 text-lg">💡 How it works</h3>
        <ul className="text-sm text-white/80 space-y-2 leading-relaxed">
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
