const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
require("dotenv").config();

/**
 * Deploy KommuneFi V2 with Investment Profile
 * 
 * Profiles:
 * - stable: 100% LST staking (current default)
 * - balanced: 50% LST staking, 50% future balanced strategies
 * - aggressive: 40% LST staking, 30% balanced, 30% aggressive
 * 
 * Usage:
 * npx hardhat run scripts/deployWithProfile.js --network kairos
 * 
 * Set INVESTMENT_PROFILE env variable to "stable", "balanced", or "aggressive"
 * Default is "stable" if not specified
 */

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║    KOMMUNEFI V2 DEPLOYMENT WITH INVESTMENT PROFILE          ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    // Get deployment profile from environment or use default
    const profile = process.env.INVESTMENT_PROFILE || "stable";
    const profiles = {
        stable: {
            investRatio: 9000, // 90% total investment for maximum returns
            stableRatio: 9000, // 90% to LST staking
            balancedRatio: 0,
            aggressiveRatio: 0,
            description: "Conservative strategy with 100% LST staking"
        },
        balanced: {
            investRatio: 9000, // 90% total investment for maximum returns
            stableRatio: 4500, // 45% to LST staking (50% of 90%)
            balancedRatio: 4500, // 45% to balanced (50% of 90%)
            aggressiveRatio: 0,
            description: "Balanced strategy with 50% LST, 50% balanced"
        },
        aggressive: {
            investRatio: 9000, // 90% total investment for maximum returns
            stableRatio: 3600, // 36% to LST staking (40% of 90%)
            balancedRatio: 2700, // 27% to balanced (30% of 90%)
            aggressiveRatio: 2700, // 27% to aggressive (30% of 90%)
            description: "Aggressive strategy with 40% LST, 30% balanced, 30% aggressive"
        }
    };
    
    if (!profiles[profile]) {
        console.error(`❌ Invalid profile: ${profile}`);
        console.log("Valid profiles: stable, balanced, aggressive");
        process.exit(1);
    }
    
    const config = profiles[profile];
    
    console.log(`📋 Deployment Configuration:`);
    console.log(`  Profile: ${profile.toUpperCase()}`);
    console.log(`  ${config.description}`);
    console.log(`  Total Investment: ${config.investRatio / 100}%`);
    console.log(`  - Stable (LST): ${config.stableRatio / 100}%`);
    console.log(`  - Balanced: ${config.balancedRatio / 100}%`);
    console.log(`  - Aggressive: ${config.aggressiveRatio / 100}%`);
    console.log("");
    
    const [deployer] = await ethers.getSigners();
    console.log("🔑 Deployer:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "KAIA\n");
    
    // Get network info
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    console.log(`🌐 Network: ${networkName.toUpperCase()} (Chain ID: ${chainId})\n`);
    
    // Get WKAIA address based on network
    const wkaiaAddress = chainId === 8217n 
        ? "0xe4f05A66Ec68B54A58B17c22107b02e0232cC817"  // Mainnet WKAIA
        : "0x043c471bEe060e00A56CcD02c0Ca286808a5A436";  // Testnet WKAIA
    
    console.log("WKAIA Address:", wkaiaAddress);
    
    // Deploy contracts
    console.log("\n📦 Deploying Contracts...\n");
    
    // 1. Deploy ShareVault (ERC4626 implementation)
    console.log("1. Deploying ShareVault...");
    const ShareVault = await ethers.getContractFactory("ShareVault");
    const shareVault = await upgrades.deployProxy(
        ShareVault,
        [
            wkaiaAddress,
            ethers.ZeroAddress, // VaultCore will be set later
            10, // 0.1% fees (10 basis points)
            deployer.address // Treasury
        ],
        { initializer: 'initialize' }
    );
    await shareVault.waitForDeployment();
    const shareVaultAddress = await shareVault.getAddress();
    console.log("   ✅ ShareVault deployed to:", shareVaultAddress);
    
    // 2. Deploy VaultCore (Asset Management)
    console.log("\n2. Deploying VaultCore...");
    const VaultCore = await ethers.getContractFactory("VaultCore");
    const balancerVault = chainId === 8217n
        ? "0x0BF61f706105EA44694f2e92986bD01C39930280"  // Mainnet Balancer
        : "0x1c9074AA147648567015287B0d4185Cb4E04F86d";  // Testnet Balancer
    
    const vaultCore = await upgrades.deployProxy(
        VaultCore,
        [
            wkaiaAddress,
            balancerVault,
            ethers.ZeroAddress, // SwapContract will be set later
            config.investRatio  // Total investment ratio
        ],
        { 
            initializer: 'initialize',
            unsafeAllow: ['delegatecall']
        }
    );
    await vaultCore.waitForDeployment();
    const vaultCoreAddress = await vaultCore.getAddress();
    console.log("   ✅ VaultCore deployed to:", vaultCoreAddress);
    
    // 3. Deploy SwapContract
    console.log("\n3. Deploying SwapContract...");
    const SwapContract = await ethers.getContractFactory("SwapContract");
    const swapContract = await upgrades.deployProxy(
        SwapContract,
        [deployer.address], // Initialize with deployer as owner
        { initializer: 'initialize' }
    );
    await swapContract.waitForDeployment();
    const swapContractAddress = await swapContract.getAddress();
    console.log("   ✅ SwapContract deployed to:", swapContractAddress);
    
    // 4. Deploy ClaimManager
    console.log("\n4. Deploying ClaimManager...");
    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    const claimManager = await ClaimManager.deploy();
    await claimManager.waitForDeployment();
    const claimManagerAddress = await claimManager.getAddress();
    console.log("   ✅ ClaimManager deployed to:", claimManagerAddress);
    
    // Configure contracts
    console.log("\n⚙️  Configuring Contracts...\n");
    
    // Set connections
    console.log("5. Setting up connections...");
    await shareVault.setVaultCore(vaultCoreAddress);
    console.log("   ✅ ShareVault → VaultCore");
    
    await vaultCore.setShareVault(shareVaultAddress);
    console.log("   ✅ VaultCore → ShareVault");
    
    await vaultCore.setSwapContract(swapContractAddress);
    console.log("   ✅ VaultCore → SwapContract");
    
    await vaultCore.setClaimManager(claimManagerAddress);
    console.log("   ✅ VaultCore → ClaimManager");
    
    await swapContract.setAuthorizedCaller(vaultCoreAddress);
    console.log("   ✅ SwapContract → VaultCore (authorized)");
    
    // Set investment ratios based on profile
    console.log("\n6. Setting investment ratios...");
    await vaultCore.setInvestmentRatios(
        config.stableRatio,
        config.balancedRatio,
        config.aggressiveRatio
    );
    console.log(`   ✅ Investment ratios set for ${profile} profile`);
    
    // Set initial APY distribution - Actual production values
    console.log("\n7. Setting APY distribution...");
    await vaultCore.setAPY(0, 709); // wKoKAIA: 7.09%
    await vaultCore.setAPY(1, 556); // wGCKAIA: 5.56%
    await vaultCore.setAPY(2, 709); // wstKLAY: 7.09%
    await vaultCore.setAPY(3, 550); // stKAIA: 5.50%
    console.log("   ✅ APY distribution set to actual production values");
    
    // Save deployment info
    const deploymentInfo = {
        network: networkName,
        profile: profile,
        deploymentDate: new Date().toISOString(),
        shareVault: shareVaultAddress,
        vaultCore: vaultCoreAddress,
        swapContract: swapContractAddress,
        claimManager: claimManagerAddress,
        wkaia: wkaiaAddress,
        balancerVault: balancerVault,
        configuration: {
            investRatio: config.investRatio,
            stableRatio: config.stableRatio,
            balancedRatio: config.balancedRatio,
            aggressiveRatio: config.aggressiveRatio
        }
    };
    
    const filename = `deployments-${networkName}-${profile}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to ${filename}`);
    
    // Also update the main deployment file for compatibility
    const mainFilename = `deployments-${networkName}.json`;
    fs.writeFileSync(mainFilename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Also saved to ${mainFilename} (for compatibility)`);
    
    // Display summary
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              DEPLOYMENT COMPLETE                            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    console.log(`📊 ${profile.toUpperCase()} Profile Deployment Summary:`);
    console.log("  ShareVault:", shareVaultAddress);
    console.log("  VaultCore:", vaultCoreAddress);
    console.log("  SwapContract:", swapContractAddress);
    console.log("  ClaimManager:", claimManagerAddress);
    console.log("\n  Investment Strategy:");
    console.log(`  - Total Investment: ${config.investRatio / 100}%`);
    console.log(`  - Stable (LST): ${config.stableRatio / 100}%`);
    console.log(`  - Balanced: ${config.balancedRatio / 100}%`);
    console.log(`  - Aggressive: ${config.aggressiveRatio / 100}%`);
    
    console.log("\n✅ All contracts deployed and configured successfully!");
    console.log(`\n🚀 ${profile.charAt(0).toUpperCase() + profile.slice(1)} vault ready for use!`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });