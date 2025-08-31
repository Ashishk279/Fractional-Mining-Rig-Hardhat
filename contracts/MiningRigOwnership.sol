// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./MiningRigShare.sol";

contract MiningRigOwnership is Ownable, ReentrancyGuard {
    MiningRigShare public immutable shareToken;

    uint8 public CAP_PER_WALLET = 10;
    uint256 public CLAIM_LOCK_PERIOD = 2 minutes;

    struct RegisterMiningInfo {
        uint8 shareId;
        address ownerAddress;
        uint256 totalShares;
        uint256 remainingShares;
        uint256 depositedRewards;
        uint256 perShareValue;
        uint256 rewardPerShare;
        bool isRegistered;
    }

    struct UserInfo {
        uint8 shareId;
        address userAddress;
        uint256 sharesBought;
        bool hasRewardClaimed;
        uint256 claimTimestamp;
        uint256 claimedAmount;
    }

    mapping(address => UserInfo) public userInfo;
    mapping(address => RegisterMiningInfo) public registerMiningInfo;

    event SharesBought(address indexed buyer, uint256 amount, uint256 paidEth);
    event RewardsDeposited(uint256 amount);
    event RewardsClaimed(address indexed claimer, uint256 amount);
    event ClaimStartTimeSet(uint256 time);
    event MiningRigRegistered(address owner, uint256 rewardPerShare, uint256 claimStartTime);
    event TokensTransferred(address indexed from, address indexed to, uint256 amount);

    constructor(address _shareToken) Ownable(msg.sender) {
        require(_shareToken != address(0), "Invalid share token address");
        shareToken = MiningRigShare(_shareToken);
        shareToken.setMiningRigOwnershipAddress(address(this));
    }

    function registerMiningRig(uint256 _rewardPerShare, uint256 _perShareValue) external onlyOwner {
        RegisterMiningInfo memory register = registerMiningInfo[msg.sender];
        require(!register.isRegistered, "Already registered");

        require(
            shareToken.isApprovedForAll(msg.sender, address(this)),
            "Please approve this contract"
        );
        shareToken.mint();
        register.shareId = shareToken.SHARE_ID();
        register.ownerAddress = msg.sender;
        register.totalShares = shareToken.TOTAL_SHARES();
        register.remainingShares = register.totalShares;
        register.perShareValue = _perShareValue;
        register.rewardPerShare = _rewardPerShare;
        register.isRegistered = true;
        registerMiningInfo[msg.sender] = register;

        emit MiningRigRegistered(
            msg.sender,
            register.totalShares,
            _rewardPerShare
        );
    }

    function buyShares(uint256 _amount, uint256 _shareId) external payable {
        RegisterMiningInfo memory register = registerMiningInfo[owner()];
        require(register.isRegistered, "Mining rig not registered");

        require(
            register.remainingShares >= _amount,
            "Insufficient shares available"
        );
        require(_shareId == shareToken.SHARE_ID(), "Invalid share ID");

        // Enforce per-wallet cap (current balance + amount <= 10)
        uint256 currentBalance = shareToken.balanceOf(msg.sender, _shareId);
        require(
            currentBalance + _amount <= CAP_PER_WALLET,
            "Exceeds max shares per wallet"
        );

        require(msg.value == _amount * register.perShareValue, "Incorrect ETH payment");

        // Transfer shares
        shareToken.safeTransferFrom(register.ownerAddress, msg.sender, _shareId, _amount, "");

        // Update structs (use memory for temp)
        UserInfo memory user = userInfo[msg.sender];

        user.userAddress = msg.sender;
        user.shareId = uint8(_shareId);
        user.sharesBought += _amount;
        user.claimTimestamp = block.timestamp + CLAIM_LOCK_PERIOD; // Per-user lock

        register.remainingShares -= _amount;

        registerMiningInfo[owner()] = register;
        userInfo[msg.sender] = user;

        emit SharesBought(msg.sender, _amount, msg.value);
    }

    function depositRewards() external payable onlyOwner {
        RegisterMiningInfo memory register = registerMiningInfo[msg.sender];
        require(register.isRegistered, "Mining rig not registered");
        require(msg.value > 0, "Deposit amount must be greater than zero");

        register.depositedRewards += msg.value;

        registerMiningInfo[msg.sender] = register;
        emit RewardsDeposited(msg.value);
    }

    function claimRewards() external nonReentrant {
        RegisterMiningInfo memory register = registerMiningInfo[owner()];
        UserInfo memory user = userInfo[msg.sender];
        require(!user.hasRewardClaimed, "Already claimed");
        require(
            block.timestamp >= user.claimTimestamp,
            "Your claim lock period not over"
        );
        require(user.sharesBought > 0, "No shares bought");

        uint256 toClaim = user.sharesBought * register.rewardPerShare;
        require(
            register.depositedRewards >= toClaim,
            "Insufficient liquidity deposited"
        );

        // Deduct from deposited
        register.depositedRewards -= toClaim;

        user.hasRewardClaimed = true;
        user.claimedAmount += toClaim;

        (bool success, ) = payable(msg.sender).call{value: toClaim}("");
        require(success, "ETH transfer failed");

        registerMiningInfo[owner()] = register;
        userInfo[msg.sender] = user;

        emit RewardsClaimed(msg.sender, toClaim);
    }

    function transferToken(address to, uint256 amount, uint8 shareId) external {
        require(to != address(0), "Cannot transfer to zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= shareToken.balanceOf(msg.sender, shareId), "Insufficient token balance");
        UserInfo memory user = userInfo[msg.sender];
        require(user.hasRewardClaimed, "Need to Claim reward First before transfer");
        require(
            shareToken.isApprovedForAll(msg.sender, address(this)),
            "Please approve this contract"
        );

        // Perform the transfer using safeTransferFrom
        shareToken.safeTransferFrom(msg.sender, to, shareId, amount, "");

        emit TokensTransferred(msg.sender, to, amount);
    }
}
