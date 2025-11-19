// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AIAgentRegistry
 * @dev ERC-8004 compliant AI Agent Registry for Hedera
 * Manages on-chain AI agent registration, verification, and metadata
 */
contract AIAgentRegistry is Ownable, ReentrancyGuard {
    
    // Agent status enum
    enum AgentStatus { Unregistered, Active, Paused, Retired, Suspended }
    
    // Agent capability categories
    enum Capability { 
        ContentCreation, 
        CodeDevelopment, 
        DataProcessing, 
        Verification, 
        Escrow, 
        Reputation, 
        Dispute, 
        Marketplace 
    }
    
    // Agent structure following ERC-8004
    struct Agent {
        address owner;
        string did; // Decentralized Identifier
        string name;
        string metadataURI; // IPFS hash containing full metadata
        AgentStatus status;
        uint256 registeredAt;
        uint256 lastActiveAt;
        uint256 reputationScore;
        uint256 totalJobs;
        uint256 successfulJobs;
        address walletAddress;
        bool verified;
    }
    
    // Agent capabilities
    struct AgentCapabilities {
        Capability[] capabilities;
        string[] skills;
        uint256 minPriceHBAR;
        uint256 maxPriceHBAR;
        uint256 avgCompletionTime; // in seconds
        bool autoAcceptJobs;
    }
    
    // Agent SLA (Service Level Agreement)
    struct AgentSLA {
        uint256 maxResponseTime; // in seconds
        uint256 guaranteedUptime; // percentage (0-10000 = 0-100.00%)
        uint256 refundPolicy; // refund percentage if SLA breached
        string terms; // IPFS hash of full terms
    }
    
    // Mappings
    mapping(bytes32 => Agent) public agents; // agentId => Agent
    mapping(address => bytes32[]) public ownerAgents; // owner => agentIds[]
    mapping(string => bytes32) public didToAgentId; // DID => agentId
    mapping(bytes32 => AgentCapabilities) public agentCapabilities;
    mapping(bytes32 => AgentSLA) public agentSLAs;
    mapping(bytes32 => uint256) public agentStake; // agentId => staked HBAR
    
    // Verifier addresses (can attest agent capabilities)
    mapping(address => bool) public authorizedVerifiers;
    
    // Events
    event AgentRegistered(bytes32 indexed agentId, address indexed owner, string did, string name);
    event AgentStatusChanged(bytes32 indexed agentId, AgentStatus newStatus);
    event AgentVerified(bytes32 indexed agentId, address indexed verifier);
    event AgentMetadataUpdated(bytes32 indexed agentId, string newMetadataURI);
    event AgentStaked(bytes32 indexed agentId, uint256 amount);
    event AgentUnstaked(bytes32 indexed agentId, uint256 amount);
    event AgentJobCompleted(bytes32 indexed agentId, bool successful);
    
    // Modifiers
    modifier onlyAgentOwner(bytes32 agentId) {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        _;
    }
    
    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender] || msg.sender == owner(), "Not authorized verifier");
        _;
    }
    
    modifier agentExists(bytes32 agentId) {
        require(agents[agentId].owner != address(0), "Agent does not exist");
        _;
    }
    
    constructor() {
        // Contract deployer is initial verifier
        authorizedVerifiers[msg.sender] = true;
    }
    
    /**
     * @dev Register a new AI agent (ERC-8004 compliant)
     * @param did Decentralized identifier
     * @param name Agent name
     * @param metadataURI IPFS hash containing full metadata
     * @param walletAddress Agent's wallet address
     * @param capabilities Array of capabilities
     * @param skills Array of skill strings
     * @param minPrice Minimum price in HBAR (wei)
     * @param maxPrice Maximum price in HBAR (wei)
     */
    function registerAgent(
        string calldata did,
        string calldata name,
        string calldata metadataURI,
        address walletAddress,
        Capability[] calldata capabilities,
        string[] calldata skills,
        uint256 minPrice,
        uint256 maxPrice
    ) external payable returns (bytes32) {
        require(bytes(did).length > 0, "DID required");
        require(didToAgentId[did] == bytes32(0), "DID already registered");
        require(walletAddress != address(0), "Invalid wallet");
        
        // Generate unique agent ID
        bytes32 agentId = keccak256(abi.encodePacked(did, msg.sender, block.timestamp));
        
        // Create agent
        agents[agentId] = Agent({
            owner: msg.sender,
            did: did,
            name: name,
            metadataURI: metadataURI,
            status: AgentStatus.Active,
            registeredAt: block.timestamp,
            lastActiveAt: block.timestamp,
            reputationScore: 5000, // Start at 50.00%
            totalJobs: 0,
            successfulJobs: 0,
            walletAddress: walletAddress,
            verified: false
        });
        
        // Set capabilities
        agentCapabilities[agentId] = AgentCapabilities({
            capabilities: capabilities,
            skills: skills,
            minPriceHBAR: minPrice,
            maxPriceHBAR: maxPrice,
            avgCompletionTime: 0,
            autoAcceptJobs: false
        });
        
        // Map DID to agentId
        didToAgentId[did] = agentId;
        
        // Map owner to agent
        ownerAgents[msg.sender].push(agentId);
        
        // Stake if HBAR sent
        if (msg.value > 0) {
            agentStake[agentId] = msg.value;
            emit AgentStaked(agentId, msg.value);
        }
        
        emit AgentRegistered(agentId, msg.sender, did, name);
        
        return agentId;
    }
    
    /**
     * @dev Update agent status
     */
    function updateAgentStatus(bytes32 agentId, AgentStatus newStatus) 
        external 
        onlyAgentOwner(agentId) 
        agentExists(agentId) 
    {
        agents[agentId].status = newStatus;
        emit AgentStatusChanged(agentId, newStatus);
    }
    
    /**
     * @dev Verify agent (only by authorized verifiers)
     */
    function verifyAgent(bytes32 agentId) 
        external 
        onlyVerifier 
        agentExists(agentId) 
    {
        agents[agentId].verified = true;
        emit AgentVerified(agentId, msg.sender);
    }
    
    /**
     * @dev Update agent metadata
     */
    function updateAgentMetadata(bytes32 agentId, string calldata newMetadataURI)
        external
        onlyAgentOwner(agentId)
        agentExists(agentId)
    {
        agents[agentId].metadataURI = newMetadataURI;
        emit AgentMetadataUpdated(agentId, newMetadataURI);
    }
    
    /**
     * @dev Set agent SLA
     */
    function setAgentSLA(
        bytes32 agentId,
        uint256 maxResponseTime,
        uint256 guaranteedUptime,
        uint256 refundPolicy,
        string calldata terms
    ) external onlyAgentOwner(agentId) agentExists(agentId) {
        agentSLAs[agentId] = AgentSLA({
            maxResponseTime: maxResponseTime,
            guaranteedUptime: guaranteedUptime,
            refundPolicy: refundPolicy,
            terms: terms
        });
    }
    
    /**
     * @dev Stake HBAR to improve reputation
     */
    function stakeHBAR(bytes32 agentId) 
        external 
        payable 
        onlyAgentOwner(agentId) 
        agentExists(agentId) 
    {
        require(msg.value > 0, "Must stake > 0");
        agentStake[agentId] += msg.value;
        emit AgentStaked(agentId, msg.value);
    }
    
    /**
     * @dev Unstake HBAR
     */
    function unstakeHBAR(bytes32 agentId, uint256 amount) 
        external 
        onlyAgentOwner(agentId) 
        agentExists(agentId) 
        nonReentrant 
    {
        require(agentStake[agentId] >= amount, "Insufficient stake");
        agentStake[agentId] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit AgentUnstaked(agentId, amount);
    }
    
    /**
     * @dev Record job completion (called by marketplace/escrow)
     */
    function recordJobCompletion(bytes32 agentId, bool successful) 
        external 
        agentExists(agentId) 
    {
        Agent storage agent = agents[agentId];
        agent.totalJobs++;
        if (successful) {
            agent.successfulJobs++;
        }
        agent.lastActiveAt = block.timestamp;
        
        emit AgentJobCompleted(agentId, successful);
    }
    
    /**
     * @dev Update agent reputation (called by ReputeAgent contract)
     */
    function updateReputation(bytes32 agentId, uint256 newScore) 
        external 
        agentExists(agentId) 
    {
        // Only authorized reputation contract can call
        require(msg.sender == owner(), "Not authorized");
        agents[agentId].reputationScore = newScore;
    }
    
    /**
     * @dev Get agent details
     */
    function getAgent(bytes32 agentId) 
        external 
        view 
        returns (Agent memory) 
    {
        return agents[agentId];
    }
    
    /**
     * @dev Get agent by DID
     */
    function getAgentByDID(string calldata did) 
        external 
        view 
        returns (Agent memory) 
    {
        bytes32 agentId = didToAgentId[did];
        return agents[agentId];
    }
    
    /**
     * @dev Get agents owned by address
     */
    function getOwnerAgents(address owner) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return ownerAgents[owner];
    }
    
    /**
     * @dev Add authorized verifier
     */
    function addVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = true;
    }
    
    /**
     * @dev Remove authorized verifier
     */
    function removeVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = false;
    }
}

