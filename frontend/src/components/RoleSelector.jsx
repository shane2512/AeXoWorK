import React, { useState } from 'react';
import { ClientIcon, WorkerIcon } from './icons/Icons';

function RoleSelector({ onRoleSelect }) {
  const [selectedRole, setSelectedRole] = useState(null);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    // Store role in localStorage
    localStorage.setItem('userRole', role);
    onRoleSelect(role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center px-4 py-12">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500" />
            <h1 className="text-5xl md:text-6xl font-bold text-gradient font-['Plus_Jakarta_Sans']">AexoWork</h1>
          </div>
          <p className="text-xl text-white/70 leading-relaxed max-w-2xl mx-auto">
            Choose your role to get started with autonomous agent-powered work
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Client Card */}
          <div
            onClick={() => handleRoleSelect('client')}
            className={`card cursor-pointer border-2 transition-all group ${
              selectedRole === 'client'
                ? 'border-white/40 bg-white/10 shadow-xl scale-105'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="text-center py-10 px-6">
              <div className="mb-6 group-hover:scale-110 transition-transform flex justify-center">
                <ClientIcon className="w-24 h-24 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-white font-['Plus_Jakarta_Sans']">I'm a Client</h2>
              <p className="text-white/70 mb-8 text-lg leading-relaxed">
                I want to post jobs and hire freelancers
              </p>
              <ul className="text-left text-sm text-white/80 space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Post job requirements</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Review and accept offers</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Manage projects and payments</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Track job progress</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Manage your agents</span>
                </li>
              </ul>
              <button
                className={`btn-primary w-full ${
                  selectedRole === 'client' 
                    ? 'bg-white text-black hover:bg-white/90' 
                    : ''
                }`}
              >
                Continue as Client
              </button>
            </div>
          </div>

          {/* Freelancer Card */}
          <div
            onClick={() => handleRoleSelect('freelancer')}
            className={`card cursor-pointer border-2 transition-all group ${
              selectedRole === 'freelancer'
                ? 'border-white/40 bg-white/10 shadow-xl scale-105'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="text-center py-10 px-6">
              <div className="mb-6 group-hover:scale-110 transition-transform flex justify-center">
                <WorkerIcon className="w-24 h-24 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-white font-['Plus_Jakarta_Sans']">I'm a Freelancer</h2>
              <p className="text-white/70 mb-8 text-lg leading-relaxed">
                I want to find jobs and deliver work
              </p>
              <ul className="text-left text-sm text-white/80 space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Discover available jobs</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Submit competitive offers</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Deliver completed work</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Build your reputation</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-400 text-lg">✓</span>
                  <span>Manage your worker agents</span>
                </li>
              </ul>
              <button
                className={`btn-primary w-full ${
                  selectedRole === 'freelancer' 
                    ? 'bg-white text-black hover:bg-white/90' 
                    : ''
                }`}
              >
                Continue as Freelancer
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-10">
          <p className="text-white/50 text-sm">
            You can change your role later in settings
          </p>
        </div>
      </div>
    </div>
  );
}

export default RoleSelector;
