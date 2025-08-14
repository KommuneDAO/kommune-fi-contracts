const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("════════════════════════════════════════════════");
    console.log("  WKAIA State Analysis");
    console.log("════════════════════════════════════════════════\n");
    
    const wallet1 = new ethers.Wallet("0x" + process.env.PRIVATE_KEY, ethers.provider);
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
    
    console.log("📋 Configuration:");
    console.log("  VaultCore:", deployments.vaultCore);
    console.log("  ShareVault:", deployments.shareVault);
    console.log("  WKAIA:", deployments.wkaia);
    
    // Check current investRatio
    const investRatio = await vaultCore.investRatio();
    console.log("\n⚙️ Settings:");
    console.log("  investRatio:", investRatio.toString(), `(${investRatio * 100n / 10000n}%)`);
    
    // Test deposit and monitor WKAIA state
    console.log("\n═══════════════════════════════════════");
    console.log("TEST: Deposit and Monitor WKAIA State");
    console.log("═══════════════════════════════════════");
    
    const depositAmount = ethers.parseEther("0.001");
    
    // Monitor WKAIA balance before deposit
    console.log("\n1️⃣ Before Deposit:");
    const userBalanceBefore = await wkaia.balanceOf(wallet1.address);
    const vaultBalanceBefore = await wkaia.balanceOf(deployments.vaultCore);
    console.log("  User WKAIA:", ethers.formatEther(userBalanceBefore));
    console.log("  VaultCore WKAIA:", ethers.formatEther(vaultBalanceBefore));
    
    // Approve and deposit
    console.log("\n2️⃣ Executing Deposit...");
    try {
        await wkaia.connect(wallet1).approve(deployments.shareVault, depositAmount);
        console.log("  ✅ Approved");
        
        const tx = await shareVault.connect(wallet1).deposit(depositAmount, wallet1.address);
        console.log("  ⏳ Transaction sent, waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("  ✅ Transaction confirmed");
        console.log("  Gas used:", receipt.gasUsed.toString());
        
        // Check WKAIA balance immediately after
        console.log("\n3️⃣ Immediately After Deposit:");
        const userBalanceAfter = await wkaia.balanceOf(wallet1.address);
        const vaultBalanceAfter = await wkaia.balanceOf(deployments.vaultCore);
        console.log("  User WKAIA:", ethers.formatEther(userBalanceAfter));
        console.log("  VaultCore WKAIA:", ethers.formatEther(vaultBalanceAfter));
        console.log("  User WKAIA change:", ethers.formatEther(userBalanceAfter - userBalanceBefore));
        console.log("  VaultCore WKAIA change:", ethers.formatEther(vaultBalanceAfter - vaultBalanceBefore));
        
        // Monitor WKAIA balance over time
        console.log("\n4️⃣ Monitoring WKAIA State Over Time:");
        for (let i = 1; i <= 5; i++) {
            await sleep(1000);
            const vaultBalance = await wkaia.balanceOf(deployments.vaultCore);
            console.log(`  After ${i}s: VaultCore WKAIA = ${ethers.formatEther(vaultBalance)}`);
        }
        
    } catch (error) {
        console.log("  ❌ Deposit failed:", error.message);
        
        // If failed, check what happened to WKAIA
        console.log("\n3️⃣ After Failed Deposit:");
        const userBalanceAfter = await wkaia.balanceOf(wallet1.address);
        const vaultBalanceAfter = await wkaia.balanceOf(deployments.vaultCore);
        console.log("  User WKAIA:", ethers.formatEther(userBalanceAfter));
        console.log("  VaultCore WKAIA:", ethers.formatEther(vaultBalanceAfter));
        
        // Check if WKAIA was transferred but not processed
        if (vaultBalanceAfter > vaultBalanceBefore) {
            console.log("  ⚠️ WKAIA was transferred to VaultCore but processing failed!");
            console.log("  Amount stuck:", ethers.formatEther(vaultBalanceAfter - vaultBalanceBefore));
        }
    }
    
    // Test multiple rapid deposits
    console.log("\n═══════════════════════════════════════");
    console.log("TEST: Rapid Sequential Deposits");
    console.log("═══════════════════════════════════════");
    
    const results = [];
    
    for (let i = 0; i < 3; i++) {
        const amount = ethers.parseEther("0.0005");
        console.log(`\nDeposit ${i+1}/3:`);
        
        const vaultBefore = await wkaia.balanceOf(deployments.vaultCore);
        console.log("  VaultCore WKAIA before:", ethers.formatEther(vaultBefore));
        
        try {
            await wkaia.connect(wallet1).approve(deployments.shareVault, amount);
            const tx = await shareVault.connect(wallet1).deposit(amount, wallet1.address);
            await tx.wait();
            
            const vaultAfter = await wkaia.balanceOf(deployments.vaultCore);
            console.log("  VaultCore WKAIA after:", ethers.formatEther(vaultAfter));
            console.log("  ✅ Success - WKAIA change:", ethers.formatEther(vaultAfter - vaultBefore));
            
            results.push({ success: true, wkaiaChange: vaultAfter - vaultBefore });
        } catch (error) {
            const vaultAfter = await wkaia.balanceOf(deployments.vaultCore);
            console.log("  VaultCore WKAIA after:", ethers.formatEther(vaultAfter));
            console.log("  ❌ Failed:", error.message.substring(0, 50));
            console.log("  WKAIA change:", ethers.formatEther(vaultAfter - vaultBefore));
            
            results.push({ success: false, wkaiaChange: vaultAfter - vaultBefore });
        }
        
        // No delay between deposits
    }
    
    // Analysis
    console.log("\n═══════════════════════════════════════");
    console.log("ANALYSIS");
    console.log("═══════════════════════════════════════");
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const stuckWKAIA = results.filter(r => !r.success && r.wkaiaChange > 0n).length;
    
    console.log("\n📊 Results:");
    console.log(`  Successful deposits: ${successCount}/${results.length}`);
    console.log(`  Failed deposits: ${failCount}/${results.length}`);
    console.log(`  Deposits with stuck WKAIA: ${stuckWKAIA}`);
    
    if (investRatio === 10000n) {
        console.log("\n⚠️ investRatio is 100%");
        console.log("  This means VaultCore tries to withdraw ALL WKAIA immediately");
        console.log("  This may cause state synchronization issues");
        console.log("\n💡 Recommendation:");
        console.log("  Consider reducing investRatio to 90% (9000) or lower");
        console.log("  This leaves some WKAIA buffer in VaultCore");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });