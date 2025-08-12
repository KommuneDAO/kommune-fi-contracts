const { ethers } = require("hardhat");
const fs = require("fs");

async function fixedWrapTest() {
  console.log("🧪 Fixed wrap test with correct balance checking");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // Test stKLAY
  const index = 2;
  const tokenInfo = await vault.tokensInfo(index);
  
  console.log("📋 stKLAY Wrap Test:");
  console.log(`   Asset (stKLAY): ${tokenInfo.asset}`);
  console.log(`   TokenA (wstKLAY): ${tokenInfo.tokenA}`);
  console.log(`   User: ${signer.address}`);
  
  try {
    const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wrapped = await ethers.getContractAt("IERC20", tokenInfo.tokenA); // Use IERC20 instead of IWrapped
    const wrapContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
    
    // Test with 1.0 stKLAY (same as successful manual test)
    const testAmount = ethers.parseEther("1.0");
    console.log(`   Testing amount: ${ethers.formatEther(testAmount)} stKLAY`);
    
    // Check initial balances (USER ADDRESS, not vault!)
    const initialAssetBalance = await asset.balanceOf(signer.address);
    const initialWrappedBalance = await wrapped.balanceOf(signer.address);
    
    console.log(`\n💰 Initial User Balances:`);
    console.log(`   User stKLAY: ${ethers.formatEther(initialAssetBalance)}`);
    console.log(`   User wstKLAY: ${ethers.formatEther(initialWrappedBalance)}`);
    
    if (initialAssetBalance < testAmount) {
      console.log(`❌ Insufficient stKLAY balance for test`);
      return;
    }
    
    console.log(`\n🧪 Testing wrap process:`);
    
    // Step 1: Reset approve
    console.log(`   1. Resetting approve...`);
    let tx = await asset.approve(tokenInfo.tokenA, 0);
    await tx.wait();
    
    // Step 2: Approve test amount
    console.log(`   2. Approving ${ethers.formatEther(testAmount)} stKLAY...`);
    tx = await asset.approve(tokenInfo.tokenA, testAmount);
    await tx.wait();
    
    // Verify allowance
    const allowance = await asset.allowance(signer.address, tokenInfo.tokenA);
    console.log(`   3. Verified allowance: ${ethers.formatEther(allowance)}`);
    
    if (allowance < testAmount) {
      console.log(`   ❌ Approve failed - insufficient allowance`);
      return;
    }
    
    // Step 3: Call wrap function
    console.log(`   4. Calling wrap function...`);
    try {
      const wrapTx = await wrapContract.wrap(testAmount);
      const receipt = await wrapTx.wait();
      
      console.log(`   ✅ Wrap transaction successful!`);
      console.log(`     Gas used: ${receipt.gasUsed.toLocaleString()}`);
      console.log(`     Tx hash: ${receipt.transactionHash}`);
      
      // Step 4: Check final balances (CORRECT ADDRESS!)
      const finalAssetBalance = await asset.balanceOf(signer.address);
      const finalWrappedBalance = await wrapped.balanceOf(signer.address);
      
      console.log(`\n📊 Final User Balances:`);
      console.log(`   User stKLAY: ${ethers.formatEther(finalAssetBalance)}`);
      console.log(`   User wstKLAY: ${ethers.formatEther(finalWrappedBalance)}`);
      
      // Calculate differences
      const assetUsed = initialAssetBalance - finalAssetBalance;
      const wrappedReceived = finalWrappedBalance - initialWrappedBalance;
      
      console.log(`\n📈 Changes:`);
      console.log(`   stKLAY used: ${ethers.formatEther(assetUsed)}`);
      console.log(`   wstKLAY received: ${ethers.formatEther(wrappedReceived)}`);
      
      if (assetUsed > 0 && wrappedReceived > 0) {
        const exchangeRate = wrappedReceived * 1000n / assetUsed;
        console.log(`   Exchange rate: 1 stKLAY = ${ethers.formatUnits(exchangeRate, 3)} wstKLAY`);
        
        if (assetUsed === testAmount && wrappedReceived === testAmount) {
          console.log(`   🎉 PERFECT: 1:1 exchange rate as expected!`);
        } else if (assetUsed === testAmount) {
          console.log(`   ✅ SUCCESS: Wrap function working correctly!`);
        } else {
          console.log(`   ⚠️ Unexpected amounts - investigate further`);
        }
      } else {
        console.log(`   ❌ No token movement detected`);
        console.log(`   This means wrap transaction succeeded but didn't transfer tokens`);
      }
      
    } catch (wrapError) {
      console.log(`   ❌ Wrap call failed: ${wrapError.message}`);
      
      // Analyze the error
      if (wrapError.message.includes("arithmetic")) {
        console.log(`   💡 Arithmetic error - likely minimum amount or calculation issue`);
      } else if (wrapError.message.includes("allowance")) {
        console.log(`   💡 Allowance error - approve didn't work correctly`);
      } else {
        console.log(`   💡 Unknown error - may need different function or parameters`);
      }
    }
    
  } catch (error) {
    console.error("❌ Test error:", error.message);
  }
}

fixedWrapTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });