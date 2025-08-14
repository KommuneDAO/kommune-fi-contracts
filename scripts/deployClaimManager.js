const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🚀 Deploying ClaimManager for V2 Architecture\n");
    
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
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    console.log(`  ShareVault: ${deployments.shareVault}`);
    
    // Deploy ClaimManager
    console.log("\n📦 Deploying ClaimManager...");
    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    const claimManager = await ClaimManager.deploy();
    await claimManager.waitForDeployment();
    const claimManagerAddress = await claimManager.getAddress();
    
    console.log(`  ✅ ClaimManager deployed at: ${claimManagerAddress}`);
    
    // Configure VaultCore to use ClaimManager
    console.log("\n🔧 Configuring VaultCore...");
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    
    const tx = await vaultCore.setClaimManager(claimManagerAddress);
    await tx.wait();
    console.log("  ✅ ClaimManager set in VaultCore");
    
    // Verify the connection
    const storedClaimManager = await vaultCore.claimManager();
    if (storedClaimManager === claimManagerAddress) {
        console.log("  ✅ ClaimManager connection verified");
    } else {
        console.log("  ❌ ClaimManager connection failed!");
        process.exit(1);
    }
    
    // Save deployment
    deployments.claimManager = claimManagerAddress;
    deployments.lastClaimManagerDeploy = new Date().toISOString();
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
    console.log(`\n✅ Deployment saved to ${deploymentFile}`);
    
    console.log("\n════════════════════════════════════════════════");
    console.log("🎉 ClaimManager Deployment Complete!");
    console.log("════════════════════════════════════════════════");
    console.log(`ClaimManager: ${claimManagerAddress}`);
    console.log("\n📝 Next Steps:");
    console.log("  1. Test unstake functionality");
    console.log("  2. Wait 7 days for claim eligibility");
    console.log("  3. Test claim functionality");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });