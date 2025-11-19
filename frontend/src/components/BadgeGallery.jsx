import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BadgeGallery = ({ wallet }) => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);

  const REPUTE_AGENT_URL = 'http://localhost:3004';

  // Badge type metadata
  const BADGE_METADATA = {
    0: { name: 'First Job Complete', icon: '🎯', color: 'blue', description: 'Completed your first job on ReputeFlow' },
    1: { name: '10 Jobs Milestone', icon: '🔟', color: 'green', description: 'Completed 10 jobs successfully' },
    2: { name: '100 Jobs Milestone', icon: '💯', color: 'purple', description: 'Completed 100 jobs successfully' },
    3: { name: 'Top Rated', icon: '⭐', color: 'yellow', description: 'Achieved 90%+ reputation score' },
    4: { name: 'Specialist', icon: '🎓', color: 'indigo', description: 'Completed 20+ jobs in a specific skill' },
    5: { name: 'Reliable', icon: '🛡️', color: 'cyan', description: '95%+ success rate with 10+ jobs' },
    6: { name: 'Fast Delivery', icon: '⚡', color: 'orange', description: '80% on-time or early delivery' },
    7: { name: 'Data Provider', icon: '📊', color: 'pink', description: 'Listed 10+ datasets on marketplace' },
    8: { name: 'Verifier', icon: '✅', color: 'teal', description: 'Completed 100+ verifications' },
    9: { name: 'Dispute Winner', icon: '⚖️', color: 'red', description: 'Won 5+ disputes' },
    10: { name: 'Early Adopter', icon: '🚀', color: 'violet', description: 'One of the first 100 users' },
    11: { name: 'Custom Badge', icon: '🏆', color: 'gold', description: 'Special achievement badge' }
  };

  useEffect(() => {
    if (wallet) {
      fetchBadges();
    }
  }, [wallet]);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      // In a real app, this would query the BadgeNFT contract
      // For now, we'll simulate with ReputeAgent data
      const response = await axios.get(`${REPUTE_AGENT_URL}/reputation/${wallet}`);
      
      // Simulate badge ownership based on reputation
      const simulatedBadges = [];
      const reputation = response.data.reputation || {};
      
      if (reputation.totalJobs >= 1) {
        simulatedBadges.push({
          badgeType: 0,
          tokenId: 1,
          issuedAt: Date.now() - 86400000,
          proof: 'ipfs://QmFirstJob...'
        });
      }
      
      if (reputation.totalJobs >= 10) {
        simulatedBadges.push({
          badgeType: 1,
          tokenId: 2,
          issuedAt: Date.now() - 43200000,
          proof: 'ipfs://Qm10Jobs...'
        });
      }
      
      if (reputation.reputationScore >= 90) {
        simulatedBadges.push({
          badgeType: 3,
          tokenId: 3,
          issuedAt: Date.now() - 21600000,
          proof: 'ipfs://QmTopRated...'
        });
      }
      
      setBadges(simulatedBadges);
    } catch (error) {
      console.error('Error fetching badges:', error);
      setBadges([]);
    } finally {
      setLoading(false);
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'from-blue-400 to-blue-600',
      green: 'from-green-400 to-green-600',
      purple: 'from-purple-400 to-purple-600',
      yellow: 'from-yellow-400 to-yellow-600',
      indigo: 'from-indigo-400 to-indigo-600',
      cyan: 'from-cyan-400 to-cyan-600',
      orange: 'from-orange-400 to-orange-600',
      pink: 'from-pink-400 to-pink-600',
      teal: 'from-teal-400 to-teal-600',
      red: 'from-red-400 to-red-600',
      violet: 'from-violet-400 to-violet-600',
      gold: 'from-yellow-300 to-yellow-500'
    };
    return colors[color] || 'from-gray-400 to-gray-600';
  };

  if (!wallet) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-yellow-900 mb-2">
            🔌 Wallet Not Connected
          </h2>
          <p className="text-yellow-700">
            Please connect your wallet to view your badge collection
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
          🏆 Badge Gallery
        </h1>
        <p className="text-gray-600">
          Your achievement badges (Soulbound NFTs)
        </p>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 text-white mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm font-medium mb-1">Badges Earned</p>
            <p className="text-5xl font-bold">{badges.length}</p>
          </div>
          <div className="text-6xl opacity-50">🏆</div>
        </div>
      </div>

      {/* Badge Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Loading your badges...</p>
        </div>
      ) : badges.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">No badges yet</p>
          <p className="text-gray-500 mt-2">Complete jobs and achievements to earn badges!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {badges.map((badge, index) => {
            const metadata = BADGE_METADATA[badge.badgeType];
            return (
              <div
                key={index}
                onClick={() => setSelectedBadge({ ...badge, metadata })}
                className="bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 cursor-pointer overflow-hidden"
              >
                {/* Badge Header with Gradient */}
                <div className={`bg-gradient-to-br ${getColorClasses(metadata.color)} p-8 text-center`}>
                  <div className="text-7xl mb-3 filter drop-shadow-lg">
                    {metadata.icon}
                  </div>
                  <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 py-1 inline-block">
                    <span className="text-white text-xs font-bold">SOULBOUND</span>
                  </div>
                </div>

                {/* Badge Body */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">
                    {metadata.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {metadata.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Token #{badge.tokenId}</span>
                    <span>{new Date(badge.issuedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All Available Badges */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          📋 All Available Badges
        </h2>
        <p className="text-gray-600 mb-6">
          Complete achievements to unlock these badges
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(BADGE_METADATA).map(([type, metadata]) => {
            const earned = badges.some(b => b.badgeType === parseInt(type));
            return (
              <div
                key={type}
                className={`rounded-lg p-4 border-2 ${
                  earned ? 'bg-white border-green-300' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{metadata.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{metadata.name}</p>
                    {earned ? (
                      <span className="text-xs text-green-600 font-medium">✓ Earned</span>
                    ) : (
                      <span className="text-xs text-gray-500">🔒 Locked</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden">
            {/* Modal Header with Gradient */}
            <div className={`bg-gradient-to-br ${getColorClasses(selectedBadge.metadata.color)} p-12 text-center`}>
              <div className="text-8xl mb-4 filter drop-shadow-2xl animate-bounce">
                {selectedBadge.metadata.icon}
              </div>
              <div className="bg-white bg-opacity-30 backdrop-blur-sm rounded-full px-4 py-2 inline-block">
                <span className="text-white text-sm font-bold">SOULBOUND NFT</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedBadge.metadata.name}
              </h2>
              <p className="text-gray-600 mb-4">
                {selectedBadge.metadata.description}
              </p>

              <div className="space-y-3 bg-gray-50 rounded-lg p-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Token ID</p>
                  <p className="font-mono font-semibold">#{selectedBadge.tokenId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Issued Date</p>
                  <p className="font-semibold">
                    {new Date(selectedBadge.issuedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Proof</p>
                  <p className="font-mono text-xs truncate">{selectedBadge.proof}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transferable</p>
                  <p className="font-semibold text-red-600">❌ No (Soulbound)</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Soulbound NFT:</strong> This badge is permanently bound to your wallet and cannot be transferred or sold.
                </p>
              </div>

              <button
                onClick={() => setSelectedBadge(null)}
                className="w-full py-3 px-4 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-medium"
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

export default BadgeGallery;

