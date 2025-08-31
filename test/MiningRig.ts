import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.connect();
const {time} = networkHelpers

describe("MiningRig Contracts", function () {
    let miningRigShare: any;
    let miningRigOwnership: any;
    let owner: any;
    let user1: any;
    let user2: any;
    let deploymentBlockNumber: number;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        const MiningRigShare = await ethers.getContractFactory("MiningRigShare");
        miningRigShare = await MiningRigShare.deploy();
        await miningRigShare.waitForDeployment();

        const MiningRigOwnership = await ethers.getContractFactory("MiningRigOwnership");
        miningRigOwnership = await MiningRigOwnership.deploy(await miningRigShare.getAddress());
        await miningRigOwnership.waitForDeployment();

        deploymentBlockNumber = await ethers.provider.getBlockNumber();
    });

    it("Should emit SharesMinted when minting shares", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await expect(miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001")))
            .to.emit(miningRigShare, "SharesMinted")
            .withArgs(100n);

        expect(await miningRigShare.balanceOf(owner.address, 1)).to.equal(100n);
        expect(await miningRigShare.MINTED()).to.equal(true);
    });

    it("Should emit MiningRigRegistered when registering", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await expect(miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001")))
            .to.emit(miningRigOwnership, "MiningRigRegistered")
            .withArgs(owner.address, 100n, 100n);

        const registerInfo = await miningRigOwnership.registerMiningInfo(owner.address);
        expect(registerInfo.isRegistered).to.equal(true);
        expect(registerInfo.totalShares).to.equal(100n);
    });

    it("Should emit SharesBought and track total shares bought", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));

        const amounts = [3n, 5n, 2n];
        for (const amount of amounts) {
            await miningRigOwnership.connect(user1).buyShares(amount, 1, { value: amount * ethers.parseEther("0.001") });
        }

        const events = await miningRigOwnership.queryFilter(
            miningRigOwnership.filters.SharesBought(),
            deploymentBlockNumber,
            "latest"
        );

        let totalSharesBought = 0n;
        for (const event of events) {
            totalSharesBought += event.args.amount;
        }

        expect(totalSharesBought).to.equal(10n);
        expect(await miningRigShare.balanceOf(user1.address, 1)).to.equal(totalSharesBought);
        const userInfo = await miningRigOwnership.userInfo(user1.address);
        expect(userInfo.sharesBought).to.equal(totalSharesBought);
    });

    it("Should emit RewardsDeposited and track total rewards", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));

        const deposits = [ethers.parseEther("0.5"), ethers.parseEther("0.3")];
        for (const amount of deposits) {
            await miningRigOwnership.connect(owner).depositRewards({ value: amount });
        }

        const events = await miningRigOwnership.queryFilter(
            miningRigOwnership.filters.RewardsDeposited(),
            deploymentBlockNumber,
            "latest"
        );

        let totalDeposited = 0n;
        for (const event of events) {
            totalDeposited += event.args.amount;
        }

        expect(totalDeposited).to.equal(ethers.parseEther("0.8"));
        const registerInfo = await miningRigOwnership.registerMiningInfo(owner.address);
        expect(registerInfo.depositedRewards).to.equal(totalDeposited);
    });

    it("Should emit RewardsClaimed and deduct rewards correctly", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });

        await time.increase(121);

        const expectedReward = ethers.parseUnits("500", "wei"); // 5 shares * 100 wei/share = 500 wei
        const claimTx = await miningRigOwnership.connect(user1).claimRewards();
        const receipt = await claimTx.wait(); 

        const userInfo = await miningRigOwnership.userInfo(user1.address);
        expect(userInfo.hasRewardClaimed).to.equal(true);
        expect(userInfo.claimedAmount).to.equal(expectedReward);

        const registerInfo = await miningRigOwnership.registerMiningInfo(owner.address);
        expect(registerInfo.depositedRewards).to.equal(ethers.parseEther("1") - expectedReward);
    });

    it("Should emit TokensTransferred and update balances", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });
        await time.increase(121);
        await miningRigOwnership.connect(user1).claimRewards();

        await miningRigShare.connect(user1).setApprovalForAll(await miningRigOwnership.getAddress(), true);

        await expect(miningRigOwnership.connect(user1).transferToken(user2.address, 3, 1))
            .to.emit(miningRigOwnership, "TokensTransferred")
            .withArgs(user1.address, user2.address, 3n);

        expect(await miningRigShare.balanceOf(user1.address, 1)).to.equal(2n);
        expect(await miningRigShare.balanceOf(user2.address, 1)).to.equal(3n);
    });

    it("Should revert if buying exceeds per-wallet cap", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(user1).buyShares(10, 1, { value: ethers.parseEther("0.01") });
        await expect(miningRigOwnership.connect(user1).buyShares(1, 1, { value: ethers.parseEther("0.001") }))
            .to.be.revertedWith("Exceeds max shares per wallet");
    });

    it("Should revert if claiming before lock period", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });
        await expect(miningRigOwnership.connect(user1).claimRewards())
            .to.be.revertedWith("Your claim lock period not over");
    });

    it("Should revert if registering mining rig twice", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await expect(miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001")))
            .to.be.revertedWith("Already registered");
    });

    it("Should revert if minting shares twice", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await expect(miningRigShare.connect(owner).mint())
            .to.be.revertedWith("Shares already minted");
    });

    it("Should revert if buying more than remaining shares", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await expect(miningRigOwnership.connect(user1).buyShares(101, 1, { value: ethers.parseEther("0.101") }))
            .to.be.revertedWith("Insufficient shares available");
    });

    it("Should revert if depositing zero rewards", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await expect(miningRigOwnership.connect(owner).depositRewards({ value: 0 }))
            .to.be.revertedWith("Deposit amount must be greater than zero");
    });

    it("Should revert if claiming with no shares", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await time.increase(121);
        await expect(miningRigOwnership.connect(user1).claimRewards())
            .to.be.revertedWith("No shares bought");
    });

    it("Should revert if claiming rewards twice", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });
        await time.increase(121);
        await miningRigOwnership.connect(user1).claimRewards();
        await expect(miningRigOwnership.connect(user1).claimRewards())
            .to.be.revertedWith("Already claimed");
    });

    it("Should revert if transferring without claiming rewards", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });
        await miningRigShare.connect(user1).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await expect(miningRigOwnership.connect(user1).transferToken(user2.address, 3, 1))
            .to.be.revertedWith("Need to Claim reward First before transfer");
    });

    it("Should revert if transferring more than balance", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });
        await time.increase(121);
        await miningRigOwnership.connect(user1).claimRewards();
        await miningRigShare.connect(user1).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await expect(miningRigOwnership.connect(user1).transferToken(user2.address, 6, 1))
            .to.be.revertedWith("Insufficient token balance");
    });

    it("Should revert if non-owner tries to register", async function () {
        await expect(miningRigOwnership.connect(user1).registerMiningRig(100, ethers.parseEther("0.001")))
            .to.be.revertedWithCustomError(miningRigOwnership, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
    });

    it("Should revert if non-owner tries to deposit rewards", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await expect(miningRigOwnership.connect(user1).depositRewards({ value: ethers.parseEther("0.1") }))
            .to.be.revertedWithCustomError(miningRigOwnership, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
    });

    it("Should revert if buying with incorrect ETH amount", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await expect(miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.004") }))
            .to.be.revertedWith("Incorrect ETH payment");
    });

    it("Should revert if claiming with insufficient deposited rewards", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: 400n }); // Less than 5*100=500
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });
        await time.increase(121);
        await expect(miningRigOwnership.connect(user1).claimRewards())
            .to.be.revertedWith("Insufficient liquidity deposited");
    });

    it("Should revert if transferring to zero address", async function () {
        await miningRigShare.connect(owner).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await miningRigOwnership.connect(owner).registerMiningRig(100, ethers.parseEther("0.001"));
        await miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("1") });
        await miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") });
        await time.increase(121);
        await miningRigOwnership.connect(user1).claimRewards();
        await miningRigShare.connect(user1).setApprovalForAll(await miningRigOwnership.getAddress(), true);
        await expect(miningRigOwnership.connect(user1).transferToken(ethers.ZeroAddress, 3, 1))
            .to.be.revertedWith("Cannot transfer to zero address");
    });

    it("Should revert if buying without registration", async function () {
        await expect(miningRigOwnership.connect(user1).buyShares(5, 1, { value: ethers.parseEther("0.005") }))
            .to.be.revertedWith("Mining rig not registered");
    });

    it("Should revert if depositing without registration", async function () {
        await expect(miningRigOwnership.connect(owner).depositRewards({ value: ethers.parseEther("0.1") }))
            .to.be.revertedWith("Mining rig not registered");
    });
});