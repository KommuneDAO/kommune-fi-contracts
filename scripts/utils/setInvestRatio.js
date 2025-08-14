const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Setting investRatio to 100%...\n");
    
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    
    // Get current investRatio
    const currentRatio = await vaultCore.investRatio();
    console.log("Current investRatio:", currentRatio.toString(), `(${currentRatio * 100n / 10000n}%)`);
    
    // Set to 100% (10000 basis points)
    const newRatio = 10000;
    console.log("\nSetting new investRatio to:", newRatio, "(100%)");
    
    const tx = await vaultCore.setInvestRatio(newRatio);
    await tx.wait();
    
    // Verify the change
    const updatedRatio = await vaultCore.investRatio();
    console.log("✅ Updated investRatio:", updatedRatio.toString(), `(${updatedRatio * 100n / 10000n}%)`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });