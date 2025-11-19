// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract Proofs {
    mapping(bytes32 => string) public proofs;

    event ProofStored(bytes32 indexed escrowId, string cid);

    function storeProof(bytes32 escrowId, string calldata cid) external {
        proofs[escrowId] = cid;
        emit ProofStored(escrowId, cid);
    }

    function getProof(bytes32 escrowId) external view returns (string memory) {
        return proofs[escrowId];
    }
}

