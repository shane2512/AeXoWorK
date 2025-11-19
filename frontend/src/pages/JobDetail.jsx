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
      // Fetch job details
      const jobResponse = await axios.get('/api/client/jobs');
      const foundJob = jobResponse.data.jobs.find((j) => j.jobId === jobId);
      setJob(foundJob);

      // Fetch offers
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
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-hedera-purple"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-xl font-bold mb-2">Job Not Found</h3>
        <button onClick={() => navigate('/marketplace')} className="btn-primary mt-4">
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/marketplace')}
        className="text-gray-600 hover:text-gray-900 flex items-center"
      >
        ← Back to Marketplace
      </button>

      {/* Job Details */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-3xl font-bold">{job.title}</h1>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              job.status === 'open'
                ? 'bg-green-100 text-green-800'
                : job.status === 'assigned'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        </div>

        <p className="text-gray-700 mb-6">{job.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-500">Budget</div>
            <div className="text-xl font-bold text-hedera-blue">
              {parseFloat(job.budgetHBAR) / 1e18} HBAR
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Posted</div>
            <div className="text-lg font-medium">
              {new Date(job.createdAt).toLocaleDateString()}
            </div>
          </div>

          {job.deadline && (
            <div>
              <div className="text-sm text-gray-500">Deadline</div>
              <div className="text-lg font-medium">{job.deadline}</div>
            </div>
          )}
        </div>

        {job.requiredSkills && job.requiredSkills.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-2">Required Skills</div>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-hedera-purple/10 text-hedera-purple rounded-lg text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.escrowId && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm font-medium text-blue-900">Escrow ID</div>
            <div className="text-xs text-blue-700 mt-1 font-mono">{job.escrowId}</div>
          </div>
        )}
      </div>

      {/* Offers Section */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">
          Offers ({offers.length})
        </h2>

        {offers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No offers yet. WorkerAgents will submit offers automatically.
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <div
                key={offer.offerId}
                className="border border-gray-200 rounded-lg p-4 hover:border-hedera-purple transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Agent: {offer.fromDid}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Price: {parseFloat(offer.priceHBAR) / 1e18} HBAR • ETA: {offer.eta}
                    </div>
                  </div>
                  
                  {job.status === 'open' && (
                    <button
                      onClick={() => handleAcceptOffer(offer)}
                      className="btn-primary"
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
        <div className="card bg-green-50 border border-green-200">
          <h3 className="font-bold text-green-900 mb-2">Job In Progress</h3>
          <p className="text-sm text-green-800 mb-4">
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

