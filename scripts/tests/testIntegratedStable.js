const { ethers } = require("hardhat");
const fs = require('fs');
const { spawn } = require('child_process');
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

    console.log("📋 Test Plan:");
    console.log("  1. Deploy fresh contracts with STABLE profile");
    console.log("  2. Test with 3 wallets - deposit & withdraw");
    console.log("  3. Test unstake & claim (optional)");
    console.log("  4. Verify LST distribution");
    console.log("");

    const [deployer] = await ethers.getSigners();
    const wallet1 = new ethers.Wallet(process.env.KAIROS_PRIVATE_KEY, ethers.provider);
    const wallet2 = new ethers.Wallet(process.env.TESTER1_PRIV_KEY, ethers.provider);
    const wallet3 = new ethers.Wallet(process.env.TESTER2_PRIV_KEY, ethers.provider);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: DEPLOY FRESH CONTRACTS WITH STABLE PROFILE
    // ═══════════════════════════════════════════════════════════════════

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 1: DEPLOY FRESH CONTRACTS (STABLE PROFILE)           ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log("📦 Deploying fresh contracts with STABLE profile...\n");

    // Deploy using deployFresh.js which defaults to stable
    await runSubScript('scripts/deployFresh.js', 'Fresh Deployment (STABLE)');

    // Load deployment info
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    const deployments = JSON.parse(fs.readFileSync(`deployments-${networkName}.json`, 'utf8'));

    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);

    console.log("✅ Contracts deployed:");
    console.log(`  ShareVault: ${deployments.shareVault}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    console.log(`  SwapContract: ${deployments.swapContract}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: TEST WITH 3 WALLETS - STABLE PROFILE
    // ═══════════════════════════════════════════════════════════════════

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   STEP 2: 3-WALLET DEPOSIT/WITHDRAW TEST (STABLE)          ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Wallet 1: Large deposit for liquidity
    console.log("1️⃣ Wallet 1 - Large Deposit (3 KAIA)...");
    const shareVault1 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet1);
    let tx = await shareVault1.depositKAIA(wallet1.address, { value: ethers.parseEther("3") });
    await tx.wait();
    console.log("  ✅ Deposited 3 KAIA");

    // Wallet 2: Small deposit
    console.log("\n2️⃣ Wallet 2 - Small Deposit (0.1 KAIA)...");
    const shareVault2 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet2);
    tx = await shareVault2.depositKAIA(wallet2.address, { value: ethers.parseEther("0.1") });
    await tx.wait();
    console.log("  ✅ Deposited 0.1 KAIA");

    // Wallet 3: Small deposit
    console.log("\n3️⃣ Wallet 3 - Small Deposit (0.05 KAIA)...");
    const shareVault3 = await ethers.getContractAt("ShareVault", deployments.shareVault, wallet3);
    tx = await shareVault3.depositKAIA(wallet3.address, { value: ethers.parseEther("0.05") });
    await tx.wait();
    console.log("  ✅ Deposited 0.05 KAIA");

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

    // Test withdrawals
    console.log("\n📤 Testing Withdrawals (STABLE):");

    // Wallet 2: 100% withdrawal
    const maxWithdraw2 = await shareVault.maxWithdraw(wallet2.address);
    tx = await shareVault2.withdraw(maxWithdraw2, wallet2.address, wallet2.address);
    await tx.wait();
    console.log(`  Wallet 2: Withdrew ${ethers.formatEther(maxWithdraw2)} WKAIA (100%)`);

    // Wallet 3: 50% withdrawal
    const maxWithdraw3 = await shareVault.maxWithdraw(wallet3.address);
    const withdraw3Amount = maxWithdraw3 / 2n;
    tx = await shareVault3.withdraw(withdraw3Amount, wallet3.address, wallet3.address);
    await tx.wait();
    console.log(`  Wallet 3: Withdrew ${ethers.formatEther(withdraw3Amount)} WKAIA (50%)`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: OPTIONAL UNSTAKE & CLAIM TEST
    // ═══════════════════════════════════════════════════════════════════

    const runUnstakeClaim = true; // Set to true to run unstake/claim test

    if (runUnstakeClaim) {
        console.log("\n╔══════════════════════════════════════════════════════════════╗");
        console.log("║   STEP 3: UNSTAKE & CLAIM TEST                              ║");
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
    console.log("  2. 3-wallet deposit/withdraw test ✓");
    if (runUnstakeClaim) {
        console.log("  3. Unstake & claim test ✓");
    }

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