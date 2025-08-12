const { ethers } = require("hardhat");
const fs = require("fs");

async function testVaultExecution() {
  console.log("🔍 Testing vault execution with detailed monitoring");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  const index = 2; // stKLAY
  const tokenInfo = await vault.tokensInfo(index);
  
  const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wstKLAY = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  console.log("📋 Pre-test State:");
  const vaultStKLAYBalance = await stKLAY.balanceOf(vaultAddress);
  const vaultWstKLAYBalance = await wstKLAY.balanceOf(vaultAddress);
  const vaultAllowance = await stKLAY.allowance(vaultAddress, tokenInfo.tokenA);
  
  console.log(`   Vault stKLAY: ${ethers.formatEther(vaultStKLAYBalance)}`);
  console.log(`   Vault wstKLAY: ${ethers.formatEther(vaultWstKLAYBalance)}`);
  console.log(`   Vault allowance: ${ethers.formatEther(vaultAllowance)}`);
  
  // The key insight: let's simulate EXACTLY what _performSmartSwap does
  // by creating a modified test contract that includes the same state tracking
  
  console.log("\n🧪 Creating Advanced Test Contract with State Tracking:");
  
  const AdvancedTestFactory = await ethers.getContractFactory("TestWrapContract");
  
  // Check if we can enhance our test contract to include the same logic
  console.log("   Testing if the issue is related to state between approve and wrap...");
  
  const testContractAddress = "0x2d416F81c58d695B80aF37966B846501B86AbDF2";
  const testContract = await ethers.getContractAt("TestWrapContract", testContractAddress);
  
  // Transfer a test amount
  const testAmount = ethers.parseEther("0.1");
  if (vaultStKLAYBalance >= testAmount) {
    console.log(`\n💰 Transferring ${ethers.formatEther(testAmount)} stKLAY to test contract...`);
    let tx = await stKLAY.transfer(testContractAddress, testAmount);
    await tx.wait();
    
    const [contractStKLAY, contractWstKLAY] = await testContract.checkBalances(tokenInfo.asset, tokenInfo.tokenA);
    console.log(`   Contract balances: stKLAY=${ethers.formatEther(contractStKLAY)}, wstKLAY=${ethers.formatEther(contractWstKLAY)}`);
    
    // Test the exact sequence with monitoring
    console.log("\n🔍 Step-by-step execution monitoring:");
    
    try {
      console.log("   1. Checking initial allowance...");
      let allowance = await testContract.checkAllowance(tokenInfo.asset, tokenInfo.tokenA);
      console.log(`      Initial allowance: ${ethers.formatEther(allowance)}`);
      
      console.log("   2. Calling direct wrap...");
      
      // Get initial state
      const [initialStKLAY, initialWstKLAY] = await testContract.checkBalances(tokenInfo.asset, tokenInfo.tokenA);
      
      // Execute wrap
      tx = await testContract.directWrap(tokenInfo.asset, tokenInfo.tokenA, testAmount);
      const receipt = await tx.wait();
      
      console.log(`      ✅ Transaction successful, gas: ${receipt.gasUsed.toLocaleString()}`);
      
      // Check final state
      const [finalStKLAY, finalWstKLAY] = await testContract.checkBalances(tokenInfo.asset, tokenInfo.tokenA);
      const stKLAYUsed = initialStKLAY - finalStKLAY;
      const wstKLAYGained = finalWstKLAY - initialWstKLAY;
      
      console.log(`   3. Results:`);
      console.log(`      stKLAY used: ${ethers.formatEther(stKLAYUsed)}`);
      console.log(`      wstKLAY gained: ${ethers.formatEther(wstKLAYGained)}`);
      
      // Check final allowance
      allowance = await testContract.checkAllowance(tokenInfo.asset, tokenInfo.tokenA);
      console.log(`      Final allowance: ${ethers.formatEther(allowance)}`);
      
      if (wstKLAYGained > 0) {
        console.log(`   🎉 SUCCESS: Test contract continues to work`);
        
        console.log("\n💡 CRITICAL INSIGHT:");
        console.log("   Since our test contract works perfectly with the SAME:");
        console.log("   - Token addresses");
        console.log("   - Amount calculations");
        console.log("   - Approve/wrap sequence");
        console.log("   - Network environment");
        console.log("");
        console.log("   The issue MUST be one of:");
        console.log("   1. Gas limits in vault's _performSmartSwap function");
        console.log("   2. State interference from other operations in _performSmartSwap");
        console.log("   3. Reentrancy or modifier issues in vault");
        console.log("   4. Complex inheritance or library conflicts in vault");
        console.log("   5. Events or logging affecting execution");
        
        console.log("\n🔧 SOLUTION APPROACHES:");
        console.log("   Option A: Add gas limit parameter to wrap call");
        console.log("   Option B: Isolate wrap logic in separate function");
        console.log("   Option C: Add explicit success checks after wrap");
        console.log("   Option D: Use low-level call instead of interface call");
        
      } else {
        console.log(`   ❌ UNEXPECTED: Test contract now failing too`);
      }
      
    } catch (error) {
      console.log(`   ❌ Test execution failed: ${error.message}`);
    }
  }
  
  console.log("\n📊 Execution Context Comparison:");
  console.log("   Test Contract (WORKS):");
  console.log("   - Simple function context");
  console.log("   - No complex state");
  console.log("   - Direct execution path");
  console.log("   - Minimal gas usage");
  
  console.log("   KVaultV2 (FAILS):");
  console.log("   - Complex _performSmartSwap function");
  console.log("   - Multiple state variables");
  console.log("   - Deep call stack");
  console.log("   - High gas usage with multiple operations");
  
  console.log("\n🎯 RECOMMENDATION:");
  console.log("   The issue is likely in the execution complexity of _performSmartSwap");
  console.log("   Consider refactoring the wrap logic or adding explicit error handling");
}

testVaultExecution()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });