// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Arbitration is Ownable {
    enum Ruling {
        None,
        Client,
        Freelancer,
        Split
    }

    struct Dispute {
        bytes32 escrowId;
        address opener;
        string evidenceCID;
        Ruling ruling;
        bool resolved;
    }

    uint256 public nextDispute = 1;
    mapping(uint256 => Dispute) public disputes;

    event DisputeOpened(
        uint256 disputeId,
        bytes32 escrowId,
        address opener,
        string evidenceCID
    );
    event DisputeResolved(uint256 disputeId, Ruling ruling);

    function openDispute(bytes32 escrowId, string calldata evidenceCID)
        external
        returns (uint256)
    {
        uint256 id = nextDispute++;
        disputes[id] = Dispute(
            escrowId,
            msg.sender,
            evidenceCID,
            Ruling.None,
            false
        );
        emit DisputeOpened(id, escrowId, msg.sender, evidenceCID);
        return id;
    }

    // In prod, restrict to juror/DAO multisig via onlyOwner or role-based access
    function resolveDispute(uint256 disputeId, Ruling ruling)
        external
        onlyOwner
    {
        Dispute storage d = disputes[disputeId];
        require(!d.resolved, "resolved");
        d.ruling = ruling;
        d.resolved = true;
        emit DisputeResolved(disputeId, ruling);
    }
}

