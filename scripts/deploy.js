const { ethers, upgrades, network } = require("hardhat");
const { RPC_URLS } = require("../config/config");
const fs = require("fs");

require("dotenv").config();

const networkName = hre.network.name;
console.log("!! start deploying to : ", networkName);

const provider = new ethers.JsonRpcProvider(
  RPC_URLS[networkName === "kaia" ? 8217 : 1001],
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const admin = wallet.address;
console.log("");
console.log("!! signer addr =", wallet.address);
console.log("");

// Constructor Arguments
const asset = "0x043c471bee060e00a56ccd02c0ca286808a5a436"; // WKaia 주소
const basisPointsFees = 100; // 1%
const treasury = "0xDdb24eCaF1cCeF3dd3BcF2e2b93A231e809B89B0"; // Treasury 주소
const koKaia = "0xb15782efbc2034e366670599f3997f94c7333ff9"; // KoKaia 컨트랙 주소
const vault = "0x1c9074AA147648567015287B0d4185Cb4E04F86d"; // Kommune-Fi vault 컨트랙 주소

async function main() {
  // 1. deploy contract
  const TokenizedVaultFactory = await ethers.getContractFactory(
    "TokenizedVaultUpgradeable",
  );

  /**
   * TODO : 에러 해결
   *        ProviderError: the method web3_clientVersion does not exist/is not available
   */
  await new Promise((res) => setTimeout(res, 3000));

  const tokenizedVaultFactory = await upgrades.deployProxy(
    TokenizedVaultFactory,
    [asset, basisPointsFees, treasury, koKaia, vault],
    {
      initializer: "initialize",
    },
  );
  await tokenizedVaultFactory.waitForDeployment();

  const tokenizedVaultAddress = await tokenizedVaultFactory.getAddress();
  console.log("TokenizedVault \t\t:", tokenizedVaultAddress);

  // 2. Store deployments
  const deployments = {
    TokenizedVault: tokenizedVaultAddress,
  };
  fs.writeFileSync(
    `deployments-${networkName}.json`,
    JSON.stringify(deployments, null, 2),
  );
}

main();
