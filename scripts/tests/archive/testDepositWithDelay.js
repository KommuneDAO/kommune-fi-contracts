const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("════════════════════════════════════════════════");
    console.log("  Deposit Test with Delay Analysis");
    console.log("════════════════════════════════════════════════\n");
    
    const wallet1 = new ethers.Wallet("0x" + process.env.PRIVATE_KEY, ethers.provider);
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
    
    console.log("📋 Test Configuration:");
    console.log("  ShareVault:", deployments.shareVault);
    console.log("  VaultCore:", deployments.vaultCore);
    console.log("  Wallet:", wallet1.address);
    
    // Check initial balances
    const initialWKAIA = await wkaia.balanceOf(wallet1.address);
    console.log("\n💰 Initial WKAIA balance:", ethers.formatEther(initialWKAIA));
    
    const testResults = {
        noDelay: { success: 0, failed: 0 },
        delay1s: { success: 0, failed: 0 },
        delay3s: { success: 0, failed: 0 },
        delay5s: { success: 0, failed: 0 },
        delay10s: { success: 0, failed: 0 }
    };
    
    // Test 1: No delay between deposits
    console.log("\n═══════════════════════════════════════");
    console.log("TEST 1: No Delay Between Deposits");
    console.log("═══════════════════════════════════════");
    
    for (let i = 0; i < 5; i++) {
        try {
            const amount = ethers.parseEther("0.0005");
            console.log(`  Deposit ${i+1}/5:`, ethers.formatEther(amount), "WKAIA");
            
            await wkaia.connect(wallet1).approve(deployments.shareVault, amount);
            const tx = await shareVault.connect(wallet1).deposit(amount, wallet1.address);
            await tx.wait();
            
            console.log("    ✅ Success");
            testResults.noDelay.success++;
        } catch (error) {
            console.log("    ❌ Failed:", error.message.substring(0, 50));
            testResults.noDelay.failed++;
        }
    }
    
    // Test 2: 1 second delay
    console.log("\n═══════════════════════════════════════");
    console.log("TEST 2: 1 Second Delay Between Deposits");
    console.log("═══════════════════════════════════════");
    
    for (let i = 0; i < 5; i++) {
        try {
            const amount = ethers.parseEther("0.0005");
            console.log(`  Deposit ${i+1}/5:`, ethers.formatEther(amount), "WKAIA");
            
            await wkaia.connect(wallet1).approve(deployments.shareVault, amount);
            const tx = await shareVault.connect(wallet1).deposit(amount, wallet1.address);
            await tx.wait();
            
            console.log("    ✅ Success");
            testResults.delay1s.success++;
            
            if (i < 4) await sleep(1000);
        } catch (error) {
            console.log("    ❌ Failed:", error.message.substring(0, 50));
            testResults.delay1s.failed++;
        }
    }
    
    // Test 3: 3 second delay
    console.log("\n═══════════════════════════════════════");
    console.log("TEST 3: 3 Second Delay Between Deposits");
    console.log("═══════════════════════════════════════");
    
    for (let i = 0; i < 5; i++) {
        try {
            const amount = ethers.parseEther("0.0005");
            console.log(`  Deposit ${i+1}/5:`, ethers.formatEther(amount), "WKAIA");
            
            await wkaia.connect(wallet1).approve(deployments.shareVault, amount);
            const tx = await shareVault.connect(wallet1).deposit(amount, wallet1.address);
            await tx.wait();
            
            console.log("    ✅ Success");
            testResults.delay3s.success++;
            
            if (i < 4) await sleep(3000);
        } catch (error) {
            console.log("    ❌ Failed:", error.message.substring(0, 50));
            testResults.delay3s.failed++;
        }
    }
    
    // Test 4: 5 second delay
    console.log("\n═══════════════════════════════════════");
    console.log("TEST 4: 5 Second Delay Between Deposits");
    console.log("═══════════════════════════════════════");
    
    for (let i = 0; i < 5; i++) {
        try {
            const amount = ethers.parseEther("0.0005");
            console.log(`  Deposit ${i+1}/5:`, ethers.formatEther(amount), "WKAIA");
            
            await wkaia.connect(wallet1).approve(deployments.shareVault, amount);
            const tx = await shareVault.connect(wallet1).deposit(amount, wallet1.address);
            await tx.wait();
            
            console.log("    ✅ Success");
            testResults.delay5s.success++;
            
            if (i < 4) await sleep(5000);
        } catch (error) {
            console.log("    ❌ Failed:", error.message.substring(0, 50));
            testResults.delay5s.failed++;
        }
    }
    
    // Test 5: 10 second delay
    console.log("\n═══════════════════════════════════════");
    console.log("TEST 5: 10 Second Delay Between Deposits");
    console.log("═══════════════════════════════════════");
    
    for (let i = 0; i < 3; i++) { // Only 3 deposits due to longer delay
        try {
            const amount = ethers.parseEther("0.0005");
            console.log(`  Deposit ${i+1}/3:`, ethers.formatEther(amount), "WKAIA");
            
            await wkaia.connect(wallet1).approve(deployments.shareVault, amount);
            const tx = await shareVault.connect(wallet1).deposit(amount, wallet1.address);
            await tx.wait();
            
            console.log("    ✅ Success");
            testResults.delay10s.success++;
            
            if (i < 2) await sleep(10000);
        } catch (error) {
            console.log("    ❌ Failed:", error.message.substring(0, 50));
            testResults.delay10s.failed++;
        }
    }
    
    // Final Report
    console.log("\n════════════════════════════════════════");
    console.log("  DELAY ANALYSIS REPORT");
    console.log("════════════════════════════════════════");
    
    console.log("\n📊 Success Rates by Delay:");
    
    for (const [delay, result] of Object.entries(testResults)) {
        const total = result.success + result.failed;
        const rate = total > 0 ? (result.success / total * 100).toFixed(1) : 0;
        const delayStr = delay.replace("delay", "").replace("s", " sec").replace("noDelay", "No delay");
        console.log(`  ${delayStr}: ${result.success}/${total} (${rate}% success)`);
    }
    
    // Check final state
    const finalWKAIA = await wkaia.balanceOf(wallet1.address);
    const finalShares = await shareVault.balanceOf(wallet1.address);
    const totalAssets = await shareVault.totalAssets();
    const totalSupply = await shareVault.totalSupply();
    
    console.log("\n💰 Final State:");
    console.log("  WKAIA spent:", ethers.formatEther(initialWKAIA - finalWKAIA));
    console.log("  Shares received:", ethers.formatEther(finalShares));
    console.log("  Vault Total Assets:", ethers.formatEther(totalAssets));
    console.log("  Vault Total Supply:", ethers.formatEther(totalSupply));
    
    // Analysis
    console.log("\n📈 Analysis:");
    const noDelayRate = testResults.noDelay.success / (testResults.noDelay.success + testResults.noDelay.failed) * 100;
    const delay5sRate = testResults.delay5s.success / (testResults.delay5s.success + testResults.delay5s.failed) * 100;
    
    if (noDelayRate < 50 && delay5sRate > 80) {
        console.log("  ⚠️ Significant improvement with delay - likely state sync issue");
        console.log("  Recommendation: Add 3-5 second delay between deposits");
    } else if (noDelayRate > 80) {
        console.log("  ✅ No delay needed - deposits working well");
    } else {
        console.log("  ⚠️ Inconsistent behavior - needs further investigation");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });