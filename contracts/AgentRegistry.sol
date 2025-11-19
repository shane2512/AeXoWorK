// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentRegistry is Ownable {
    struct Agent {
        address owner;
        string did;
        string metadataCID;
        uint8 agentType;
        uint8 status;
    }

    mapping(uint256 => Agent) public agents;
    mapping(string => uint256) public didToAgent;
    uint256 public nextAgentId = 1;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string did,
        string metadataCID,
        uint8 agentType
    );
    event AgentUpdated(uint256 indexed agentId, string metadataCID);
    event AgentStatusChanged(uint256 indexed agentId, uint8 status);

    function registerAgent(
        string calldata did,
        string calldata metadataCID,
        uint8 agentType
    ) external returns (uint256) {
        require(didToAgent[did] == 0, "DID in use");
        uint256 id = nextAgentId++;
        agents[id] = Agent(msg.sender, did, metadataCID, agentType, 0);
        didToAgent[did] = id;
        emit AgentRegistered(id, msg.sender, did, metadataCID, agentType);
        return id;
    }

    function updateAgent(uint256 id, string calldata metadataCID) external {
        require(
            agents[id].owner == msg.sender || owner() == msg.sender,
            "not authorized"
        );
        agents[id].metadataCID = metadataCID;
        emit AgentUpdated(id, metadataCID);
    }

    function setAgentStatus(uint256 id, uint8 status) external {
        require(
            agents[id].owner == msg.sender || owner() == msg.sender,
            "not authorized"
        );
        agents[id].status = status;
        emit AgentStatusChanged(id, status);
    }

    function resolveAgentByDID(string calldata did)
        external
        view
        returns (uint256)
    {
        return didToAgent[did];
    }
}

