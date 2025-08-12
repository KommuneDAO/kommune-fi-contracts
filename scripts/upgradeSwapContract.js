const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");

require("dotenv").config();

const networkName = hre.network.name;
const chainId = networkName === "kaia" ? 8217 : 1001;
console.log("🔄 Starting SwapContract upgrade on:", networkName, chainId);

async function main() {
  // Load existing deployments
  const deploymentFile = `deployments-${networkName}.json`;
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}. Please deploy SwapContract first.`);
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

  const currentAddress = deployments.SwapContract;
  console.log("Current SwapContract address:", currentAddress);

  // Get the new contract factory
  const SwapContractFactory = await ethers.getContractFactory("SwapContract");
  
  console.log("Upgrading SwapContract...");
  
  // Upgrade the contract
  const upgraded = await upgrades.upgradeProxy(currentAddress, SwapContractFactory);
  await upgraded.waitForDeployment();
  
  const newAddress = await upgraded.getAddress();
  
  // Address should be the same for proxy upgrades
  if (currentAddress.toLowerCase() !== newAddress.toLowerCase()) {
    console.warn("⚠️  Warning: Proxy address changed during upgrade");
  }

  console.log("✅ SwapContract upgrade completed!");
  console.log("   Address:", newAddress);

  // Update deployment info with upgrade timestamp
  if (!deployments.upgradeHistory) {
    deployments.upgradeHistory = {};
  }
  if (!deployments.upgradeHistory.SwapContract) {
    deployments.upgradeHistory.SwapContract = [];
  }
  
  deployments.upgradeHistory.SwapContract.push({
    timestamp: new Date().toISOString(),
    network: networkName,
    upgrader: process.env.DEPLOYER_ADDRESS || "unknown"
  });

  // Save updated deployments
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deployments, null, 2)
  );

  console.log("📄 Deployment info updated in:", deploymentFile);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:", error.message);
    process.exit(1);
  });