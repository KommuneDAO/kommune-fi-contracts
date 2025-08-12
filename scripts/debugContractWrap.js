const { ethers } = require("hardhat");
const fs = require("fs");

async function debugContractWrap() {
  console.log("🔍 Debugging why wrap fails in contract context");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // Test stKLAY specifically since manual test was successful
  const index = 2;
  const tokenInfo = await vault.tokensInfo(index);
  
  console.log("📋 stKLAY Configuration:");
  console.log(`   Asset (stKLAY): ${tokenInfo.asset}`);
  console.log(`   TokenA (wstKLAY): ${tokenInfo.tokenA}`);
  console.log(`   Vault address: ${vaultAddress}`);
  console.log(`   User address: ${signer.address}`);
  
  try {
    const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wrapped = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
    
    // Check balances
    const vaultAssetBalance = await asset.balanceOf(vaultAddress);
    const userAssetBalance = await asset.balanceOf(signer.address);
    
    console.log(`\n💰 Current Balances:`);
    console.log(`   Vault stKLAY: ${ethers.formatEther(vaultAssetBalance)}`);
    console.log(`   User stKLAY: ${ethers.formatEther(userAssetBalance)}`);
    
    const testAmount = ethers.parseEther("0.01");
    
    console.log(`\n🧪 Comparison Test: Direct vs Contract Call`);
    console.log(`Testing amount: ${ethers.formatEther(testAmount)} stKLAY`);
    
    // Test 1: Direct call (like successful manual test)
    console.log(`\n1️⃣ Direct Call Test (should succeed):`);
    if (userAssetBalance >= testAmount) {
      try {
        // Reset approve
        await asset.approve(tokenInfo.tokenA, 0);
        await asset.approve(tokenInfo.tokenA, testAmount);
        
        const allowance = await asset.allowance(signer.address, tokenInfo.tokenA);
        console.log(`   Allowance set: ${ethers.formatEther(allowance)}`);
        
        // Direct wrap call
        const wrapTx = await wrapped.wrap(testAmount);
        await wrapTx.wait();
        console.log(`   ✅ Direct wrap successful!`);
        
      } catch (error) {
        console.log(`   ❌ Direct wrap failed: ${error.message}`);
      }
    } else {
      console.log(`   ⏭️ Insufficient user balance for direct test`);
    }
    
    // Test 2: Check vault context issues
    console.log(`\n2️⃣ Vault Context Analysis:`);
    
    // Check if vault can approve
    try {
      const vaultAllowance = await asset.allowance(vaultAddress, tokenInfo.tokenA);
      console.log(`   Current vault allowance: ${ethers.formatEther(vaultAllowance)}`);
      
      // Try to check what happens when vault tries to approve
      console.log(`   Testing vault approve mechanism...`);
      
      // Check if there are any restrictions on the wrap function
      console.log(`   Checking wrap function restrictions...`);
      
      // Try to simulate what our contract does
      if (vaultAssetBalance >= testAmount) {
        console.log(`   Simulating contract wrap process...`);
        
        // This would be called from within the contract context
        // Let's see if we can identify what's different
        
        // Check if the wrap function has any sender restrictions
        try {
          // Call wrap with 0 amount to see if there are permission issues
          const testTx = await wrapped.populateTransaction.wrap(0);
          console.log(`   Wrap function callable: ✅`);
          console.log(`   Target: ${testTx.to}`);
          console.log(`   Data: ${testTx.data}`);
        } catch (permError) {
          console.log(`   ❌ Wrap function permission issue: ${permError.message}`);
        }
        
      } else {
        console.log(`   ⏭️ Insufficient vault balance for simulation`);
      }
      
    } catch (error) {
      console.log(`   ❌ Vault context analysis failed: ${error.message}`);
    }
    
    // Test 3: Check for differences in execution context
    console.log(`\n3️⃣ Execution Context Differences:`);
    
    console.log(`   Manual test context:`);
    console.log(`     - Caller: User (${signer.address})`);
    console.log(`     - msg.sender in wrap: User`);
    console.log(`     - Transaction origin: User`);
    
    console.log(`   Contract test context:`);
    console.log(`     - Caller: User → Vault → SwapContract → wrap`);
    console.log(`     - msg.sender in wrap: SwapContract or Vault`);
    console.log(`     - Transaction origin: User`);
    
    // Test 4: Try to understand the exact failure mode
    console.log(`\n4️⃣ Failure Mode Analysis:`);
    
    console.log(`   From our previous tests, the pattern was:`);
    console.log(`   ✅ Approve transaction succeeds`);
    console.log(`   ❌ But allowance remains 0`);
    console.log(`   ✅ Wrap transaction succeeds`);
    console.log(`   ❌ But no tokens are transferred`);
    
    console.log(`\n💡 Possible Issues:`);
    console.log(`   1. wrap() function checks msg.sender and rejects contracts`);
    console.log(`   2. approve() target is wrong for contract context`);
    console.log(`   3. wrap() function has different behavior for contracts`);
    console.log(`   4. Gas limits or execution environment differences`);
    console.log(`   5. wrap() function requires specific permissions`);
    
  } catch (error) {
    console.error("❌ Debug error:", error.message);
  }
}

debugContractWrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });