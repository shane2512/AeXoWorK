import React, { useState } from 'react';

function RoleSelector({ onRoleSelect }) {
  const [selectedRole, setSelectedRole] = useState(null);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    // Store role in localStorage
    localStorage.setItem('userRole', role);
    onRoleSelect(role);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-hedera-purple mb-2">Welcome to AexoWork</h1>
          <p className="text-gray-600 text-lg">Choose your role to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Card */}
          <div
            onClick={() => handleRoleSelect('client')}
            className={`card hover:shadow-xl transition-all cursor-pointer border-2 ${
              selectedRole === 'client'
                ? 'border-hedera-purple bg-hedera-purple/5'
                : 'border-transparent hover:border-hedera-purple'
            }`}
          >
            <div className="text-center py-8">
              <div className="text-7xl mb-6">👔</div>
              <h2 className="text-2xl font-bold mb-4">I'm a Client</h2>
              <p className="text-gray-600 mb-6">
                I want to post jobs and hire freelancers
              </p>
              <ul className="text-left text-sm text-gray-600 space-y-2 mb-6">
                <li>✓ Post job requirements</li>
                <li>✓ Review and accept offers</li>
                <li>✓ Manage projects and payments</li>
                <li>✓ Track job progress</li>
                <li>✓ Manage your agents</li>
              </ul>
              <button
                className={`btn-primary w-full ${
                  selectedRole === 'client' ? 'bg-hedera-purple' : ''
                }`}
              >
                Continue as Client
              </button>
            </div>
          </div>

          {/* Freelancer Card */}
          <div
            onClick={() => handleRoleSelect('freelancer')}
            className={`card hover:shadow-xl transition-all cursor-pointer border-2 ${
              selectedRole === 'freelancer'
                ? 'border-hedera-purple bg-hedera-purple/5'
                : 'border-transparent hover:border-hedera-purple'
            }`}
          >
            <div className="text-center py-8">
              <div className="text-7xl mb-6">👷</div>
              <h2 className="text-2xl font-bold mb-4">I'm a Freelancer</h2>
              <p className="text-gray-600 mb-6">
                I want to find jobs and deliver work
              </p>
              <ul className="text-left text-sm text-gray-600 space-y-2 mb-6">
                <li>✓ Discover available jobs</li>
                <li>✓ Submit competitive offers</li>
                <li>✓ Deliver completed work</li>
                <li>✓ Build your reputation</li>
                <li>✓ Manage your worker agents</li>
              </ul>
              <button
                className={`btn-primary w-full ${
                  selectedRole === 'freelancer' ? 'bg-hedera-purple' : ''
                }`}
              >
                Continue as Freelancer
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>You can change your role later in settings</p>
        </div>
      </div>
    </div>
  );
}

export default RoleSelector;

