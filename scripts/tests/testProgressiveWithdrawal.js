const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

// Helper function to wait for next block
async function waitForNextBlock() {
    const provider = ethers.provider;
    const currentBlock = await provider.getBlockNumber();
    console.log(`  Waiting for next block (current: ${currentBlock})...`);
    while (await provider.getBlockNumber() === currentBlock) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`  New block: ${await provider.getBlockNumber()}`);
}

// Helper function to format percentage
function formatPercent(value, total) {
    if (total == 0n) return "0.00%";
    return ((Number(value) / Number(total)) * 100).toFixed(2) + "%";
}

async function testSingleWallet() {
    console.log("=== SINGLE WALLET PROGRESSIVE WITHDRAWAL TEST ===\n");
    
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    const [signer] = await ethers.getSigners();
    
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
    
    console.log("Wallet address:", signer.address);
    
    // Step 1: Check maxWithdraw and ensure enough shares
    let maxWithdraw = await shareVault.maxWithdraw(signer.address);
    let shares = await shareVault.balanceOf(signer.address);
    console.log("Current shares:", ethers.formatEther(shares));
    console.log("Max withdrawable:", ethers.formatEther(maxWithdraw));
    
    // If not enough shares, deposit some KAIA (native)
    const minRequired = ethers.parseEther("0.1"); // Minimum 0.1 KAIA worth of shares
    if (maxWithdraw < minRequired) {
        console.log("\n📝 Not enough shares, depositing native KAIA...");
        
        const depositAmount = ethers.parseEther("0.2");
        const kaiaBalance = await ethers.provider.getBalance(signer.address);
        
        if (kaiaBalance < depositAmount + ethers.parseEther("0.01")) { // Keep some for gas
            console.log("❌ Not enough KAIA to deposit. Please fund the wallet.");
            return;
        }
        
        // Deposit native KAIA
        const depositTx = await shareVault.depositKAIA(signer.address, { value: depositAmount });
        await depositTx.wait();
        console.log("✅ Deposited", ethers.formatEther(depositAmount), "KAIA");
        
        // Wait for next block before checking again
        await waitForNextBlock();
        
        // Re-check maxWithdraw
        maxWithdraw = await shareVault.maxWithdraw(signer.address);
        shares = await shareVault.balanceOf(signer.address);
        console.log("Updated shares:", ethers.formatEther(shares));
        console.log("Updated max withdrawable:", ethers.formatEther(maxWithdraw));
    }
    
    // Step 2: Progressive withdrawal test
    const percentages = [10, 30, 50, 70, 90];
    const withdrawResults = [];
    
    console.log("\n=== PROGRESSIVE WITHDRAWAL TEST ===");
    console.log("Testing percentages:", percentages.join("%, ") + "%");
    
    for (const percent of percentages) {
        console.log(`\n--- Testing ${percent}% withdrawal ---`);
        
        // Re-check current state
        const currentMax = await shareVault.maxWithdraw(signer.address);
        const currentShares = await shareVault.balanceOf(signer.address);
        
        if (currentShares == 0n) {
            console.log("❌ No shares left to withdraw");
            break;
        }
        
        // Calculate withdrawal amount (percentage of current shares)
        const withdrawShares = (currentShares * BigInt(percent)) / 100n;
        console.log(`Withdrawing ${percent}% of ${ethers.formatEther(currentShares)} = ${ethers.formatEther(withdrawShares)} shares`);
        
        // Check WKAIA balance before
        const wkaiaBefore = await wkaia.balanceOf(signer.address);
        
        // Check LST balances in VaultCore before withdrawal
        console.log("\nLST balances before withdrawal:");
        for (let i = 0; i < 4; i++) {
            const tokenInfo = await vaultCore.tokensInfo(i);
            const tokenA = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
            const balance = await tokenA.balanceOf(deployments.vaultCore);
            if (balance > 0n) {
                console.log(`  LST ${i}: ${ethers.formatEther(balance)}`);
            }
        }
        
        // Execute withdrawal
        try {
            const tx = await shareVault.redeem(
                withdrawShares,
                signer.address,
                signer.address,
                { gasLimit: 1500000 }
            );
            console.log("Transaction sent:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("✅ Withdrawal successful!");
            console.log("Gas used:", receipt.gasUsed.toString());
            
            // Check WKAIA received
            const wkaiaAfter = await wkaia.balanceOf(signer.address);
            const received = wkaiaAfter - wkaiaBefore;
            console.log("WKAIA received:", ethers.formatEther(received));
            
            // Check for swap events
            const swapEvents = receipt.logs.filter(log => {
                try {
                    const parsed = vaultCore.interface.parseLog(log);
                    return parsed && parsed.name === "SwapExecuted";
                } catch {
                    return false;
                }
            });
            
            if (swapEvents.length > 0) {
                console.log(`🔄 ${swapEvents.length} swap(s) executed for multi-LST withdrawal`);
            }
            
            // Store result
            withdrawResults.push({
                percent,
                requested: withdrawShares,
                received,
                swaps: swapEvents.length,
                success: true
            });
            
            // Wait for next block before next withdrawal
            if (percent !== percentages[percentages.length - 1]) {
                await waitForNextBlock();
            }
            
        } catch (error) {
            console.log("❌ Withdrawal failed:", error.message);
            withdrawResults.push({
                percent,
                requested: withdrawShares,
                received: 0n,
                swaps: 0,
                success: false,
                error: error.message
            });
        }
    }
    
    // Summary
    console.log("\n=== WITHDRAWAL TEST SUMMARY ===");
    console.log("┌─────────┬──────────────────┬──────────────────┬───────┬─────────┐");
    console.log("│ Percent │ Requested Shares │ WKAIA Received   │ Swaps │ Status  │");
    console.log("├─────────┼──────────────────┼──────────────────┼───────┼─────────┤");
    for (const result of withdrawResults) {
        const status = result.success ? "✅" : "❌";
        console.log(
            `│ ${result.percent.toString().padEnd(7)} │ ${ethers.formatEther(result.requested).padEnd(16)} │ ${ethers.formatEther(result.received).padEnd(16)} │ ${result.swaps.toString().padEnd(5)} │ ${status}       │`
        );
    }
    console.log("└─────────┴──────────────────┴──────────────────┴───────┴─────────┘");
}

async function testMultiWallet() {
    console.log("\n\n=== MULTI-WALLET CONCURRENT WITHDRAWAL TEST ===\n");
    
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    
    // Use test wallets from .env
    require("dotenv").config();
    const provider = ethers.provider;
    const wallets = [];
    
    // PRIVATE_KEY wallet (main test wallet)
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.log("❌ PRIVATE_KEY not found in .env");
        return;
    }
    const wallet0 = new ethers.Wallet(privateKey, provider);
    wallets.push(wallet0);
    
    // TESTER1_PRIV_KEY wallet
    const tester1PrivKey = process.env.TESTER1_PRIV_KEY;
    if (!tester1PrivKey) {
        console.log("❌ TESTER1_PRIV_KEY not found in .env");
        return;
    }
    const wallet1 = new ethers.Wallet(tester1PrivKey, provider);
    wallets.push(wallet1);
    
    // TESTER2_PRIV_KEY wallet
    const tester2PrivKey = process.env.TESTER2_PRIV_KEY;
    if (!tester2PrivKey) {
        console.log("❌ TESTER2_PRIV_KEY not found in .env");
        return;
    }
    const wallet2 = new ethers.Wallet(tester2PrivKey, provider);
    wallets.push(wallet2);
    
    // Use hardhat signer as funder (it has KAIA)
    const [funder] = await ethers.getSigners();
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
    
    // Check and prepare test wallets
    console.log("Checking test wallets...");
    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        console.log(`\nWallet ${i + 1}: ${wallet.address}`);
        
        // Check existing shares
        let shares = await shareVault.balanceOf(wallet.address);
        console.log(`  Current shares: ${ethers.formatEther(shares)}`);
        
        // If wallet doesn't have enough shares, deposit some
        const minShares = ethers.parseEther("0.01");
        if (shares < minShares) {
            console.log(`  Depositing to get shares...`);
            
            // Check KAIA balance
            const kaiaBalance = await provider.getBalance(wallet.address);
            const depositAmount = ethers.parseEther("0.05");
            
            // Only fund if needed (skip for main signer as it should have funds)
            if (i > 0 && kaiaBalance < depositAmount + ethers.parseEther("0.01")) {
                console.log(`  Funding wallet...`);
                const fundTx = await funder.sendTransaction({
                    to: wallet.address,
                    value: ethers.parseEther("0.06")
                });
                await fundTx.wait();
            }
            
            // Deposit native KAIA
            try {
                const depositTx = await shareVault.connect(wallet).depositKAIA(wallet.address, { value: depositAmount });
                await depositTx.wait();
                shares = await shareVault.balanceOf(wallet.address);
                console.log(`  New shares: ${ethers.formatEther(shares)}`);
            } catch (error) {
                console.log(`  ❌ Deposit failed: ${error.message}`);
            }
        }
    }
    
    // Wait for next block
    await waitForNextBlock();
    
    // Test concurrent withdrawals
    console.log("\n=== CONCURRENT WITHDRAWAL TEST ===");
    console.log("All 3 wallets will attempt to withdraw 50% simultaneously...\n");
    
    const promises = [];
    const results = [];
    
    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const walletShareVault = shareVault.connect(wallet);
        
        const withdrawPromise = (async () => {
            const shares = await shareVault.balanceOf(wallet.address);
            const withdrawAmount = shares / 2n; // 50% withdrawal
            
            const wkaiaBefore = await wkaia.balanceOf(wallet.address);
            
            try {
                const tx = await walletShareVault.redeem(
                    withdrawAmount,
                    wallet.address,
                    wallet.address,
                    { gasLimit: 1500000 }
                );
                
                const receipt = await tx.wait();
                const wkaiaAfter = await wkaia.balanceOf(wallet.address);
                const received = wkaiaAfter - wkaiaBefore;
                
                return {
                    wallet: i + 1,
                    address: wallet.address,
                    success: true,
                    shares: withdrawAmount,
                    received,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed
                };
            } catch (error) {
                return {
                    wallet: i + 1,
                    address: wallet.address,
                    success: false,
                    shares: withdrawAmount,
                    received: 0n,
                    error: error.message
                };
            }
        })();
        
        promises.push(withdrawPromise);
    }
    
    // Execute all withdrawals concurrently
    const withdrawResults = await Promise.all(promises);
    
    // Display results
    console.log("=== CONCURRENT WITHDRAWAL RESULTS ===");
    console.log("┌────────┬──────────────┬─────────┬──────────────────┬──────────┐");
    console.log("│ Wallet │ Shares       │ Status  │ WKAIA Received   │ Block    │");
    console.log("├────────┼──────────────┼─────────┼──────────────────┼──────────┤");
    
    let sameBlockCount = 0;
    const blockNumbers = new Set();
    
    for (const result of withdrawResults) {
        const status = result.success ? "✅" : "❌";
        const block = result.blockNumber || "N/A";
        if (result.blockNumber) blockNumbers.add(result.blockNumber);
        
        console.log(
            `│ ${result.wallet.toString().padEnd(6)} │ ${ethers.formatEther(result.shares).substring(0, 12).padEnd(12)} │ ${status}       │ ${ethers.formatEther(result.received).substring(0, 16).padEnd(16)} │ ${block.toString().padEnd(8)} │`
        );
    }
    console.log("└────────┴──────────────┴─────────┴──────────────────┴──────────┘");
    
    const successCount = withdrawResults.filter(r => r.success).length;
    console.log(`\n✅ Success: ${successCount}/3`);
    console.log(`📦 Unique blocks used: ${blockNumbers.size}`);
    
    if (blockNumbers.size === 1) {
        console.log("✨ All withdrawals processed in the same block!");
    } else {
        console.log("⚠️ Withdrawals were processed across multiple blocks");
    }
}

async function main() {
    try {
        // Run single wallet test
        await testSingleWallet();
        
        // Run multi-wallet test
        await testMultiWallet();
        
        console.log("\n✅ All tests completed!");
        
    } catch (error) {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });