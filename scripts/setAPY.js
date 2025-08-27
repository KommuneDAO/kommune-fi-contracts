const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("\n=== Set APY Values ===");
    
    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);
    
    // Detect network and load appropriate deployment file
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    console.log("Network:", networkName);
    
    // Try different deployment file patterns
    let deployment;
    let deploymentFile;
    
    // Try stable deployment first
    if (fs.existsSync(`./deployments-stable-${networkName}.json`)) {
        deploymentFile = `./deployments-stable-${networkName}.json`;
        deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    } 
    // Try regular deployment
    else if (fs.existsSync(`./deployments-${networkName}.json`)) {
        deploymentFile = `./deployments-${networkName}.json`;
        deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    } 
    else {
        throw new Error(`No deployment file found for ${networkName}`);
    }
    
    console.log("Using deployment file:", deploymentFile);
    
    // Load VaultCore contract
    if (!deployment.vaultCore) {
        throw new Error("No VaultCore contract found in deployment");
    }
    
    const vault = await ethers.getContractAt("VaultCore", deployment.vaultCore);
    console.log("VaultCore:", deployment.vaultCore);
    
    // Get current APY values
    console.log("\nCurrent APY values:");
    let currentAPYs = [];
    for (let i = 0; i < 4; i++) {
        currentAPYs[i] = await vault.lstAPY(i);
    }
    
    console.log("  wKoKAIA:", currentAPYs[0].toString(), `(${Number(currentAPYs[0]) / 100}%)`);
    console.log("  wGCKAIA:", currentAPYs[1].toString(), `(${Number(currentAPYs[1]) / 100}%)`);
    console.log("  wstKLAY:", currentAPYs[2].toString(), `(${Number(currentAPYs[2]) / 100}%)`);
    console.log("  stKAIA: ", currentAPYs[3].toString(), `(${Number(currentAPYs[3]) / 100}%)`);
    
    // Set new APY values - Actual production values
    const newAPYs = [676, 556, 700, 550]; // 7.09%, 5.56%, 7.09%, 5.50%
    console.log("\nSetting new APY values:");
    console.log("  wKoKAIA: 709 (7.09%)");
    console.log("  wGCKAIA: 556 (5.56%)");
    console.log("  wstKLAY: 709 (7.09%)");
    console.log("  stKAIA:  550 (5.50%)");
    
    try {
        // Set APY values one by one
        console.log("\nSetting APY values...");
        for (let i = 0; i < 4; i++) {
            const tx = await vault.setAPY(i, newAPYs[i]);
            console.log(`  LST ${i}: Transaction sent`);
            await tx.wait();
        }
        console.log("✅ APY values updated successfully!");
        
        // Verify new APY values
        console.log("\nVerifying new APY values:");
        let updatedAPYs = [];
        for (let i = 0; i < 4; i++) {
            updatedAPYs[i] = await vault.lstAPY(i);
        }
        
        console.log("  wKoKAIA:", updatedAPYs[0].toString(), `(${Number(updatedAPYs[0]) / 100}%)`);
        console.log("  wGCKAIA:", updatedAPYs[1].toString(), `(${Number(updatedAPYs[1]) / 100}%)`);
        console.log("  wstKLAY:", updatedAPYs[2].toString(), `(${Number(updatedAPYs[2]) / 100}%)`);
        console.log("  stKAIA: ", updatedAPYs[3].toString(), `(${Number(updatedAPYs[3]) / 100}%)`);
        
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