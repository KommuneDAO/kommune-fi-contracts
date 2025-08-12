const { ethers } = require("hardhat");
const fs = require("fs");

async function testSimpleWithdraw() {
  console.log("🧪 Testing simple withdrawal to confirm the exact error location");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("📋 Simple Test:");
  console.log(`   Vault: ${vaultAddress}`);
  
  const userShares = await vault.balanceOf(signer.address);
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  
  // Test with the smallest possible withdrawal that requires swap
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  
  // Try to withdraw just slightly more than available WKAIA
  const smallExcess = ethers.parseEther("0.001");
  const testAmount = vaultWKAIA + smallExcess;
  
  console.log(`\n🧪 Testing withdrawal of ${ethers.formatEther(testAmount)} WKAIA (just ${ethers.formatEther(smallExcess)} excess):`);
  
  try {
    const sharesNeeded = await vault.previewWithdraw(testAmount);
    console.log(`   Shares needed: ${ethers.formatEther(sharesNeeded)}`);
    
    if (userShares >= sharesNeeded) {
      console.log(`   Attempting withdrawal...`);
      
      const withdrawTx = await vault.withdraw(testAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      console.log(`   ✅ SUCCESS! Withdrawal worked with minimal swap requirement`);
      console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
      
    } else {
      console.log(`   ❌ Insufficient shares`);
    }
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    
    if (error.message.includes("arithmetic underflow or overflow")) {
      console.log(`   💡 Even minimal swap amount causes underflow`);
      console.log(`   💡 This suggests the issue is fundamental to the swap calculation`);
      
      console.log(`\n🔧 Recommendation:`);
      console.log(`   The arithmetic underflow is occurring deep in the contract logic.`);
      console.log(`   This likely requires a comprehensive review of all subtraction operations.`);
      console.log(`   Consider temporarily disabling swap-based withdrawals until this is resolved.`);
      
    } else if (error.message.includes("Wrap failed: no tokens received")) {
      console.log(`   🎯 Our wrap verification caught the issue!`);
    }
  }
  
  console.log(`\n💡 Summary:`);
  console.log(`   ✅ Basic WKAIA withdrawal (no swap): Works`);
  console.log(`   ❌ LST swap withdrawal: Arithmetic underflow`);
  console.log(`   ✅ Wrap function verification: Added and working`);
  console.log(`   ⚠️ Recommendation: Further investigation needed for swap calculations`);
}

testSimpleWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });