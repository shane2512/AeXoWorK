import React, { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Textarea } from "../components/ui/Textarea";
import { cn } from "../utils/cn";
import { PlugIcon, AgentIcon } from "../components/icons/Icons";

// Lucide icons as SVG components
const ArrowUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
);

const Paperclip = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
);

const PlusIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronDown = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

function useAutoResizeTextarea({ minHeight, maxHeight }) {
  const textareaRef = useRef(null);

  const adjustHeight = useCallback(
    (reset) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(
          textarea.scrollHeight,
          maxHeight ?? Number.POSITIVE_INFINITY
        )
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

function Chat({ account, userRole }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [userAgents, setUserAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const dropdownRef = useRef(null);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  // Fetch user's agents
  useEffect(() => {
    const fetchUserAgents = async () => {
      if (!account) {
        setLoadingAgents(false);
        return;
      }

      try {
        setLoadingAgents(true);
        console.log('[Chat] Fetching agents for account:', account);
        const response = await axios.get('/api/agents');
        console.log('[Chat] Agents response:', response.data);
        
        // Handle different response formats
        let agents = [];
        if (response.data.agents) {
          agents = response.data.agents;
        } else if (response.data.success && response.data.agents) {
          agents = response.data.agents;
        } else if (Array.isArray(response.data)) {
          agents = response.data;
        }
        
        console.log('[Chat] All agents:', agents);
        
        // Filter agents owned by the current user
        // Account might be in different formats (0x... or did:...)
        const accountLower = account?.toLowerCase().trim();
        const accountWithoutPrefix = accountLower?.replace(/^0x/, '').replace(/^did:hedera:testnet:/, '');
        
        const ownedAgents = agents.filter(agent => {
          if (!agent) return false;
          
          const ownerLower = agent.owner?.toLowerCase()?.trim();
          const ownerWithoutPrefix = ownerLower?.replace(/^0x/, '').replace(/^did:hedera:testnet:/, '');
          
          // Try multiple matching strategies
          const matches = 
            ownerLower === accountLower || 
            ownerWithoutPrefix === accountWithoutPrefix ||
            (ownerLower && accountLower && ownerLower.includes(accountWithoutPrefix)) ||
            (accountLower && ownerLower && accountLower.includes(ownerWithoutPrefix));
          
          if (matches) {
            console.log('[Chat] Found owned agent:', {
              name: agent.name,
              id: agent.id,
              owner: agent.owner,
              account: account
            });
          }
          return matches;
        });
        
        console.log('[Chat] Owned agents:', ownedAgents);
        console.log('[Chat] Total agents found:', agents.length);
        console.log('[Chat] Owned agents count:', ownedAgents.length);
        console.log('[Chat] Current account:', account);
        
        setUserAgents(ownedAgents);
        
        if (ownedAgents.length > 0 && !selectedAgent) {
          setSelectedAgent(ownedAgents[0].id);
          console.log('[Chat] Auto-selected agent:', ownedAgents[0].id);
        } else if (ownedAgents.length === 0) {
          console.warn('[Chat] No agents found for account:', account);
          console.warn('[Chat] All agents:', agents.map(a => ({ id: a.id, name: a.name, owner: a.owner })));
        }
      } catch (error) {
        console.error('[Chat] Error fetching agents:', error);
        console.error('[Chat] Error details:', error.response?.data || error.message);
        setUserAgents([]);
      } finally {
        setLoadingAgents(false);
      }
    };

    fetchUserAgents();
  }, [account]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAgentDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && selectedAgent) {
        handleSend();
      }
    }
  };

  const handleSend = async () => {
    if (!value.trim() || !selectedAgent || loading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: value.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setValue("");
    adjustHeight(true);
    setLoading(true);

    try {
      const agent = userAgents.find(a => a.id === selectedAgent);
      
      setTimeout(() => {
        const agentMessage = {
          id: Date.now() + 1,
          role: 'agent',
          content: `This is a placeholder response from ${agent?.name || 'your agent'}. Agent-to-agent messaging integration coming soon!`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      setLoading(false);
    }
  };

  const selectedAgentData = userAgents.find(a => a.id === selectedAgent);

  if (!account) {
    return (
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8">
        <div className="text-center py-16">
          <div className="mb-6 flex justify-center">
            <PlugIcon className="w-20 h-20 text-white/60" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Connect Your Wallet</h2>
          <p className="text-white/70 mb-8">Please connect your wallet to use the chat interface</p>
        </div>
      </div>
    );
  }

  if (userAgents.length === 0 && !loadingAgents) {
    return (
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8">
        <div className="text-center py-16">
          <div className="mb-6 flex justify-center">
            <AgentIcon className="w-20 h-20 text-white/60" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">No Agents Found</h2>
          <p className="text-white/70 mb-8">You haven't created any agents yet.</p>
          <button
            onClick={() => navigate('/create-agent')}
            className="btn-primary"
          >
            Create Your First Agent
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8">
      <h1 className="text-4xl font-bold text-white">
        Chat with Your Agent
      </h1>

      <div className="w-full">
        {/* Agent Selector - Cursor/Claude style */}
        <div className="mb-4 flex items-center justify-center">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowAgentDropdown(!showAgentDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/80 hover:text-white transition-colors text-sm font-medium"
            >
              <span>{selectedAgentData ? selectedAgentData.name || 'Unnamed Agent' : 'Select Agent'}</span>
              <span className="text-xs text-white/50">({selectedAgentData?.agentType || selectedAgentData?.type || 'N/A'})</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showAgentDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-black/95 backdrop-blur-md rounded-lg border border-white/10 shadow-xl z-50 max-h-64 overflow-y-auto">
                {userAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      setSelectedAgent(agent.id);
                      setShowAgentDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0",
                      selectedAgent === agent.id && "bg-white/10"
                    )}
                  >
                    <div className="font-medium text-white text-sm">{agent.name || 'Unnamed Agent'}</div>
                    <div className="text-xs text-white/50 mt-1">{agent.agentType || agent.type}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages Area */}
        {messages.length > 0 && (
          <div className="mb-4 max-h-[400px] overflow-y-auto space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg p-4",
                  message.role === 'user'
                    ? "bg-white/10 text-white ml-auto max-w-[80%]"
                    : "bg-white/5 text-white/90 max-w-[80%]"
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            {loading && (
              <div className="bg-white/5 text-white/90 rounded-lg p-4 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className="relative bg-black/50 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="overflow-y-auto">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedAgent ? "Ask your agent a question..." : "Select an agent first..."}
              disabled={!selectedAgent || loading}
              className={cn(
                "w-full px-4 py-3",
                "resize-none",
                "bg-transparent",
                "border-none",
                "text-white text-sm",
                "focus:outline-none",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "placeholder:text-white/50 placeholder:text-sm",
                "min-h-[60px]"
              )}
              style={{
                overflow: "hidden",
              }}
            />
          </div>
          <div className="flex items-center justify-between p-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="group p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1"
              >
                <Paperclip className="w-4 h-4 text-white/70" />
                <span className="text-xs text-white/50 hidden group-hover:inline transition-opacity">
                  Attach
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded-lg text-sm text-white/50 transition-colors border border-dashed border-white/20 hover:border-white/30 hover:bg-white/5 flex items-center justify-between gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Project
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!value.trim() || !selectedAgent || loading}
                className={cn(
                  "px-1.5 py-1.5 rounded-lg text-sm transition-colors border border-white/20 hover:border-white/30 hover:bg-white/10 flex items-center justify-between gap-1",
                  value.trim() && selectedAgent && !loading
                    ? "bg-white text-black"
                    : "text-white/50 cursor-not-allowed"
                )}
              >
                <ArrowUpIcon
                  className={cn(
                    "w-4 h-4",
                    value.trim() && selectedAgent && !loading
                      ? "text-black"
                      : "text-white/50"
                  )}
                />
                <span className="sr-only">Send</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Chat;
