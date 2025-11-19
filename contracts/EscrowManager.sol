// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EscrowManager is ReentrancyGuard, Ownable {
    enum EscrowStatus {
        None,
        Created,
        Funded,
        Delivered,
        Disputed,
        Released,
        Refunded
    }

    struct Escrow {
        address client;
        address payable freelancer;
        uint256 amount;
        EscrowStatus status;
        address verifier;
        uint256 createdAt;
    }

    mapping(bytes32 => Escrow) public escrows;
    uint256 public platformFeeBasis = 200; // 2% default
    address public feeRecipient;

    event EscrowCreated(
        bytes32 indexed escrowId,
        address client,
        address freelancer,
        uint256 amount
    );
    event EscrowFunded(bytes32 indexed escrowId, uint256 amount);
    event DeliverySubmitted(bytes32 indexed escrowId, string deliveryCID);
    event EscrowReleased(
        bytes32 indexed escrowId,
        address to,
        uint256 amount,
        uint256 fee
    );
    event EscrowRefunded(bytes32 indexed escrowId, address to, uint256 amount);
    event DisputeOpened(
        bytes32 indexed escrowId,
        address by,
        string evidenceCID
    );

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    function createEscrow(bytes32 escrowId, address payable freelancer)
        external
    {
        require(escrows[escrowId].status == EscrowStatus.None, "exists");
        escrows[escrowId] = Escrow(
            msg.sender,
            freelancer,
            0,
            EscrowStatus.Created,
            address(0),
            block.timestamp
        );
        emit EscrowCreated(escrowId, msg.sender, freelancer, 0);
    }

    function fundEscrow(bytes32 escrowId) external payable nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Created, "invalid state");
        require(msg.sender == e.client, "only client");
        require(msg.value > 0, "zero");
        e.amount += msg.value;
        e.status = EscrowStatus.Funded;
        emit EscrowFunded(escrowId, msg.value);
    }

    function submitDelivery(bytes32 escrowId, string calldata deliveryCID)
        external
    {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Funded, "not funded");
        require(msg.sender == e.freelancer, "only freelancer");
        e.status = EscrowStatus.Delivered;
        emit DeliverySubmitted(escrowId, deliveryCID);
    }

    function approveWork(bytes32 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(e.status == EscrowStatus.Delivered, "not delivered");
        require(msg.sender == e.client, "only client");
        uint256 amount = e.amount;
        require(amount > 0, "no funds");
        uint256 fee = (amount * platformFeeBasis) / 10000;
        uint256 payout = amount - fee;
        e.amount = 0;
        e.status = EscrowStatus.Released;
        (bool s1, ) = feeRecipient.call{value: fee}("");
        (bool s2, ) = e.freelancer.call{value: payout}("");
        require(s1 && s2, "transfer failed");
        emit EscrowReleased(escrowId, e.freelancer, payout, fee);
    }

    function raiseDispute(bytes32 escrowId, string calldata evidenceCID)
        external
    {
        Escrow storage e = escrows[escrowId];
        require(
            e.status == EscrowStatus.Delivered ||
                e.status == EscrowStatus.Funded,
            "invalid state"
        );
        e.status = EscrowStatus.Disputed;
        emit DisputeOpened(escrowId, msg.sender, evidenceCID);
    }

    function refundClient(bytes32 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        require(
            e.status == EscrowStatus.Disputed || e.status == EscrowStatus.Funded,
            "no refund"
        );
        require(
            msg.sender == e.client || owner() == msg.sender,
            "not authorized"
        );
        uint256 amount = e.amount;
        e.amount = 0;
        e.status = EscrowStatus.Refunded;
        (bool s, ) = payable(e.client).call{value: amount}("");
        require(s, "refund failed");
        emit EscrowRefunded(escrowId, e.client, amount);
    }

    // Admin functions
    function setPlatformFee(uint256 basis) external onlyOwner {
        platformFeeBasis = basis;
    }

    function setFeeRecipient(address r) external onlyOwner {
        feeRecipient = r;
    }
}

