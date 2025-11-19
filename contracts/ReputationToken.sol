// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationToken
 * @dev HTS-compatible Reputation Token (fungible)
 * Earned through successful job completion, can be staked for benefits
 */
contract ReputationToken is ERC20, Ownable {
    
    // Authorized minters (ReputeAgent, contracts)
    mapping(address => bool) public authorizedMinters;
    
    // User reputation data
    struct ReputationData {
        uint256 earned;
        uint256 burned;
        uint256 staked;
        uint256 lastUpdated;
        uint256 multiplier; // 100 = 1x, 200 = 2x
    }
    
    mapping(address => ReputationData) public reputationData;
    
    // Staking rewards
    uint256 public stakingRewardRate = 5; // 5% annual
    mapping(address => uint256) public stakingStartTime;
    
    // Events
    event ReputationEarned(address indexed user, uint256 amount, string reason);
    event ReputationBurned(address indexed user, uint256 amount, string reason);
    event ReputationStaked(address indexed user, uint256 amount);
    event ReputationUnstaked(address indexed user, uint256 amount, uint256 rewards);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    
    modifier onlyMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized minter");
        _;
    }
    
    constructor() ERC20("ReputeFlow Reputation", "REPUTE") {
        authorizedMinters[msg.sender] = true;
    }
    
    /**
     * @dev Mint reputation tokens to user
     * @param to Recipient address
     * @param amount Amount to mint
     * @param reason Reason for minting (stored in event)
     */
    function mintReputation(address to, uint256 amount, string calldata reason)
        external
        onlyMinter
    {
        _mint(to, amount);
        
        ReputationData storage data = reputationData[to];
        data.earned += amount;
        data.lastUpdated = block.timestamp;
        
        emit ReputationEarned(to, amount, reason);
    }
    
    /**
     * @dev Burn reputation tokens (e.g., for disputes)
     * @param from Address to burn from
     * @param amount Amount to burn
     * @param reason Reason for burning
     */
    function burnReputation(address from, uint256 amount, string calldata reason)
        external
        onlyMinter
    {
        _burn(from, amount);
        
        ReputationData storage data = reputationData[from];
        data.burned += amount;
        data.lastUpdated = block.timestamp;
        
        emit ReputationBurned(from, amount, reason);
    }
    
    /**
     * @dev Stake reputation tokens for benefits
     * @param amount Amount to stake
     */
    function stakeReputation(uint256 amount) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(amount > 0, "Must stake > 0");
        
        // Claim any existing rewards first
        if (reputationData[msg.sender].staked > 0) {
            _claimStakingRewards();
        }
        
        _transfer(msg.sender, address(this), amount);
        
        ReputationData storage data = reputationData[msg.sender];
        data.staked += amount;
        stakingStartTime[msg.sender] = block.timestamp;
        
        emit ReputationStaked(msg.sender, amount);
    }
    
    /**
     * @dev Unstake reputation tokens
     * @param amount Amount to unstake
     */
    function unstakeReputation(uint256 amount) external {
        ReputationData storage data = reputationData[msg.sender];
        require(data.staked >= amount, "Insufficient staked");
        
        // Calculate and claim rewards
        uint256 rewards = _claimStakingRewards();
        
        data.staked -= amount;
        _transfer(address(this), msg.sender, amount);
        
        if (data.staked == 0) {
            delete stakingStartTime[msg.sender];
        } else {
            stakingStartTime[msg.sender] = block.timestamp;
        }
        
        emit ReputationUnstaked(msg.sender, amount, rewards);
    }
    
    /**
     * @dev Claim staking rewards
     */
    function claimStakingRewards() external returns (uint256) {
        return _claimStakingRewards();
    }
    
    /**
     * @dev Internal: Calculate and distribute staking rewards
     */
    function _claimStakingRewards() internal returns (uint256) {
        ReputationData storage data = reputationData[msg.sender];
        if (data.staked == 0) return 0;
        
        uint256 stakingDuration = block.timestamp - stakingStartTime[msg.sender];
        uint256 rewards = (data.staked * stakingRewardRate * stakingDuration) / (365 days * 100);
        
        if (rewards > 0) {
            _mint(msg.sender, rewards);
            data.earned += rewards;
            stakingStartTime[msg.sender] = block.timestamp;
        }
        
        return rewards;
    }
    
    /**
     * @dev Get pending staking rewards
     */
    function getPendingRewards(address user) external view returns (uint256) {
        ReputationData storage data = reputationData[user];
        if (data.staked == 0) return 0;
        
        uint256 stakingDuration = block.timestamp - stakingStartTime[user];
        return (data.staked * stakingRewardRate * stakingDuration) / (365 days * 100);
    }
    
    /**
     * @dev Get user reputation data
     */
    function getUserReputationData(address user) 
        external 
        view 
        returns (ReputationData memory) 
    {
        return reputationData[user];
    }
    
    /**
     * @dev Add authorized minter
     */
    function addMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev Remove authorized minter
     */
    function removeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev Update staking reward rate
     */
    function setStakingRewardRate(uint256 newRate) external onlyOwner {
        require(newRate <= 20, "Rate too high"); // Max 20%
        stakingRewardRate = newRate;
    }
}

