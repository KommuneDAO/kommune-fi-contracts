const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("════════════════════════════════════════════════");
    console.log("  Stress Test - Continuous Deposits");
    console.log("════════════════════════════════════════════════\n");
    
    // Create wallets
    const wallet1 = new ethers.Wallet("0x" + process.env.PRIVATE_KEY, ethers.provider);
    const wallet2 = new ethers.Wallet("0x" + process.env.TESTER1_PRIV_KEY, ethers.provider);
    const wallet3 = new ethers.Wallet("0x" + process.env.TESTER2_PRIV_KEY, ethers.provider);
    
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
    
    console.log("📋 Configuration:");
    console.log("  ShareVault:", deployments.shareVault);
    console.log("  WKAIA:", deployments.wkaia);
    
    // Check initial balances
    console.log("\n💰 Initial WKAIA Balances:");
    const balance1 = await wkaia.balanceOf(wallet1.address);
    const balance2 = await wkaia.balanceOf(wallet2.address);
    const balance3 = await wkaia.balanceOf(wallet3.address);
    
    console.log("  Wallet1:", ethers.formatEther(balance1));
    console.log("  Wallet2:", ethers.formatEther(balance2));
    console.log("  Wallet3:", ethers.formatEther(balance3));
    
    // ════════════════════════════════════════════════
    // STRESS TEST 1: 30-Second Continuous Deposits
    // ════════════════════════════════════════════════
    console.log("\n════════════════════════════════════════════════");
    console.log("STRESS TEST 1: 30-Second Continuous Deposits");
    console.log("════════════════════════════════════════════════");
    
    const stressAmount = ethers.parseEther("0.0001"); // Very small amount
    const stressStartTime = Date.now();
    const stressDuration = 30000; // 30 seconds
    let stressAttempts = 0;
    let stressSuccess = 0;
    let stressWethErrors = 0;
    let stressOtherErrors = 0;
    
    // Pre-approve large amount
    await wkaia.connect(wallet1).approve(deployments.shareVault, ethers.parseEther("1"));
    await wkaia.connect(wallet2).approve(deployments.shareVault, ethers.parseEther("1"));
    await wkaia.connect(wallet3).approve(deployments.shareVault, ethers.parseEther("1"));
    
    console.log("\n⏱️ Starting 30-second stress test...");
    
    while (Date.now() - stressStartTime < stressDuration) {
        stressAttempts += 3;
        
        // Fire deposits without waiting
        const stressDeposits = [
            shareVault.connect(wallet1).deposit(stressAmount, wallet1.address),
            shareVault.connect(wallet2).deposit(stressAmount, wallet2.address),
            shareVault.connect(wallet3).deposit(stressAmount, wallet3.address)
        ];
        
        const stressResults = await Promise.allSettled(
            stressDeposits.map(d => d.then(tx => tx.wait()))
        );
        
        stressResults.forEach((result) => {
            if (result.status === 'fulfilled') {
                stressSuccess++;
            } else if (result.reason.message?.includes("State sync failed")) {
                stressWethErrors++;
            } else {
                stressOtherErrors++;
            }
        });
        
        // Show progress every 30 attempts
        if (stressAttempts % 30 === 0) {
            console.log(`  Progress: ${stressAttempts} attempts, ${stressSuccess} successful, ${stressWethErrors} sync errors`);
        }
        
        // Small delay to avoid overwhelming
        await sleep(500);
    }
    
    console.log(`\n📊 30-Second Stress Test Results:`);
    console.log(`  Total attempts: ${stressAttempts}`);
    console.log(`  Successful: ${stressSuccess}`);
    console.log(`  State sync errors: ${stressWethErrors}`);
    console.log(`  Other errors: ${stressOtherErrors}`);
    console.log(`  Success rate: ${((stressSuccess/stressAttempts)*100).toFixed(2)}%`);
    
    await sleep(3000);
    
    // ════════════════════════════════════════════════
    // STRESS TEST 2: Zero-Delay Burst
    // ════════════════════════════════════════════════
    console.log("\n════════════════════════════════════════════════");
    console.log("STRESS TEST 2: Zero-Delay Burst (100 deposits)");
    console.log("════════════════════════════════════════════════");
    
    const burstAmount = ethers.parseEther("0.00005");
    const allDeposits = [];
    
    console.log("\n🚀 Creating 100 deposit transactions...");
    
    // Create 100 deposits (33-34 per wallet)
    for (let i = 0; i < 34; i++) {
        allDeposits.push(shareVault.connect(wallet1).deposit(burstAmount, wallet1.address));
        allDeposits.push(shareVault.connect(wallet2).deposit(burstAmount, wallet2.address));
        if (i < 32) {
            allDeposits.push(shareVault.connect(wallet3).deposit(burstAmount, wallet3.address));
        }
    }
    
    console.log(`📤 Firing ${allDeposits.length} deposits simultaneously...`);
    
    // Execute ALL at once
    const burstResults = await Promise.allSettled(
        allDeposits.map(d => d.then(tx => tx.wait()))
    );
    
    // Analyze results
    let burstSuccess = 0;
    let burstSyncErrors = 0;
    let burstPerBlock = 0;
    let burstOther = 0;
    
    burstResults.forEach((result) => {
        if (result.status === 'fulfilled') {
            burstSuccess++;
        } else {
            const error = result.reason.message || result.reason;
            if (error.includes("State sync failed")) {
                burstSyncErrors++;
            } else if (error.includes("Same block") || error.includes("per block")) {
                burstPerBlock++;
            } else {
                burstOther++;
            }
        }
    });
    
    console.log(`\n📊 Burst Test Results:`);
    console.log(`  Successful: ${burstSuccess}/${allDeposits.length}`);
    console.log(`  State sync errors: ${burstSyncErrors}`);
    console.log(`  Per-block limits: ${burstPerBlock}`);
    console.log(`  Other errors: ${burstOther}`);
    console.log(`  Success rate: ${((burstSuccess/allDeposits.length)*100).toFixed(2)}%`);
    
    // ════════════════════════════════════════════════
    // FINAL REPORT
    // ════════════════════════════════════════════════
    console.log("\n════════════════════════════════════════════════");
    console.log("  STRESS TEST FINAL REPORT");
    console.log("════════════════════════════════════════════════");
    
    // Final balances
    console.log("\n💰 Final WKAIA Balances:");
    const finalBalance1 = await wkaia.balanceOf(wallet1.address);
    const finalBalance2 = await wkaia.balanceOf(wallet2.address);
    const finalBalance3 = await wkaia.balanceOf(wallet3.address);
    
    console.log("  Wallet1:", ethers.formatEther(finalBalance1));
    console.log("  Wallet2:", ethers.formatEther(finalBalance2));
    console.log("  Wallet3:", ethers.formatEther(finalBalance3));
    
    // Vault state
    const totalSupply = await shareVault.totalSupply();
    const totalAssets = await shareVault.totalAssets();
    
    console.log("\n📈 Vault State:");
    console.log("  Total Supply:", ethers.formatEther(totalSupply), "shares");
    console.log("  Total Assets:", ethers.formatEther(totalAssets), "WKAIA");
    
    // Overall stats
    const totalAttempts = stressAttempts + allDeposits.length;
    const totalSuccess = stressSuccess + burstSuccess;
    const totalSyncErrors = stressWethErrors + burstSyncErrors;
    
    console.log("\n📊 Overall Statistics:");
    console.log(`  Total Attempts: ${totalAttempts}`);
    console.log(`  Total Successful: ${totalSuccess}`);
    console.log(`  Total Sync Errors: ${totalSyncErrors}`);
    console.log(`  Overall Success Rate: ${((totalSuccess/totalAttempts)*100).toFixed(2)}%`);
    console.log(`  Sync Error Rate: ${((totalSyncErrors/totalAttempts)*100).toFixed(2)}%`);
    
    if (totalSyncErrors < totalAttempts * 0.1) {
        console.log("\n✅ EXCELLENT! State sync errors below 10%");
    } else if (totalSyncErrors < totalAttempts * 0.2) {
        console.log("\n⚠️ ACCEPTABLE: State sync errors below 20%");
    } else {
        console.log("\n❌ NEEDS IMPROVEMENT: High state sync error rate");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });