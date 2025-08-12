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
console.log("!! start deploying KVaultV2 to:", networkName, chainId);

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
  // Load existing deployments to get SwapContract address
  const deploymentFile = `deployments-${networkName}.json`;
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}. Please deploy SwapContract first using: yarn deploy-swap:${networkName === 'kaia' ? 'prod' : 'dev'}`);
  }

  let deployments;
  try {
    const fileContent = fs.readFileSync(deploymentFile, 'utf8');
    deployments = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Error reading deployment file: ${error.message}`);
  }

  if (!deployments.SwapContract) {
    throw new Error(`SwapContract address not found in ${deploymentFile}. Please deploy SwapContract first.`);
  }

  const swapContractAddress = deployments.SwapContract;
  console.log("Using SwapContract at:", swapContractAddress);

  // Deploy KVaultV2
  const TokenizedVaultFactory = await ethers.getContractFactory("KVaultV2");

  /**
   * TODO : 에러 해결
   *        ProviderError: the method web3_clientVersion does not exist/is not available
   */
  await new Promise((res) => setTimeout(res, 3000));

  console.log("Deploying KVaultV2...");
  const tokenizedVaultFactory = await upgrades.deployProxy(
    TokenizedVaultFactory,
    [asset, basisPointsFees, investRatio, treasury, vault, swapContractAddress],
    {
      initializer: "initialize",
    },
  );
  await tokenizedVaultFactory.waitForDeployment();

  const tokenizedVaultAddress = await tokenizedVaultFactory.getAddress();
  console.log("TokenizedVault (KVaultV2) deployed at:", tokenizedVaultAddress);

  // Update deployments
  deployments.KVaultV2 = tokenizedVaultAddress; // Alias for compatibility
  
  // Save updated deployments
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deployments, null, 2)
  );

  console.log("");
  console.log("✅ KVaultV2 deployment completed!");
  console.log("📄 Deployment info updated in:", deploymentFile);
  console.log("");
  console.log("📋 Final deployment summary:");
  console.log("   SwapContract:", swapContractAddress);
  console.log("   KVaultV2:", tokenizedVaultAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  });