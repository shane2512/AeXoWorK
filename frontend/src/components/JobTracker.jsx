import React, { useState, useEffect } from 'react';
import axios from 'axios';

const JobTracker = ({ wallet, userRole }) => {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const CLIENT_AGENT_URL = 'http://localhost:3001';
  const WORKER_AGENT_URL = 'http://localhost:3002';

  useEffect(() => {
    if (wallet && userRole) {
      fetchJobs();
    }
  }, [wallet, filter, userRole]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      
      if (userRole === 'client') {
        // Fetch only client's posted jobs
        try {
          const clientResponse = await axios.get(`${CLIENT_AGENT_URL}/jobs`);
          const clientJobs = (clientResponse.data.jobs || []).map(job => ({
            ...job,
            userRole: 'client'
          }));
          setJobs(clientJobs);
        } catch (error) {
          console.log('ClientAgent not available');
          setJobs([]);
        }
      } else if (userRole === 'freelancer') {
        // Fetch only freelancer's accepted work
        try {
          const workerResponse = await axios.get(`${WORKER_AGENT_URL}/work`);
          const workerJobs = (workerResponse.data.work || []).map(job => ({
            ...job,
            userRole: 'worker'
          }));
          setJobs(workerJobs);
        } catch (error) {
          console.log('WorkerAgent not available');
          setJobs([]);
        }
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'delivered': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800',
      'disputed': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRoleBadge = (role) => {
    return role === 'client' 
      ? <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">👤 Client</span>
      : <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">🔧 Worker</span>;
  };

  const filteredJobs = filter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  if (!wallet) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-yellow-900 mb-2">
            🔌 Wallet Not Connected
          </h2>
          <p className="text-yellow-700">
            Please connect your wallet to track your jobs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📋 {userRole === 'client' ? 'My Posted Jobs' : 'My Work'}
        </h1>
        <p className="text-gray-600">
          {userRole === 'client' 
            ? 'Track all the jobs you have posted'
            : 'Track all the work you are doing'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm mb-1">Total Jobs</p>
          <p className="text-3xl font-bold text-gray-900">{jobs.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-600">
            {jobs.filter(j => j.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <p className="text-gray-500 text-sm mb-1">In Progress</p>
          <p className="text-3xl font-bold text-yellow-600">
            {jobs.filter(j => j.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm mb-1">Pending</p>
          <p className="text-3xl font-bold text-purple-600">
            {jobs.filter(j => j.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Filters - Role Specific */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {userRole === 'client' ? (
            <>
              <button
                onClick={() => setFilter('open')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  filter === 'open' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setFilter('assigned')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  filter === 'assigned' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Assigned
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setFilter('in_progress')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  filter === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilter('delivered')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  filter === 'delivered' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Delivered
              </button>
            </>
          )}
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading jobs...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">No jobs found</p>
          <p className="text-gray-500 mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {job.title || job.description || 'Untitled Job'}
                    </h3>
                    {getRoleBadge(job.userRole)}
                  </div>
                  <p className="text-gray-600">
                    {job.description || 'No description provided'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ml-4 ${getStatusColor(job.status)}`}>
                  {(job.status || 'pending').toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {job.budget && (
                  <div>
                    <p className="text-gray-500">Budget</p>
                    <p className="font-semibold text-lg">{job.budget} HBAR</p>
                  </div>
                )}
                
                {job.worker && (
                  <div>
                    <p className="text-gray-500">Worker</p>
                    <p className="font-mono text-xs truncate">{job.worker}</p>
                  </div>
                )}

                {job.deadline && (
                  <div>
                    <p className="text-gray-500">Deadline</p>
                    <p className="font-semibold">
                      {new Date(job.deadline).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {job.createdAt && (
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-semibold">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {job.escrowId && (
                  <div>
                    <p className="text-gray-500">Escrow ID</p>
                    <p className="font-mono text-xs">{job.escrowId}</p>
                  </div>
                )}
              </div>

              {/* Progress Timeline */}
              {job.status && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className={job.status === 'pending' ? 'text-blue-600 font-semibold' : ''}>
                      Posted
                    </span>
                    <div className="flex-1 h-1 mx-2 bg-gray-200 rounded">
                      <div 
                        className="h-1 bg-blue-600 rounded transition-all"
                        style={{ 
                          width: job.status === 'pending' ? '25%' : 
                                 job.status === 'in_progress' ? '50%' : 
                                 job.status === 'delivered' ? '75%' : 
                                 job.status === 'completed' ? '100%' : '0%'
                        }}
                      />
                    </div>
                    <span className={job.status === 'in_progress' ? 'text-blue-600 font-semibold' : ''}>
                      In Progress
                    </span>
                    <div className="flex-1 h-1 mx-2 bg-gray-200 rounded">
                      <div 
                        className="h-1 bg-blue-600 rounded transition-all"
                        style={{ 
                          width: job.status === 'delivered' ? '75%' : 
                                 job.status === 'completed' ? '100%' : '0%'
                        }}
                      />
                    </div>
                    <span className={job.status === 'delivered' ? 'text-blue-600 font-semibold' : ''}>
                      Delivered
                    </span>
                    <div className="flex-1 h-1 mx-2 bg-gray-200 rounded">
                      <div 
                        className="h-1 bg-blue-600 rounded transition-all"
                        style={{ width: job.status === 'completed' ? '100%' : '0%' }}
                      />
                    </div>
                    <span className={job.status === 'completed' ? 'text-green-600 font-semibold' : ''}>
                      Completed
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobTracker;

