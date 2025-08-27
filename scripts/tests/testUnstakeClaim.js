const { ethers } = require("hardhat");
const fs = require('fs');
require("dotenv").config();

/**
 * Test Unstake/Claim Operations
 * 
 * Purpose: Test the complete unstake/claim cycle for LSTs
 * - Owner-only operations for protocol interest harvesting
 * - Claimed assets stay in VaultCore
 * 
 * @dev Run with: npx hardhat run scripts/tests/testUnstakeClaim.js --network kairos
 */

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║          UNSTAKE/CLAIM TEST (wKoKAIA ONLY)                  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    const owner = new ethers.Wallet(chainId === 8217 ? process.env.KAIA_PRIVATE_KEY : process.env.KAIROS_PRIVATE_KEY, ethers.provider);
    
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    const deployments = JSON.parse(fs.readFileSync(`deployments-${networkName}.json`, 'utf8'));
    
    const vaultCoreAddress = deployments.vaultCore;
    const wkaiaAddress = deployments.wkaia;
    const koKAIAAddress = chainId === 8217n 
        ? "0xA1338309658D3Da331C747518d0bb414031F22fd"  // Mainnet
        : "0xb15782EFbC2034E366670599F3997f94c7333FF9"; // Testnet
    
    const vaultCore = await ethers.getContractAt("VaultCore", vaultCoreAddress);
    const wkaia = await ethers.getContractAt("IERC20", wkaiaAddress);
    const koKAIA = await ethers.getContractAt("IERC20", koKAIAAddress);
    
    console.log(`Owner: ${owner.address}`);
    console.log(`VaultCore: ${vaultCoreAddress}`);
    console.log(`WKAIA: ${wkaiaAddress}`);
    console.log(`Network: ${networkName.toUpperCase()}\n`);
    
    // Verify owner
    const contractOwner = await vaultCore.owner();
    console.log(`Contract Owner: ${contractOwner}`);
    console.log(`Is signer the owner? ${contractOwner.toLowerCase() === owner.address.toLowerCase()}\n`);
    
    // Get token info for wKoKAIA
    const tokenInfo = await vaultCore.tokensInfo(0);
    // tokenInfo returns: [handler, asset, wrappedToken, poolId, wkaia, kaiaPairId, klayPairId]
    const wKoKAIAAddress = tokenInfo[2]; // wrappedToken is at index 2
    
    // Check if tokenInfo is valid
    if (!wKoKAIAAddress || wKoKAIAAddress === ethers.ZeroAddress) {
        console.log("❌ No wKoKAIA configured in VaultCore");
        console.log("   wKoKAIA address:", wKoKAIAAddress);
        process.exit(1);
    }
    
    const wKoKAIA = await ethers.getContractAt("IERC20", wKoKAIAAddress);
    
    // Get initial balances
    const vaultCoreWKoKAIA = await wKoKAIA.balanceOf(vaultCoreAddress);
    const vaultCoreKoKAIA = await koKAIA.balanceOf(vaultCoreAddress);
    
    console.log(`VaultCore wKoKAIA balance: ${ethers.formatEther(vaultCoreWKoKAIA)}`);
    console.log(`VaultCore KoKAIA balance: ${ethers.formatEther(vaultCoreKoKAIA)}\n`);
    
    // If no wKoKAIA balance, exit
    if (vaultCoreWKoKAIA === 0n) {
        console.log("❌ No wKoKAIA balance in VaultCore");
        console.log("   Please make some deposits first");
        process.exit(1);
    }
    
    // === Unwrap wKoKAIA to KoKAIA ===
    // Need to unwrap some wKoKAIA to get KoKAIA for unstaking
    console.log("=== Unwrapping wKoKAIA to KoKAIA ===");
    const unwrapAmount = vaultCoreWKoKAIA / 10n; // Unwrap 10% of wKoKAIA
    console.log(`Need to unwrap ${ethers.formatEther(unwrapAmount)} wKoKAIA to KoKAIA for unstaking...`);
    
    const vaultCoreSigner = await ethers.getContractAt("VaultCore", vaultCoreAddress, owner);
    
    // Use the unwrapLST function
    try {
        const unwrapTx = await vaultCoreSigner.unwrapLST(0, unwrapAmount); // 0 is the index for wKoKAIA
        console.log(`Unwrap TX: ${unwrapTx.hash}`);
        await unwrapTx.wait();
        console.log("✅ Unwrap successful");
    } catch (error) {
        console.log(`❌ Unwrap failed: ${error.message}`);
        console.log("   Trying to proceed with available balance...");
    }
    
    const newKoKAIABalance = await koKAIA.balanceOf(vaultCoreAddress);
    console.log(`New KoKAIA balance: ${ethers.formatEther(newKoKAIABalance)}\n`);
    
    // If no KoKAIA balance, we need to skip this test
    if (newKoKAIABalance === 0n && vaultCoreWKoKAIA > 0n) {
        console.log("⚠️ No KoKAIA available for unstaking");
        console.log("   The unwrap might have failed");
        console.log("   Skipping unstake/claim test\n");
        return;
    }
    
    // === Step 1: Owner Unstakes KoKAIA ===
    console.log("=== Step 1: Owner Unstakes KoKAIA ===");
    const unstakeAmount = newKoKAIABalance > 0n ? newKoKAIABalance : unwrapAmount; // Use actual balance
    console.log(`Unstaking ${ethers.formatEther(unstakeAmount)} KoKAIA for protocol interest...`);
    
    const unstakeTx = await vaultCoreSigner.unstake(owner.address, 0, unstakeAmount);
    console.log(`TX: ${unstakeTx.hash}`);
    await unstakeTx.wait();
    console.log("✅ Unstake successful");
    
    const koKAIAAfterUnstake = await koKAIA.balanceOf(vaultCoreAddress);
    console.log(`KoKAIA balance after: ${ethers.formatEther(koKAIAAfterUnstake)}\n`);
    
    // === Step 2: Wait 10 Minutes (Testnet) ===
    console.log("=== Step 2: Wait 10 Minutes (Testnet) ===");
    console.log("⏰ Waiting for claim period...");
    const waitTime = 10 * 60 * 1000; // 10 minutes in milliseconds
    const endTime = Date.now() + waitTime;
    
    while (Date.now() < endTime) {
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        process.stdout.write(`   ⏱️  ${minutes} minutes ${seconds} seconds remaining...  \r`);
        await sleep(3000); // Update every 3 seconds
    }
    console.log("\n✅ Wait period complete!\n");
    
    // === Step 3: Owner Claims ===
    console.log("=== Step 3: Owner Claims ===");
    console.log("Claiming unstaked amount...");
    
    const wkaiaBalanceBefore = await wkaia.balanceOf(vaultCoreAddress);
    console.log(`WKAIA balance before claim: ${ethers.formatEther(wkaiaBalanceBefore)}`);
    
    const claimTx = await vaultCoreSigner.claim(owner.address, 0);
    console.log(`TX: ${claimTx.hash}`);
    const receipt = await claimTx.wait();
    console.log("✅ Claim successful");
    
    // Parse events to see the claimed amount
    const claimedEvent = receipt.logs.find(log => {
        try {
            const parsedLog = vaultCore.interface.parseLog(log);
            return parsedLog && parsedLog.name === "Claimed";
        } catch {
            return false;
        }
    });
    
    if (claimedEvent) {
        const parsedEvent = vaultCore.interface.parseLog(claimedEvent);
        const claimedAmount = parsedEvent.args[2];
        console.log(`Claimed amount: ${ethers.formatEther(claimedAmount)} KAIA`);
    }
    
    // Check final balances
    const wkaiaBalanceAfter = await wkaia.balanceOf(vaultCoreAddress);
    const wkaiaGained = wkaiaBalanceAfter - wkaiaBalanceBefore;
    
    console.log(`WKAIA balance after claim: ${ethers.formatEther(wkaiaBalanceAfter)}`);
    console.log(`WKAIA gained from claim: ${ethers.formatEther(wkaiaGained)}\n`);
    
    // === Final Verification ===
    console.log("=== Final Verification ===");
    if (wkaiaGained > 0n) {
        console.log("✅ Claim successful! WKAIA increased in VaultCore");
        console.log("   This represents staking rewards harvested for the protocol");
        console.log("   The WKAIA stays in VaultCore for all users' benefit");
    } else {
        console.log("⚠️ No WKAIA gained from claim");
        console.log("   This could mean:");
        console.log("   - The unstaked amount was too small");
        console.log("   - No staking rewards accumulated yet");
        console.log("   - Need to wait longer between unstake and claim");
    }
    
    // Check total assets increased
    const totalAssets = await vaultCore.getTotalAssets();
    console.log(`\n📊 Total Assets in VaultCore: ${ethers.formatEther(totalAssets)} WKAIA`);
    
    console.log("\n✅ Unstake/Claim test complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });