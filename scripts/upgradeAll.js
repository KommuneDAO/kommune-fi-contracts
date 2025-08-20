const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
require("dotenv").config();

/**
 * Upgrade All Contracts in KommuneFi V2
 * 
 * This script upgrades all upgradeable contracts:
 * 1. VaultCore (with investment ratio support)
 * 2. ShareVault
 * 3. SwapContract
 * 
 * Note: ClaimManager is not upgradeable
 * 
 * Usage:
 * npx hardhat run scripts/upgradeAll.js --network kairos
 * npx hardhat run scripts/upgradeAll.js --network kaia
 */

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║         KOMMUNEFI V2 - UPGRADE ALL CONTRACTS                ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("🔑 Deployer:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "KAIA\n");
    
    // Get network info
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    console.log(`🌐 Network: ${networkName.toUpperCase()} (Chain ID: ${chainId})\n`);
    
    // Load deployment addresses
    const filename = `deployments-${networkName}.json`;
    if (!fs.existsSync(filename)) {
        console.error(`❌ Deployment file ${filename} not found!`);
        console.error("   Please run deployFresh.js first.");
        process.exit(1);
    }
    
    const deployments = JSON.parse(fs.readFileSync(filename, 'utf8'));
    console.log("📋 Current Deployment:");
    console.log("  ShareVault:", deployments.shareVault);
    console.log("  VaultCore:", deployments.vaultCore);
    console.log("  SwapContract:", deployments.swapContract);
    console.log("  ClaimManager:", deployments.claimManager, "(not upgradeable)");
    console.log("");
    
    let upgradeCount = 0;
    const upgradeResults = {};
    
    // 1. Upgrade VaultCore
    console.log("1️⃣ Upgrading VaultCore...");
    try {
        const VaultCore = await ethers.getContractFactory("VaultCore");
        const vaultCore = await upgrades.upgradeProxy(
            deployments.vaultCore,
            VaultCore,
            { 
                unsafeAllow: ['delegatecall'],
                redeployImplementation: 'always'
            }
        );
        await vaultCore.waitForDeployment();
        console.log("   ✅ VaultCore upgraded successfully");
        
        // Check if investment ratios need initialization
        try {
            const ratios = await vaultCore.getInvestmentRatios();
            console.log(`   📊 Current ratios - Total: ${ratios.total / 100n}%, Stable: ${ratios.stable / 100n}%, Balanced: ${ratios.balanced / 100n}%, Aggressive: ${ratios.aggressive / 100n}%`);
            
            // If ratios are not set, initialize them
            if (ratios.stable === 0n && ratios.total > 0n) {
                console.log("   🔧 Initializing investment ratios for STABLE profile...");
                await vaultCore.setInvestmentRatios(
                    ratios.total,  // All to stable
                    0n,            // 0% to balanced
                    0n             // 0% to aggressive
                );
                console.log("   ✅ Investment ratios initialized");
            }
        } catch (e) {
            console.log("   ⚠️ Could not check investment ratios (may be old version)");
        }
        
        upgradeResults.vaultCore = "✅ Success";
        upgradeCount++;
    } catch (error) {
        console.log("   ❌ VaultCore upgrade failed:", error.message);
        upgradeResults.vaultCore = "❌ Failed";
    }
    
    // 2. Upgrade ShareVault
    console.log("\n2️⃣ Upgrading ShareVault...");
    try {
        const ShareVault = await ethers.getContractFactory("ShareVault");
        const shareVault = await upgrades.upgradeProxy(
            deployments.shareVault,
            ShareVault,
            { redeployImplementation: 'always' }
        );
        await shareVault.waitForDeployment();
        console.log("   ✅ ShareVault upgraded successfully");
        upgradeResults.shareVault = "✅ Success";
        upgradeCount++;
    } catch (error) {
        console.log("   ❌ ShareVault upgrade failed:", error.message);
        upgradeResults.shareVault = "❌ Failed";
    }
    
    // 3. Upgrade SwapContract
    console.log("\n3️⃣ Upgrading SwapContract...");
    try {
        const SwapContract = await ethers.getContractFactory("SwapContract");
        const swapContract = await upgrades.upgradeProxy(
            deployments.swapContract,
            SwapContract,
            { redeployImplementation: 'always' }
        );
        await swapContract.waitForDeployment();
        console.log("   ✅ SwapContract upgraded successfully");
        upgradeResults.swapContract = "✅ Success";
        upgradeCount++;
    } catch (error) {
        console.log("   ❌ SwapContract upgrade failed:", error.message);
        upgradeResults.swapContract = "❌ Failed";
    }
    
    // 4. Verify connections after upgrade
    console.log("\n4️⃣ Verifying connections...");
    try {
        const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
        const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
        const swapContract = await ethers.getContractAt("SwapContract", deployments.swapContract);
        
        const vcShareVault = await vaultCore.shareVault();
        const vcSwapContract = await vaultCore.swapContract();
        const vcClaimManager = await vaultCore.claimManager();
        const svVaultCore = await shareVault.vaultCore();
        const scAuthorized = await swapContract.authorizedCaller();
        
        console.log("   ShareVault <-> VaultCore:", 
            vcShareVault === deployments.shareVault && svVaultCore === deployments.vaultCore ? "✅" : "❌");
        console.log("   VaultCore -> SwapContract:", 
            vcSwapContract === deployments.swapContract ? "✅" : "❌");
        console.log("   VaultCore -> ClaimManager:", 
            vcClaimManager === deployments.claimManager ? "✅" : "❌");
        console.log("   SwapContract authorized:", 
            scAuthorized === deployments.vaultCore ? "✅" : "❌");
            
        // Check investment ratios
        try {
            const ratios = await vaultCore.getInvestmentRatios();
            console.log("\n   📊 Investment Ratios:");
            console.log(`      Total: ${ratios.total / 100n}%`);
            console.log(`      Stable: ${ratios.stable / 100n}%`);
            console.log(`      Balanced: ${ratios.balanced / 100n}%`);
            console.log(`      Aggressive: ${ratios.aggressive / 100n}%`);
        } catch (e) {
            // Old version without investment ratios
        }
    } catch (error) {
        console.log("   ❌ Verification failed:", error.message);
    }
    
    // Update deployment file with upgrade timestamp
    deployments.lastUpgrade = new Date().toISOString();
    deployments.upgradeResults = upgradeResults;
    fs.writeFileSync(filename, JSON.stringify(deployments, null, 2));
    
    // Display summary
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    UPGRADE COMPLETE                         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    console.log("📊 Upgrade Summary:");
    console.log("  VaultCore:", upgradeResults.vaultCore || "⏭️ Skipped");
    console.log("  ShareVault:", upgradeResults.shareVault || "⏭️ Skipped");
    console.log("  SwapContract:", upgradeResults.swapContract || "⏭️ Skipped");
    console.log("  ClaimManager: ⏭️ Not upgradeable");
    console.log(`\n  Total upgraded: ${upgradeCount}/3 contracts`);
    
    if (upgradeCount === 3) {
        console.log("\n✅ All contracts upgraded successfully!");
    } else if (upgradeCount > 0) {
        console.log(`\n⚠️ Partial upgrade: ${upgradeCount}/3 contracts upgraded`);
    } else {
        console.log("\n❌ No contracts were upgraded");
    }
    
    console.log("\n💡 Next Steps:");
    console.log("  1. Run integration tests: npx hardhat run scripts/testIntegrated.js --network", networkName);
    console.log("  2. Verify functionality with deposit/withdraw tests");
    console.log("  3. Check investment ratios if using new features");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });