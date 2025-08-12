const { ethers } = require("hardhat");
const fs = require("fs");

async function deepDebugWithdraw() {
  console.log("🔍 Deep debugging withdrawal arithmetic underflow");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("📋 Deep Debug Setup:");
  console.log(`   Vault: ${vaultAddress}`);
  
  const userShares = await vault.balanceOf(signer.address);
  const totalAssets = await vault.totalAssets();
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  
  const testWithdrawAmount = ethers.parseEther("0.1");
  const sharesNeeded = await vault.previewWithdraw(testWithdrawAmount);
  
  console.log(`\n🧮 Withdrawal Calculation Debug:`);
  console.log(`   Withdraw amount: ${ethers.formatEther(testWithdrawAmount)}`);
  console.log(`   Shares needed: ${ethers.formatEther(sharesNeeded)}`);
  
  // Step 1: Check if we need to swap (assets > balWKaia)
  console.log(`\n1️⃣ Check swap necessity:`);
  console.log(`   Requested: ${ethers.formatEther(testWithdrawAmount)}`);
  console.log(`   Available WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  
  const needsSwap = testWithdrawAmount > vaultWKAIA;
  console.log(`   Needs swap: ${needsSwap}`);
  
  if (needsSwap) {
    const lack = testWithdrawAmount - vaultWKAIA;
    console.log(`   Amount lacking: ${ethers.formatEther(lack)}`);
    
    // Step 2: Test LST balance calculations manually
    console.log(`\n2️⃣ Manual LST Balance Calculation:`);
    
    for (let i = 0; i < 4; i++) {
      console.log(`   Index ${i}:`);
      
      try {
        const tokenInfo = await vault.tokensInfo(i);
        console.log(`     Asset: ${tokenInfo.asset}`);
        console.log(`     TokenA: ${tokenInfo.tokenA}`);
        
        const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await assetContract.balanceOf(vaultAddress);
        console.log(`     Asset balance: ${ethers.formatEther(balance)}`);
        
        let wrapBal = 0n;
        let totalValue = 0n;
        
        if (i < 3) {
          // Regular LST
          try {
            const tokenAContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
            wrapBal = await tokenAContract.balanceOf(vaultAddress);
            console.log(`     TokenA balance: ${ethers.formatEther(wrapBal)}`);
            
            if (wrapBal > 0) {
              const wrapContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
              let uw = 0n;
              
              if (i == 1) {
                // GCKAIA - use wrapped balance directly
                uw = wrapBal;
              } else {
                // Regular LST - convert wrapped to unwrapped
                try {
                  uw = await wrapContract.getUnwrappedAmount(wrapBal);
                  console.log(`     Unwrapped equivalent: ${ethers.formatEther(uw)}`);
                } catch (uwError) {
                  console.log(`     ❌ getUnwrappedAmount failed: ${uwError.message}`);
                  uw = 0n;
                }
              }
              
              try {
                totalValue = balance + uw;
                console.log(`     Total value: ${ethers.formatEther(totalValue)}`);
              } catch (addError) {
                console.log(`     ❌ Addition overflow: ${addError.message}`);
                totalValue = balance; // Fallback
              }
            } else {
              totalValue = balance;
              console.log(`     Total value (no wrapped): ${ethers.formatEther(totalValue)}`);
            }
            
          } catch (wrapError) {
            console.log(`     ❌ Wrapped token error: ${wrapError.message}`);
            totalValue = balance;
          }
          
        } else {
          // stKAIA (index 3)
          try {
            const stKaiaContract = await ethers.getContractAt("IStKaia", tokenInfo.asset);
            totalValue = await stKaiaContract.getRatioNativeTokenByStakingToken(balance);
            console.log(`     StKAIA total value: ${ethers.formatEther(totalValue)}`);
          } catch (stKaiaError) {
            console.log(`     ❌ stKAIA ratio calculation failed: ${stKaiaError.message}`);
            totalValue = balance;
          }
        }
        
      } catch (error) {
        console.log(`     ❌ Index ${i} error: ${error.message}`);
      }
    }
    
    // Step 3: Try to call selectAsset manually
    console.log(`\n3️⃣ Testing selectAsset function:`);
    
    try {
      const [selectedIdx, availableAmount] = await vault.selectAsset(lack);
      console.log(`   Selected asset index: ${selectedIdx}`);
      console.log(`   Available amount: ${ethers.formatEther(availableAmount)}`);
      
      if (availableAmount >= lack) {
        console.log(`   ✅ Single asset can cover the lack`);
      } else {
        console.log(`   ⚠️ Need multi-asset withdrawal`);
      }
      
    } catch (selectError) {
      console.log(`   ❌ selectAsset failed: ${selectError.message}`);
      
      if (selectError.message.includes("arithmetic underflow or overflow")) {
        console.log(`   💡 selectAsset is where the underflow occurs!`);
      }
    }
    
    // Step 4: Try to call planWithdraw manually
    console.log(`\n4️⃣ Testing planWithdraw function:`);
    
    try {
      // We can't call internal functions directly, so let's check if there's a public version
      console.log(`   Cannot test planWithdraw directly (internal function)`);
    } catch (planError) {
      console.log(`   ❌ planWithdraw failed: ${planError.message}`);
    }
  }
  
  console.log(`\n🔧 Potential Solutions:`);
  console.log(`   1. Add try-catch blocks around ratio calculations`);
  console.log(`   2. Add bounds checking for all arithmetic operations`);
  console.log(`   3. Handle edge cases where LST contracts return unexpected values`);
  console.log(`   4. Add SafeMath-like operations for all subtractions`);
  console.log(`   5. Check if any LST contract is in an invalid state`);
}

deepDebugWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });