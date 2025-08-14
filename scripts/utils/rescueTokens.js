const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔧 Rescuing stuck tokens from SwapContract...\n");
    
    const [deployer] = await ethers.getSigners();
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    
    // First, deploy new SwapContract with rescue function
    console.log("1. Deploying new SwapContract with rescue function...");
    const SwapContract = await ethers.getContractFactory("SwapContract");
    const swapContract = await SwapContract.deploy();
    await swapContract.waitForDeployment();
    const newSwapAddress = await swapContract.getAddress();
    console.log("  New SwapContract deployed at:", newSwapAddress);
    
    // Get VaultCore and update SwapContract address
    console.log("\n2. Updating VaultCore with new SwapContract...");
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    await vaultCore.setSwapContract(newSwapAddress);
    console.log("  ✅ VaultCore updated");
    
    // Get old SwapContract to check balances
    console.log("\n3. Checking stuck tokens in old SwapContract...");
    const oldSwapContract = await ethers.getContractAt("SwapContract", deployments.swapContract);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
    
    const lstNames = ["wKoKAIA", "wGCKAIA", "wstKLAY", "stKAIA"];
    const stuckTokens = [];
    
    for (let i = 0; i < 4; i++) {
        const tokenInfo = await vaultCore.tokensInfo(i);
        const tokenContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
        const balance = await tokenContract.balanceOf(deployments.swapContract);
        
        if (balance > 0) {
            console.log(`  ${lstNames[i]}: ${ethers.formatEther(balance)}`);
            stuckTokens.push({
                name: lstNames[i],
                address: tokenInfo.tokenA,
                balance: balance
            });
        }
    }
    
    // Check WKAIA too
    const wkaiaBalance = await wkaia.balanceOf(deployments.swapContract);
    if (wkaiaBalance > 0) {
        console.log(`  WKAIA: ${ethers.formatEther(wkaiaBalance)}`);
        stuckTokens.push({
            name: "WKAIA",
            address: deployments.wkaia,
            balance: wkaiaBalance
        });
    }
    
    if (stuckTokens.length === 0) {
        console.log("  No stuck tokens found!");
    } else {
        console.log("\n4. Manual recovery needed:");
        console.log("  Since old SwapContract doesn't have rescue function,");
        console.log("  these tokens are permanently stuck unless:");
        console.log("  - The contract has an admin/owner rescue function");
        console.log("  - Or we can upgrade the contract");
        console.log("\n  For now, we'll use the new SwapContract going forward.");
    }
    
    // Update deployments file
    console.log("\n5. Updating deployments file...");
    deployments.swapContract = newSwapAddress;
    fs.writeFileSync("deployments-kairos.json", JSON.stringify(deployments, null, 2));
    console.log("  ✅ Deployments updated");
    
    // Verify new setup
    console.log("\n6. Verifying new setup...");
    const vcSwapContract = await vaultCore.swapContract();
    console.log("  VaultCore.swapContract():", vcSwapContract);
    console.log("  New SwapContract:", newSwapAddress);
    console.log("  Match:", vcSwapContract === newSwapAddress ? "✅" : "❌");
    
    console.log("\n✅ SwapContract upgraded successfully!");
    console.log("Note: Stuck tokens in old contract cannot be recovered without admin access.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });