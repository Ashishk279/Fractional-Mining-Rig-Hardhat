import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable } from "hardhat/config";

import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337, // Default Hardhat network chain ID
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
      },
      blockGasLimit: 30000000,
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    arbitrumSepolia: {
      type: "http",
      chainType: "op",
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || configVariable("ARBITRUM_SEPOLIA_RPC_URL") || "",
      accounts: process.env.ARBITRUM_SEPOLIA_PRIVATE_KEY ? [process.env.ARBITRUM_SEPOLIA_PRIVATE_KEY] : [],
      chainId: 421614, // Correct chain ID for Arbitrum Sepolia
      gasPrice: 1000000000, // 1 gwei
    },
    polygon: {
      type: "http",
      chainType: "op",
      url: process.env.POLYGON_AMOY_RPC_URL || configVariable("POLYGON_AMOY_RPC_URL") || "",
      chainId: 80002,
      accounts: process.env.POLYGON_AMOY_PRIVATE_KEY ? [process.env.POLYGON_AMOY_PRIVATE_KEY] : [],
      gasPrice: 1000000000, // 1 gwei
    },
  },
  verify: {
    etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY || configVariable("POLYGONSCAN_API_KEY") || "",
  },
  }
  
};

export default config;



// Polygon Amoy 
// MiningRigModule#MiningRigShare - 0x3bF3002257178E1cE3B74bc5c3Ab7B1A20E133D3
// MiningRigModule#MiningRigOwnership - 0x7C915e3DBc9934feC22f328bAE277488C537C5a9

// 0x2dcfC814801364B34fA00894d4832e030585298C
// https://amoy.polygonscan.com/address/0x2dcfC814801364B34fA00894d4832e030585298C#code



//  0xd4dC87783F0460106eE988f118a3dB824fF160E6
// https://amoy.polygonscan.com/address/0xd4dC87783F0460106eE988f118a3dB824fF160E6#code