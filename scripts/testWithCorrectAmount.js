const { ethers } = require("hardhat");
const fs = require("fs");

async function testWithCorrectAmount() {
  console.log("🧪 Testing wrap with correct amount: 1.0 stKLAY");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // Test stKLAY with 1.0 amount (same as successful manual test)
  const index = 2;
  const tokenInfo = await vault.tokensInfo(index);
  
  console.log("📋 Testing stKLAY wrap:");
  console.log(`   Asset: ${tokenInfo.asset}`);
  console.log(`   TokenA: ${tokenInfo.tokenA}`);
  
  try {
    const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wrapped = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
    
    // Use exact amount from successful manual test
    const testAmount = ethers.parseEther("1.0"); // 1000000000000000000 wei
    console.log(`   Testing amount: ${ethers.formatEther(testAmount)} stKLAY`);
    
    // Check balances
    const vaultBalance = await asset.balanceOf(vaultAddress);
    const userBalance = await asset.balanceOf(signer.address);
    const initialWrappedBalance = await wrapped.balanceOf(vaultAddress);
    
    console.log(`\n💰 Initial Balances:`);
    console.log(`   Vault stKLAY: ${ethers.formatEther(vaultBalance)}`);
    console.log(`   User stKLAY: ${ethers.formatEther(userBalance)}`);
    console.log(`   Vault wstKLAY: ${ethers.formatEther(initialWrappedBalance)}`);
    
    // Test 1: Direct user call with 1.0 stKLAY
    if (userBalance >= testAmount) {
      console.log(`\n🧪 Test 1: Direct user call with 1.0 stKLAY`);
      
      try {
        // Reset approve
        console.log(`   Resetting approve...`);
        let tx = await asset.approve(tokenInfo.tokenA, 0);
        await tx.wait();
        
        // Approve 1.0 stKLAY
        console.log(`   Approving 1.0 stKLAY...`);
        tx = await asset.approve(tokenInfo.tokenA, testAmount);
        await tx.wait();
        
        // Check allowance
        const allowance = await asset.allowance(signer.address, tokenInfo.tokenA);
        console.log(`   Allowance: ${ethers.formatEther(allowance)}`);
        
        if (allowance >= testAmount) {
          // Attempt wrap
          console.log(`   Calling wrap(1.0 stKLAY)...`);
          const wrapTx = await wrapped.wrap(testAmount);
          const receipt = await wrapTx.wait();
          
          console.log(`   ✅ Wrap successful! Gas: ${receipt.gasUsed.toLocaleString()}`);
          
          // Check results
          const newUserBalance = await asset.balanceOf(signer.address);
          const newWrappedBalance = await wrapped.balanceOf(signer.address);
          
          console.log(`   📊 Results:`);
          console.log(`     stKLAY used: ${ethers.formatEther(userBalance - newUserBalance)}`);
          console.log(`     wstKLAY received: ${ethers.formatEther(newWrappedBalance)}`);
          
          if (newWrappedBalance > 0) {
            console.log(`   🎉 SUCCESS: wrap function works with 1.0 stKLAY!`);
            
            // Now test if vault can do the same
            console.log(`\n🧪 Test 2: Vault context with 1.0 stKLAY`);
            
            if (vaultBalance >= testAmount) {
              // We can't directly call from vault, but we can check if the issue is amount-related
              console.log(`   Vault has sufficient balance for 1.0 stKLAY wrap`);
              console.log(`   The issue in our contract might be:`);
              console.log(`   1. Using amounts smaller than 1.0 stKLAY`);
              console.log(`   2. msg.sender restrictions`);
              console.log(`   3. Execution context differences`);
              
              // Test smaller amounts to find minimum
              console.log(`\n🧪 Test 3: Finding minimum wrap amount`);
              const testAmounts = [
                ethers.parseEther("0.5"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.01")
              ];
              
              for (const amount of testAmounts) {
                console.log(`\n   Testing ${ethers.formatEther(amount)} stKLAY:`);
                try {
                  await asset.approve(tokenInfo.tokenA, 0);
                  await asset.approve(tokenInfo.tokenA, amount);
                  
                  const wrapTx = await wrapped.wrap(amount);
                  await wrapTx.wait();
                  console.log(`     ✅ ${ethers.formatEther(amount)} stKLAY wrap successful`);
                } catch (error) {
                  console.log(`     ❌ ${ethers.formatEther(amount)} stKLAY wrap failed: ${error.message}`);
                  break; // Stop at first failure to find minimum
                }
              }
              
            } else {
              console.log(`   ❌ Vault has insufficient balance for 1.0 stKLAY test`);
            }
            
          } else {
            console.log(`   ❌ No wstKLAY received despite successful transaction`);
          }
          
        } else {
          console.log(`   ❌ Approve failed - allowance: ${ethers.formatEther(allowance)}`);
        }
        
      } catch (error) {
        console.log(`   ❌ 1.0 stKLAY wrap failed: ${error.message}`);
      }
    } else {
      console.log(`   ❌ Insufficient user balance for 1.0 stKLAY test`);
    }
    
  } catch (error) {
    console.error("❌ Test error:", error.message);
  }
}

testWithCorrectAmount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });