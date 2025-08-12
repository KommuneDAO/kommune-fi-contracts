const { ethers } = require("hardhat");
const fs = require("fs");

async function debugWithdrawError() {
  console.log("🔍 Debugging withdrawal arithmetic underflow/overflow error");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("📋 Debug Setup:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   User: ${signer.address}`);
  
  // Get detailed vault state
  const userShares = await vault.balanceOf(signer.address);
  const totalSupply = await vault.totalSupply();
  const totalAssets = await vault.totalAssets();
  
  console.log("\n💰 Vault State:");
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Total supply: ${ethers.formatEther(totalSupply)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
  
  // Check LST balances and identify which ones have substantial holdings
  console.log("\n📊 Detailed LST Analysis:");
  
  const lstData = [];
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const tokenAContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
      
      const assetBalance = await assetContract.balanceOf(vaultAddress);
      const tokenABalance = await tokenAContract.balanceOf(vaultAddress);
      
      lstData[i] = {
        tokenInfo,
        assetBalance,
        tokenABalance,
        hasAssets: assetBalance > 0n || tokenABalance > 0n
      };
      
      console.log(`   Index ${i}:`);
      console.log(`     Asset: ${tokenInfo.asset}`);
      console.log(`     TokenA: ${tokenInfo.tokenA}`);
      console.log(`     Asset balance: ${ethers.formatEther(assetBalance)}`);
      console.log(`     TokenA balance: ${ethers.formatEther(tokenABalance)}`);
      console.log(`     Has assets: ${lstData[i].hasAssets}`);
      
    } catch (error) {
      console.log(`   Index ${i}: Error - ${error.message}`);
      lstData[i] = { hasAssets: false };
    }
  }
  
  // Check the getLSTBalances function result
  console.log("\n🧮 Testing getLSTBalances calculation:");
  try {
    const lstBalances = await vault.getLSTBalances();
    
    console.log("   LST Balances result:");
    for (let i = 0; i < lstBalances.length && i < 4; i++) {
      console.log(`     Index ${i}:`);
      console.log(`       balance: ${ethers.formatEther(lstBalances[i].balance)}`);
      console.log(`       wrapBal: ${ethers.formatEther(lstBalances[i].wrapBal)}`);
      console.log(`       totalValue: ${ethers.formatEther(lstBalances[i].totalValue)}`);
      console.log(`       distAPY: ${lstBalances[i].distAPY}`);
    }
    
  } catch (error) {
    console.log(`   ❌ getLSTBalances failed: ${error.message}`);
    console.log("   This could be the source of the arithmetic error");
  }
  
  // Test a very small withdrawal to isolate the issue
  console.log("\n🧪 Testing minimal withdrawal (0.01 WKAIA):");
  
  const smallWithdrawAmount = ethers.parseEther("0.01");
  
  try {
    const sharesNeeded = await vault.previewWithdraw(smallWithdrawAmount);
    console.log(`   Shares needed: ${ethers.formatEther(sharesNeeded)}`);
    
    if (userShares >= sharesNeeded) {
      console.log("   Attempting minimal withdrawal...");
      
      // Try to isolate where the error occurs by using a very small amount
      const withdrawTx = await vault.withdraw(smallWithdrawAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      console.log(`   ✅ Small withdrawal successful!`);
      console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
      
    } else {
      console.log(`   ❌ Insufficient shares even for small withdrawal`);
    }
    
  } catch (error) {
    console.log(`   ❌ Small withdrawal failed: ${error.message}`);
    
    // Try to decode the error more specifically
    if (error.message.includes("arithmetic underflow or overflow")) {
      console.log("\n🔍 Analyzing arithmetic error:");
      console.log("   Possible causes:");
      console.log("   1. Negative calculation in asset conversion");
      console.log("   2. Division by zero in ratio calculations");
      console.log("   3. Underflow in balance subtraction");
      console.log("   4. Overflow in multiplication operations");
      
      // Check for potential negative calculations
      console.log("\n📊 Checking for potential negative values:");
      
      // Look at the withdrawal calculation components
      console.log(`   Total assets: ${totalAssets}`);
      console.log(`   Total supply: ${totalSupply}`);
      
      if (totalSupply > 0n) {
        const sharePrice = (totalAssets * ethers.parseEther("1")) / totalSupply;
        console.log(`   Share price (assets/share): ${ethers.formatEther(sharePrice)}`);
        
        const assetsForShares = (sharesNeeded * totalAssets) / totalSupply;
        console.log(`   Assets for ${ethers.formatEther(sharesNeeded)} shares: ${ethers.formatEther(assetsForShares)}`);
        
        if (assetsForShares > totalAssets) {
          console.log(`   ⚠️ Issue found: Calculated assets needed (${ethers.formatEther(assetsForShares)}) > Total assets (${ethers.formatEther(totalAssets)})`);
        }
      }
      
      // Check slippage configuration
      try {
        // The slippage is a private variable, but we can check if it's causing issues
        console.log("\n🔧 Potential fixes:");
        console.log("   1. Check slippage calculation in _performSmartSwap");
        console.log("   2. Verify asset balance calculations don't go negative");
        console.log("   3. Add bounds checking before arithmetic operations");
        console.log("   4. Check if any LST has zero or very small balances causing ratio issues");
      } catch (e) {
        // Skip if we can't access private variables
      }
    }
  }
  
  // Try redeem instead of withdraw to see if it's withdrawal-specific
  console.log("\n🧪 Testing redeem instead of withdraw:");
  
  try {
    const smallRedeemShares = ethers.parseEther("0.01"); // Very small amount of shares
    
    if (userShares >= smallRedeemShares) {
      console.log(`   Attempting to redeem ${ethers.formatEther(smallRedeemShares)} shares...`);
      
      const redeemTx = await vault.redeem(smallRedeemShares, signer.address, signer.address);
      const receipt = await redeemTx.wait();
      
      console.log(`   ✅ Redeem successful!`);
      console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
      
      // Check how much WKAIA was received
      const assetAddress = await vault.asset();
      const wkaia = await ethers.getContractAt("IERC20", assetAddress);
      
      console.log("   💡 Redeem worked - the issue is specifically with withdraw(), not redeem()");
      console.log("   This suggests the problem is in the withdraw amount calculation or conversion logic");
      
    } else {
      console.log(`   ❌ Insufficient shares for redeem test`);
    }
    
  } catch (error) {
    console.log(`   ❌ Redeem also failed: ${error.message}`);
    console.log("   This suggests the error is in the common withdrawal logic, not withdraw-specific");
  }
  
  console.log("\n💡 Recommendations:");
  console.log("   1. The arithmetic underflow suggests negative calculations in asset conversions");
  console.log("   2. This is likely in the LST swap calculations during withdrawal");
  console.log("   3. Need to add bounds checking before subtractions");
  console.log("   4. Check if any slippage calculations result in negative values");
  console.log("   5. Verify all ratio calculations handle edge cases (zero balances, etc.)");
}

debugWithdrawError()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });