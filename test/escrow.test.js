const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("EscrowManager", function () {
  let escrowManager;
  let owner, client, freelancer;
  let escrowId;

  beforeEach(async function () {
    [owner, client, freelancer] = await ethers.getSigners();

    const EscrowManager = await ethers.getContractFactory("EscrowManager");
    escrowManager = await EscrowManager.deploy(owner.address);
    await escrowManager.deployed();

    // Create a sample escrow ID
    escrowId = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("test-escrow-" + Date.now())
    );
  });

  describe("Escrow Creation", function () {
    it("Should create a new escrow", async function () {
      await escrowManager
        .connect(client)
        .createEscrow(escrowId, freelancer.address);

      const escrow = await escrowManager.escrows(escrowId);
      expect(escrow.client).to.equal(client.address);
      expect(escrow.freelancer).to.equal(freelancer.address);
      expect(escrow.status).to.equal(1); // Created
    });

    it("Should not allow duplicate escrow IDs", async function () {
      await escrowManager
        .connect(client)
        .createEscrow(escrowId, freelancer.address);

      await expect(
        escrowManager.connect(client).createEscrow(escrowId, freelancer.address)
      ).to.be.reverted;
    });
  });

  describe("Escrow Funding", function () {
    beforeEach(async function () {
      await escrowManager
        .connect(client)
        .createEscrow(escrowId, freelancer.address);
    });

    it("Should fund an escrow", async function () {
      const amount = ethers.utils.parseEther("1.0");
      await escrowManager
        .connect(client)
        .fundEscrow(escrowId, { value: amount });

      const escrow = await escrowManager.escrows(escrowId);
      expect(escrow.amount).to.equal(amount);
      expect(escrow.status).to.equal(2); // Funded
    });

    it("Should only allow client to fund", async function () {
      const amount = ethers.utils.parseEther("1.0");
      await expect(
        escrowManager.connect(freelancer).fundEscrow(escrowId, { value: amount })
      ).to.be.revertedWith("only client");
    });

    it("Should not allow zero funding", async function () {
      await expect(
        escrowManager.connect(client).fundEscrow(escrowId, { value: 0 })
      ).to.be.revertedWith("zero");
    });
  });

  describe("Delivery Submission", function () {
    beforeEach(async function () {
      await escrowManager
        .connect(client)
        .createEscrow(escrowId, freelancer.address);
      const amount = ethers.utils.parseEther("1.0");
      await escrowManager
        .connect(client)
        .fundEscrow(escrowId, { value: amount });
    });

    it("Should allow freelancer to submit delivery", async function () {
      const deliveryCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      await escrowManager
        .connect(freelancer)
        .submitDelivery(escrowId, deliveryCID);

      const escrow = await escrowManager.escrows(escrowId);
      expect(escrow.status).to.equal(3); // Delivered
    });

    it("Should only allow freelancer to submit", async function () {
      const deliveryCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      await expect(
        escrowManager.connect(client).submitDelivery(escrowId, deliveryCID)
      ).to.be.revertedWith("only freelancer");
    });
  });

  describe("Work Approval and Payment", function () {
    beforeEach(async function () {
      await escrowManager
        .connect(client)
        .createEscrow(escrowId, freelancer.address);
      const amount = ethers.utils.parseEther("1.0");
      await escrowManager
        .connect(client)
        .fundEscrow(escrowId, { value: amount });
      const deliveryCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      await escrowManager
        .connect(freelancer)
        .submitDelivery(escrowId, deliveryCID);
    });

    it("Should release payment to freelancer", async function () {
      const initialBalance = await freelancer.getBalance();
      
      await escrowManager.connect(client).approveWork(escrowId);

      const escrow = await escrowManager.escrows(escrowId);
      expect(escrow.status).to.equal(5); // Released
      expect(escrow.amount).to.equal(0);

      const finalBalance = await freelancer.getBalance();
      // Check freelancer received payment (minus gas)
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should deduct platform fee", async function () {
      const amount = ethers.utils.parseEther("1.0");
      const platformFeeBasis = await escrowManager.platformFeeBasis();
      const expectedFee = amount.mul(platformFeeBasis).div(10000);

      const ownerInitialBalance = await owner.getBalance();
      
      await escrowManager.connect(client).approveWork(escrowId);

      const ownerFinalBalance = await owner.getBalance();
      const feeReceived = ownerFinalBalance.sub(ownerInitialBalance);
      
      expect(feeReceived).to.equal(expectedFee);
    });

    it("Should only allow client to approve", async function () {
      await expect(
        escrowManager.connect(freelancer).approveWork(escrowId)
      ).to.be.revertedWith("only client");
    });
  });

  describe("Dispute Handling", function () {
    beforeEach(async function () {
      await escrowManager
        .connect(client)
        .createEscrow(escrowId, freelancer.address);
      const amount = ethers.utils.parseEther("1.0");
      await escrowManager
        .connect(client)
        .fundEscrow(escrowId, { value: amount });
    });

    it("Should allow raising dispute", async function () {
      const evidenceCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      await escrowManager
        .connect(client)
        .raiseDispute(escrowId, evidenceCID);

      const escrow = await escrowManager.escrows(escrowId);
      expect(escrow.status).to.equal(4); // Disputed
    });

    it("Should allow refund after dispute", async function () {
      const evidenceCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
      await escrowManager
        .connect(client)
        .raiseDispute(escrowId, evidenceCID);

      const initialBalance = await client.getBalance();
      
      await escrowManager.connect(client).refundClient(escrowId);

      const escrow = await escrowManager.escrows(escrowId);
      expect(escrow.status).to.equal(6); // Refunded
      expect(escrow.amount).to.equal(0);

      const finalBalance = await client.getBalance();
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set platform fee", async function () {
      await escrowManager.connect(owner).setPlatformFee(300); // 3%
      expect(await escrowManager.platformFeeBasis()).to.equal(300);
    });

    it("Should not allow non-owner to set fee", async function () {
      await expect(
        escrowManager.connect(client).setPlatformFee(300)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to change fee recipient", async function () {
      await escrowManager.connect(owner).setFeeRecipient(client.address);
      expect(await escrowManager.feeRecipient()).to.equal(client.address);
    });
  });
});

