// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DataMarketplace
 * @dev Marketplace for buying/selling datasets, AI models, APIs
 * Supports A2A micropayments for automatic data purchases
 */
contract DataMarketplace is Ownable, ReentrancyGuard {
    
    enum DataType { Dataset, AIModel, API, PromptTemplate, Other }
    enum PricingModel { PerUse, Subscription, Unlimited }
    enum AccessLevel { Public, Gated, Private }
    
    struct DataListing {
        bytes32 listingId;
        address provider;
        string name;
        string description;
        DataType dataType;
        string metadataURI; // IPFS with full details
        string sampleDataURI; // IPFS with sample/preview
        PricingModel pricingModel;
        uint256 pricePerUse; // in HBAR (wei)
        uint256 subscriptionPrice; // monthly, in HBAR
        uint256 unlimitedPrice; // one-time, in HBAR
        AccessLevel accessLevel;
        bool active;
        uint256 totalPurchases;
        uint256 totalRevenue;
        uint256 createdAt;
    }
    
    struct Purchase {
        bytes32 purchaseId;
        bytes32 listingId;
        address buyer;
        PricingModel model;
        uint256 amount;
        uint256 purchasedAt;
        uint256 expiresAt; // for subscriptions
        string accessTokenURI; // IPFS with access credentials
    }
    
    // Mappings
    mapping(bytes32 => DataListing) public listings;
    mapping(address => bytes32[]) public providerListings;
    mapping(bytes32 => Purchase[]) public listingPurchases;
    mapping(address => bytes32[]) public buyerPurchases;
    mapping(bytes32 => mapping(address => bool)) public hasAccess;
    
    // Platform fee (basis points, 100 = 1%)
    uint256 public platformFeeBasis = 250; // 2.5%
    address public feeRecipient;
    
    // Events
    event ListingCreated(bytes32 indexed listingId, address indexed provider, string name);
    event ListingUpdated(bytes32 indexed listingId);
    event ListingDeactivated(bytes32 indexed listingId);
    event DataPurchased(bytes32 indexed purchaseId, bytes32 indexed listingId, address indexed buyer, uint256 amount);
    event AccessGranted(bytes32 indexed listingId, address indexed buyer);
    event RevenueWithdrawn(address indexed provider, uint256 amount);
    
    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Create a new data listing
     */
    function createListing(
        string calldata name,
        string calldata description,
        DataType dataType,
        string calldata metadataURI,
        string calldata sampleDataURI,
        PricingModel pricingModel,
        uint256 pricePerUse,
        uint256 subscriptionPrice,
        uint256 unlimitedPrice,
        AccessLevel accessLevel
    ) external returns (bytes32) {
        bytes32 listingId = keccak256(abi.encodePacked(msg.sender, name, block.timestamp));
        
        listings[listingId] = DataListing({
            listingId: listingId,
            provider: msg.sender,
            name: name,
            description: description,
            dataType: dataType,
            metadataURI: metadataURI,
            sampleDataURI: sampleDataURI,
            pricingModel: pricingModel,
            pricePerUse: pricePerUse,
            subscriptionPrice: subscriptionPrice,
            unlimitedPrice: unlimitedPrice,
            accessLevel: accessLevel,
            active: true,
            totalPurchases: 0,
            totalRevenue: 0,
            createdAt: block.timestamp
        });
        
        providerListings[msg.sender].push(listingId);
        
        emit ListingCreated(listingId, msg.sender, name);
        return listingId;
    }
    
    /**
     * @dev Purchase data (supports all pricing models)
     */
    function purchaseData(bytes32 listingId, PricingModel model) 
        external 
        payable 
        nonReentrant 
        returns (bytes32) 
    {
        DataListing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        
        uint256 price;
        uint256 expiresAt;
        
        if (model == PricingModel.PerUse) {
            price = listing.pricePerUse;
            expiresAt = 0; // no expiration
        } else if (model == PricingModel.Subscription) {
            price = listing.subscriptionPrice;
            expiresAt = block.timestamp + 30 days;
        } else if (model == PricingModel.Unlimited) {
            price = listing.unlimitedPrice;
            expiresAt = type(uint256).max; // never expires
        }
        
        require(msg.value >= price, "Insufficient payment");
        
        bytes32 purchaseId = keccak256(abi.encodePacked(listingId, msg.sender, block.timestamp));
        
        // Create purchase record
        Purchase memory purchase = Purchase({
            purchaseId: purchaseId,
            listingId: listingId,
            buyer: msg.sender,
            model: model,
            amount: price,
            purchasedAt: block.timestamp,
            expiresAt: expiresAt,
            accessTokenURI: "" // Set by provider off-chain
        });
        
        listingPurchases[listingId].push(purchase);
        buyerPurchases[msg.sender].push(purchaseId);
        
        // Grant access
        hasAccess[listingId][msg.sender] = true;
        
        // Update listing stats
        listing.totalPurchases++;
        listing.totalRevenue += price;
        
        // Calculate and transfer fees
        uint256 fee = (price * platformFeeBasis) / 10000;
        uint256 providerAmount = price - fee;
        
        (bool s1, ) = feeRecipient.call{value: fee}("");
        (bool s2, ) = listing.provider.call{value: providerAmount}("");
        require(s1 && s2, "Transfer failed");
        
        // Refund excess
        if (msg.value > price) {
            (bool s3, ) = msg.sender.call{value: msg.value - price}("");
            require(s3, "Refund failed");
        }
        
        emit DataPurchased(purchaseId, listingId, msg.sender, price);
        emit AccessGranted(listingId, msg.sender);
        
        return purchaseId;
    }
    
    /**
     * @dev Check if buyer has access to listing
     */
    function checkAccess(bytes32 listingId, address buyer) 
        external 
        view 
        returns (bool) 
    {
        return hasAccess[listingId][buyer];
    }
    
    /**
     * @dev Get listing details
     */
    function getListing(bytes32 listingId) 
        external 
        view 
        returns (DataListing memory) 
    {
        return listings[listingId];
    }
    
    /**
     * @dev Get provider's listings
     */
    function getProviderListings(address provider) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return providerListings[provider];
    }
    
    /**
     * @dev Get buyer's purchases
     */
    function getBuyerPurchases(address buyer) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return buyerPurchases[buyer];
    }
    
    /**
     * @dev Deactivate listing
     */
    function deactivateListing(bytes32 listingId) external {
        require(listings[listingId].provider == msg.sender, "Not provider");
        listings[listingId].active = false;
        emit ListingDeactivated(listingId);
    }
    
    /**
     * @dev Update platform fee
     */
    function setPlatformFee(uint256 newFeeBasis) external onlyOwner {
        require(newFeeBasis <= 1000, "Fee too high"); // Max 10%
        platformFeeBasis = newFeeBasis;
    }
}

