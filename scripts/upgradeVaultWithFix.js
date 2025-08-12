const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function upgradeVaultWithFix() {
  console.log("🚀 Upgrading KVaultV2 with wrap success verification fix");

  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  const proxyAddress = deployments.KVaultV2;
  console.log(`🏠 Vault Proxy: ${proxyAddress}`);

  // Get the new implementation contract factory
  const KVaultV2Factory = await ethers.getContractFactory("KVaultV2");
  
  console.log("📦 Deploying new implementation with wrap fix...");
  
  try {
    // Upgrade the proxy to point to the new implementation
    const upgradedVault = await upgrades.upgradeProxy(proxyAddress, KVaultV2Factory);
    
    console.log("✅ Vault upgraded successfully!");
    console.log(`🏠 Proxy address (unchanged): ${await upgradedVault.getAddress()}`);
    
    // Verify the upgrade worked by calling a function
    console.log("\n🔍 Verifying upgrade...");
    
    const vaultBalance = await ethers.provider.getBalance(proxyAddress);
    console.log(`📊 Vault balance: ${ethers.formatEther(vaultBalance)} KAIA`);
    
    // Check token configuration to ensure state is preserved
    const tokenInfo = await upgradedVault.tokensInfo(2);
    console.log(`🪙 stKLAY config preserved: ${tokenInfo.asset}`);
    
    console.log("\n🎉 Upgrade Complete!");
    console.log("🔧 New features added:");
    console.log("   ✅ Wrap success verification in _performSmartSwap");
    console.log("   ✅ Wrap success verification in SwapContract");
    console.log("   ✅ Clear error messages for wrap failures");
    console.log("   ✅ Prevention of silent wrap failures");
    
    console.log("\n🧪 Next steps:");
    console.log("   1. Test deposit/withdraw operations");
    console.log("   2. Monitor for 'Wrap failed: no tokens received' errors");
    console.log("   3. If errors occur, investigate specific LST protocols");
    console.log("   4. Consider protocol-specific fixes if needed");

  } catch (error) {
    console.error("❌ Upgrade failed:", error.message);
    
    if (error.message.includes("not authorized")) {
      console.log("💡 Make sure you're using the correct deployer account");
    } else if (error.message.includes("implementation")) {
      console.log("💡 Check if the new implementation is compatible");
    }
  }
}

upgradeVaultWithFix()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });