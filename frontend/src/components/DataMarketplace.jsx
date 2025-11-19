import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DataMarketplace = ({ wallet }) => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchases, setPurchases] = useState([]);

  const DATA_AGENT_URL = 'http://localhost:3006';

  useEffect(() => {
    fetchDatasets();
    if (wallet) {
      fetchPurchases();
    }
  }, [wallet, filter, maxPrice]);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      let url = `${DATA_AGENT_URL}/datasets`;
      const params = new URLSearchParams();
      
      if (maxPrice) {
        params.append('maxPrice', maxPrice);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url);
      setDatasets(response.data.datasets || []);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await axios.get(`${DATA_AGENT_URL}/purchases`, {
        params: { buyer: wallet }
      });
      setPurchases(response.data.purchases || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const handlePurchase = async (dataset) => {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setPurchasing(true);
    try {
      const response = await axios.post(`${DATA_AGENT_URL}/purchase`, {
        listingId: dataset.id,
        buyer: wallet,
        duration: dataset.pricingModel === 'SUBSCRIPTION' ? 30 : undefined
      });

      if (response.data.success) {
        alert(`✅ Dataset purchased successfully!
        
Purchase ID: ${response.data.purchaseId}
Access Token: ${response.data.accessToken}
Data Hash: ${response.data.dataHash}

Your access token has been saved.`);
        
        setSelectedDataset(null);
        fetchPurchases();
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert(`❌ Purchase failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setPurchasing(false);
    }
  };

  const getPricingModelBadge = (model) => {
    const colors = {
      'ONE_TIME': 'bg-blue-100 text-blue-800',
      'SUBSCRIPTION': 'bg-green-100 text-green-800',
      'PAY_PER_USE': 'bg-purple-100 text-purple-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[model] || 'bg-gray-100 text-gray-800'}`}>
        {model.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🗄️ Data Marketplace
        </h1>
        <p className="text-gray-600">
          Browse and purchase datasets, models, and API access with HBAR micropayments
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Price (HBAR)
            </label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Any price"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={fetchDatasets}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* My Purchases */}
      {wallet && purchases.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            ✅ My Purchases ({purchases.length})
          </h3>
          <div className="space-y-2">
            {purchases.slice(0, 3).map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between text-sm">
                <span className="text-green-800">{purchase.datasetName}</span>
                <span className="text-green-600 font-medium">{purchase.price} HBAR</span>
              </div>
            ))}
          </div>
          {purchases.length > 3 && (
            <p className="text-sm text-green-600 mt-2">
              + {purchases.length - 3} more purchases
            </p>
          )}
        </div>
      )}

      {/* Dataset Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading datasets...</p>
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">No datasets found</p>
          <p className="text-gray-500 mt-2">Try adjusting your filters or check back later</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {datasets.map((dataset) => (
            <div
              key={dataset.id}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden border border-gray-200"
            >
              {/* Dataset Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4">
                <h3 className="text-xl font-bold text-white mb-1">
                  {dataset.name}
                </h3>
                <div className="flex items-center gap-2">
                  {getPricingModelBadge(dataset.pricingModel)}
                  <span className="text-blue-100 text-sm">
                    {dataset.totalSales} sales
                  </span>
                </div>
              </div>

              {/* Dataset Body */}
              <div className="p-4">
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {dataset.description}
                </p>

                {/* Provider */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500">Provider</p>
                  <p className="text-sm font-mono text-gray-700 truncate">
                    {dataset.provider}
                  </p>
                </div>

                {/* Data Hash Preview */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500">Data Hash</p>
                  <p className="text-sm font-mono text-gray-700">
                    {dataset.dataHash}
                  </p>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between mb-4 pt-4 border-t border-gray-200">
                  <span className="text-2xl font-bold text-gray-900">
                    {dataset.price} <span className="text-sm text-gray-500">HBAR</span>
                  </span>
                  {dataset.pricingModel === 'SUBSCRIPTION' && (
                    <span className="text-xs text-gray-500">/month</span>
                  )}
                </div>

                {/* Purchase Button */}
                <button
                  onClick={() => setSelectedDataset(dataset)}
                  disabled={!wallet}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {wallet ? '🛒 Purchase Dataset' : '🔌 Connect Wallet'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Purchase Modal */}
      {selectedDataset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Confirm Purchase</h2>
            
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-sm text-gray-500">Dataset</p>
                <p className="font-semibold">{selectedDataset.name}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Pricing Model</p>
                <p className="font-semibold">{selectedDataset.pricingModel.replace('_', ' ')}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Provider</p>
                <p className="font-mono text-sm truncate">{selectedDataset.provider}</p>
              </div>
              
              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">Total Price</p>
                <p className="text-3xl font-bold text-blue-600">
                  {selectedDataset.price} HBAR
                </p>
                {selectedDataset.pricingModel === 'SUBSCRIPTION' && (
                  <p className="text-sm text-gray-500">for 30 days</p>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">
                💡 After purchase, you'll receive an access token and data hash to download your dataset.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedDataset(null)}
                disabled={purchasing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePurchase(selectedDataset)}
                disabled={purchasing}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {purchasing ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataMarketplace;

