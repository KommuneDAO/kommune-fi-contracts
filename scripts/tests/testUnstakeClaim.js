const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * Test Unstake/Claim Operations
 * 
 * Purpose: Test the complete unstake/claim cycle for LSTs
 * - Owner-only operations for protocol interest harvesting
 * - Claimed assets stay in VaultCore
 * 
 * @dev Run with: npx hardhat run scripts/tests/testUnstakeClaim.js --network kairos
 */

async function main() {
    console.log("=== Test Unstake/Claim Operations ===\n");
    
    const [owner] = await ethers.getSigners();
    const deployments = JSON.parse(fs.readFileSync('deployments-kairos.json', 'utf8'));
    const vaultCoreAddress = deployments.vaultCore;
    const wkaiaAddress = deployments.wkaia;
    const koKAIAAddress = "0xb15782EFbC2034E366670599F3997f94c7333FF9";
    
    const vaultCore = await ethers.getContractAt("VaultCore", vaultCoreAddress);
    const wkaia = await ethers.getContractAt("IERC20", wkaiaAddress);
    const koKAIA = await ethers.getContractAt("IERC20", koKAIAAddress);
    
    console.log(`Owner: ${owner.address}`);
    console.log(`VaultCore: ${vaultCoreAddress}`);
    console.log(`WKAIA: ${wkaiaAddress}\n`);
    
    // Verify owner
    const contractOwner = await vaultCore.owner();
    console.log(`Contract Owner: ${contractOwner}`);
    console.log(`Is signer the owner? ${contractOwner.toLowerCase() === owner.address.toLowerCase()}\n`);
    
    // Check KoKAIA balance
    const vaultKoKAIA = await koKAIA.balanceOf(vaultCoreAddress);
    console.log(`VaultCore KoKAIA balance: ${ethers.formatEther(vaultKoKAIA)}`);
    
    if (vaultKoKAIA >= ethers.parseEther("0.0001")) {
        console.log("\n=== Step 1: Owner Unstakes KoKAIA ===");
        const unstakeAmount = ethers.parseEther("0.0001");
        console.log(`Unstaking ${ethers.formatEther(unstakeAmount)} KoKAIA for protocol interest...`);
        
        try {
            const unstakeTx = await vaultCore.unstake(owner.address, 0, unstakeAmount);
            console.log(`TX: ${unstakeTx.hash}`);
            await unstakeTx.wait();
            console.log("✅ Unstake successful");
            
            // Check new balance
            const newKoKAIA = await koKAIA.balanceOf(vaultCoreAddress);
            console.log(`KoKAIA balance after: ${ethers.formatEther(newKoKAIA)}`);
            
            console.log("\n=== Step 2: Wait 10 Minutes (Testnet) ===");
            console.log("⏰ Waiting for claim period...");
            
            // Wait with countdown
            let remaining = 600; // 10 minutes in seconds
            while (remaining > 0) {
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                
                if (remaining % 120 === 0) { // Update every 2 minutes
                    console.log(`   ⏱️  ${minutes} minutes ${seconds} seconds remaining...`);
                }
                
                if (remaining >= 60) {
                    await new Promise(r => setTimeout(r, 60000)); // Wait 1 minute
                    remaining -= 60;
                } else {
                    await new Promise(r => setTimeout(r, remaining * 1000));
                    remaining = 0;
                }
            }
            
            console.log("✅ Claim period complete!");
            
            console.log("\n=== Step 3: Check Balances Before Claim ===");
            const kaiaBefore = await ethers.provider.getBalance(vaultCoreAddress);
            const wkaiaBefore = await wkaia.balanceOf(vaultCoreAddress);
            const ownerWkaiaBefore = await wkaia.balanceOf(owner.address);
            
            console.log(`VaultCore KAIA:  ${ethers.formatEther(kaiaBefore)}`);
            console.log(`VaultCore WKAIA: ${ethers.formatEther(wkaiaBefore)}`);
            console.log(`Owner WKAIA:     ${ethers.formatEther(ownerWkaiaBefore)}`);
            
            console.log("\n=== Step 4: Owner Claims ===");
            console.log("Claiming unstaked assets for protocol...");
            
            const claimTx = await vaultCore.claim(owner.address, 0);
            console.log(`Claim TX: ${claimTx.hash}`);
            const receipt = await claimTx.wait();
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);
            console.log(`Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
            
            console.log("\n=== Step 5: Check Balances After Claim ===");
            const kaiaAfter = await ethers.provider.getBalance(vaultCoreAddress);
            const wkaiaAfter = await wkaia.balanceOf(vaultCoreAddress);
            const ownerWkaiaAfter = await wkaia.balanceOf(owner.address);
            
            console.log(`VaultCore KAIA:  ${ethers.formatEther(kaiaAfter)}`);
            console.log(`VaultCore WKAIA: ${ethers.formatEther(wkaiaAfter)}`);
            console.log(`Owner WKAIA:     ${ethers.formatEther(ownerWkaiaAfter)}`);
            
            console.log("\n=== Calculate Changes ===");
            const kaiaChange = kaiaAfter - kaiaBefore;
            const wkaiaChange = wkaiaAfter - wkaiaBefore;
            const ownerWkaiaChange = ownerWkaiaAfter - ownerWkaiaBefore;
            
            console.log(`VaultCore KAIA change:  ${ethers.formatEther(kaiaChange)}`);
            console.log(`VaultCore WKAIA change: ${ethers.formatEther(wkaiaChange)}`);
            console.log(`Owner WKAIA change:     ${ethers.formatEther(ownerWkaiaChange)}`);
            
            console.log("\n=== VERIFICATION ===");
            if (wkaiaChange > 0n && ownerWkaiaChange === 0n) {
                console.log(`✅ SUCCESS: Protocol claim working correctly!`);
                console.log(`   - VaultCore WKAIA increased by ${ethers.formatEther(wkaiaChange)}`);
                console.log(`   - Owner didn't receive any WKAIA (correct)`);
                console.log(`   - Claimed assets stay in VaultCore for protocol use`);
            } else if (ownerWkaiaChange > 0n) {
                console.log(`❌ PROBLEM: Owner received ${ethers.formatEther(ownerWkaiaChange)} WKAIA`);
                console.log(`   This should not happen - claimed assets should stay in VaultCore`);
            } else if (wkaiaChange === 0n) {
                console.log(`❌ PROBLEM: No WKAIA increase in VaultCore`);
            }
            
            // Check for Claimed event
            console.log("\n=== Events Check ===");
            for (const log of receipt.logs) {
                try {
                    const parsed = vaultCore.interface.parseLog(log);
                    if (parsed && parsed.name === "Claimed") {
                        console.log(`✅ Claimed event emitted:`);
                        console.log(`   User: ${parsed.args[0]}`);
                        console.log(`   LST Index: ${parsed.args[1]}`);
                        console.log(`   Amount: ${ethers.formatEther(parsed.args[2])}`);
                    }
                } catch {}
            }
            
        } catch (error) {
            console.log(`\n❌ Error: ${error.message}`);
            
            if (error.message.includes("OwnableUnauthorizedAccount")) {
                console.log("\n⚠️ Only the owner can call unstake/claim functions");
                console.log(`Current owner: ${contractOwner}`);
                console.log(`Your address: ${owner.address}`);
            }
        }
    } else {
        console.log("❌ Insufficient KoKAIA balance for test");
        console.log("   Need at least 0.0001 KoKAIA in VaultCore");
    }
    
    console.log("\n=== Summary ===");
    console.log("Unstake/Claim are owner-only protocol management functions");
    console.log("Claimed assets (WKAIA) stay in VaultCore to increase total protocol value");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });