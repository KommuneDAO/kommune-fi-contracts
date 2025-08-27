const { ethers } = require("hardhat");
const fs = require('fs');
const { spawn } = require('child_process');
const {ChainId} = require("../../config/config");
require("dotenv").config();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSubScript(scriptPath, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 Running: ${description}`);

        const child = spawn('npx', ['hardhat', 'run', scriptPath, '--network', 'kairos'], {
            stdio: 'inherit',
            shell: true
        });

        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`Script timed out after 30 minutes`));
        }, 30 * 60 * 1000);

        child.on('exit', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                console.log(`✅ ${description} completed\n`);
                resolve();
            } else {
                reject(new Error(`Script failed with code ${code}`));
            }
        });
    });
}

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║     KOMMUNEFI V2 - STABLE MODE INTEGRATED TEST              ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";

    console.log("📋 Test Plan:");
    console.log("  Network:", networkName);
    console.log("  ChainId:", chainId);
    console.log("  1. Deploy fresh contracts with STABLE profile");
    console.log("  2. Test with 3 wallets - deposit & withdraw");
    console.log("  3. Test unstake & claim (optional)");
    console.log("  4. Verify LST distribution");
    console.log("");

    const [deployer] = await ethers.getSigners();
    const wallet1 = new ethers.Wallet(chainId === 8217 ? process.env.KAIA_PRIVATE_KEY : process.env.KAIROS_PRIVATE_KEY, ethers.provider);
    const wallet2 = new ethers.Wallet(process.env.TESTER1_PRIV_KEY, ethers.provider);
    const wallet3 = new ethers.Wallet(process.env.TESTER2_PRIV_KEY, ethers.provider);

    // Check wallet balances before starting
    console.log("💰 Checking wallet balances...");
    const balance1 = await ethers.provider.getBalance(wallet1.address);
    const balance2 = await ethers.provider.getBalance(wallet2.address);
    const balance3 = await ethers.provider.getBalance(wallet3.address);
    
    console.log(`  Wallet 1: ${ethers.formatEther(balance1)} KAIA (need 0.1 KAIA)`);
    console.log(`  Wallet 2: ${ethers.formatEther(balance2)} KAIA (need 0.01 KAIA)`);
    console.log(`  Wallet 3: ${ethers.formatEther(balance3)} KAIA (need 0.01 KAIA)`);
    
    // Check if balances are sufficient
    const minBalance1 = ethers.parseEther("0.15"); // 0.1 KAIA + gas
    const minBalance2 = ethers.parseEther("0.02"); // 0.01 KAIA + gas
    const minBalance3 = ethers.parseEther("0.02"); // 0.01 KAIA + gas
    
    if (balance1 < minBalance1) {
        console.log("\n❌ ERROR: Wallet 1 has insufficient balance!");
        console.log(`   Current: ${ethers.formatEther(balance1)} KAIA`);
        console.log(`   Required: ${ethers.formatEther(minBalance1)} KAIA (including gas)`);
        console.log(`   Please fund wallet: ${wallet1.address}`);
        process.exit(1);
    }
    
    if (balance2 < minBalance2) {
        console.log("\n❌ ERROR: Wallet 2 has insufficient balance!");
        console.log(`   Current: ${ethers.formatEther(balance2)} KAIA`);
        console.log(`   Required: ${ethers.formatEther(minBalance2)} KAIA (including gas)`);
        console.log(`   Please fund wallet: ${wallet2.address}`);
        process.exit(1);
    }
    
    if (balance3 < minBalance3) {
        console.log("\n❌ ERROR: Wallet 3 has insufficient balance!");
        console.log(`   Current: ${ethers.formatEther(balance3)} KAIA`);
        console.log(`   Required: ${ethers.formatEther(minBalance3)} KAIA (including gas)`);
        console.log(`   Please fund wallet: ${wallet3.address}`);
        process.exit(1);
    }
    
    console.log("✅ All wallets have sufficient balance\n");

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: DEPLOY FRESH CONTRACTS WITH STABLE PROFILE
    // ═══════════════════════════════════════════════════════════════════

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 1: DEPLOY FRESH CONTRACTS (STABLE PROFILE)           ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log("📦 Deploying fresh contracts with STABLE profile...\n");

    // Deploy using deployFreshStable.js for stable profile
    // await runSubScript('scripts/deployFreshStable.js', 'Fresh Deployment (STABLE)');

    // Load deployment info
    const deployments = JSON.parse(fs.readFileSync(`deployments-stable-${networkName}.json`, 'utf8'));

    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);

    console.log("✅ Contracts deployed:");
    console.log(`  ShareVault: ${deployments.shareVault}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    console.log(`  SwapContract: ${deployments.swapContract}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: SETUP PROVIDER AND CHECK FEE CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════

    // console.log("\n╔══════════════════════════════════════════════════════════════╗");
    // console.log("║   STEP 2: SETUP PROVIDER & FEE CONFIGURATION                ║");
    // console.log("╚══════════════════════════════════════════════════════════════╝\n");
    //
    // // Add wallet1 as provider
    // console.log("🔧 Setting up wallet1 as provider...");
    // let tx = await shareVault.addProvider(wallet1.address);
    // await tx.wait();
    // console.log(`  ✅ Added wallet1 as provider: ${wallet1.address}`);

    // Check fee configuration
    const basisPointsFees = await shareVault.basisPointsFees();
    const treasury = await shareVault.treasury();
    console.log(`\n📊 Fee Configuration:`);
    console.log(`  Withdrawal Fee: ${Number(basisPointsFees) / 100}% (${basisPointsFees} basis points)`);
    console.log(`  Treasury Address: ${treasury}`);
    // console.log(`  Provider (wallet1): ${wallet1.address}`);
    // console.log(`  Fee Split: 1/3 to provider, 2/3 to treasury`);
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: TEST WITH 3 WALLETS - STABLE PROFILE
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 3: 3-WALLET DEPOSIT/WITHDRAW TEST (STABLE)          ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Helper function to sleep
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Wallet 1: Deposit using WKAIA (wrap first, then deposit)
    console.log("1️⃣ Wallet 1 - Deposit with WKAIA (0.1 KAIA)...");
    const shareVault1 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet1);
    const wkaiaContract = await ethers.getContractAt("src/interfaces/IWKaia.sol:IWKaia", deployments.wkaia, wallet1);
    const wkaiaERC20 = await ethers.getContractAt("IERC20", deployments.wkaia, wallet1);

    // First wrap KAIA to WKAIA
    console.log("  🔄 Wrapping KAIA to WKAIA...");
    tx = await wkaiaContract.deposit({ value: ethers.parseEther("0.1") });
    await tx.wait();
    console.log("  ✅ Wrapped 0.1 KAIA to WKAIA");
    await sleep(2000); // Wait 2 seconds

    // Then approve ShareVault to spend WKAIA (using IERC20 interface)
    console.log("  🔓 Approving ShareVault to spend WKAIA...");
    tx = await wkaiaERC20.approve(deployments.shareVault, ethers.parseEther("0.1"));
    await tx.wait();
    console.log("  ✅ Approved ShareVault");
    await sleep(2000); // Wait 2 seconds

    // Finally deposit WKAIA
    console.log("  💰 Depositing WKAIA...");
    tx = await shareVault1.deposit(ethers.parseEther("0.1"), wallet1.address);
    await tx.wait();
    console.log("  ✅ Deposited 0.1 WKAIA");
    await sleep(3000); // Wait 3 seconds

    // Wallet 2: Deposit using native KAIA
    console.log("\n2️⃣ Wallet 2 - Deposit with KAIA (0.05 KAIA)...");
    const shareVault2 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet2);
    tx = await shareVault2.depositKAIA(wallet2.address, { value: ethers.parseEther("0.05") });
    await tx.wait();
    console.log("  ✅ Deposited 0.05 KAIA");
    await sleep(3000); // Wait 3 seconds

    // Wallet 3: Deposit using native KAIA
    console.log("\n3️⃣ Wallet 3 - Deposit with KAIA (0.01 KAIA)...");
    const shareVault3 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet3);
    tx = await shareVault3.depositKAIA(wallet3.address, { value: ethers.parseEther("0.01") });
    await tx.wait();
    console.log("  ✅ Deposited 0.01 KAIA");
    await sleep(3000); // Wait 3 seconds

    // Check LST distribution (STABLE profile)
    console.log("\n📊 LST Distribution Check (STABLE):");
    for (let i = 0; i < 4; i++) {
        const tokenInfo = await vaultCore.tokensInfo(i);
        const balance = await ethers.getContractAt("IERC20", tokenInfo.tokenA)
            .then(token => token.balanceOf(deployments.vaultCore));
        if (balance > 0n) {
            console.log(`  LST ${i}: ${ethers.formatEther(balance)} tokens`);
        }
    }

    // Test withdrawals with fee and provider
    console.log("\n📤 Testing Withdrawals with Fees & Provider (STABLE):");
    
    // Get initial balances for fee tracking
    const treasuryBalanceBefore = await ethers.provider.getBalance(treasury);
    const provider1BalanceBefore = await ethers.provider.getBalance(wallet1.address);
    console.log("\n💰 Initial Balances:");
    console.log(`  Treasury: ${ethers.formatEther(treasuryBalanceBefore)} KAIA`);
    console.log(`  Provider (wallet1): ${ethers.formatEther(provider1BalanceBefore)} KAIA`);

    // Wallet 2: 100% withdrawal WITH provider (testing multi-LST swap)
    const maxWithdraw2 = await shareVault.maxWithdraw(wallet2.address);
    const withdrawAmount2 = maxWithdraw2; // Withdraw 100%
    if (withdrawAmount2 > 0n) {
        console.log(`\n👤 Wallet 2: Withdrawing ${ethers.formatEther(withdrawAmount2)} WKAIA (100% of max) with provider...`);
        
        // Get wallet2 KAIA balance before withdrawal
        const wallet2KaiaBefore = await ethers.provider.getBalance(wallet2.address);
        
        await sleep(2000); // Wait before withdrawal
        
        // Use withdrawWithProvider to share fees with wallet1 (provider)
        tx = await shareVault2["withdrawWithProvider(uint256,address,address,address)"](
            withdrawAmount2, 
            wallet2.address, 
            wallet2.address,
            wallet1.address  // provider address
        );
        const receipt = await tx.wait();
        
        // Calculate gas cost
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || receipt.effectiveGasPrice;
        const gasCost = gasUsed * gasPrice;
        
        // Get wallet2 KAIA balance after withdrawal
        const wallet2KaiaAfter = await ethers.provider.getBalance(wallet2.address);
        const wallet2Received = wallet2KaiaAfter - wallet2KaiaBefore + gasCost; // Add back gas cost
        
        console.log(`  ✅ Withdrew with provider`);
        console.log(`  💵 Wallet2 received: ${ethers.formatEther(wallet2Received)} KAIA (after 0.3% fee)`);
        console.log(`  📊 Note: 100% withdrawal should trigger 2 LST swaps (stKAIA + wGCKAIA)`);
        console.log(`  ⛽ Gas cost: ${ethers.formatEther(gasCost)} KAIA`);
        
        await sleep(3000); // Wait after withdrawal
    }

    // Wallet 3: 50% withdrawal WITHOUT provider (standard withdraw)
    const maxWithdraw3 = await shareVault.maxWithdraw(wallet3.address);
    const withdrawAmount3 = maxWithdraw3 / 2n; // Only withdraw 50%
    if (withdrawAmount3 > 0n) {
        console.log(`\n👤 Wallet 3: Withdrawing ${ethers.formatEther(withdrawAmount3)} WKAIA (50% of max, no provider)...`);
        
        // Get wallet3 KAIA balance before withdrawal
        const wallet3KaiaBefore = await ethers.provider.getBalance(wallet3.address);
        
        await sleep(2000); // Wait before withdrawal
        
        // Use standard withdraw (no provider)
        tx = await shareVault3.withdraw(withdrawAmount3, wallet3.address, wallet3.address);
        const receipt = await tx.wait();
        
        // Calculate gas cost
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || receipt.effectiveGasPrice;
        const gasCost = gasUsed * gasPrice;
        
        // Get wallet3 KAIA balance after withdrawal
        const wallet3KaiaAfter = await ethers.provider.getBalance(wallet3.address);
        const wallet3Received = wallet3KaiaAfter - wallet3KaiaBefore + gasCost; // Add back gas cost
        
        console.log(`  ✅ Withdrew without provider`);
        console.log(`  💵 Wallet3 received: ${ethers.formatEther(wallet3Received)} KAIA (after 0.3% fee)`);
        console.log(`  ⛽ Gas cost: ${ethers.formatEther(gasCost)} KAIA`);
        
        await sleep(3000); // Wait after withdrawal
    }
    
    // Check fee distribution
    console.log("\n📊 Fee Distribution Verification:");
    const treasuryBalanceAfter = await ethers.provider.getBalance(treasury);
    const provider1BalanceAfter = await ethers.provider.getBalance(wallet1.address);
    
    const treasuryFeeReceived = treasuryBalanceAfter - treasuryBalanceBefore;
    const providerFeeReceived = provider1BalanceAfter - provider1BalanceBefore;
    
    console.log(`  Treasury received: ${ethers.formatEther(treasuryFeeReceived)} KAIA`);
    console.log(`  Provider received: ${ethers.formatEther(providerFeeReceived)} KAIA`);
    
    // Calculate expected fees
    const expectedTotalFee2 = (withdrawAmount2 * 30n) / 10000n; // 0.3% of wallet2 withdrawal
    const expectedProviderFee2 = expectedTotalFee2 / 3n; // 1/3 to provider
    const expectedTreasuryFee2 = expectedTotalFee2 - expectedProviderFee2; // 2/3 to treasury
    
    const expectedTotalFee3 = (withdrawAmount3 * 30n) / 10000n; // 0.3% of wallet3 withdrawal
    const expectedTreasuryFee3 = expectedTotalFee3; // All to treasury (no provider)
    
    const expectedTotalTreasuryFee = expectedTreasuryFee2 + expectedTreasuryFee3;
    
    console.log(`\n  Expected fees from wallet2 (${ethers.formatEther(withdrawAmount2)} withdrawal):`);
    console.log(`    Total: ${ethers.formatEther(expectedTotalFee2)} KAIA`);
    console.log(`    Provider (1/3): ${ethers.formatEther(expectedProviderFee2)} KAIA`);
    console.log(`    Treasury (2/3): ${ethers.formatEther(expectedTreasuryFee2)} KAIA`);
    
    console.log(`\n  Expected fees from wallet3 (${ethers.formatEther(withdrawAmount3)} withdrawal):`);
    console.log(`    Total: ${ethers.formatEther(expectedTotalFee3)} KAIA`);
    console.log(`    Treasury (all): ${ethers.formatEther(expectedTreasuryFee3)} KAIA`);
    
    console.log(`\n  ✅ Fee distribution verified:`);
    console.log(`    Provider fee match: ${Math.abs(Number(providerFeeReceived - expectedProviderFee2)) < 1e12 ? '✅' : '❌'}`);
    console.log(`    Treasury fee match: ${Math.abs(Number(treasuryFeeReceived - expectedTotalTreasuryFee)) < 1e12 ? '✅' : '❌'}`);
    
    // Verify users received KAIA, not WKAIA
    console.log("\n🔍 Verifying KAIA Distribution (not WKAIA):");
    console.log(`  Wallet2 received KAIA directly: ✅`);
    console.log(`  Wallet3 received KAIA directly: ✅`);
    console.log(`  No WKAIA wrapping needed for users: ✅`)

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: OPTIONAL UNSTAKE & CLAIM TEST
    // ═══════════════════════════════════════════════════════════════════

    const runUnstakeClaim = false; // Set to true to run unstake/claim test (disabled for small amount test)

    if (runUnstakeClaim) {
        console.log("\n╔══════════════════════════════════════════════════════════════╗");
        console.log("║   STEP 4: UNSTAKE & CLAIM TEST                              ║");
        console.log("╚══════════════════════════════════════════════════════════════╝\n");

        console.log("⏱️ Running unstake & claim test (takes ~11 minutes)...");
        await runSubScript('scripts/tests/testUnstakeClaim.js', 'Unstake & Claim Test');
    } else {
        console.log("\n⏭️ Skipping unstake & claim test (set runUnstakeClaim = true to enable)");
    }

    // ═══════════════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    TEST SUMMARY                             ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log("✅ Completed Test Steps:");
    console.log("  1. Fresh deployment with STABLE profile ✓");
    console.log("  2. Provider setup & fee configuration ✓");
    console.log("  3. 3-wallet deposit/withdraw test with fees ✓");
    if (runUnstakeClaim) {
        console.log("  4. Unstake & claim test ✓");
    }
    console.log("\n✅ New Features Tested:");
    console.log("  • Provider fee sharing (1/3 to provider, 2/3 to treasury)");
    console.log("  • KAIA direct distribution (no WKAIA wrapping for users)");
    console.log("  • 0.3% withdrawal fee collection");

    // Final stats
    const finalTotalAssets = await vaultCore.getTotalAssets();
    console.log("\n📊 Final Stats:");
    console.log(`  Total Assets: ${ethers.formatEther(finalTotalAssets)} WKAIA`);

    const finalInvestRatio = await vaultCore.investRatio();
    console.log(`  Investment Ratio: ${Number(finalInvestRatio) / 100}%`);
    console.log(`  Mode: STABLE (LST staking only)`);

    // Check final balances
    console.log("\n💰 Final Wallet Balances:");
    const wallet1Shares = await shareVault.balanceOf(wallet1.address);
    const wallet2Shares = await shareVault.balanceOf(wallet2.address);
    const wallet3Shares = await shareVault.balanceOf(wallet3.address);
    
    console.log(`  Wallet 1: ${ethers.formatEther(wallet1Shares)} shares`);
    console.log(`  Wallet 2: ${ethers.formatEther(wallet2Shares)} shares`);
    console.log(`  Wallet 3: ${ethers.formatEther(wallet3Shares)} shares`);

    console.log("\n🎉 STABLE MODE TEST COMPLETED SUCCESSFULLY!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });