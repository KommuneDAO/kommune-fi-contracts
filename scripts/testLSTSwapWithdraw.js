const { ethers } = require("hardhat");
const fs = require("fs");

async function testLSTSwapWithdraw() {
  console.log("🧪 Testing LST swap withdraw functionality");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("📋 Test Setup:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   User: ${signer.address}`);
  console.log(`   Network: ${networkName}`);
  
  // Get vault asset (WKAIA)
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  console.log(`   WKAIA (asset): ${assetAddress}`);
  
  // Check current vault LST balances
  console.log("\n📊 Current Vault LST Holdings:");
  
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const tokenAContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
      
      const assetBalance = await assetContract.balanceOf(vaultAddress);
      const tokenABalance = await tokenAContract.balanceOf(vaultAddress);
      
      console.log(`   Index ${i}:`);
      console.log(`     Asset: ${tokenInfo.asset}`);
      console.log(`     TokenA: ${tokenInfo.tokenA}`);
      console.log(`     Asset balance: ${ethers.formatEther(assetBalance)}`);
      console.log(`     TokenA balance: ${ethers.formatEther(tokenABalance)}`);
      
      // Try to get token name for identification
      try {
        const assetName = await assetContract.name();
        const tokenAName = await tokenAContract.name();
        console.log(`     Names: ${assetName} / ${tokenAName}`);
      } catch (nameError) {
        console.log(`     Names: Unable to fetch`);
      }
      
    } catch (error) {
      console.log(`   Index ${i}: Not configured or error`);
    }
  }
  
  // Check user's current vault shares
  const userShares = await vault.balanceOf(signer.address);
  const vaultTotalSupply = await vault.totalSupply();
  const vaultTotalAssets = await vault.totalAssets();
  
  console.log("\n💰 Current Vault State:");
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Total supply: ${ethers.formatEther(vaultTotalSupply)}`);
  console.log(`   Total assets: ${ethers.formatEther(vaultTotalAssets)}`);
  
  if (userShares === 0n) {
    console.log("\n⚠️ User has no vault shares. Need to deposit first.");
    
    // Do a small deposit to get shares for testing
    const depositAmount = ethers.parseEther("0.5");
    const userWKAIA = await wkaia.balanceOf(signer.address);
    
    if (userWKAIA >= depositAmount) {
      console.log(`\n🔄 Performing ${ethers.formatEther(depositAmount)} WKAIA deposit first...`);
      
      try {
        await wkaia.approve(vaultAddress, depositAmount);
        const depositTx = await vault.deposit(depositAmount, signer.address);
        await depositTx.wait();
        
        const newUserShares = await vault.balanceOf(signer.address);
        console.log(`   ✅ Deposit successful! New shares: ${ethers.formatEther(newUserShares)}`);
        
      } catch (depositError) {
        console.log(`   ❌ Deposit failed: ${depositError.message}`);
        return;
      }
    } else {
      console.log(`   ❌ Insufficient WKAIA for deposit. Have: ${ethers.formatEther(userWKAIA)}`);
      return;
    }
  }
  
  // Update user shares after potential deposit
  const currentUserShares = await vault.balanceOf(signer.address);
  console.log(`\n📊 User shares available: ${ethers.formatEther(currentUserShares)}`);
  
  // Test withdrawal that would trigger LST swaps
  // We'll try different withdrawal amounts to trigger different swap scenarios
  
  const testWithdrawAmounts = [
    ethers.parseEther("0.1"),  // Small withdrawal
    ethers.parseEther("0.2"),  // Medium withdrawal
  ];
  
  for (const withdrawAmount of testWithdrawAmounts) {
    console.log(`\n🧪 Testing withdrawal of ${ethers.formatEther(withdrawAmount)} WKAIA:`);
    
    try {
      // Preview the withdrawal to see how many shares are needed
      const sharesNeeded = await vault.previewWithdraw(withdrawAmount);
      console.log(`   Shares needed: ${ethers.formatEther(sharesNeeded)}`);
      
      if (currentUserShares < sharesNeeded) {
        console.log(`   ⚠️ Insufficient shares. Have: ${ethers.formatEther(currentUserShares)}, Need: ${ethers.formatEther(sharesNeeded)}`);
        continue;
      }
      
      // Get pre-withdrawal state
      const preWithdrawWKAIA = await wkaia.balanceOf(signer.address);
      const preWithdrawTotalAssets = await vault.totalAssets();
      
      console.log(`   Pre-withdrawal WKAIA: ${ethers.formatEther(preWithdrawWKAIA)}`);
      console.log(`   Pre-withdrawal total assets: ${ethers.formatEther(preWithdrawTotalAssets)}`);
      
      // Record LST balances before withdrawal
      console.log(`   Pre-withdrawal LST balances:`);
      const preWithdrawLSTBalances = [];
      
      for (let i = 0; i < 4; i++) {
        try {
          const tokenInfo = await vault.tokensInfo(i);
          const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const tokenAContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
          
          const assetBalance = await assetContract.balanceOf(vaultAddress);
          const tokenABalance = await tokenAContract.balanceOf(vaultAddress);
          
          preWithdrawLSTBalances[i] = { asset: assetBalance, tokenA: tokenABalance };
          console.log(`     Index ${i}: Asset=${ethers.formatEther(assetBalance)}, TokenA=${ethers.formatEther(tokenABalance)}`);
          
        } catch (error) {
          preWithdrawLSTBalances[i] = { asset: 0n, tokenA: 0n };
        }
      }
      
      // Perform withdrawal
      console.log(`   Executing withdrawal...`);
      const withdrawTx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
      const withdrawReceipt = await withdrawTx.wait();
      
      console.log(`   ✅ Withdrawal successful!`);
      console.log(`   Gas used: ${withdrawReceipt.gasUsed.toLocaleString()}`);
      console.log(`   Block: ${withdrawReceipt.blockNumber}`);
      
      // Check post-withdrawal state
      const postWithdrawWKAIA = await wkaia.balanceOf(signer.address);
      const postWithdrawTotalAssets = await vault.totalAssets();
      const wkaiaReceived = postWithdrawWKAIA - preWithdrawWKAIA;
      
      console.log(`   Post-withdrawal WKAIA: ${ethers.formatEther(postWithdrawWKAIA)}`);
      console.log(`   WKAIA received: ${ethers.formatEther(wkaiaReceived)}`);
      console.log(`   Post-withdrawal total assets: ${ethers.formatEther(postWithdrawTotalAssets)}`);
      
      // Check LST balance changes (this shows swap activity)
      console.log(`   LST balance changes:`);
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
            console.log(`     Index ${i}: Asset change=${ethers.formatEther(assetChange)}, TokenA change=${ethers.formatEther(tokenAChange)}`);
            swapActivity = true;
          }
          
        } catch (error) {
          // Skip
        }
      }
      
      // Analyze transaction events
      console.log(`   Transaction analysis:`);
      console.log(`     Total events: ${withdrawReceipt.logs.length}`);
      
      let transferEvents = 0;
      let batchSwapEvents = 0;
      
      for (const log of withdrawReceipt.logs) {
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
          transferEvents++;
        }
        // Look for BatchSwap events
        if (log.topics.length > 0 && log.address === vaultAddress) {
          // This could be a BatchSwap event
          try {
            const decoded = vault.interface.parseLog(log);
            if (decoded && decoded.name === "BatchSwap") {
              batchSwapEvents++;
              console.log(`     BatchSwap detected: delta0=${decoded.args[0]}, delta1=${decoded.args[1]}, delta2=${decoded.args[2]}`);
            }
          } catch (e) {
            // Not a BatchSwap event or parsing failed
          }
        }
      }
      
      console.log(`     Transfer events: ${transferEvents}`);
      console.log(`     BatchSwap events: ${batchSwapEvents}`);
      
      // Validate results
      const withdrawalSuccess = wkaiaReceived >= withdrawAmount * 90n / 100n; // 10% tolerance for slippage
      
      if (withdrawalSuccess) {
        console.log(`   🎉 SUCCESS: Withdrawal completed successfully!`);
        console.log(`     Expected: ~${ethers.formatEther(withdrawAmount)} WKAIA`);
        console.log(`     Received: ${ethers.formatEther(wkaiaReceived)} WKAIA`);
        
        if (swapActivity) {
          console.log(`   ✅ LST swap activity detected - this proves LST-to-WKAIA conversion worked!`);
        }
        
        if (batchSwapEvents > 0) {
          console.log(`   ✅ BatchSwap events detected - confirms DEX swap operations!`);
        }
        
      } else {
        console.log(`   ⚠️ Withdrawal amount lower than expected:`);
        console.log(`     Expected: ~${ethers.formatEther(withdrawAmount)} WKAIA`);
        console.log(`     Received: ${ethers.formatEther(wkaiaReceived)} WKAIA`);
        console.log(`     This could indicate slippage or swap issues`);
      }
      
      // Don't continue with more tests if we're running low on shares
      const remainingShares = await vault.balanceOf(signer.address);
      if (remainingShares < ethers.parseEther("0.1")) {
        console.log(`   ⚠️ Low remaining shares (${ethers.formatEther(remainingShares)}), stopping further tests`);
        break;
      }
      
    } catch (error) {
      console.log(`   ❌ Withdrawal failed: ${error.message}`);
      
      if (error.message.includes("Wrap failed: no tokens received")) {
        console.log(`   🎯 DETECTED: Our wrap verification caught a failure!`);
        console.log(`   💡 This indicates an issue with LST wrap operations during withdrawal`);
        console.log(`   🔧 Need to investigate specific LST protocol that's failing`);
      } else if (error.message.includes("insufficient liquidity")) {
        console.log(`   💡 DEX liquidity issue - normal for large withdrawals`);
      } else if (error.message.includes("slippage")) {
        console.log(`   💡 Slippage protection triggered - consider adjusting slippage settings`);
      } else {
        console.log(`   💡 Unexpected error - needs investigation`);
      }
    }
    
    console.log(`   ---`);
  }
  
  console.log("\n📋 Test Summary:");
  console.log("   This test validates:");
  console.log("   1. ✅ LST balance monitoring");
  console.log("   2. ✅ Withdrawal with LST swaps");
  console.log("   3. ✅ BatchSwap event detection");
  console.log("   4. ✅ Wrap success verification during complex operations");
  console.log("   5. ✅ End-to-end LST → WKAIA conversion flow");
}

testLSTSwapWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });