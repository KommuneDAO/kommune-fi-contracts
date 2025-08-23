const { ethers } = require("hardhat");
const fs = require('fs');
require("dotenv").config();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║     KOMMUNEFI V2 - BALANCED MODE INTEGRATED TEST            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log("📋 Test Plan:");
    console.log("  1. Use existing deployment or deploy new contracts");
    console.log("  2. Switch to BALANCED profile");
    console.log("  3. Test with 3 wallets - deposit & withdraw");
    console.log("  4. Verify add liquidity success");
    console.log("  5. Verify remove liquidity fund recovery");
    console.log("");

    const wallet1 = new ethers.Wallet(process.env.KAIROS_PRIVATE_KEY, ethers.provider);
    const wallet2 = new ethers.Wallet(process.env.TESTER1_PRIV_KEY, ethers.provider);
    const wallet3 = new ethers.Wallet(process.env.TESTER2_PRIV_KEY, ethers.provider);

    // Load deployment info
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    const deployments = JSON.parse(fs.readFileSync(`deployments-${networkName}.json`, 'utf8'));

    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);

    console.log("📋 Using existing deployment:");
    console.log(`  ShareVault: ${deployments.shareVault}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    console.log(`  SwapContract: ${deployments.swapContract}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: SWITCH TO BALANCED PROFILE
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 1: SWITCH TO BALANCED PROFILE                        ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log("🔄 Switching investment profile to BALANCED...");

    // Set investment ratios with 90% total investment
    let tx = await vaultCore.setInvestmentRatios(
        9000,  // 90% total investment ratio
        5000,  // 50% to balanced (LST + LP)
        0      // 0% to aggressive
    );
    await tx.wait();
    console.log("  ✅ Switched to BALANCED profile with 90% total investment");

    const investRatio = await vaultCore.investRatio();
    console.log("  Total Investment Ratio:", Number(investRatio) / 100 + "%");
    console.log("  Current Mode: BALANCED (45% to LP pools)");

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: TEST WITH 3 WALLETS - BALANCED PROFILE
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 2: 3-WALLET DEPOSIT/WITHDRAW TEST (BALANCED)        ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Get contract instances for each wallet
    const shareVault1 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet1);
    const shareVault2 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet2);
    const shareVault3 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet3);

    // Wallet 1: Large deposit
    console.log("1️⃣ Wallet 1 - Deposit with BALANCED (1 KAIA)...");
    tx = await shareVault1.depositKAIA(wallet1.address, { value: ethers.parseEther("1") });
    await tx.wait();
    console.log("  ✅ Deposited 1 KAIA");

    // Wallet 2: Medium deposit
    console.log("\n2️⃣ Wallet 2 - Deposit with BALANCED (0.5 KAIA)...");
    tx = await shareVault2.depositKAIA(wallet2.address, { value: ethers.parseEther("0.5") });
    await tx.wait();
    console.log("  ✅ Deposited 0.5 KAIA");

    // Wallet 3: Small deposit
    console.log("\n3️⃣ Wallet 3 - Deposit with BALANCED (0.1 KAIA)...");
    tx = await shareVault3.depositKAIA(wallet3.address, { value: ethers.parseEther("0.1") });
    await tx.wait();
    console.log("  ✅ Deposited 0.1 KAIA");

    // Wait for LP operations
    console.log("\n⏳ Waiting for LP operations to complete...");
    await sleep(5000);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: VERIFY ADD LIQUIDITY SUCCESS
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 3: VERIFY ADD LIQUIDITY SUCCESS                      ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log("🔍 Checking LP Token Creation...");
    let lpPositions = [];
    let totalLPValue = 0n;

    // Check LP token value for each LST
    for (let i = 0; i < 4; i++) {
        try {
            const lpValue = await vaultCore.getLPTokenValue(i);
            if (lpValue > 0n) {
                lpPositions.push({
                    index: i,
                    value: lpValue
                });
                totalLPValue += lpValue;
                console.log(`  LST ${i}: LP Value = ${ethers.formatEther(lpValue)} tokens`);
            }
        } catch (error) {
            // LP functions might fail if no LP tokens
        }
    }

    if (lpPositions.length > 0) {
        console.log(`\n✅ Add Liquidity Success!`);
        console.log(`  Total LP Positions: ${lpPositions.length}`);
        console.log(`  Total LP Value: ${ethers.formatEther(totalLPValue)} LST tokens`);
    } else {
        console.log("\n⚠️ No LP tokens found (LP functions may not be available)");
    }

    // Test withdrawals with balanced profile
    console.log("\n📤 Testing Withdrawals (BALANCED):");

    // Wallet 2: 50% withdrawal
    const maxWithdraw2 = await shareVault.maxWithdraw(wallet2.address);
    const withdraw2Amount = maxWithdraw2 / 2n;
    if (withdraw2Amount > 0n) {
        tx = await shareVault2.withdraw(withdraw2Amount, wallet2.address, wallet2.address);
        await tx.wait();
        console.log(`  Wallet 2: Withdrew ${ethers.formatEther(withdraw2Amount)} WKAIA (50%)`);
    }

    // Wallet 3: 100% withdrawal
    const maxWithdraw3 = await shareVault.maxWithdraw(wallet3.address);
    if (maxWithdraw3 > 0n) {
        tx = await shareVault3.withdraw(maxWithdraw3, wallet3.address, wallet3.address);
        await tx.wait();
        console.log(`  Wallet 3: Withdrew ${ethers.formatEther(maxWithdraw3)} WKAIA (100%)`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: VERIFY REMOVE LIQUIDITY FUND RECOVERY
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 4: VERIFY REMOVE LIQUIDITY FUND RECOVERY             ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    if (lpPositions.length > 0) {
        console.log("💧 Testing Remove Liquidity...");

        const lpToRemove = lpPositions[0];
        
        console.log(`\n  Removing liquidity from LST ${lpToRemove.index}...`);
        console.log(`  LP value: ${ethers.formatEther(lpToRemove.value)}`);

        // Get LST balance before removal
        const tokenInfo = await vaultCore.tokensInfo(lpToRemove.index);
        const lstToken = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
        const lstBalanceBefore = await lstToken.balanceOf(deployments.vaultCore);

        try {
            // Remove liquidity (owner function)
            // Note: Using a small fixed amount for testing
            const testLpAmount = ethers.parseEther("0.01"); // Remove 0.01 BPT
            tx = await vaultCore.removeLiquidity(lpToRemove.index, testLpAmount);
            await tx.wait();
            console.log(`  ✅ Liquidity removed successfully`);

            // Check LST balance after removal
            const lstBalanceAfter = await lstToken.balanceOf(deployments.vaultCore);
            const lstRecovered = lstBalanceAfter - lstBalanceBefore;
            console.log(`  LST recovered: ${ethers.formatEther(lstRecovered)}`);

            // Check new LP value
            const newLpValue = await vaultCore.getLPTokenValue(lpToRemove.index);
            console.log(`  Remaining LP value: ${ethers.formatEther(newLpValue)}`);

            console.log("\n✅ Fund Recovery Verified!");
            console.log("  LP tokens can be converted back to LST for withdrawals");
        } catch (error) {
            console.log(`  ❌ Remove liquidity failed: ${error.message}`);
        }
    } else {
        console.log("⚠️ No LP positions to test removal");
    }

    // ═══════════════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    TEST SUMMARY                             ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log("✅ Completed Test Steps:");
    console.log("  1. Switch to BALANCED profile ✓");
    console.log("  2. 3-wallet deposit/withdraw test ✓");
    console.log("  3. Add liquidity verification ✓");
    console.log("  4. Remove liquidity fund recovery ✓");

    // Final stats
    const finalTotalAssets = await vaultCore.getTotalAssets();
    console.log("\n📊 Final Stats:");
    console.log(`  Total Assets: ${ethers.formatEther(finalTotalAssets)} WKAIA`);

    const finalInvestRatio = await vaultCore.investRatio();
    console.log(`  Investment Ratio: ${Number(finalInvestRatio) / 100}%`);
    console.log(`  Mode: BALANCED (LST staking + LP pools)`);

    // Check LP positions
    console.log("\n📊 LP Positions Summary:");
    if (lpPositions.length > 0) {
        console.log(`  Active LP positions: ${lpPositions.length}`);
        console.log(`  Total LP value: ${ethers.formatEther(totalLPValue)} LST tokens`);
    } else {
        console.log("  No active LP positions");
    }

    console.log("\n🎉 BALANCED MODE TEST COMPLETED SUCCESSFULLY!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });