import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProviderDashboard = ({ wallet }) => {
  const [datasets, setDatasets] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dataHash: '',
    pricingModel: 'ONE_TIME',
    price: ''
  });
  const [registering, setRegistering] = useState(false);

  const DATA_AGENT_URL = 'http://localhost:3006';

  useEffect(() => {
    if (wallet) {
      fetchProviderData();
    }
  }, [wallet]);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      
      // Fetch datasets
      const datasetsResponse = await axios.get(`${DATA_AGENT_URL}/datasets`, {
        params: { provider: wallet }
      });
      setDatasets(datasetsResponse.data.datasets || []);

      // Fetch revenue
      const revenueResponse = await axios.get(`${DATA_AGENT_URL}/revenue/${wallet}`);
      setRevenue(revenueResponse.data);
    } catch (error) {
      console.error('Error fetching provider data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDataset = async (e) => {
    e.preventDefault();
    
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setRegistering(true);
    try {
      const response = await axios.post(`${DATA_AGENT_URL}/register-data`, {
        name: formData.name,
        description: formData.description,
        dataHash: formData.dataHash,
        pricingModel: formData.pricingModel,
        price: parseFloat(formData.price),
        provider: wallet
      });

      if (response.data.success) {
        alert(`✅ Dataset registered successfully!
        
Listing ID: ${response.data.listingId}
Name: ${response.data.name}
Price: ${response.data.price} HBAR
Transaction: ${response.data.onChainTx}`);
        
        setShowRegisterForm(false);
        setFormData({
          name: '',
          description: '',
          dataHash: '',
          pricingModel: 'ONE_TIME',
          price: ''
        });
        fetchProviderData();
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert(`❌ Registration failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setRegistering(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!wallet) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-yellow-900 mb-2">
            🔌 Wallet Not Connected
          </h2>
          <p className="text-yellow-700">
            Please connect your wallet to access the Provider Dashboard
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
          📊 Provider Dashboard
        </h1>
        <p className="text-gray-600">
          Manage your datasets and track your revenue
        </p>
      </div>

      {/* Revenue Stats */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <p className="text-blue-100 text-sm font-medium mb-1">Total Revenue</p>
            <p className="text-4xl font-bold">{revenue.totalRevenue}</p>
            <p className="text-blue-100 text-sm mt-1">HBAR</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <p className="text-green-100 text-sm font-medium mb-1">Total Sales</p>
            <p className="text-4xl font-bold">{revenue.totalSales}</p>
            <p className="text-green-100 text-sm mt-1">purchases</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <p className="text-purple-100 text-sm font-medium mb-1">Active Listings</p>
            <p className="text-4xl font-bold">{revenue.totalListings}</p>
            <p className="text-purple-100 text-sm mt-1">datasets</p>
          </div>
        </div>
      )}

      {/* Register New Dataset Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowRegisterForm(!showRegisterForm)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
        >
          {showRegisterForm ? '❌ Cancel' : '➕ Register New Dataset'}
        </button>
      </div>

      {/* Register Dataset Form */}
      {showRegisterForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-4">Register New Dataset</h2>
          <form onSubmit={handleRegisterDataset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dataset Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="e.g., Financial Market Data 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={3}
                placeholder="Describe your dataset..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Hash (IPFS CID or SHA-256) *
              </label>
              <input
                type="text"
                name="dataHash"
                value={formData.dataHash}
                onChange={handleInputChange}
                required
                placeholder="QmXxx... or sha256:abc123..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Model *
                </label>
                <select
                  name="pricingModel"
                  value={formData.pricingModel}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ONE_TIME">One-Time Purchase</option>
                  <option value="SUBSCRIPTION">Subscription (Monthly)</option>
                  <option value="PAY_PER_USE">Pay Per Use</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (HBAR) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="10.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Your dataset will be registered on-chain and immediately available in the marketplace.
                Store your actual data on IPFS or another decentralized storage solution.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowRegisterForm(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={registering}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {registering ? 'Registering...' : 'Register Dataset'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* My Datasets */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">My Datasets</h2>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading your datasets...</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-lg">No datasets yet</p>
            <p className="text-gray-500 mt-2">Click "Register New Dataset" to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dataset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pricing Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {datasets.map((dataset) => (
                  <tr key={dataset.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{dataset.name}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {dataset.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                        {dataset.pricingModel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium">{dataset.price} HBAR</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-green-600 font-medium">
                        {dataset.totalSales || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-gray-900">
                        {dataset.revenue || 0} HBAR
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderDashboard;

