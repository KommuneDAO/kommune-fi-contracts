const { ethers } = require("hardhat");
const fs = require("fs");

async function testWrapCalculation() {
  console.log("🔍 Testing exact wrap amount calculation from KVaultV2");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  const index = 2; // stKLAY
  const tokenInfo = await vault.tokensInfo(index);
  
  console.log("📋 Setup:");
  console.log(`   Asset (stKLAY): ${tokenInfo.asset}`);
  console.log(`   TokenA (wstKLAY): ${tokenInfo.tokenA}`);
  
  const wrapContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
  const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wstKLAY = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  // Simulate the exact calculation from _performSmartSwap
  const testAmt = ethers.parseEther("1.0"); // What we want to wrap
  
  console.log(`\n🧮 Simulating KVaultV2 calculation for ${ethers.formatEther(testAmt)} target amount:`);
  
  try {
    // Step 1: Get balances (simulate what getLSTBalances() would return)
    const vaultStKLAYBalance = await stKLAY.balanceOf(vaultAddress);
    const vaultWstKLAYBalance = await wstKLAY.balanceOf(vaultAddress);
    
    console.log(`   Vault stKLAY balance: ${ethers.formatEther(vaultStKLAYBalance)}`);
    console.log(`   Vault wstKLAY balance: ${ethers.formatEther(vaultWstKLAYBalance)}`);
    
    // Step 2: Calculate slippage addition (vault.slippage)
    // Assuming 2% slippage like in other tests
    const slippage = 200; // 2% = 200 basis points
    const slippageAmount = testAmt * BigInt(slippage) / 10000n;
    const actual = testAmt + slippageAmount;
    
    console.log(`   Target amount: ${ethers.formatEther(testAmt)}`);
    console.log(`   Slippage (2%): ${ethers.formatEther(slippageAmount)}`);
    console.log(`   Actual amount needed: ${ethers.formatEther(actual)}`);
    
    // Step 3: Calculate reqWrap (line 507)
    const wrapBal = vaultWstKLAYBalance; // Current wrapped balance
    const reqWrap = actual > wrapBal ? actual - wrapBal : 0n;
    
    console.log(`   Current wrapped balance: ${ethers.formatEther(wrapBal)}`);
    console.log(`   Required wrap amount: ${ethers.formatEther(reqWrap)}`);
    
    if (reqWrap > 0) {
      console.log(`\n🔍 Testing getUnwrappedAmount calculation:`);
      
      // Step 4: Call getUnwrappedAmount (line 516) - this is the KEY calculation
      try {
        const wrapAmount = await wrapContract.getUnwrappedAmount(reqWrap);
        console.log(`   getUnwrappedAmount(${ethers.formatEther(reqWrap)}) = ${ethers.formatEther(wrapAmount)}`);
        
        // Step 5: Check against available balance (line 519)
        const finalWrapAmount = wrapAmount > vaultStKLAYBalance ? vaultStKLAYBalance : wrapAmount;
        console.log(`   Final wrap amount (after balance check): ${ethers.formatEther(finalWrapAmount)}`);
        
        if (finalWrapAmount > 0) {
          console.log(`\n🧪 Testing with calculated amount:`);
          
          // Now test if this amount works with our working test contract
          const testContractAddress = "0x2d416F81c58d695B80aF37966B846501B86AbDF2"; // From previous test
          const testContract = await ethers.getContractAt("TestWrapContract", testContractAddress);
          
          // Transfer the exact calculated amount to test contract
          if (vaultStKLAYBalance >= finalWrapAmount && finalWrapAmount > 0) {
            console.log(`   Transferring ${ethers.formatEther(finalWrapAmount)} stKLAY to test contract...`);
            
            try {
              let tx = await stKLAY.transfer(testContractAddress, finalWrapAmount);
              await tx.wait();
              
              // Test wrap with exact calculated amount
              const [beforeStKLAY, beforeWstKLAY] = await testContract.checkBalances(tokenInfo.asset, tokenInfo.tokenA);
              console.log(`   Before: stKLAY=${ethers.formatEther(beforeStKLAY)}, wstKLAY=${ethers.formatEther(beforeWstKLAY)}`);
              
              tx = await testContract.directWrap(tokenInfo.asset, tokenInfo.tokenA, finalWrapAmount);
              await tx.wait();
              
              const [afterStKLAY, afterWstKLAY] = await testContract.checkBalances(tokenInfo.asset, tokenInfo.tokenA);
              console.log(`   After: stKLAY=${ethers.formatEther(afterStKLAY)}, wstKLAY=${ethers.formatEther(afterWstKLAY)}`);
              
              const gained = afterWstKLAY - beforeWstKLAY;
              if (gained > 0) {
                console.log(`   ✅ SUCCESS: Test contract works with vault's calculated amount`);
                console.log(`   💡 The calculation is NOT the issue`);
              } else {
                console.log(`   ❌ FAILED: Even test contract fails with this amount`);
                console.log(`   💡 The calculated amount might be the problem`);
              }
              
            } catch (transferError) {
              console.log(`   ❌ Transfer failed: ${transferError.message}`);
            }
          } else {
            console.log(`   ⚠️ Cannot test: insufficient vault balance or zero amount`);
          }
          
        } else {
          console.log(`   ❌ Final wrap amount is 0 - this could be the issue!`);
        }
        
      } catch (calcError) {
        console.log(`   ❌ getUnwrappedAmount failed: ${calcError.message}`);
        console.log(`   💡 This might be the root cause!`);
        
        if (calcError.message.includes("revert")) {
          console.log(`   The getUnwrappedAmount function is reverting`);
        }
      }
      
    } else {
      console.log(`   ⚠️ reqWrap is 0 - no wrap needed according to calculation`);
      console.log(`   This means vault already has enough wrapped tokens`);
    }
    
  } catch (error) {
    console.log(`❌ Calculation test failed: ${error.message}`);
  }
  
  console.log(`\n💡 Summary:`);
  console.log(`   If getUnwrappedAmount fails or returns wrong value:`);
  console.log(`     → That's the root cause of wrap failures`);
  console.log(`   If getUnwrappedAmount works but final amount is 0:`);
  console.log(`     → Logic error in amount calculation`);
  console.log(`   If amounts are correct but still fails in vault:`);
  console.log(`     → Issue is in execution context or state`);
}

testWrapCalculation()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });