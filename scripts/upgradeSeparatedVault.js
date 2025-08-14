const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Upgrading separated vault architecture...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading with account:", deployer.address);
    
    // Load existing deployment addresses
    const networkName = hre.network.name;
    const deployments = JSON.parse(fs.readFileSync(`./deployments-${networkName}.json`, "utf8"));
    
    console.log("Existing deployments:");
    console.log("ShareVault:", deployments.shareVault);
    console.log("VaultCore:", deployments.vaultCore);
    
    // 1. Upgrade VaultCore if needed
    console.log("\n1. Upgrading VaultCore...");
    const VaultCore = await ethers.getContractFactory("VaultCore");
    const vaultCore = await upgrades.upgradeProxy(deployments.vaultCore, VaultCore);
    await vaultCore.waitForDeployment();
    console.log("VaultCore upgraded successfully");
    
    // 2. Upgrade ShareVault if needed
    console.log("\n2. Upgrading ShareVault...");
    const ShareVault = await ethers.getContractFactory("ShareVault");
    const shareVault = await upgrades.upgradeProxy(deployments.shareVault, ShareVault);
    await shareVault.waitForDeployment();
    console.log("ShareVault upgraded successfully");
    
    // 3. Verify configuration
    console.log("\n3. Verifying configuration...");
    
    // Check VaultCore configuration
    const shareVaultInCore = await vaultCore.shareVault();
    console.log("ShareVault in VaultCore:", shareVaultInCore);
    
    if (shareVaultInCore !== deployments.shareVault) {
        console.log("Setting ShareVault in VaultCore...");
        const tx = await vaultCore.setShareVault(deployments.shareVault);
        await tx.wait();
        console.log("ShareVault updated in VaultCore");
    }
    
    // Check ShareVault configuration
    const vaultCoreInShare = await shareVault.vaultCore();
    console.log("VaultCore in ShareVault:", vaultCoreInShare);
    
    if (vaultCoreInShare !== deployments.vaultCore) {
        console.log("Setting VaultCore in ShareVault...");
        const tx = await shareVault.setVaultCore(deployments.vaultCore);
        await tx.wait();
        console.log("VaultCore updated in ShareVault");
    }
    
    // 4. Check APY values
    console.log("\n4. Checking APY values...");
    for (let i = 0; i < 4; i++) {
        const apy = await vaultCore.lstAPY(i);
        console.log(`APY for LST ${i}: ${apy.toString() / 100}%`);
        
        if (apy == 0) {
            console.log(`Setting APY for LST ${i}...`);
            const apyValue = (500 + i * 100) * 10; // 5%, 6%, 7%, 8%
            const tx = await vaultCore.setAPY(i, apyValue);
            await tx.wait();
            console.log(`APY set to ${apyValue / 100}%`);
        }
    }
    
    // 5. Update deployment info
    deployments.lastUpgrade = new Date().toISOString();
    
    fs.writeFileSync(
        `./deployments-${networkName}.json`,
        JSON.stringify(deployments, null, 2)
    );
    
    console.log("\n========== Upgrade Summary ==========");
    console.log("ShareVault:", deployments.shareVault);
    console.log("VaultCore:", deployments.vaultCore);
    console.log("=====================================");
    
    console.log("\n✅ Upgrade complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });