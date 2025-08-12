const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");

require("dotenv").config();

const networkName = hre.network.name;
const chainId = networkName === "kaia" ? 8217 : 1001;
console.log("🔄 Starting KVaultV2 upgrade on:", networkName, chainId);

async function main() {
  // Load existing deployments
  const deploymentFile = `deployments-${networkName}.json`;
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}. Please deploy KVaultV2 first.`);
  }

  let deployments;
  try {
    const fileContent = fs.readFileSync(deploymentFile, 'utf8');
    deployments = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Error reading deployment file: ${error.message}`);
  }

  const currentAddress = deployments.KVaultV2 || deployments.TokenizedVault;
  if (!currentAddress) {
    throw new Error(`KVaultV2 address not found in ${deploymentFile}. Please deploy KVaultV2 first.`);
  }

  console.log("Current KVaultV2 address:", currentAddress);

  // Get the new contract factory
  const KVaultV2Factory = await ethers.getContractFactory("KVaultV2");
  
  console.log("Upgrading KVaultV2...");
  
  // Upgrade the contract
  const upgraded = await upgrades.upgradeProxy(currentAddress, KVaultV2Factory);
  await upgraded.waitForDeployment();
  
  const newAddress = await upgraded.getAddress();
  
  // Address should be the same for proxy upgrades
  if (currentAddress.toLowerCase() !== newAddress.toLowerCase()) {
    console.warn("⚠️  Warning: Proxy address changed during upgrade");
  }

  console.log("✅ KVaultV2 upgrade completed!");
  console.log("   Address:", newAddress);

  // Update deployment info with upgrade timestamp
  if (!deployments.upgradeHistory) {
    deployments.upgradeHistory = {};
  }
  if (!deployments.upgradeHistory.KVaultV2) {
    deployments.upgradeHistory.KVaultV2 = [];
  }
  
  deployments.upgradeHistory.KVaultV2.push({
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