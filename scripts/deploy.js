const { ethers, upgrades, network } = require("hardhat");
const { RPC_URLS } = require("../config/config");
const fs = require("fs");
const {
  contracts,
  basisPointsFees,
  investRatio,
} = require("../config/constants");

require("dotenv").config();

const networkName = hre.network.name;
const chainId = networkName === "kaia" ? 8217 : 1001;
console.log("!! start deploying to : ", networkName, chainId);

const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const admin = wallet.address;
console.log("");
console.log("!! signer addr =", wallet.address);
console.log("");

const asset = contracts.wkaia[chainId]; // WKaia 주소
const koKaia = contracts.koKaia[chainId]; // KoKaia 컨트랙 주소
const vault = contracts.vault[chainId]; // Kommune-Fi vault 컨트랙 주소
const treasury = contracts.treasury[chainId]; // Treasury 주소

async function main() {
  // 1. deploy contract
  const TokenizedVaultFactory = await ethers.getContractFactory("KommuneVault");

  /**
   * TODO : 에러 해결
   *        ProviderError: the method web3_clientVersion does not exist/is not available
   */
  await new Promise((res) => setTimeout(res, 3000));

  const tokenizedVaultFactory = await upgrades.deployProxy(
    TokenizedVaultFactory,
    [asset, basisPointsFees, investRatio, treasury, koKaia, vault],
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
