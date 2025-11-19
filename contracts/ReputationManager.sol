// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ReputationManager is Ownable {
    mapping(address => int256) public scores;
    mapping(address => string[]) public history;

    event ReputationChanged(
        address indexed subject,
        int256 delta,
        int256 newScore,
        string evidenceCID
    );

    function recordEvent(
        address subject,
        int256 delta,
        string calldata evidenceCID
    ) external onlyOwner {
        scores[subject] += delta;
        history[subject].push(evidenceCID);
        emit ReputationChanged(subject, delta, scores[subject], evidenceCID);
    }

    function getScore(address subject) external view returns (int256) {
        return scores[subject];
    }

    function getHistory(address subject)
        external
        view
        returns (string[] memory)
    {
        return history[subject];
    }
}

