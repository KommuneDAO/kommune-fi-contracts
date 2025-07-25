require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const { KAIA_PRIVATE_KEY, KAIROS_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [{ version: "0.5.17" }, { version: "0.8.25" }],
    overrides: {
      "contracts/WKLAY.sol": { version: "0.5.17" },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    kaia: {
      url: `hhttps://public-en.node.kaia.io`,
      accounts: [KAIA_PRIVATE_KEY],
    },
    kairos: {
      url: "https://public-en-kairos.node.kaia.io",
      accounts: [KAIROS_PRIVATE_KEY],
    },
  },
};
