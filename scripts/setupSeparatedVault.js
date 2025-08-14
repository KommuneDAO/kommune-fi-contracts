const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Setting up separated vault...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Setting up with account:", deployer.address);
    
    // Load deployment addresses
    const networkName = hre.network.name;
    const deployments = JSON.parse(fs.readFileSync(`./deployments-${networkName}.json`, "utf8"));
    
    // Get contract instances
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    
    // 1. Setup VaultCore
    console.log("1. Setting up VaultCore...");
    
    // Set APY values
    console.log("Setting APY values...");
    const apyValues = [
        { index: 0, apy: 5000, name: "wKoKAIA" },  // 5%
        { index: 1, apy: 6000, name: "wGCKAIA" },  // 6%
        { index: 2, apy: 7000, name: "wstKLAY" },  // 7%
        { index: 3, apy: 8000, name: "stKAIA" }    // 8%
    ];
    
    for (const lst of apyValues) {
        const currentAPY = await vaultCore.lstAPY(lst.index);
        if (currentAPY == 0) {
            const tx = await vaultCore.setAPY(lst.index, lst.apy);
            await tx.wait();
            console.log(`✅ APY for ${lst.name} set to ${lst.apy/1000}%`);
        } else {
            console.log(`APY for ${lst.name} already set to ${currentAPY/1000}%`);
        }
    }
    
    // Set invest ratio
    console.log("\nSetting invest ratio...");
    const currentRatio = await vaultCore.investRatio();
    if (currentRatio != 9000) {
        const tx = await vaultCore.setInvestRatio(9000); // 90%
        await tx.wait();
        console.log("✅ Invest ratio set to 90%");
    } else {
        console.log("Invest ratio already set to 90%");
    }
    
    // 2. Setup ShareVault
    console.log("\n2. Setting up ShareVault...");
    
    // Set deposit limit
    console.log("Setting deposit limit...");
    const depositLimit = ethers.parseEther("100"); // 100 WKAIA
    const currentLimit = await shareVault.depositLimit();
    if (currentLimit != depositLimit) {
        const tx = await shareVault.setDepositLimit(depositLimit);
        await tx.wait();
        console.log("✅ Deposit limit set to 100 WKAIA");
    } else {
        console.log("Deposit limit already set to 100 WKAIA");
    }
    
    // Set fees
    console.log("Setting fees...");
    const currentFees = await shareVault.basisPointsFees();
    if (currentFees != 10) {
        const tx = await shareVault.setFees(10); // 0.1%
        await tx.wait();
        console.log("✅ Fees set to 0.1%");
    } else {
        console.log("Fees already set to 0.1%");
    }
    
    // 3. Verify connections
    console.log("\n3. Verifying connections...");
    
    const shareVaultInCore = await vaultCore.shareVault();
    const vaultCoreInShare = await shareVault.vaultCore();
    
    console.log("ShareVault in VaultCore:", shareVaultInCore);
    console.log("VaultCore in ShareVault:", vaultCoreInShare);
    
    if (shareVaultInCore !== deployments.shareVault) {
        console.log("❌ ShareVault not properly set in VaultCore!");
    }
    
    if (vaultCoreInShare !== deployments.vaultCore) {
        console.log("❌ VaultCore not properly set in ShareVault!");
    }
    
    // 4. Display summary
    console.log("\n========== Setup Summary ==========");
    console.log("ShareVault:", deployments.shareVault);
    console.log("VaultCore:", deployments.vaultCore);
    console.log("SwapContract:", deployments.swapContract);
    console.log("\nAPY Settings:");
    for (const lst of apyValues) {
        const apy = await vaultCore.lstAPY(lst.index);
        console.log(`  ${lst.name}: ${apy/1000}%`);
    }
    console.log("\nVault Settings:");
    console.log(`  Invest Ratio: ${await vaultCore.investRatio() / 100}%`);
    console.log(`  Deposit Limit: ${ethers.formatEther(await shareVault.depositLimit())} WKAIA`);
    console.log(`  Fees: ${await shareVault.basisPointsFees() / 100}%`);
    console.log("===================================");
    
    console.log("\n✅ Setup complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });