import React, { useState, useEffect } from 'react';
import axios from 'axios';

const VerificationDashboard = ({ wallet }) => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [verificationType, setVerificationType] = useState('all');

  const VERIFY_AGENT_URL = 'http://localhost:3003';

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${VERIFY_AGENT_URL}/verifications`);
      setVerifications(response.data.verifications || []);
    } catch (error) {
      console.error('Error fetching verifications:', error);
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (passed) => {
    return passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredVerifications = verificationType === 'all'
    ? verifications
    : verifications.filter(v => {
        if (verificationType === 'passed') return v.passed;
        if (verificationType === 'failed') return !v.passed;
        return true;
      });

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🔍 Verification Dashboard
        </h1>
        <p className="text-gray-600">
          Multi-verification results with AI, plagiarism, quality, and consensus
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm mb-1">Total Verifications</p>
          <p className="text-3xl font-bold text-gray-900">{verifications.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm mb-1">Passed</p>
          <p className="text-3xl font-bold text-green-600">
            {verifications.filter(v => v.passed).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
          <p className="text-gray-500 text-sm mb-1">Failed</p>
          <p className="text-3xl font-bold text-red-600">
            {verifications.filter(v => !v.passed).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm mb-1">Avg Score</p>
          <p className="text-3xl font-bold text-purple-600">
            {verifications.length > 0
              ? Math.round(verifications.reduce((sum, v) => sum + (v.score || 0), 0) / verifications.length)
              : 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setVerificationType('all')}
            className={`px-4 py-2 rounded-md transition-colors ${
              verificationType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setVerificationType('passed')}
            className={`px-4 py-2 rounded-md transition-colors ${
              verificationType === 'passed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ✅ Passed
          </button>
          <button
            onClick={() => setVerificationType('failed')}
            className={`px-4 py-2 rounded-md transition-colors ${
              verificationType === 'failed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ❌ Failed
          </button>
        </div>
      </div>

      {/* Verifications List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading verifications...</p>
        </div>
      ) : filteredVerifications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">No verifications found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVerifications.map((verification) => (
            <div
              key={verification.escrowId}
              onClick={() => setSelectedVerification(verification)}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Escrow #{verification.escrowId}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Verified by {verification.verifier || 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(verification.passed)}`}>
                    {verification.passed ? '✅ PASSED' : '❌ FAILED'}
                  </span>
                  <span className={`text-2xl font-bold ${getScoreColor(verification.score)}`}>
                    {verification.score || 0}
                  </span>
                </div>
              </div>

              {/* Verification Checks */}
              {verification.checks && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {verification.checks.ai && (
                    <div className="bg-blue-50 rounded-md p-3">
                      <p className="text-xs text-gray-500 mb-1">AI Verification</p>
                      <p className="font-semibold text-blue-600">
                        {verification.checks.ai.score}%
                      </p>
                      <p className="text-xs text-gray-600">
                        {verification.checks.ai.passed ? '✅' : '❌'}
                      </p>
                    </div>
                  )}
                  
                  {verification.checks.plagiarism && (
                    <div className="bg-purple-50 rounded-md p-3">
                      <p className="text-xs text-gray-500 mb-1">Plagiarism</p>
                      <p className="font-semibold text-purple-600">
                        {verification.checks.plagiarism.similarity}%
                      </p>
                      <p className="text-xs text-gray-600">
                        {verification.checks.plagiarism.passed ? '✅' : '❌'}
                      </p>
                    </div>
                  )}

                  {verification.checks.quality && (
                    <div className="bg-green-50 rounded-md p-3">
                      <p className="text-xs text-gray-500 mb-1">Quality</p>
                      <p className="font-semibold text-green-600">
                        {verification.checks.quality.score}%
                      </p>
                      <p className="text-xs text-gray-600">
                        {verification.checks.quality.passed ? '✅' : '❌'}
                      </p>
                    </div>
                  )}

                  {verification.checks.deadline && (
                    <div className="bg-orange-50 rounded-md p-3">
                      <p className="text-xs text-gray-500 mb-1">Deadline</p>
                      <p className="font-semibold text-orange-600">
                        {verification.checks.deadline.onTime ? '✅ On Time' : '❌ Late'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                {verification.passedChecks}/{verification.totalChecks} checks passed
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verification Detail Modal */}
      {selectedVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Verification Details</h2>
              <button
                onClick={() => setSelectedVerification(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Overall Result */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm mb-1">Overall Result</p>
                    <p className="text-4xl font-bold">
                      {selectedVerification.passed ? '✅ PASSED' : '❌ FAILED'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-100 text-sm mb-1">Score</p>
                    <p className="text-5xl font-bold">{selectedVerification.score || 0}</p>
                  </div>
                </div>
              </div>

              {/* Verification Checks Breakdown */}
              {selectedVerification.checks && (
                <div>
                  <h3 className="text-lg font-bold mb-3">Verification Checks</h3>
                  <div className="space-y-3">
                    {selectedVerification.checks.ai && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-blue-900">🤖 AI Verification</h4>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(selectedVerification.checks.ai.passed)}`}>
                            {selectedVerification.checks.ai.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          Score: <span className="font-bold">{selectedVerification.checks.ai.score}%</span>
                        </p>
                        {selectedVerification.checks.ai.breakdown && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(selectedVerification.checks.ai.breakdown).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-600">{key}:</span>
                                <span className="font-semibold">{value}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedVerification.checks.plagiarism && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-purple-900">🔍 Plagiarism Check</h4>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(selectedVerification.checks.plagiarism.passed)}`}>
                            {selectedVerification.checks.plagiarism.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          Similarity: <span className="font-bold">{selectedVerification.checks.plagiarism.similarity}%</span>
                          {' '}(Threshold: {selectedVerification.checks.plagiarism.threshold}%)
                        </p>
                      </div>
                    )}

                    {selectedVerification.checks.quality && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-green-900">⭐ Quality Score</h4>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(selectedVerification.checks.quality.passed)}`}>
                            {selectedVerification.checks.quality.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          Overall: <span className="font-bold">{selectedVerification.checks.quality.score}%</span>
                        </p>
                        {selectedVerification.checks.quality.breakdown && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(selectedVerification.checks.quality.breakdown).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-600">{key}:</span>
                                <span className="font-semibold">{value}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedVerification.checks.codeQuality && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-indigo-900">💻 Code Quality</h4>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(selectedVerification.checks.codeQuality.passed)}`}>
                            {selectedVerification.checks.codeQuality.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          Score: <span className="font-bold">{selectedVerification.checks.codeQuality.score}%</span>
                        </p>
                        {selectedVerification.checks.codeQuality.metrics && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(selectedVerification.checks.codeQuality.metrics).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-600">{key}:</span>
                                <span className="font-semibold">{value}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedVerification(null)}
                className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationDashboard;



