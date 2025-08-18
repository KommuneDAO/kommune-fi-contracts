require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("@nomicfoundation/hardhat-verify");
require("hardhat-contract-sizer");
require("dotenv").config();

const { KAIA_PRIVATE_KEY, KAIROS_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.22",
        settings: {
          evmVersion: "paris",
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1,
            details: {
              yul: true,
              yulDetails: {
                stackAllocation: true,
                optimizerSteps: "dhfoDgvulfnTUtnIf"
              }
            }
          },
          metadata: {
            bytecodeHash: "none"
          }
        },
      },
      {
        version: "0.5.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    kaia: {
      url: "https://klaytn-en.kommunedao.xyz:8651",
      chainId: 8217,
      accounts: [KAIA_PRIVATE_KEY],
      timeout: 600000, // 10 minutes
    },
    kairos: {
      url: "https://responsive-green-emerald.kaia-kairos.quiknode.pro", // QuickNode - rate limited
      // url: "https://public-en-kairos.node.kaia.io", // Official Kairos RPC
      chainId: 1001,
      accounts: [KAIROS_PRIVATE_KEY],
      timeout: 600000, // 10 minutes
    },
  },
  mocha: {
    timeout: 600000, // 10 minutes for test timeout
  },
};
