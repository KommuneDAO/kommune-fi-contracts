const { ethers } = require("hardhat");
const fs = require("fs");

async function testContractContext() {
  console.log("🔍 Testing contract execution context vs direct user calls");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // Test stKLAY (index 2)
  const index = 2;
  const tokenInfo = await vault.tokensInfo(index);
  
  console.log("📋 stKLAY Configuration:");
  console.log(`   Asset (stKLAY): ${tokenInfo.asset}`);
  console.log(`   TokenA (wstKLAY): ${tokenInfo.tokenA}`);
  
  const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wrapped = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  const wrapContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
  
  const testAmount = ethers.parseEther("1.0");
  
  // Test 1: Direct user call (this should work like the manual test)
  console.log("\n1️⃣ Testing Direct User Call:");
  
  const userBalance = await asset.balanceOf(signer.address);
  console.log(`   User stKLAY balance: ${ethers.formatEther(userBalance)}`);
  
  if (userBalance >= testAmount) {
    try {
      console.log("   Step 1: Approving stKLAY...");
      await asset.approve(tokenInfo.tokenA, 0);
      let tx = await asset.approve(tokenInfo.tokenA, testAmount);
      await tx.wait();
      
      const allowance = await asset.allowance(signer.address, tokenInfo.tokenA);
      console.log(`   Allowance set: ${ethers.formatEther(allowance)}`);
      
      if (allowance >= testAmount) {
        console.log("   Step 2: Calling wrap directly...");
        const initialWrapped = await wrapped.balanceOf(signer.address);
        
        tx = await wrapContract.wrap(testAmount);
        await tx.wait();
        
        const finalWrapped = await wrapped.balanceOf(signer.address);
        const received = finalWrapped - initialWrapped;
        
        console.log(`   Result: Received ${ethers.formatEther(received)} wstKLAY`);
        console.log(received > 0 ? "   ✅ Direct user wrap: SUCCESS" : "   ❌ Direct user wrap: FAILED");
      }
    } catch (error) {
      console.log(`   ❌ Direct user wrap failed: ${error.message}`);
    }
  }
  
  // Test 2: Simulate vault context by transferring tokens to vault and testing
  console.log("\n2️⃣ Testing Vault Execution Context:");
  
  // Transfer stKLAY to vault for testing
  const vaultBalance = await asset.balanceOf(vaultAddress);
  console.log(`   Vault stKLAY balance: ${ethers.formatEther(vaultBalance)}`);
  
  if (vaultBalance < testAmount && userBalance >= testAmount) {
    console.log("   Transferring stKLAY to vault for testing...");
    tx = await asset.transfer(vaultAddress, testAmount);
    await tx.wait();
  }
  
  const updatedVaultBalance = await asset.balanceOf(vaultAddress);
  console.log(`   Updated vault stKLAY balance: ${ethers.formatEther(updatedVaultBalance)}`);
  
  if (updatedVaultBalance >= testAmount) {
    console.log("   Testing vault's _performSmartSwap function...");
    
    try {
      // This will call _performSmartSwap internally
      const initialVaultWrapped = await wrapped.balanceOf(vaultAddress);
      console.log(`   Vault initial wstKLAY: ${ethers.formatEther(initialVaultWrapped)}`);
      
      // Call performSmartSwap with a small amount to trigger wrap
      // This simulates what happens during deposit/rebalancing
      tx = await vault.performSmartSwap(index, testAmount);
      await tx.wait();
      
      const finalVaultWrapped = await wrapped.balanceOf(vaultAddress);
      const vaultReceived = finalVaultWrapped - initialVaultWrapped;
      
      console.log(`   Vault final wstKLAY: ${ethers.formatEther(finalVaultWrapped)}`);
      console.log(`   Vault received: ${ethers.formatEther(vaultReceived)} wstKLAY`);
      
      if (vaultReceived > 0) {
        console.log("   ✅ Vault context wrap: SUCCESS");
        console.log("   💡 The wrap function works in vault context!");
      } else {
        console.log("   ❌ Vault context wrap: FAILED");
        console.log("   💡 This is the source of our problem!");
      }
      
    } catch (error) {
      console.log(`   ❌ Vault context test failed: ${error.message}`);
      
      if (error.message.includes("performSmartSwap")) {
        console.log("   💡 performSmartSwap function not available - this is expected");
        console.log("   💡 The issue is in the internal _performSmartSwap implementation");
      }
    }
  }
  
  // Test 3: Analyze the difference between contexts
  console.log("\n3️⃣ Context Analysis:");
  console.log("   Direct user context:");
  console.log(`     - msg.sender in wrap(): ${signer.address} (user)`);
  console.log("     - tx.origin: user");
  console.log("     - Funds location: user wallet");
  
  console.log("   Vault context:");
  console.log(`     - msg.sender in wrap(): ${vaultAddress} (vault contract)`);
  console.log("     - tx.origin: user");
  console.log("     - Funds location: vault contract");
  
  console.log("\n4️⃣ Problem Analysis:");
  console.log("   The wrap function likely:");
  console.log("   1. Checks if msg.sender has approved funds correctly");
  console.log("   2. Transfers funds from msg.sender to the wrap contract");
  console.log("   3. Mints wrapped tokens to msg.sender");
  console.log("");
  console.log("   In vault context, this means:");
  console.log("   1. Vault approves stKLAY to wrap contract ✅");
  console.log("   2. Wrap contract tries to transfer from vault ✅");
  console.log("   3. Wrap contract mints wstKLAY to vault ✅");
  console.log("");
  console.log("   But the issue might be:");
  console.log("   - Wrap function restrictions on contract callers");
  console.log("   - Different behavior for contract vs EOA");
  console.log("   - Specific permission checks in wrap implementation");
}

testContractContext()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });