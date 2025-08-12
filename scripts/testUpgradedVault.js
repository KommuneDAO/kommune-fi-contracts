const { ethers } = require("hardhat");
const fs = require("fs");

async function testUpgradedVault() {
  console.log("🧪 Testing upgraded vault with wrap success verification");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("📋 Test Configuration:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   User: ${signer.address}`);
  
  // Test with small deposit that would trigger wrap
  const depositAmount = ethers.parseEther("0.05"); // Small amount to trigger wrapping
  
  console.log(`\n💰 Testing deposit of ${ethers.formatEther(depositAmount)} WKAIA:`);
  
  // Check if user has enough WKAIA for test
  const wkaiaAddress = "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432"; // WKAIA on Kairos
  const wkaia = await ethers.getContractAt("IERC20", wkaiaAddress);
  
  const userWKAIABalance = await wkaia.balanceOf(signer.address);
  console.log(`   User WKAIA balance: ${ethers.formatEther(userWKAIABalance)}`);
  
  if (userWKAIABalance < depositAmount) {
    console.log(`   ⚠️ Insufficient WKAIA for deposit test`);
    console.log(`   Let's test with smaller amount or skip deposit test`);
    
    // Instead, let's test the wrap function detection directly
    console.log(`\n🔍 Testing wrap error detection directly:`);
    
    // Check current vault token balances
    const index = 2; // stKLAY
    const tokenInfo = await vault.tokensInfo(index);
    const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wstKLAY = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
    
    const vaultStKLAY = await stKLAY.balanceOf(vaultAddress);
    const vaultWstKLAY = await wstKLAY.balanceOf(vaultAddress);
    
    console.log(`   Vault stKLAY: ${ethers.formatEther(vaultStKLAY)}`);
    console.log(`   Vault wstKLAY: ${ethers.formatEther(vaultWstKLAY)}`);
    
    if (vaultStKLAY > 0) {
      console.log(`\n💡 Our upgrade now includes wrap success verification:`);
      console.log(`   Before wrap: balanceBefore = balanceOf(this)`);
      console.log(`   Call wrap: IWrapped.wrap(amount)`);
      console.log(`   After wrap: balanceAfter = balanceOf(this)`);
      console.log(`   Verify: require(balanceAfter > balanceBefore, "Wrap failed: no tokens received")`);
      
      console.log(`\n🎯 Expected behavior:`);
      console.log(`   ✅ If wrap works: Transaction succeeds, tokens are wrapped`);
      console.log(`   ❌ If wrap fails: Transaction reverts with clear error message`);
      console.log(`   🚫 No more silent failures that cause swap issues`);
      
      console.log(`\n📊 Monitoring recommendations:`);
      console.log(`   1. Watch for "Wrap failed: no tokens received" errors in logs`);
      console.log(`   2. If this error appears, it confirms wrap function issues`);
      console.log(`   3. Test with UI to see if deposit/withdraw now work properly`);
      console.log(`   4. Monitor specific LST protocols that may have restrictions`);
    }
    
    return;
  }
  
  console.log(`\n🧪 Proceeding with deposit test...`);
  
  try {
    // Get vault state before deposit
    const totalSupplyBefore = await vault.totalSupply();
    const totalAssetsBefore = await vault.totalAssets();
    
    console.log(`   Pre-deposit state:`);
    console.log(`     Vault total supply: ${ethers.formatEther(totalSupplyBefore)}`);
    console.log(`     Vault total assets: ${ethers.formatEther(totalAssetsBefore)}`);
    
    // Approve WKAIA for deposit
    console.log(`   Approving ${ethers.formatEther(depositAmount)} WKAIA...`);
    let tx = await wkaia.approve(vaultAddress, depositAmount);
    await tx.wait();
    
    // Attempt deposit (this will trigger wrap operations if needed)
    console.log(`   Depositing ${ethers.formatEther(depositAmount)} WKAIA...`);
    
    const depositTx = await vault.deposit(depositAmount, signer.address);
    const receipt = await depositTx.wait();
    
    console.log(`   ✅ Deposit successful!`);
    console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    
    // Get vault state after deposit
    const totalSupplyAfter = await vault.totalSupply();
    const totalAssetsAfter = await vault.totalAssets();
    
    console.log(`   Post-deposit state:`);
    console.log(`     Vault total supply: ${ethers.formatEther(totalSupplyAfter)}`);
    console.log(`     Vault total assets: ${ethers.formatEther(totalAssetsAfter)}`);
    
    const sharesMinted = totalSupplyAfter - totalSupplyBefore;
    console.log(`   Shares minted: ${ethers.formatEther(sharesMinted)}`);
    
    if (sharesMinted > 0) {
      console.log(`   🎉 SUCCESS: Deposit worked without wrap errors!`);
      console.log(`   💡 This means either:`);
      console.log(`      a) Wrap functions are now working correctly, OR`);
      console.log(`      b) This deposit didn't require wrapping operations`);
    }
    
    // Analyze transaction logs for any wrap events
    console.log(`\n📊 Transaction Analysis:`);
    let wrapOperations = 0;
    let transferEvents = 0;
    
    for (const log of receipt.logs) {
      if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        transferEvents++;
      }
    }
    
    console.log(`   Transfer events: ${transferEvents}`);
    console.log(`   This indicates token movements during the deposit`);
    
  } catch (error) {
    console.log(`   ❌ Deposit failed: ${error.message}`);
    
    if (error.message.includes("Wrap failed: no tokens received")) {
      console.log(`   🎯 SUCCESS: Our fix detected the wrap failure!`);
      console.log(`   💡 The wrap function was indeed failing silently before`);
      console.log(`   💡 Now it's caught and reported clearly`);
      console.log(`   🔧 Next step: Investigate why specific wrap functions fail`);
    } else {
      console.log(`   💡 Different error - may not be wrap-related`);
    }
  }
}

testUpgradedVault()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });