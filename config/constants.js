const { ChainId } = require("./config");

const contracts = {
  wkaia: {
    [ChainId.KAIA]: "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432",
    [ChainId.KAIROS]: "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106",
  },
  koKaia: {
    [ChainId.KAIA]: "0xa1338309658d3da331c747518d0bb414031f22fd",
    [ChainId.KAIROS]: "0xb15782efbc2034e366670599f3997f94c7333ff9",
  },
  wKoKaia: {
    [ChainId.KAIA]: "0xdec2cc84f0a37ef917f63212fe8ba7494b0e4b15",
    [ChainId.KAIROS]: "0x9a93e2fcdebe43d0f8205d1cd255d709b7598317",
  },
  gcKaia: {
    [ChainId.KAIA]: "0x999999999939Ba65AbB254339eEc0b2A0daC80E9",
    [ChainId.KAIROS]: "0x4ec04f4d46d7e34ebf0c3932b65068168fdce7f6",
  },
  wGcKaia: {
    [ChainId.KAIA]: "0xa9999999c3D05Fb75cE7230e0D22F5625527d583",
    [ChainId.KAIROS]: "0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601",
  },
  stKlay: {
    [ChainId.KAIA]: "0xF80F2b22932fCEC6189b9153aA18662b15CC9C00",
    [ChainId.KAIROS]: "0x524dcff07bff606225a4fa76afa55d705b052004",
  },
  wstKlay: {
    [ChainId.KAIA]: "0x031fB2854029885E1D46b394c8B7881c8ec6AD63",
    [ChainId.KAIROS]: "0x474B49DF463E528223F244670e332fE82742e1aA",
  },
  stKaia: {
    [ChainId.KAIA]: "0x42952B873ed6f7f0A7E4992E2a9818E3A9001995",
    [ChainId.KAIROS]: "0x45886b01276c45Fe337d3758b94DD8D7F3951d97",
  },
  vault: {
    [ChainId.KAIA]: "0xbF1f3C783C8f6f4582c0a0508f2790b4E2C2E581",
    [ChainId.KAIROS]: "0x1c9074AA147648567015287B0d4185Cb4E04F86d",
  },
  treasury: {
    [ChainId.KAIA]: "0x0d7Aea5B64cABC760540a298eefde492f1740d5D",
    [ChainId.KAIROS]: "0xdc926E34E73292cD7c48c6fD7375af7D93435D36", // wallet1 for testing
  },
};

const handlers = {
    koKaia: {
        [ChainId.KAIA]: "0xa1338309658d3da331c747518d0bb414031f22fd",
        [ChainId.KAIROS]: "0xb15782EFbC2034E366670599F3997f94c7333FF9",
    },
    gcKaia: {
        [ChainId.KAIA]: "0x999999999939Ba65AbB254339eEc0b2A0daC80E9",
        [ChainId.KAIROS]: "0xe4c732f651B39169648A22F159b815d8499F996c",
    },
    stKlay: {
        [ChainId.KAIA]: "0xF80F2b22932fCEC6189b9153aA18662b15CC9C00",
        [ChainId.KAIROS]: "0x28B13a88E72a2c8d6E93C28dD39125705d78E75F",
    },
    stKaia: {
        [ChainId.KAIA]: "0x42952B873ed6f7f0A7E4992E2a9818E3A9001995",
        [ChainId.KAIROS]: "0x4C0d434C7DD74491A52375163a7b724ED387d0b6",
    }
};

const basisPointsFees = 1000; // 10%
const investRatio = 10000; // 100%

module.exports = { contracts, handlers, basisPointsFees, investRatio };
