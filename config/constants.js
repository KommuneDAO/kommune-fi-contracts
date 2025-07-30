const { ChainId } = require("./config");

// Common
// const basisPointsFees = 1000; // 10%
// const investRatio = 10000; // 100%

// Kaia Mainnet
// const asset = "0xdec2cc84f0a37ef917f63212fe8ba7494b0e4b15"; // WKaia 주소
// const koKaia = "0xa1338309658d3da331c747518d0bb414031f22fd"; // KoKaia 컨트랙 주소
// const vault = "0xbF1f3C783C8f6f4582c0a0508f2790b4E2C2E581"; // Kommune-Fi vault 컨트랙 주소
// const treasury = "0xDdb24eCaF1cCeF3dd3BcF2e2b93A231e809B89B0"; // Treasury 주소

// Kaia Kairos Testnet
// const asset = "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106"; // WKaia 주소
// const koKaia = "0xb15782efbc2034e366670599f3997f94c7333ff9"; // KoKaia 컨트랙 주소
// const vault = "0x1c9074AA147648567015287B0d4185Cb4E04F86d"; // Kommune-Fi vault 컨트랙 주소
// const treasury = "0xDdb24eCaF1cCeF3dd3BcF2e2b93A231e809B89B0"; // Treasury 주소

const contracts = {
  wkaia: {
    [ChainId.KAIA]: "0xdec2cc84f0a37ef917f63212fe8ba7494b0e4b15",
    [ChainId.KAIROS]: "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106",
  },
  koKaia: {
    [ChainId.KAIA]: "0xa1338309658d3da331c747518d0bb414031f22fd",
    [ChainId.KAIROS]: "0xb15782efbc2034e366670599f3997f94c7333ff9",
  },
  vault: {
    [ChainId.KAIA]: "0xbF1f3C783C8f6f4582c0a0508f2790b4E2C2E581",
    [ChainId.KAIROS]: "0x1c9074AA147648567015287B0d4185Cb4E04F86d",
  },
  treasury: {
    [ChainId.KAIA]: "0x0d7Aea5B64cABC760540a298eefde492f1740d5D",
    [ChainId.KAIROS]: "0xDdb24eCaF1cCeF3dd3BcF2e2b93A231e809B89B0",
  },
};

const basisPointsFees = 1000; // 10%
const investRatio = 10000; // 100%

module.exports = { contracts, basisPointsFees, investRatio };
