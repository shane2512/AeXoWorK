// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Marketplace is Ownable {
    struct Job {
        bytes32 id;
        address client;
        string jobCID;
        uint256 budget;
        uint8 status; /* 0 open, 1 assigned, 2 closed */
    }

    mapping(bytes32 => Job) public jobs;

    event JobPosted(
        bytes32 indexed jobId,
        address indexed client,
        string jobCID,
        uint256 budget
    );

    function postJob(
        bytes32 jobId,
        string calldata jobCID,
        uint256 budget
    ) external {
        require(jobs[jobId].client == address(0), "exists");
        jobs[jobId] = Job(jobId, msg.sender, jobCID, budget, 0);
        emit JobPosted(jobId, msg.sender, jobCID, budget);
    }

    function updateJobStatus(bytes32 jobId, uint8 status) external {
        Job storage j = jobs[jobId];
        require(
            j.client == msg.sender || owner() == msg.sender,
            "not authorized"
        );
        j.status = status;
    }
}

