import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReputationDashboard = ({ wallet }) => {
  const [reputation, setReputation] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [staked, setStaked] = useState(0);
  const [stakeAmount, setStakeAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState(false);

  const REPUTE_AGENT_URL = 'http://localhost:3004';

  useEffect(() => {
    if (wallet) {
      fetchReputationData();
    }
  }, [wallet]);

  const fetchReputationData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${REPUTE_AGENT_URL}/reputation/${wallet}`);
      
      setReputation(response.data.reputation || {
        reputationScore: 0,
        successRate: 0,
        totalJobs: 0,
        completedJobs: 0,
        avgResponseTime: 0,
        avgQualityScore: 0
      });
      
      // Simulate token balance (in real app, query ReputationToken contract)
      setTokenBalance(response.data.tokenBalance || 0);
      setStaked(response.data.staked || 0);
    } catch (error) {
      console.error('Error fetching reputation:', error);
      setReputation({
        reputationScore: 0,
        successRate: 0,
        totalJobs: 0,
        completedJobs: 0,
        avgResponseTime: 0,
        avgQualityScore: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (parseFloat(stakeAmount) > tokenBalance) {
      alert('Insufficient balance');
      return;
    }

    setStaking(true);
    try {
      // In real app, this would call ReputationToken.stake()
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transaction
      
      alert(`✅ Successfully staked ${stakeAmount} REPUTE tokens!`);
      setStakeAmount('');
      fetchReputationData();
    } catch (error) {
      alert(`❌ Staking failed: ${error.message}`);
    } finally {
      setStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (staked <= 0) {
      alert('No tokens staked');
      return;
    }

    setStaking(true);
    try {
      // In real app, this would call ReputationToken.unstake()
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transaction
      
      alert(`✅ Successfully unstaked ${staked} REPUTE tokens!`);
      fetchReputationData();
    } catch (error) {
      alert(`❌ Unstaking failed: ${error.message}`);
    } finally {
      setStaking(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (score >= 70) return { label: 'Good', color: 'bg-yellow-100 text-yellow-800' };
    if (score >= 50) return { label: 'Fair', color: 'bg-orange-100 text-orange-800' };
    return { label: 'Poor', color: 'bg-red-100 text-red-800' };
  };

  if (!wallet) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-yellow-900 mb-2">
            🔌 Wallet Not Connected
          </h2>
          <p className="text-yellow-700">
            Please connect your wallet to view your reputation
          </p>
        </div>
      </div>
    );
  }

  const badge = getScoreBadge(reputation?.reputationScore || 0);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ⭐ Reputation Dashboard
        </h1>
        <p className="text-gray-600">
          Your reputation score, token balance, and staking rewards
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading reputation data...</p>
        </div>
      ) : (
        <>
          {/* Reputation Score Card */}
          <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-lg shadow-2xl p-8 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium mb-2">Overall Reputation Score</p>
                <div className="flex items-end gap-3">
                  <p className={`text-7xl font-bold ${getScoreColor(reputation.reputationScore)}`}>
                    {reputation.reputationScore}
                  </p>
                  <p className="text-3xl text-purple-100 mb-2">/100</p>
                </div>
                <div className="mt-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
              <div className="text-8xl opacity-50">⭐</div>
            </div>
          </div>

          {/* Token Balance & Staking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Token Balance */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-2xl">
                  🪙
                </div>
                <div>
                  <p className="text-sm text-gray-500">REPUTE Token Balance</p>
                  <p className="text-3xl font-bold text-gray-900">{tokenBalance}</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  💡 Earn REPUTE tokens by completing jobs successfully
                </p>
              </div>
            </div>

            {/* Staked Balance */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-2xl">
                  🔒
                </div>
                <div>
                  <p className="text-sm text-gray-500">Staked REPUTE</p>
                  <p className="text-3xl font-bold text-gray-900">{staked}</p>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-800">
                  💰 Staking earns you +10% reputation boost
                </p>
              </div>
            </div>
          </div>

          {/* Staking Interface */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💎 Staking</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Stake */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Stake Tokens</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount to Stake
                    </label>
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      max={tokenBalance}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {tokenBalance} REPUTE
                    </p>
                  </div>
                  <button
                    onClick={handleStake}
                    disabled={staking || !stakeAmount}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {staking ? 'Processing...' : '🔒 Stake Tokens'}
                  </button>
                </div>
              </div>

              {/* Unstake */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Unstake Tokens</h3>
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-600 mb-1">Staked Amount</p>
                    <p className="text-2xl font-bold text-gray-900">{staked} REPUTE</p>
                  </div>
                  <button
                    onClick={handleUnstake}
                    disabled={staking || staked <= 0}
                    className="w-full py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 transition-colors font-medium"
                  >
                    {staking ? 'Processing...' : '🔓 Unstake All'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reputation Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Reputation Breakdown</h2>
            
            <div className="space-y-4">
              {/* Success Rate */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Success Rate (35%)</span>
                  <span className="text-sm font-bold text-gray-900">{reputation.successRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${reputation.successRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Response Time */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Response Time (20%)</span>
                  <span className="text-sm font-bold text-gray-900">{reputation.avgResponseTime || 0}h avg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (24 - (reputation.avgResponseTime || 0)) / 24 * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Quality Score */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Quality Score (25%)</span>
                  <span className="text-sm font-bold text-gray-900">{reputation.avgQualityScore}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-purple-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${reputation.avgQualityScore}%` }}
                  ></div>
                </div>
              </div>

              {/* Consistency */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Consistency (10%)</span>
                  <span className="text-sm font-bold text-gray-900">85%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-orange-600 h-2.5 rounded-full transition-all" style={{ width: '85%' }}></div>
                </div>
              </div>

              {/* Staking Bonus */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Staking Bonus (10%)</span>
                  <span className="text-sm font-bold text-gray-900">{staked > 0 ? '+10%' : '0%'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-yellow-600 h-2.5 rounded-full transition-all"
                    style={{ width: staked > 0 ? '100%' : '0%' }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Job Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{reputation.totalJobs}</p>
                <p className="text-sm text-gray-500">Total Jobs</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{reputation.completedJobs}</p>
                <p className="text-sm text-gray-500">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{reputation.totalJobs - reputation.completedJobs}</p>
                <p className="text-sm text-gray-500">Failed</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReputationDashboard;

