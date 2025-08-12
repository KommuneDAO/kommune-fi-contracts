const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");

require("dotenv").config();

const networkName = hre.network.name;
const chainId = networkName === "kaia" ? 8217 : 1001;
console.log("!! start deploying SwapContract to:", networkName, chainId);

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || (chainId === 8217 ? "https://klaytn-en.kommunedao.xyz:8651" : "https://responsive-green-emerald.kaia-kairos.quiknode.pro"));
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
console.log("");
console.log("!! signer addr =", wallet.address);
console.log("");

async function main() {
  // Deploy SwapContract (upgradeable)
  const SwapContractFactory = await ethers.getContractFactory("SwapContract");
  
  console.log("Deploying SwapContract...");
  const swapContract = await upgrades.deployProxy(
    SwapContractFactory,
    [],
    {
      initializer: "initialize",
    }
  );
  await swapContract.waitForDeployment();
  
  const swapContractAddress = await swapContract.getAddress();
  console.log("SwapContract deployed at:", swapContractAddress);

  // Load existing deployments or create new
  const deploymentFile = `deployments-${networkName}.json`;
  let deployments = {};
  
  if (fs.existsSync(deploymentFile)) {
    try {
      const fileContent = fs.readFileSync(deploymentFile, 'utf8');
      deployments = JSON.parse(fileContent);
      console.log("Loaded existing deployments");
    } catch (error) {
      console.log("Error reading existing deployments, creating new file");
    }
  }

  // Update deployments
  deployments.SwapContract = swapContractAddress;
  
  // Save deployments
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deployments, null, 2)
  );
  
  console.log("");
  console.log("✅ SwapContract deployment completed!");
  console.log("📄 Deployment info saved to:", deploymentFile);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });