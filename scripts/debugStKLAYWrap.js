const { ethers } = require("hardhat");
const fs = require("fs");

async function debugStKLAYWrap() {
  console.log("🔍 Debugging stKLAY wrap process");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    console.log("📊 Token Info for stKLAY (index 2):");
    const tokenInfo = await vault.tokensInfo(2);
    console.log(`   asset (stKLAY): ${tokenInfo.asset}`);
    console.log(`   tokenA (wstKLAY): ${tokenInfo.tokenA}`);
    console.log(`   handler: ${tokenInfo.handler}`);
    
    // Check stKLAY balance
    const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const stKLAYBalance = await stKLAY.balanceOf(vaultAddress);
    console.log(`\n💰 Current stKLAY balance: ${ethers.formatEther(stKLAYBalance)}`);
    
    // Check wstKLAY balance
    const wstKLAY = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
    const wstKLAYBalance = await wstKLAY.balanceOf(vaultAddress);
    console.log(`💰 Current wstKLAY balance: ${ethers.formatEther(wstKLAYBalance)}`);
    
    // Check allowance
    const allowance = await stKLAY.allowance(vaultAddress, tokenInfo.tokenA);
    console.log(`🔑 Current allowance: ${ethers.formatEther(allowance)}`);
    
    if (stKLAYBalance > 0) {
      console.log("\n🧪 Testing wrap conversion calculation:");
      
      // Test small wrap amount
      const testWrapAmount = ethers.parseEther("0.01"); // 0.01 wstKLAY needed
      
      try {
        const wrapped = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
        const requiredStKLAY = await wrapped.getUnwrappedAmount(testWrapAmount);
        console.log(`   To get ${ethers.formatEther(testWrapAmount)} wstKLAY`);
        console.log(`   Need ${ethers.formatEther(requiredStKLAY)} stKLAY`);
        console.log(`   Have ${ethers.formatEther(stKLAYBalance)} stKLAY`);
        console.log(`   Sufficient: ${stKLAYBalance >= requiredStKLAY}`);
        
        if (stKLAYBalance >= requiredStKLAY) {
          console.log("\n✅ Should be able to wrap successfully!");
        } else {
          console.log("\n❌ Insufficient stKLAY for wrapping");
        }
        
      } catch (error) {
        console.log(`❌ Error calculating wrap amount: ${error.message}`);
      }
    } else {
      console.log("❌ No stKLAY balance to wrap");
    }
    
    // Test the wrap process step by step
    console.log("\n🔧 Manual wrap test:");
    if (stKLAYBalance > 0) {
      const wrapAmount = stKLAYBalance / 10n; // Use 10% for testing
      console.log(`Testing wrap of ${ethers.formatEther(wrapAmount)} stKLAY`);
      
      try {
        // Test approve
        console.log("   Testing approve...");
        const approveTx = await stKLAY.approve(tokenInfo.tokenA, wrapAmount);
        await approveTx.wait();
        console.log("   ✅ Approve successful");
        
        // Test wrap
        console.log("   Testing wrap...");
        const wrapped = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
        const wrapTx = await wrapped.wrap(wrapAmount);
        await wrapTx.wait();
        console.log("   ✅ Wrap successful");
        
        // Check new balances
        const newStKLAYBalance = await stKLAY.balanceOf(vaultAddress);
        const newWstKLAYBalance = await wstKLAY.balanceOf(vaultAddress);
        console.log(`   New stKLAY balance: ${ethers.formatEther(newStKLAYBalance)}`);
        console.log(`   New wstKLAY balance: ${ethers.formatEther(newWstKLAYBalance)}`);
        
      } catch (error) {
        console.log(`   ❌ Wrap test failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Debug error:", error.message);
  }
}

debugStKLAYWrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });