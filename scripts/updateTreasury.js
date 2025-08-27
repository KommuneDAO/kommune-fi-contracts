const { ethers } = require("hardhat");
const fs = require('fs');
const { contracts } = require("../config/constants");

async function main() {
    console.log("🏛️ Treasury 주소 업데이트");
    console.log("════════════════════════════");

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    
    if (networkName !== "kaia") {
        console.log("❌ This script is for Kaia mainnet only!");
        return;
    }

    // Get new treasury address from constants
    const newTreasury = contracts.treasury[chainId];
    console.log(`\n📍 New Treasury Address: ${newTreasury}`);

    // Get profile from environment or default
    const profile = process.env.PROFILE || "stable";
    console.log(`📊 Profile: ${profile.toUpperCase()}`);

    // Load deployment info
    const deployments = JSON.parse(fs.readFileSync(`deployments-${profile}-${networkName}.json`, 'utf8'));
    
    console.log("\n📋 현재 배포 정보:");
    console.log(`  Network: ${networkName}`);
    console.log(`  ShareVault: ${deployments.shareVault}`);
    
    // Get ShareVault contract
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    
    // Get current treasury
    const currentTreasury = await shareVault.treasury();
    console.log(`\n💰 Current Treasury: ${currentTreasury}`);
    
    if (currentTreasury.toLowerCase() === newTreasury.toLowerCase()) {
        console.log("✅ Treasury is already set to the correct address!");
        return;
    }
    
    // Update treasury
    console.log("\n🔄 Updating treasury...");
    const tx = await shareVault.setTreasury(newTreasury);
    console.log(`  📤 Tx Hash: ${tx.hash}`);
    await tx.wait();
    console.log("  ✅ Transaction confirmed!");
    
    // Verify update
    const updatedTreasury = await shareVault.treasury();
    console.log(`\n✅ Treasury Updated:`);
    console.log(`  Old: ${currentTreasury}`);
    console.log(`  New: ${updatedTreasury}`);
    
    if (updatedTreasury.toLowerCase() === newTreasury.toLowerCase()) {
        console.log("\n🎉 Treasury update successful!");
    } else {
        console.log("\n❌ Treasury update failed!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });