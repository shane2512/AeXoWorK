import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PlugIcon, DocumentIcon } from './icons/Icons';

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

  const getStatusBadge = (status) => {
    const styles = {
      'pending': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      'in_progress': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      'delivered': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      'completed': 'bg-green-500/20 text-green-400 border border-green-500/30',
      'disputed': 'bg-red-500/20 text-red-400 border border-red-500/30',
      'open': 'bg-green-500/20 text-green-400 border border-green-500/30',
      'assigned': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    };
    return styles[status] || 'bg-white/5 text-white/60 border border-white/10';
  };

  const filteredJobs = filter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  if (!wallet) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card bg-yellow-500/10 border-yellow-500/30 text-center py-16">
          <div className="mb-6 flex justify-center">
            <PlugIcon className="w-20 h-20 text-white/60" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Wallet Not Connected
          </h2>
          <p className="text-white/70 text-lg">
            Please connect your wallet to track your jobs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
          <span className="flex items-center gap-2">
            <DocumentIcon className="w-6 h-6" />
            {userRole === 'client' ? 'My Posted Jobs' : 'My Work'}
          </span>
        </h1>
        <p className="text-lg text-white/70 leading-relaxed">
          {userRole === 'client' 
            ? 'Track and manage all your posted jobs'
            : 'Monitor your active and completed work'}
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-white/90 uppercase tracking-wider">Filter:</span>
          {['all', 'open', 'pending', 'in_progress', 'assigned', 'delivered', 'completed', 'disputed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === f
                  ? 'bg-white text-black shadow-lg'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4 text-white/60">Loading jobs...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-6xl mb-6">📭</div>
          <h3 className="text-2xl font-bold mb-3 text-white">No Jobs Found</h3>
          <p className="text-white/70 mb-8">
            {filter === 'all'
              ? 'No jobs yet. Get started by posting a job or accepting work!'
              : `No ${filter} jobs at the moment.`}
          </p>
          {userRole === 'client' && (
            <Link to="/post-job" className="btn-primary inline-block">
              Post Your First Job
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredJobs.map((job) => (
            <Link
              key={job.jobId || job.workId}
              to={`/job/${job.jobId || job.workId}`}
              className="card-hover block"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{job.title}</h3>
                  <p className="text-white/70 line-clamp-2 leading-relaxed">{job.description}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-xs font-semibold ml-4 ${getStatusBadge(job.status)}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                {job.budgetHBAR && (
                  <div>
                    <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Budget</div>
                    <div className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      {parseFloat(job.budgetHBAR) / 1e18} HBAR
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Posted</div>
                  <div className="text-sm font-semibold text-white/90">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {job.deadline && (
                  <div>
                    <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Deadline</div>
                    <div className="text-sm font-semibold text-white/90">{job.deadline}</div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobTracker;
