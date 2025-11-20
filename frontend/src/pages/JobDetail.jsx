import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function JobDetail({ account }) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const jobResponse = await axios.get('/api/client/jobs');
      const foundJob = jobResponse.data.jobs.find((j) => j.jobId === jobId);
      setJob(foundJob);

      const offersResponse = await axios.get(`/api/client/offers/${jobId}`);
      setOffers(offersResponse.data.offers || []);
    } catch (error) {
      console.error('Error fetching job details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offer) => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const response = await axios.post('/api/client/accept-offer', {
        jobId: job.jobId,
        offerId: offer.offerId,
        workerAddress: offer.workerAddress,
      });

      if (response.data.ok) {
        alert('Offer accepted! Escrow created and funded.');
        fetchJobDetails();
      }
    } catch (error) {
      console.error('Error accepting offer:', error);
      alert('Failed to accept offer');
    }
  };

  const handleApproveWork = async () => {
    if (!job.escrowId) {
      alert('No escrow found');
      return;
    }

    try {
      const response = await axios.post('/api/client/approve-work', {
        escrowId: job.escrowId,
      });

      if (response.data.ok) {
        alert('Work approved! Payment released to worker.');
        fetchJobDetails();
      }
    } catch (error) {
      console.error('Error approving work:', error);
      alert('Failed to approve work');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <p className="mt-4 text-white/60">Loading job details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-16">
          <div className="text-6xl mb-6">📭</div>
          <h3 className="text-2xl font-bold mb-3 text-white">Job Not Found</h3>
          <button onClick={() => navigate('/marketplace')} className="btn-primary mt-6">
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-green-500/20 text-green-400 border border-green-500/30',
      assigned: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      completed: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    };
    return styles[status] || 'bg-white/5 text-white/60 border border-white/10';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button
        onClick={() => navigate('/marketplace')}
        className="text-white/70 hover:text-white transition-colors flex items-center gap-2"
      >
        <span>←</span> Back to Marketplace
      </button>

      {/* Job Details */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white flex-1 mr-4">{job.title}</h1>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusBadge(job.status)}`}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        </div>

        <p className="text-white/80 text-lg mb-8 leading-relaxed">{job.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-white/5 rounded-xl border border-white/10 mb-6">
          <div>
            <div className="text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Budget</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {parseFloat(job.budgetHBAR) / 1e18} HBAR
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Posted</div>
            <div className="text-lg font-semibold text-white">
              {new Date(job.createdAt).toLocaleDateString()}
            </div>
          </div>

          {job.deadline && (
            <div>
              <div className="text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Deadline</div>
              <div className="text-lg font-semibold text-white">{job.deadline}</div>
            </div>
          )}
        </div>

        {job.requiredSkills && job.requiredSkills.length > 0 && (
          <div className="mb-6">
            <div className="text-sm font-semibold text-white/80 mb-3 uppercase tracking-wider">Required Skills</div>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 bg-white/5 text-white/90 rounded-lg text-sm font-medium border border-white/10"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.escrowId && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">Escrow ID</div>
            <div className="text-xs text-white/70 font-mono break-all">{job.escrowId}</div>
          </div>
        )}
      </div>

      {/* Offers Section */}
      <div className="card">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">
          Offers ({offers.length})
        </h2>

        {offers.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            <div className="text-5xl mb-4">📬</div>
            <p className="text-lg">No offers yet. WorkerAgents will submit offers automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <div
                key={offer.offerId}
                className="card bg-white/5 border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold text-white mb-2">Agent: {offer.fromDid}</div>
                    <div className="text-sm text-white/70 space-y-1">
                      <div>Price: <span className="font-semibold text-white">{parseFloat(offer.priceHBAR) / 1e18} HBAR</span></div>
                      <div>ETA: <span className="font-semibold text-white">{offer.eta}</span></div>
                    </div>
                  </div>
                  
                  {job.status === 'open' && (
                    <button
                      onClick={() => handleAcceptOffer(offer)}
                      className="btn-primary whitespace-nowrap"
                    >
                      Accept Offer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {job.status === 'assigned' && (
        <div className="card bg-green-500/10 border-green-500/30">
          <h3 className="font-bold text-white mb-3 text-lg">Job In Progress</h3>
          <p className="text-sm text-white/80 mb-6 leading-relaxed">
            Work is being completed. You'll be notified when it's ready for review.
          </p>
          <button onClick={handleApproveWork} className="btn-primary">
            Approve & Release Payment
          </button>
        </div>
      )}
    </div>
  );
}

export default JobDetail;
