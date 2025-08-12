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
console.log("🚀 Starting full deployment to:", networkName, chainId);

const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
console.log("");
console.log("!! signer addr =", wallet.address);
console.log("");

const asset = contracts.wkaia[chainId]; // WKaia 주소
const koKaia = contracts.koKaia[chainId]; // KoKaia 컨트랙 주소
const vault = contracts.vault[chainId]; // Kommune-Fi vault 컨트랙 주소
const treasury = contracts.treasury[chainId]; // Treasury 주소

async function main() {
  console.log("📋 Deployment Parameters:");
  console.log("   Asset (WKaia):", asset);
  console.log("   Vault:", vault);
  console.log("   Treasury:", treasury);
  console.log("   Basis Points Fees:", basisPointsFees);
  console.log("   Invest Ratio:", investRatio);
  console.log("");

  // 1. Deploy SwapContract (upgradeable)
  console.log("1️⃣  Deploying SwapContract...");
  const SwapContractFactory = await ethers.getContractFactory("SwapContract");
  
  const swapContract = await upgrades.deployProxy(
    SwapContractFactory,
    [],
    {
      initializer: "initialize",
    }
  );
  await swapContract.waitForDeployment();
  
  const swapContractAddress = await swapContract.getAddress();
  console.log("✅ SwapContract deployed at:", swapContractAddress);
  console.log("");

  // 2. Deploy KVaultV2
  console.log("2️⃣  Deploying KVaultV2...");
  const TokenizedVaultFactory = await ethers.getContractFactory("KVaultV2");

  /**
   * TODO : 에러 해결
   *        ProviderError: the method web3_clientVersion does not exist/is not available
   */
  await new Promise((res) => setTimeout(res, 3000));

  const tokenizedVaultFactory = await upgrades.deployProxy(
    TokenizedVaultFactory,
    [asset, basisPointsFees, investRatio, treasury, vault, swapContractAddress],
    {
      initializer: "initialize",
    },
  );
  await tokenizedVaultFactory.waitForDeployment();

  const tokenizedVaultAddress = await tokenizedVaultFactory.getAddress();
  console.log("✅ KVaultV2 deployed at:", tokenizedVaultAddress);
  console.log("");

  // 3. Save deployments
  const deployments = {
    SwapContract: swapContractAddress,
    KVaultV2: tokenizedVaultAddress, // Alias for compatibility
    deploymentInfo: {
      network: networkName,
      chainId: chainId,
      deployer: wallet.address,
      timestamp: new Date().toISOString(),
      parameters: {
        asset,
        vault,
        treasury,
        basisPointsFees,
        investRatio
      }
    }
  };
  
  const deploymentFile = `deployments-${networkName}.json`;
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deployments, null, 2)
  );

  console.log("🎉 Full deployment completed successfully!");
  console.log("📄 Deployment info saved to:", deploymentFile);
  console.log("");
  console.log("📋 Final deployment summary:");
  console.log("   Network:", networkName, `(Chain ID: ${chainId})`);
  console.log("   SwapContract:", swapContractAddress);
  console.log("   KVaultV2:", tokenizedVaultAddress);
  console.log("   Deployer:", wallet.address);
  console.log("");
  console.log("🔄 To upgrade contracts later:");
  console.log("   SwapContract:", `yarn upgrade-swap:${networkName === 'kaia' ? 'prod' : 'dev'}`);
  console.log("   KVaultV2:", `yarn upgrade-vault:${networkName === 'kaia' ? 'prod' : 'dev'}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  });