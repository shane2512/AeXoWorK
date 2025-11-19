// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MilestoneEscrow
 * @dev Multi-stage escrow with milestone-based payments
 * Allows jobs to be broken into milestones with separate approvals and releases
 */
contract MilestoneEscrow is Ownable, ReentrancyGuard {
    
    enum MilestoneStatus { Pending, InProgress, Delivered, Approved, Disputed }
    enum EscrowStatus { Created, Active, Completed, Cancelled, Disputed }
    
    struct Milestone {
        uint256 milestoneId;
        string title;
        string description;
        uint256 amount; // HBAR in wei
        uint256 deadline;
        MilestoneStatus status;
        string deliveryURI; // IPFS proof
        uint256 deliveredAt;
        uint256 approvedAt;
    }
    
    struct Escrow {
        bytes32 escrowId;
        address client;
        address freelancer;
        uint256 totalAmount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 completedAt;
        uint256 releasedAmount;
        uint256 refundedAmount;
        Milestone[] milestones;
    }
    
    // Mappings
    mapping(bytes32 => Escrow) public escrows;
    mapping(address => bytes32[]) public clientEscrows;
    mapping(address => bytes32[]) public freelancerEscrows;
    
    // Platform fee
    uint256 public platformFeeBasis = 250; // 2.5%
    address public feeRecipient;
    
    // Events
    event EscrowCreated(bytes32 indexed escrowId, address indexed client, address indexed freelancer, uint256 totalAmount);
    event MilestoneAdded(bytes32 indexed escrowId, uint256 indexed milestoneId, string title, uint256 amount);
    event MilestoneStarted(bytes32 indexed escrowId, uint256 indexed milestoneId);
    event MilestoneDelivered(bytes32 indexed escrowId, uint256 indexed milestoneId, string deliveryURI);
    event MilestoneApproved(bytes32 indexed escrowId, uint256 indexed milestoneId, uint256 amount);
    event MilestoneDisputed(bytes32 indexed escrowId, uint256 indexed milestoneId);
    event PaymentReleased(bytes32 indexed escrowId, address indexed recipient, uint256 amount);
    event EscrowCompleted(bytes32 indexed escrowId);
    event EscrowCancelled(bytes32 indexed escrowId);
    
    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Create new milestone escrow
     */
    function createEscrow(
        bytes32 escrowId,
        address freelancer,
        string[] calldata milestoneTitles,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneAmounts,
        uint256[] calldata milestoneDeadlines
    ) external payable returns (bytes32) {
        require(escrows[escrowId].client == address(0), "Escrow exists");
        require(freelancer != address(0), "Invalid freelancer");
        require(milestoneTitles.length == milestoneAmounts.length, "Length mismatch");
        require(milestoneTitles.length == milestoneDeadlines.length, "Length mismatch");
        require(milestoneTitles.length == milestoneDescriptions.length, "Length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            totalAmount += milestoneAmounts[i];
        }
        
        require(msg.value >= totalAmount, "Insufficient funds");
        
        // Create escrow
        Escrow storage escrow = escrows[escrowId];
        escrow.escrowId = escrowId;
        escrow.client = msg.sender;
        escrow.freelancer = freelancer;
        escrow.totalAmount = totalAmount;
        escrow.status = EscrowStatus.Created;
        escrow.createdAt = block.timestamp;
        escrow.releasedAmount = 0;
        escrow.refundedAmount = 0;
        
        // Add milestones
        for (uint256 i = 0; i < milestoneTitles.length; i++) {
            Milestone memory milestone = Milestone({
                milestoneId: i,
                title: milestoneTitles[i],
                description: milestoneDescriptions[i],
                amount: milestoneAmounts[i],
                deadline: milestoneDeadlines[i],
                status: MilestoneStatus.Pending,
                deliveryURI: "",
                deliveredAt: 0,
                approvedAt: 0
            });
            
            escrow.milestones.push(milestone);
            emit MilestoneAdded(escrowId, i, milestoneTitles[i], milestoneAmounts[i]);
        }
        
        // Mark as active
        escrow.status = EscrowStatus.Active;
        escrow.milestones[0].status = MilestoneStatus.InProgress;
        
        // Track escrows
        clientEscrows[msg.sender].push(escrowId);
        freelancerEscrows[freelancer].push(escrowId);
        
        // Refund excess
        if (msg.value > totalAmount) {
            (bool success, ) = msg.sender.call{value: msg.value - totalAmount}("");
            require(success, "Refund failed");
        }
        
        emit EscrowCreated(escrowId, msg.sender, freelancer, totalAmount);
        emit MilestoneStarted(escrowId, 0);
        
        return escrowId;
    }
    
    /**
     * @dev Freelancer submits milestone delivery
     */
    function deliverMilestone(bytes32 escrowId, uint256 milestoneId, string calldata deliveryURI) 
        external 
    {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.freelancer == msg.sender, "Not freelancer");
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(milestoneId < escrow.milestones.length, "Invalid milestone");
        
        Milestone storage milestone = escrow.milestones[milestoneId];
        require(milestone.status == MilestoneStatus.InProgress, "Not in progress");
        
        milestone.status = MilestoneStatus.Delivered;
        milestone.deliveryURI = deliveryURI;
        milestone.deliveredAt = block.timestamp;
        
        emit MilestoneDelivered(escrowId, milestoneId, deliveryURI);
    }
    
    /**
     * @dev Client approves milestone and releases payment
     */
    function approveMilestone(bytes32 escrowId, uint256 milestoneId) 
        external 
        nonReentrant 
    {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.client == msg.sender, "Not client");
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(milestoneId < escrow.milestones.length, "Invalid milestone");
        
        Milestone storage milestone = escrow.milestones[milestoneId];
        require(milestone.status == MilestoneStatus.Delivered, "Not delivered");
        
        uint256 amount = milestone.amount;
        require(amount > 0, "No funds");
        
        milestone.status = MilestoneStatus.Approved;
        milestone.approvedAt = block.timestamp;
        
        // Calculate fees
        uint256 fee = (amount * platformFeeBasis) / 10000;
        uint256 payout = amount - fee;
        
        escrow.releasedAmount += amount;
        
        // Transfer funds
        (bool s1, ) = feeRecipient.call{value: fee}("");
        (bool s2, ) = escrow.freelancer.call{value: payout}("");
        require(s1 && s2, "Transfer failed");
        
        emit MilestoneApproved(escrowId, milestoneId, payout);
        emit PaymentReleased(escrowId, escrow.freelancer, payout);
        
        // Start next milestone if available
        if (milestoneId + 1 < escrow.milestones.length) {
            escrow.milestones[milestoneId + 1].status = MilestoneStatus.InProgress;
            emit MilestoneStarted(escrowId, milestoneId + 1);
        } else {
            // All milestones complete
            escrow.status = EscrowStatus.Completed;
            escrow.completedAt = block.timestamp;
            emit EscrowCompleted(escrowId);
        }
    }
    
    /**
     * @dev Dispute a milestone
     */
    function disputeMilestone(bytes32 escrowId, uint256 milestoneId) external {
        Escrow storage escrow = escrows[escrowId];
        require(msg.sender == escrow.client || msg.sender == escrow.freelancer, "Not authorized");
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(milestoneId < escrow.milestones.length, "Invalid milestone");
        
        Milestone storage milestone = escrow.milestones[milestoneId];
        milestone.status = MilestoneStatus.Disputed;
        escrow.status = EscrowStatus.Disputed;
        
        emit MilestoneDisputed(escrowId, milestoneId);
    }
    
    /**
     * @dev Get escrow details
     */
    function getEscrow(bytes32 escrowId) 
        external 
        view 
        returns (
            address client,
            address freelancer,
            uint256 totalAmount,
            EscrowStatus status,
            uint256 createdAt,
            uint256 milestoneCount
        ) 
    {
        Escrow storage escrow = escrows[escrowId];
        return (
            escrow.client,
            escrow.freelancer,
            escrow.totalAmount,
            escrow.status,
            escrow.createdAt,
            escrow.milestones.length
        );
    }
    
    /**
     * @dev Get milestone details
     */
    function getMilestone(bytes32 escrowId, uint256 milestoneId) 
        external 
        view 
        returns (Milestone memory) 
    {
        require(milestoneId < escrows[escrowId].milestones.length, "Invalid milestone");
        return escrows[escrowId].milestones[milestoneId];
    }
    
    /**
     * @dev Get all milestones for escrow
     */
    function getMilestones(bytes32 escrowId) 
        external 
        view 
        returns (Milestone[] memory) 
    {
        return escrows[escrowId].milestones;
    }
    
    /**
     * @dev Get client's escrows
     */
    function getClientEscrows(address client) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return clientEscrows[client];
    }
    
    /**
     * @dev Get freelancer's escrows
     */
    function getFreelancerEscrows(address freelancer) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return freelancerEscrows[freelancer];
    }
    
    /**
     * @dev Update platform fee
     */
    function setPlatformFee(uint256 newFeeBasis) external onlyOwner {
        require(newFeeBasis <= 1000, "Fee too high"); // Max 10%
        platformFeeBasis = newFeeBasis;
    }
}

