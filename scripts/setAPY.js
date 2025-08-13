const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("\n=== Set APY Values ===");
    
    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);
    
    const deployment = JSON.parse(fs.readFileSync("./deployments-kairos.json", 'utf8'));
    const vault = await ethers.getContractAt("KVaultV2", deployment.KVaultV2);
    console.log("Vault:", deployment.KVaultV2);
    
    // Get current APY values
    console.log("\nCurrent APY values:");
    const currentAPYs = await vault.getAllAPY();
    console.log("  koKAIA:", currentAPYs[0].toString());
    console.log("  gcKAIA:", currentAPYs[1].toString());
    console.log("  stKLAY:", currentAPYs[2].toString());
    console.log("  stKAIA:", currentAPYs[3].toString());
    
    // Set new APY values
    const newAPYs = [755, 655, 555, 738]; // 7.55%, 6.55%, 5.55%, 7.38%
    console.log("\nSetting new APY values:");
    console.log("  koKAIA: 755 (7.55%)");
    console.log("  gcKAIA: 655 (6.55%)");
    console.log("  stKLAY: 555 (5.55%)");
    console.log("  stKAIA: 738 (7.38%)");
    
    try {
        const tx = await vault.setMultipleAPY(newAPYs);
        console.log("\nTransaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ APY values updated successfully!");
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Verify new APY values
        console.log("\nVerifying new APY values:");
        const updatedAPYs = await vault.getAllAPY();
        console.log("  koKAIA:", updatedAPYs[0].toString());
        console.log("  gcKAIA:", updatedAPYs[1].toString());
        console.log("  stKLAY:", updatedAPYs[2].toString());
        console.log("  stKAIA:", updatedAPYs[3].toString());
        
    } catch (error) {
        console.log("❌ Failed to set APY:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });