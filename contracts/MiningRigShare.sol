// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MiningRigOwnership.sol";

contract MiningRigShare is ERC1155, Ownable {
    uint8 public TOTAL_SHARES = 100;
    bool public MINTED = false;
    uint8 public SHARE_ID = 1;

    address private miningRigOwnershipContract;

    event SharesMinted(uint256 totalShares);

    constructor() ERC1155("") Ownable(msg.sender) {}

    // Owner mints all shares for specific shareId once
    function mint() external {
        require(!MINTED, "Shares already minted");
        require(
            msg.sender == miningRigOwnershipContract,
            "Only miningRigOwnershipContract mint the tokens."
        );
        MINTED = true;
        _mint(owner(), SHARE_ID, TOTAL_SHARES, "");
        emit SharesMinted(TOTAL_SHARES);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public override {
        if (from == owner()) {
            require(
                isApprovedForAll(from, msg.sender),
                "Owner transfers require approval"
            );
        }
        super.safeTransferFrom(from, to, id, value, data);
    }

    function setMiningRigOwnershipAddress(address miningRigOwnershipAddress)
        external
    {
        require(
            miningRigOwnershipContract == address(0),
            "Ownership contract already set"
        );
        miningRigOwnershipContract = miningRigOwnershipAddress;
    }
}
