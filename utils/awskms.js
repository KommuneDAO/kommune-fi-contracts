require("dotenv").config();
const { KmsProvider } = require("aws-kms-provider");
const { providers } = require("@kaiachain/ethers-ext/v5");
const { RPC_URLS } = require("../config/config");
const { Web3 } = require("web3");

const getKlaytnKmsWeb3 = () => {
  try {
    const accessKeyId = process.env.ACCESS_KEY_ID;
    const secretAccessKey = process.env.SECRET_ACCESS_KEY;
    const region = process.env.REGION;
    const kmsProvider = new KmsProvider(
      RPC_URLS[parseInt(process.env.TARGET_NETWORK)],
      {
        region,
        keyIds: [process.env.KEY_ID],
        credential: { accessKeyId, secretAccessKey },
      },
    );

    return new Web3(kmsProvider);
  } catch (e) {
    console.log("getKlaytnKmsWeb3", e);
    throw e;
  }
};

const getKlaytnKmsEthers = () => {
  try {
    const accessKeyId = process.env.ACCESS_KEY_ID;
    const secretAccessKey = process.env.SECRET_ACCESS_KEY;
    const region = process.env.REGION;
    const kmsProvider = new KmsProvider(
      RPC_URLS[parseInt(process.env.TARGET_NETWORK)],
      {
        region,
        keyIds: [process.env.KEY_ID],
        credential: { accessKeyId, secretAccessKey },
      },
    );

    return new providers.Web3Provider(kmsProvider);
  } catch (e) {
    console.log("getKlaytnKmsEthers", e);
    throw e;
  }
};

module.exports = {
  getKlaytnKmsWeb3,
  getKlaytnKmsEthers,
};
