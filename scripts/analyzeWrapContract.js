const { ethers } = require("hardhat");

async function analyzeWrapContract() {
  console.log("🔍 Analyzing wstKLAY wrap contract implementation");
  
  const wstKLAYAddress = "0x474B49DF463E528223F244670e332fE82742e1aA";
  const stKLAYAddress = "0x524dCFf07BFF606225A4FA76AFA55D705B052004";
  
  const [signer] = await ethers.getSigners();
  
  console.log("📋 Contract Information:");
  console.log(`   wstKLAY: ${wstKLAYAddress}`);
  console.log(`   stKLAY: ${stKLAYAddress}`);
  console.log(`   User: ${signer.address}`);
  
  const wstKLAY = await ethers.getContractAt("IERC20", wstKLAYAddress);
  const wrapContract = await ethers.getContractAt("IWrapped", wstKLAYAddress);
  
  console.log("\n🔍 Testing Contract Functions:");
  
  // Test basic view functions
  try {
    const name = await wstKLAY.name();
    const symbol = await wstKLAY.symbol();
    console.log(`   Token name: ${name}`);
    console.log(`   Token symbol: ${symbol}`);
    
    // Try to check if there are access control functions
    try {
      // Check if contract has owner/admin functions
      const owner = await wstKLAY.owner();
      console.log(`   Owner: ${owner}`);
    } catch (e) {
      console.log("   No owner function found");
    }
    
    // Check for paused state
    try {
      const paused = await wstKLAY.paused();
      console.log(`   Paused: ${paused}`);
    } catch (e) {
      console.log("   No paused function found");
    }
    
  } catch (error) {
    console.log(`   ❌ Basic info failed: ${error.message}`);
  }
  
  // Test wrap function restrictions
  console.log("\n🧪 Testing Wrap Function Access:");
  
  try {
    // Test with 0 amount to see if function exists and is callable
    console.log("   Testing wrap(0) to check accessibility...");
    
    const tx = await wrapContract.populateTransaction.wrap(0);
    console.log(`   ✅ Wrap function is accessible`);
    console.log(`   Function selector: ${tx.data.slice(0, 10)}`);
    
    // Now test actual wrap with very small amount
    const testAmount = ethers.parseEther("0.001");
    const stKLAY = await ethers.getContractAt("IERC20", stKLAYAddress);
    
    const userBalance = await stKLAY.balanceOf(signer.address);
    
    if (userBalance >= testAmount) {
      console.log(`\n   Testing actual wrap with ${ethers.formatEther(testAmount)} stKLAY...`);
      
      // Approve
      await stKLAY.approve(wstKLAYAddress, testAmount);
      
      const initialWstKLAY = await wstKLAY.balanceOf(signer.address);
      
      // Try wrap
      const wrapTx = await wrapContract.wrap(testAmount);
      const receipt = await wrapTx.wait();
      
      const finalWstKLAY = await wstKLAY.balanceOf(signer.address);
      const received = finalWstKLAY - initialWstKLAY;
      
      console.log(`   ✅ Wrap successful, received: ${ethers.formatEther(received)} wstKLAY`);
      console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
      
      // Analyze transaction logs for more details
      console.log(`\n📊 Transaction Analysis:`);
      for (const log of receipt.logs) {
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
          const from = ethers.getAddress("0x" + log.topics[1].slice(26));
          const to = ethers.getAddress("0x" + log.topics[2].slice(26));
          const value = ethers.getBigInt(log.data);
          
          console.log(`   Transfer: ${ethers.formatEther(value)} tokens`);
          console.log(`     From: ${from}`);
          console.log(`     To: ${to}`);
          console.log(`     Contract: ${log.address}`);
        }
      }
      
    }
    
  } catch (error) {
    console.log(`   ❌ Wrap function test failed: ${error.message}`);
  }
  
  console.log("\n🔍 Contract Context Simulation:");
  console.log("   To properly test contract context, we need to:");
  console.log("   1. Deploy a simple test contract");
  console.log("   2. Transfer tokens to the test contract");
  console.log("   3. Have the test contract call approve and wrap");
  console.log("   4. Compare results with direct user calls");
  
  // Check if we can simulate contract calls differently
  console.log("\n💡 Problem Analysis:");
  console.log("   Based on our findings:");
  console.log("   ✅ Direct user → wrap contract: WORKS");
  console.log("   ❌ Vault contract → wrap contract: FAILS");
  console.log("   ❌ SwapContract → wrap contract: FAILS");
  console.log("");
  console.log("   Possible causes:");
  console.log("   1. msg.sender whitelist in wrap contract");
  console.log("   2. Contract caller restrictions in stKLAY or wstKLAY");
  console.log("   3. Different gas limits or execution context");
  console.log("   4. Reentrancy protection blocking contract calls");
  console.log("   5. Admin/owner restrictions on contract interactions");
}

analyzeWrapContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });