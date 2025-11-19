// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title BadgeNFT
 * @dev HTS-compatible NFT Badges for achievements, milestones, and reputation
 * Soulbound (non-transferable) badges for user reputation and achievements
 */
contract BadgeNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    // Badge types
    enum BadgeType {
        FirstJob,           // Completed first job
        TenJobs,           // 10 jobs milestone
        HundredJobs,       // 100 jobs milestone
        TopRated,          // Top 10% reputation
        Specialist,        // Expert in specific skill
        Reliable,          // 95%+ success rate
        FastDelivery,      // Consistent fast delivery
        DataProvider,      // Sold 10+ datasets
        Verifier,          // 100+ verifications
        DisputeWinner,     // Won 5+ disputes
        EarlyAdopter,      // Registered in first month
        CustomBadge        // Custom achievement
    }
    
    // Badge metadata
    struct Badge {
        BadgeType badgeType;
        string name;
        string description;
        address recipient;
        uint256 issuedAt;
        string criteriaMetURI; // IPFS proof of criteria
        bool soulbound; // Cannot be transferred
    }
    
    // Mappings
    mapping(uint256 => Badge) public badges;
    mapping(address => uint256[]) public userBadges;
    mapping(address => mapping(BadgeType => bool)) public hasBadgeType;
    mapping(address => bool) public authorizedIssuers;
    
    // Badge type counts
    mapping(BadgeType => uint256) public badgeTypeCount;
    
    // Events
    event BadgeIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        BadgeType indexed badgeType,
        string name
    );
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    
    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender] || msg.sender == owner(), "Not authorized issuer");
        _;
    }
    
    constructor() ERC721("ReputeFlow Badge", "BADGE") {
        authorizedIssuers[msg.sender] = true;
    }
    
    /**
     * @dev Issue a badge to a user
     * @param recipient Address to receive badge
     * @param badgeType Type of badge
     * @param name Badge name
     * @param description Badge description
     * @param tokenURI IPFS metadata URI
     * @param criteriaMetURI IPFS proof that criteria was met
     * @param soulbound Whether badge is soulbound (non-transferable)
     */
    function issueBadge(
        address recipient,
        BadgeType badgeType,
        string calldata name,
        string calldata description,
        string calldata tokenURI,
        string calldata criteriaMetURI,
        bool soulbound
    ) external onlyIssuer returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        
        // Prevent duplicate badge types (unless custom)
        if (badgeType != BadgeType.CustomBadge) {
            require(!hasBadgeType[recipient][badgeType], "Already has this badge type");
        }
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _mint(recipient, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        badges[newTokenId] = Badge({
            badgeType: badgeType,
            name: name,
            description: description,
            recipient: recipient,
            issuedAt: block.timestamp,
            criteriaMetURI: criteriaMetURI,
            soulbound: soulbound
        });
        
        userBadges[recipient].push(newTokenId);
        hasBadgeType[recipient][badgeType] = true;
        badgeTypeCount[badgeType]++;
        
        emit BadgeIssued(newTokenId, recipient, badgeType, name);
        
        return newTokenId;
    }
    
    /**
     * @dev Override transfer to prevent soulbound badge transfers
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        require(!badges[tokenId].soulbound, "Badge is soulbound");
        super._transfer(from, to, tokenId);
        
        // Update user badges mappings
        _removeFromUserBadges(from, tokenId);
        userBadges[to].push(tokenId);
    }
    
    /**
     * @dev Remove tokenId from user's badge array
     */
    function _removeFromUserBadges(address user, uint256 tokenId) internal {
        uint256[] storage userTokens = userBadges[user];
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (userTokens[i] == tokenId) {
                userTokens[i] = userTokens[userTokens.length - 1];
                userTokens.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Get all badges owned by user
     */
    function getUserBadges(address user) external view returns (uint256[] memory) {
        return userBadges[user];
    }
    
    /**
     * @dev Get badge details
     */
    function getBadge(uint256 tokenId) external view returns (Badge memory) {
        require(_exists(tokenId), "Badge does not exist");
        return badges[tokenId];
    }
    
    /**
     * @dev Check if user has specific badge type
     */
    function hasType(address user, BadgeType badgeType) external view returns (bool) {
        return hasBadgeType[user][badgeType];
    }
    
    /**
     * @dev Get total badges issued of a type
     */
    function getBadgeTypeCount(BadgeType badgeType) external view returns (uint256) {
        return badgeTypeCount[badgeType];
    }
    
    /**
     * @dev Get user badge count
     */
    function getUserBadgeCount(address user) external view returns (uint256) {
        return userBadges[user].length;
    }
    
    /**
     * @dev Add authorized issuer
     */
    function addIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }
    
    /**
     * @dev Remove authorized issuer
     */
    function removeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }
    
    /**
     * @dev Issue "First Job" badge
     */
    function issueFirstJobBadge(address recipient, string calldata proof) 
        external 
        onlyIssuer 
        returns (uint256) 
    {
        return this.issueBadge(
            recipient,
            BadgeType.FirstJob,
            "First Job Complete",
            "Completed your first job on ReputeFlow",
            "ipfs://QmFirstJobBadge", // Should be actual IPFS URI
            proof,
            true // soulbound
        );
    }
    
    /**
     * @dev Issue "Top Rated" badge
     */
    function issueTopRatedBadge(address recipient, string calldata proof) 
        external 
        onlyIssuer 
        returns (uint256) 
    {
        return this.issueBadge(
            recipient,
            BadgeType.TopRated,
            "Top Rated",
            "Achieved top 10% reputation score",
            "ipfs://QmTopRatedBadge",
            proof,
            true // soulbound
        );
    }
    
    /**
     * @dev Issue "Reliable" badge
     */
    function issueReliableBadge(address recipient, string calldata proof) 
        external 
        onlyIssuer 
        returns (uint256) 
    {
        return this.issueBadge(
            recipient,
            BadgeType.Reliable,
            "Reliable",
            "Maintained 95%+ success rate",
            "ipfs://QmReliableBadge",
            proof,
            true // soulbound
        );
    }
}


