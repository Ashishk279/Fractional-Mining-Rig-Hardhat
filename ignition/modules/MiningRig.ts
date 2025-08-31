import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {ethers} from "ethers"
export default buildModule("MiningRigModule", (m) => {
  // Deploy MiningRigShare
  const miningRigShare = m.contract("MiningRigShare");

  // Deploy MiningRigOwnership with MiningRigShare address
  const miningRigOwnership = m.contract("MiningRigOwnership", [miningRigShare]);

//   // Set approval and register mining rig
//   m.call(miningRigShare, "setApprovalForAll", [miningRigOwnership, true]);
//   m.call(miningRigOwnership, "registerMiningRig", [100n, ethers.parseEther("0.001")]);

  return { miningRigShare, miningRigOwnership };
});