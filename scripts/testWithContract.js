const { ethers } = require("hardhat");

async function testWithContract() {
  console.log("🔍 Testing wrap functionality using deployed test contract");
  
  const [signer] = await ethers.getSigners();
  
  const stKLAYAddress = "0x524dCFf07BFF606225A4FA76AFA55D705B052004";
  const wstKLAYAddress = "0x474B49DF463E528223F244670e332fE82742e1aA";
  
  console.log("📋 Setup:");
  console.log(`   User: ${signer.address}`);
  console.log(`   stKLAY: ${stKLAYAddress}`);
  console.log(`   wstKLAY: ${wstKLAYAddress}`);
  
  // Deploy test contract
  console.log("\n🚀 Deploying Test Contract...");
  const TestWrapContract = await ethers.getContractFactory("TestWrapContract");
  const testContract = await TestWrapContract.deploy();
  await testContract.waitForDeployment();
  
  const testContractAddress = await testContract.getAddress();
  console.log(`   Test contract deployed at: ${testContractAddress}`);
  
  const stKLAY = await ethers.getContractAt("IERC20", stKLAYAddress);
  const wstKLAY = await ethers.getContractAt("IERC20", wstKLAYAddress);
  
  // Transfer stKLAY to test contract
  const testAmount = ethers.parseEther("1.0");
  console.log(`\n💰 Transferring ${ethers.formatEther(testAmount)} stKLAY to test contract...`);
  
  const userBalance = await stKLAY.balanceOf(signer.address);
  console.log(`   User stKLAY balance: ${ethers.formatEther(userBalance)}`);
  
  if (userBalance >= testAmount) {
    let tx = await stKLAY.transfer(testContractAddress, testAmount);
    await tx.wait();
    console.log(`   ✅ Transfer completed`);
  } else {
    console.log(`   ❌ Insufficient balance for test`);
    return;
  }
  
  // Check contract balances
  const [contractStKLAY, contractWstKLAY] = await testContract.checkBalances(stKLAYAddress, wstKLAYAddress);
  console.log(`\n📊 Test Contract Initial Balances:`);
  console.log(`   stKLAY: ${ethers.formatEther(contractStKLAY)}`);
  console.log(`   wstKLAY: ${ethers.formatEther(contractWstKLAY)}`);
  
  // Test 1: Try wrap function with error handling
  console.log(`\n🧪 Test 1: Contract wrap with error handling`);
  
  try {
    const [success, errorMessage] = await testContract.testWrapFunction(
      stKLAYAddress, 
      wstKLAYAddress, 
      testAmount
    );
    
    console.log(`   Result: ${success ? "✅ SUCCESS" : "❌ FAILED"}`);
    if (!success) {
      console.log(`   Error: ${errorMessage}`);
    }
    
    // Check balances after test
    const [finalStKLAY, finalWstKLAY] = await testContract.checkBalances(stKLAYAddress, wstKLAYAddress);
    console.log(`   Final balances:`);
    console.log(`     stKLAY: ${ethers.formatEther(finalStKLAY)}`);
    console.log(`     wstKLAY: ${ethers.formatEther(finalWstKLAY)}`);
    
    const wstKLAYReceived = finalWstKLAY - contractWstKLAY;
    if (wstKLAYReceived > 0) {
      console.log(`   🎉 Received ${ethers.formatEther(wstKLAYReceived)} wstKLAY!`);
    }
    
  } catch (error) {
    console.log(`   ❌ Test 1 failed: ${error.message}`);
  }
  
  // Test 2: Try direct wrap (without try/catch wrapper)  
  console.log(`\n🧪 Test 2: Direct contract wrap`);
  
  try {
    // Check current balances
    const [beforeStKLAY, beforeWstKLAY] = await testContract.checkBalances(stKLAYAddress, wstKLAYAddress);
    console.log(`   Before: stKLAY=${ethers.formatEther(beforeStKLAY)}, wstKLAY=${ethers.formatEther(beforeWstKLAY)}`);
    
    if (beforeStKLAY >= ethers.parseEther("0.5")) {
      const smallAmount = ethers.parseEther("0.5");
      
      console.log(`   Attempting direct wrap with ${ethers.formatEther(smallAmount)} stKLAY...`);
      
      tx = await testContract.directWrap(stKLAYAddress, wstKLAYAddress, smallAmount);
      const receipt = await tx.wait();
      
      console.log(`   ✅ Direct wrap transaction successful!`);
      console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
      
      // Check results
      const [afterStKLAY, afterWstKLAY] = await testContract.checkBalances(stKLAYAddress, wstKLAYAddress);
      console.log(`   After: stKLAY=${ethers.formatEther(afterStKLAY)}, wstKLAY=${ethers.formatEther(afterWstKLAY)}`);
      
      const stKLAYUsed = beforeStKLAY - afterStKLAY;
      const wstKLAYGained = afterWstKLAY - beforeWstKLAY;
      
      console.log(`   📊 Results:`);
      console.log(`     stKLAY used: ${ethers.formatEther(stKLAYUsed)}`);
      console.log(`     wstKLAY gained: ${ethers.formatEther(wstKLAYGained)}`);
      
      if (wstKLAYGained > 0) {
        const rate = wstKLAYGained * 1000n / stKLAYUsed;
        console.log(`     Exchange rate: 1 stKLAY = ${ethers.formatUnits(rate, 3)} wstKLAY`);
        console.log(`   🎉 SUCCESS: Contract context wrap WORKS!`);
        
        console.log(`\n💡 IMPORTANT FINDING:`);
        console.log(`   The wrap function DOES work in contract context!`);
        console.log(`   This means the problem is elsewhere in our implementation.`);
        
      } else {
        console.log(`   ❌ No wstKLAY received despite successful transaction`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Test 2 failed: ${error.message}`);
    
    // Analyze the specific error
    if (error.message.includes("execution reverted")) {
      console.log(`   💡 Transaction reverted - wrap function rejected the contract call`);
    } else if (error.message.includes("allowance")) {
      console.log(`   💡 Allowance issue in contract context`);
    } else {
      console.log(`   💡 Unknown contract context issue`);
    }
  }
  
  console.log(`\n📝 Analysis:`);
  console.log(`   If Test 2 succeeds:`);
  console.log(`     → Wrap function DOES work from contracts`);
  console.log(`     → Problem is in our vault/SwapContract implementation`);
  console.log(`     → Check gas limits, function parameters, or execution flow`);
  console.log(`   If Test 2 fails:`);
  console.log(`     → Wrap function blocks contract callers`);
  console.log(`     → Need to find alternative approach or contact protocol team`);
}

testWithContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });