const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("════════════════════════════════════════════════");
    console.log("  Stable Deposits & Withdrawals Test");
    console.log("  (with 3s delay between operations)");
    console.log("════════════════════════════════════════════════\n");
    
    const wallet1 = new ethers.Wallet("0x" + process.env.PRIVATE_KEY, ethers.provider);
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
    
    console.log("📋 Configuration:");
    console.log("  ShareVault:", deployments.shareVault);
    console.log("  VaultCore:", deployments.vaultCore);
    console.log("  Wallet:", wallet1.address);
    
    // Check initial state
    const initialWKAIA = await wkaia.balanceOf(wallet1.address);
    const initialShares = await shareVault.balanceOf(wallet1.address);
    
    console.log("\n💰 Initial State:");
    console.log("  User WKAIA:", ethers.formatEther(initialWKAIA));
    console.log("  User Shares:", ethers.formatEther(initialShares));
    
    const results = {
        deposits: { success: 0, failed: 0 },
        withdrawals: { success: 0, failed: 0 }
    };
    
    // Test 1: Multiple deposits with proper delay
    console.log("\n═══════════════════════════════════════");
    console.log("TEST 1: Stable Deposits (3s delay)");
    console.log("═══════════════════════════════════════");
    
    const depositAmounts = [
        ethers.parseEther("0.001"),
        ethers.parseEther("0.002"),
        ethers.parseEther("0.001"),
        ethers.parseEther("0.0015"),
        ethers.parseEther("0.001")
    ];
    
    for (let i = 0; i < depositAmounts.length; i++) {
        const amount = depositAmounts[i];
        console.log(`\nDeposit ${i+1}/${depositAmounts.length}: ${ethers.formatEther(amount)} WKAIA`);
        
        try {
            // Check balance before
            const sharesBefore = await shareVault.balanceOf(wallet1.address);
            
            // Approve and deposit
            await wkaia.connect(wallet1).approve(deployments.shareVault, amount);
            const tx = await shareVault.connect(wallet1).deposit(amount, wallet1.address);
            const receipt = await tx.wait();
            
            // Check shares received
            const sharesAfter = await shareVault.balanceOf(wallet1.address);
            const sharesReceived = sharesAfter - sharesBefore;
            
            console.log("  ✅ Success");
            console.log("  Shares received:", ethers.formatEther(sharesReceived));
            console.log("  Gas used:", receipt.gasUsed.toString());
            
            results.deposits.success++;
            
            // Wait 3 seconds between deposits
            if (i < depositAmounts.length - 1) {
                console.log("  Waiting 3 seconds...");
                await sleep(3000);
            }
        } catch (error) {
            console.log("  ❌ Failed:", error.message);
            results.deposits.failed++;
        }
    }
    
    // Check vault state after deposits
    console.log("\n📊 State After Deposits:");
    const afterDepositShares = await shareVault.balanceOf(wallet1.address);
    const afterDepositAssets = await shareVault.totalAssets();
    const afterDepositSupply = await shareVault.totalSupply();
    
    console.log("  User Shares:", ethers.formatEther(afterDepositShares));
    console.log("  Total Assets:", ethers.formatEther(afterDepositAssets));
    console.log("  Total Supply:", ethers.formatEther(afterDepositSupply));
    
    // Test 2: Multiple withdrawals
    console.log("\n═══════════════════════════════════════");
    console.log("TEST 2: Stable Withdrawals (3s delay)");
    console.log("═══════════════════════════════════════");
    
    const withdrawalPercentages = [10, 20, 30]; // 10%, 20%, 30% of max
    
    for (let i = 0; i < withdrawalPercentages.length; i++) {
        const maxWithdraw = await shareVault.maxWithdraw(wallet1.address);
        const percentage = withdrawalPercentages[i];
        const withdrawAmount = (maxWithdraw * BigInt(percentage)) / 100n;
        
        console.log(`\nWithdrawal ${i+1}/${withdrawalPercentages.length}: ${percentage}% (${ethers.formatEther(withdrawAmount)} WKAIA)`);
        console.log("  Max available:", ethers.formatEther(maxWithdraw));
        
        try {
            // Check WKAIA balance before
            const wkaiaBefore = await wkaia.balanceOf(wallet1.address);
            
            // Check if swap will be needed
            const vaultWKAIA = await wkaia.balanceOf(deployments.vaultCore);
            const needsSwap = vaultWKAIA < withdrawAmount;
            
            if (needsSwap) {
                console.log("  ℹ️ Swap will be needed");
                console.log("    Vault WKAIA:", ethers.formatEther(vaultWKAIA));
                console.log("    Need to swap:", ethers.formatEther(withdrawAmount - vaultWKAIA));
            }
            
            // Execute withdrawal
            const tx = await shareVault.connect(wallet1).withdraw(
                withdrawAmount,
                wallet1.address,
                wallet1.address
            );
            const receipt = await tx.wait();
            
            // Check WKAIA received
            const wkaiaAfter = await wkaia.balanceOf(wallet1.address);
            const wkaiaReceived = wkaiaAfter - wkaiaBefore;
            
            console.log("  ✅ Success");
            console.log("  WKAIA received:", ethers.formatEther(wkaiaReceived));
            console.log("  Expected:", ethers.formatEther(withdrawAmount));
            console.log("  Match:", wkaiaReceived === withdrawAmount ? "✅" : `❌ (diff: ${ethers.formatEther(withdrawAmount - wkaiaReceived)})`);
            console.log("  Gas used:", receipt.gasUsed.toString());
            
            // Check for swap events
            const swapEvents = receipt.logs.filter(log => 
                log.topics[0] === ethers.id("SwapExecuted(uint256,uint256,uint256)")
            );
            
            if (swapEvents.length > 0) {
                console.log(`  ℹ️ ${swapEvents.length} LST swap(s) executed`);
            }
            
            results.withdrawals.success++;
            
            // Wait 3 seconds between withdrawals
            if (i < withdrawalPercentages.length - 1) {
                console.log("  Waiting 3 seconds...");
                await sleep(3000);
            }
        } catch (error) {
            console.log("  ❌ Failed:", error.message);
            results.withdrawals.failed++;
            
            // If withdrawal failed due to swap, note it
            if (error.message.includes("Core withdraw failed")) {
                console.log("    → This is the swap issue we need to fix");
            }
        }
    }
    
    // Final state check
    console.log("\n═══════════════════════════════════════");
    console.log("FINAL STATE & ANALYSIS");
    console.log("═══════════════════════════════════════");
    
    const finalWKAIA = await wkaia.balanceOf(wallet1.address);
    const finalShares = await shareVault.balanceOf(wallet1.address);
    const finalTotalAssets = await shareVault.totalAssets();
    const finalTotalSupply = await shareVault.totalSupply();
    
    console.log("\n💰 Final Balances:");
    console.log("  User WKAIA:", ethers.formatEther(finalWKAIA));
    console.log("  User Shares:", ethers.formatEther(finalShares));
    console.log("  WKAIA change:", ethers.formatEther(finalWKAIA - initialWKAIA));
    
    console.log("\n📈 Vault State:");
    console.log("  Total Assets:", ethers.formatEther(finalTotalAssets));
    console.log("  Total Supply:", ethers.formatEther(finalTotalSupply));
    
    if (finalTotalSupply > 0n) {
        const sharePrice = (finalTotalAssets * ethers.parseEther("1")) / finalTotalSupply;
        console.log("  Share Price: 1 share =", ethers.formatEther(sharePrice), "WKAIA");
    }
    
    // Check for stuck tokens
    console.log("\n🔍 Checking for stuck tokens...");
    const lstNames = ["wKoKAIA", "wGCKAIA", "wstKLAY", "stKAIA"];
    let hasStuckTokens = false;
    
    for (let i = 0; i < 4; i++) {
        const tokenInfo = await vaultCore.tokensInfo(i);
        const tokenContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
        const balance = await tokenContract.balanceOf(deployments.swapContract);
        if (balance > 0) {
            console.log(`  ⚠️ ${lstNames[i]} in SwapContract: ${ethers.formatEther(balance)}`);
            hasStuckTokens = true;
        }
    }
    
    if (!hasStuckTokens) {
        console.log("  ✅ No stuck tokens!");
    }
    
    // Summary
    console.log("\n════════════════════════════════════════");
    console.log("  TEST SUMMARY");
    console.log("════════════════════════════════════════");
    
    console.log("\n📊 Results:");
    console.log(`  Deposits: ${results.deposits.success}/${results.deposits.success + results.deposits.failed} successful`);
    console.log(`  Withdrawals: ${results.withdrawals.success}/${results.withdrawals.success + results.withdrawals.failed} successful`);
    console.log(`  Stuck Tokens: ${hasStuckTokens ? "⚠️ YES" : "✅ NO"}`);
    
    const depositRate = results.deposits.success / (results.deposits.success + results.deposits.failed) * 100;
    const withdrawalRate = results.withdrawals.success / (results.withdrawals.success + results.withdrawals.failed) * 100;
    
    console.log("\n📈 Success Rates:");
    console.log(`  Deposit success rate: ${depositRate.toFixed(1)}%`);
    console.log(`  Withdrawal success rate: ${withdrawalRate.toFixed(1)}%`);
    
    if (depositRate === 100 && withdrawalRate === 100 && !hasStuckTokens) {
        console.log("\n🎉 ALL TESTS PASSED PERFECTLY!");
    } else if (depositRate >= 80 && withdrawalRate >= 60) {
        console.log("\n✅ System mostly working, but needs improvement");
        if (withdrawalRate < 100) {
            console.log("   → Large withdrawals failing due to swap issue");
        }
    } else {
        console.log("\n⚠️ Significant issues detected");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });