const { ethers } = require("hardhat");

async function debugStKLAY() {
  console.log("🔍 Debugging stKLAY token contract behavior");
  
  const [signer] = await ethers.getSigners();
  
  const stKLAYAddress = "0x524dCFf07BFF606225A4FA76AFA55D705B052004";
  const wstKLAYAddress = "0x474B49DF463E528223F244670e332fE82742e1aA";
  
  console.log(`📋 Addresses:`);
  console.log(`   User: ${signer.address}`);
  console.log(`   stKLAY: ${stKLAYAddress}`);
  console.log(`   wstKLAY: ${wstKLAYAddress}`);
  
  const stKLAY = await ethers.getContractAt("IERC20", stKLAYAddress);
  const wstKLAY = await ethers.getContractAt("IERC20", wstKLAYAddress);
  
  // Check basic info
  const balance = await stKLAY.balanceOf(signer.address);
  const currentAllowance = await stKLAY.allowance(signer.address, wstKLAYAddress);
  
  console.log(`\n💰 Current State:`);
  console.log(`   stKLAY balance: ${ethers.formatEther(balance)}`);
  console.log(`   Current allowance: ${ethers.formatEther(currentAllowance)}`);
  
  // Test very basic approve with 0 first
  console.log(`\n🧪 Testing basic approve operations:`);
  
  try {
    console.log("   1. Testing approve(spender, 0)...");
    let tx = await stKLAY.approve(wstKLAYAddress, 0);
    let receipt = await tx.wait();
    console.log(`   ✅ Reset approve successful (gas: ${receipt.gasUsed.toLocaleString()})`);
    
    const allowanceAfterReset = await stKLAY.allowance(signer.address, wstKLAYAddress);
    console.log(`   Allowance after reset: ${ethers.formatEther(allowanceAfterReset)}`);
    
  } catch (error) {
    console.log(`   ❌ Reset approve failed: ${error.message}`);
    
    // Try to understand the error
    if (error.message.includes("revert")) {
      console.log("   💡 Transaction reverted - may be a contract restriction");
    } else if (error.message.includes("execution reverted")) {
      console.log("   💡 Execution reverted - check contract implementation");
    }
    
    // Let's try to call the contract view functions to see if it's accessible
    console.log(`\n🔍 Testing contract accessibility:`);
    
    try {
      const name = await stKLAY.name();
      const symbol = await stKLAY.symbol();
      console.log(`   Token name: ${name}`);
      console.log(`   Token symbol: ${symbol}`);
      console.log(`   ✅ Contract is accessible`);
    } catch (viewError) {
      console.log(`   ❌ Contract not accessible: ${viewError.message}`);
    }
    
    return; // Exit early if basic approve fails
  }
  
  // Test small amount approve
  try {
    console.log(`\n   2. Testing approve with small amount...`);
    const testAmount = ethers.parseEther("0.01");
    
    let tx = await stKLAY.approve(wstKLAYAddress, testAmount);
    let receipt = await tx.wait();
    console.log(`   ✅ Small approve successful (gas: ${receipt.gasUsed.toLocaleString()})`);
    
    const allowanceAfter = await stKLAY.allowance(signer.address, wstKLAYAddress);
    console.log(`   Allowance set: ${ethers.formatEther(allowanceAfter)}`);
    
    if (allowanceAfter >= testAmount) {
      console.log(`   ✅ Allowance correctly set`);
      
      // Now try wrap with small amount
      console.log(`\n🧪 Testing wrap function:`);
      
      const wrapContract = await ethers.getContractAt("IWrapped", wstKLAYAddress);
      
      try {
        const initialWstKLAY = await wstKLAY.balanceOf(signer.address);
        console.log(`   Initial wstKLAY balance: ${ethers.formatEther(initialWstKLAY)}`);
        
        tx = await wrapContract.wrap(testAmount);
        receipt = await tx.wait();
        console.log(`   ✅ Wrap successful (gas: ${receipt.gasUsed.toLocaleString()})`);
        
        const finalWstKLAY = await wstKLAY.balanceOf(signer.address);
        const received = finalWstKLAY - initialWstKLAY;
        
        console.log(`   Final wstKLAY balance: ${ethers.formatEther(finalWstKLAY)}`);
        console.log(`   Received: ${ethers.formatEther(received)} wstKLAY`);
        
        if (received > 0) {
          console.log(`   🎉 SUCCESS: Wrap function works for direct user calls!`);
          console.log(`   💡 The issue is specifically with contract context, not user context`);
        } else {
          console.log(`   ⚠️ Wrap succeeded but no tokens received`);
        }
        
      } catch (wrapError) {
        console.log(`   ❌ Wrap failed: ${wrapError.message}`);
        
        // Analyze wrap error
        if (wrapError.message.includes("allowance")) {
          console.log(`   💡 Allowance issue detected`);
        } else if (wrapError.message.includes("balance")) {
          console.log(`   💡 Balance issue detected`);
        } else {
          console.log(`   💡 Unknown wrap error - may be contract-specific`);
        }
      }
      
    } else {
      console.log(`   ❌ Allowance not set correctly`);
    }
    
  } catch (error) {
    console.log(`   ❌ Small approve failed: ${error.message}`);
  }
  
  console.log(`\n📝 Summary:`);
  console.log(`   This test helps isolate whether the issue is:`);
  console.log(`   1. stKLAY token contract restrictions`);
  console.log(`   2. Network/connection issues`);
  console.log(`   3. User account issues`);
  console.log(`   4. Wrap contract implementation issues`);
}

debugStKLAY()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });