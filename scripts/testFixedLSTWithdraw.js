const { ethers } = require("hardhat");
const fs = require("fs");

async function testFixedLSTWithdraw() {
  console.log("🧪 Testing LST withdrawal after arithmetic underflow fixes");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("📋 Test Setup:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   User: ${signer.address}`);
  
  // Get current state
  const userShares = await vault.balanceOf(signer.address);
  const totalSupply = await vault.totalSupply();
  const totalAssets = await vault.totalAssets();
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("\n💰 Current State:");
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Total supply: ${ethers.formatEther(totalSupply)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
  
  // Test withdrawal amounts that previously failed
  const testAmounts = [
    ethers.parseEther("0.1"),
    ethers.parseEther("0.2"),
  ];
  
  for (const withdrawAmount of testAmounts) {
    console.log(`\n🧪 Testing ${ethers.formatEther(withdrawAmount)} WKAIA withdrawal:`);
    
    try {
      const sharesNeeded = await vault.previewWithdraw(withdrawAmount);
      console.log(`   Shares needed: ${ethers.formatEther(sharesNeeded)}`);
      
      if (userShares < sharesNeeded) {
        console.log(`   ⚠️ Insufficient shares. Have: ${ethers.formatEther(userShares)}, Need: ${ethers.formatEther(sharesNeeded)}`);
        continue;
      }
      
      // Get pre-withdrawal balance
      const preWithdrawWKAIA = await wkaia.balanceOf(signer.address);
      console.log(`   Pre-withdrawal WKAIA: ${ethers.formatEther(preWithdrawWKAIA)}`);
      
      // Record vault LST balances before withdrawal
      console.log(`   Recording vault LST state...`);
      const preWithdrawLSTBalances = [];
      for (let i = 0; i < 4; i++) {
        try {
          const tokenInfo = await vault.tokensInfo(i);
          const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const tokenAContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
          
          const assetBalance = await assetContract.balanceOf(vaultAddress);
          const tokenABalance = await tokenAContract.balanceOf(vaultAddress);
          
          preWithdrawLSTBalances[i] = { asset: assetBalance, tokenA: tokenABalance };
        } catch (error) {
          preWithdrawLSTBalances[i] = { asset: 0n, tokenA: 0n };
        }
      }
      
      // Perform withdrawal
      console.log(`   Executing withdrawal...`);
      const withdrawTx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      console.log(`   ✅ Withdrawal successful!`);
      console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      
      // Check results
      const postWithdrawWKAIA = await wkaia.balanceOf(signer.address);
      const wkaiaReceived = postWithdrawWKAIA - preWithdrawWKAIA;
      const postWithdrawUserShares = await vault.balanceOf(signer.address);
      const sharesUsed = userShares - postWithdrawUserShares;
      
      console.log(`   Post-withdrawal WKAIA: ${ethers.formatEther(postWithdrawWKAIA)}`);
      console.log(`   WKAIA received: ${ethers.formatEther(wkaiaReceived)}`);
      console.log(`   Shares used: ${ethers.formatEther(sharesUsed)}`);
      
      // Check for LST balance changes (indicates swap activity)
      let swapActivity = false;
      for (let i = 0; i < 4; i++) {
        try {
          const tokenInfo = await vault.tokensInfo(i);
          const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const tokenAContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
          
          const postAssetBalance = await assetContract.balanceOf(vaultAddress);
          const postTokenABalance = await tokenAContract.balanceOf(vaultAddress);
          
          const assetChange = postAssetBalance - preWithdrawLSTBalances[i].asset;
          const tokenAChange = postTokenABalance - preWithdrawLSTBalances[i].tokenA;
          
          if (assetChange !== 0n || tokenAChange !== 0n) {
            console.log(`     LST ${i}: Asset Δ=${ethers.formatEther(assetChange)}, TokenA Δ=${ethers.formatEther(tokenAChange)}`);
            swapActivity = true;
          }
        } catch (error) {
          // Skip
        }
      }
      
      // Analyze transaction events
      let transferEvents = 0;
      let batchSwapEvents = 0;
      
      for (const log of receipt.logs) {
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
          transferEvents++;
        }
        
        try {
          const decoded = vault.interface.parseLog(log);
          if (decoded && decoded.name === "BatchSwap") {
            batchSwapEvents++;
            console.log(`     BatchSwap: Δ0=${decoded.args[0]}, Δ1=${decoded.args[1]}, Δ2=${decoded.args[2]}`);
          } else if (decoded && decoded.name === "MultiAssetWithdraw") {
            console.log(`     MultiAssetWithdraw: amt=${ethers.formatEther(decoded.args[0])}, used=${decoded.args[1]}, swp=${ethers.formatEther(decoded.args[2])}`);
          }
        } catch (e) {
          // Not a vault event
        }
      }
      
      console.log(`   Events: ${transferEvents} transfers, ${batchSwapEvents} BatchSwaps`);
      
      // Validate withdrawal success
      const expectedAmount = withdrawAmount;
      const tolerance = expectedAmount * 5n / 100n; // 5% tolerance
      const withdrawSuccess = wkaiaReceived >= (expectedAmount - tolerance);
      
      if (withdrawSuccess) {
        console.log(`   🎉 SUCCESS: Withdrawal completed successfully!`);
        console.log(`   Expected: ${ethers.formatEther(expectedAmount)} WKAIA`);
        console.log(`   Received: ${ethers.formatEther(wkaiaReceived)} WKAIA`);
        
        if (swapActivity) {
          console.log(`   ✅ LST swap activity detected - LST→WKAIA conversion worked!`);
        }
        
        if (batchSwapEvents > 0) {
          console.log(`   ✅ BatchSwap events detected - DEX operations successful!`);
        }
        
        // Update userShares for next test
        userShares = postWithdrawUserShares;
        
      } else {
        console.log(`   ⚠️ Withdrawal amount lower than expected:`);
        console.log(`   Expected: ${ethers.formatEther(expectedAmount)} ± ${ethers.formatEther(tolerance)}`);
        console.log(`   Received: ${ethers.formatEther(wkaiaReceived)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Withdrawal failed: ${error.message}`);
      
      if (error.message.includes("arithmetic underflow or overflow")) {
        console.log(`   💡 Still getting arithmetic underflow - need more investigation`);
      } else if (error.message.includes("Wrap failed: no tokens received")) {
        console.log(`   🎯 Our wrap verification caught a failure!`);
      } else {
        console.log(`   💡 Different error type`);
      }
    }
    
    console.log(`   ---`);
    
    // Stop if we're running low on shares
    if (userShares < ethers.parseEther("0.1")) {
      console.log(`   ⚠️ Low remaining shares, stopping tests`);
      break;
    }
  }
  
  console.log("\n📊 Test Summary:");
  console.log("   This test validates our arithmetic underflow fixes:");
  console.log("   1. Safe balance subtraction in execWithdraw()");
  console.log("   2. Safe remainder calculation in planWithdraw()");
  console.log("   3. LST swap withdrawal functionality");
  console.log("   4. Multi-asset withdrawal scenarios");
}

testFixedLSTWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });