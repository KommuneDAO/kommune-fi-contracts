const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║           SEND WKAIA TO VAULTCORE CONTRACTS                  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    
    console.log("🌐 Network:", networkName.toUpperCase());
    console.log("👤 Deployer:", deployer.address);
    
    // WKAIA address based on network
    const WKAIA_ADDRESS = networkName === "kaia" 
        ? "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432"  // Kaia mainnet
        : "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106"; // Kairos testnet
    
    // Amount to send (can be configured via environment variable)
    const AMOUNT = process.env.SEND_AMOUNT || "0.5";
    console.log("💎 Amount to send per VaultCore:", AMOUNT, "WKAIA");
    
    // Load deployment addresses
    const stableDeployments = JSON.parse(fs.readFileSync(`deployments-stable-${networkName}.json`, 'utf8'));
    const balancedDeployments = JSON.parse(fs.readFileSync(`deployments-balanced-${networkName}.json`, 'utf8'));
    
    console.log("\n📍 Target VaultCore Addresses:");
    console.log("   STABLE VaultCore:", stableDeployments.vaultCore);
    console.log("   BALANCED VaultCore:", balancedDeployments.vaultCore);
    
    // Get WKAIA contract
    const wkaia = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)",
         "function transfer(address to, uint256 amount) returns (bool)",
         "function deposit() payable",
         "function decimals() view returns (uint8)"],
        WKAIA_ADDRESS,
        deployer
    );
    
    // Check current WKAIA balance
    const wkaiaBalance = await wkaia.balanceOf(deployer.address);
    console.log("\n💰 Current WKAIA Balance:", ethers.formatEther(wkaiaBalance), "WKAIA");
    
    const amountToSend = ethers.parseEther(AMOUNT);
    const totalNeeded = amountToSend * 2n; // 0.5 for each VaultCore
    
    if (wkaiaBalance < totalNeeded) {
        console.log("⚠️ Insufficient WKAIA balance");
        console.log("   Needed:", ethers.formatEther(totalNeeded), "WKAIA");
        console.log("   Current:", ethers.formatEther(wkaiaBalance), "WKAIA");
        
        // Check KAIA balance to wrap
        const kaiaBalance = await ethers.provider.getBalance(deployer.address);
        console.log("\n💎 KAIA Balance:", ethers.formatEther(kaiaBalance), "KAIA");
        
        if (kaiaBalance >= totalNeeded) {
            console.log("\n🔄 Wrapping KAIA to WKAIA...");
            const wrapTx = await wkaia.deposit({ value: totalNeeded });
            await wrapTx.wait();
            console.log("   ✅ Wrapped", ethers.formatEther(totalNeeded), "KAIA to WKAIA");
            
            // Update balance
            const newBalance = await wkaia.balanceOf(deployer.address);
            console.log("   New WKAIA Balance:", ethers.formatEther(newBalance), "WKAIA");
        } else {
            console.log("❌ Insufficient KAIA to wrap");
            return;
        }
    }
    
    // Send to STABLE VaultCore
    console.log("\n📤 Sending to STABLE VaultCore...");
    console.log("   Amount:", ethers.formatEther(amountToSend), "WKAIA");
    console.log("   To:", stableDeployments.vaultCore);
    
    try {
        const tx1 = await wkaia.transfer(stableDeployments.vaultCore, amountToSend);
        console.log("   Tx hash:", tx1.hash);
        await tx1.wait();
        console.log("   ✅ Transfer successful");
        
        // Check VaultCore balance
        const stableVaultBalance = await wkaia.balanceOf(stableDeployments.vaultCore);
        console.log("   VaultCore WKAIA balance:", ethers.formatEther(stableVaultBalance), "WKAIA");
    } catch (error) {
        console.log("   ❌ Transfer failed:", error.message);
    }
    
    // Send to BALANCED VaultCore
    console.log("\n📤 Sending to BALANCED VaultCore...");
    console.log("   Amount:", ethers.formatEther(amountToSend), "WKAIA");
    console.log("   To:", balancedDeployments.vaultCore);
    
    try {
        const tx2 = await wkaia.transfer(balancedDeployments.vaultCore, amountToSend);
        console.log("   Tx hash:", tx2.hash);
        await tx2.wait();
        console.log("   ✅ Transfer successful");
        
        // Check VaultCore balance
        const balancedVaultBalance = await wkaia.balanceOf(balancedDeployments.vaultCore);
        console.log("   VaultCore WKAIA balance:", ethers.formatEther(balancedVaultBalance), "WKAIA");
    } catch (error) {
        console.log("   ❌ Transfer failed:", error.message);
    }
    
    // Final balance check
    const finalBalance = await wkaia.balanceOf(deployer.address);
    console.log("\n💰 Final WKAIA Balance:", ethers.formatEther(finalBalance), "WKAIA");
    console.log("   Total sent:", ethers.formatEther(totalNeeded), "WKAIA");
    
    console.log("\n✅ Script completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
