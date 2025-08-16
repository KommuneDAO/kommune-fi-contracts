const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

// This script upgrades all contracts (for npm script usage)
async function main() {
    console.log("🔧 Contract Upgrade Tool (All)\n");
    
    const [deployer] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    const deploymentFile = `deployments-${networkName}.json`;
    
    if (!fs.existsSync(deploymentFile)) {
        console.error(`❌ ${deploymentFile} not found. Please run deployFresh.js first.`);
        process.exit(1);
    }
    
    const deployments = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    
    console.log("📋 Current Deployment:");
    console.log(`  Network: ${networkName}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  ShareVault: ${deployments.shareVault}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    console.log(`  SwapContract: ${deployments.swapContract}`);
    
    console.log("\n🚀 Upgrade Plan:");
    console.log("  ✓ ShareVault");
    console.log("  ✓ VaultCore");
    
    // Upgrade VaultCore
    console.log("\n📦 Upgrading VaultCore...");
    
    try {
        // Force import if needed
        const VaultCore = await ethers.getContractFactory("VaultCore");
        try {
            await upgrades.forceImport(deployments.vaultCore, VaultCore);
            console.log("  ✓ Proxy imported");
        } catch (e) {
            // Already imported
        }
        
        const vaultCore = await upgrades.upgradeProxy(
            deployments.vaultCore, 
            VaultCore,
            { unsafeAllow: ['delegatecall'] }  // Allow delegatecall for ClaimManager
        );
        await vaultCore.waitForDeployment();
        console.log("  ✅ VaultCore upgraded successfully");
        
        // Verify SwapContract connection
        const swapContract = await vaultCore.swapContract();
        if (swapContract !== deployments.swapContract) {
            console.log("  ⚠️ Updating SwapContract address...");
            await vaultCore.setSwapContract(deployments.swapContract);
            console.log("  ✓ SwapContract updated");
        }
        
        // Verify totalAssets
        const totalAssets = await vaultCore.getTotalAssets();
        console.log(`  Total Assets: ${ethers.formatEther(totalAssets)} WKAIA`);
        
    } catch (error) {
        console.error("  ❌ VaultCore upgrade failed:", error.message);
        process.exit(1);
    }
    
    // Upgrade ShareVault
    console.log("\n📦 Upgrading ShareVault...");
    
    try {
        // Force import if needed
        const ShareVault = await ethers.getContractFactory("ShareVault");
        try {
            await upgrades.forceImport(deployments.shareVault, ShareVault);
            console.log("  ✓ Proxy imported");
        } catch (e) {
            // Already imported
        }
        
        const shareVault = await upgrades.upgradeProxy(deployments.shareVault, ShareVault);
        await shareVault.waitForDeployment();
        console.log("  ✅ ShareVault upgraded successfully");
        
        // Verify VaultCore connection
        const vaultCore = await shareVault.vaultCore();
        if (vaultCore !== deployments.vaultCore) {
            console.log("  ⚠️ VaultCore address mismatch!");
            console.log(`    Expected: ${deployments.vaultCore}`);
            console.log(`    Actual: ${vaultCore}`);
        }
        
        // Verify state
        const totalSupply = await shareVault.totalSupply();
        const totalAssets = await shareVault.totalAssets();
        console.log(`  Total Supply: ${ethers.formatEther(totalSupply)} shares`);
        console.log(`  Total Assets: ${ethers.formatEther(totalAssets)} WKAIA`);
        
    } catch (error) {
        console.error("  ❌ ShareVault upgrade failed:", error.message);
        process.exit(1);
    }
    
    // Final verification
    console.log("\n✅ Upgrade Complete!");
    
    // Test basic functionality
    console.log("\n🔍 Verifying Integration...");
    
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    
    const shareVaultCore = await shareVault.vaultCore();
    const vaultCoreShare = await vaultCore.shareVault();
    
    console.log(`  ShareVault → VaultCore: ${shareVaultCore === deployments.vaultCore ? "✅" : "❌"}`);
    console.log(`  VaultCore → ShareVault: ${vaultCoreShare === deployments.shareVault ? "✅" : "❌"}`);
    
    const vaultCoreSwap = await vaultCore.swapContract();
    console.log(`  VaultCore → SwapContract: ${vaultCoreSwap === deployments.swapContract ? "✅" : "❌"}`);
    
    // Check ClaimManager if exists
    if (deployments.claimManager) {
        const vaultCoreClaimManager = await vaultCore.claimManager();
        console.log(`  VaultCore → ClaimManager: ${vaultCoreClaimManager === deployments.claimManager ? "✅" : "❌"}`);
    }
    
    console.log("\n📊 Current State:");
    const totalSupply = await shareVault.totalSupply();
    const totalAssets = await shareVault.totalAssets();
    console.log(`  Total Supply: ${ethers.formatEther(totalSupply)} shares`);
    console.log(`  Total Assets: ${ethers.formatEther(totalAssets)} WKAIA`);
    
    if (totalSupply > 0n) {
        const sharePrice = (totalAssets * ethers.parseEther("1")) / totalSupply;
        console.log(`  Share Price: ${ethers.formatEther(sharePrice)} WKAIA/share`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });