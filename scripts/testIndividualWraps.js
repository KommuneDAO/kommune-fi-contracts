const { ethers } = require("hardhat");
const fs = require("fs");

async function testIndividualWraps() {
  console.log("🧪 Testing individual LST wrap functions");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  const protocols = [
    { name: "KoKAIA", index: 0 },
    { name: "GCKAIA", index: 1 },
    { name: "stKLAY", index: 2 }
  ];
  
  for (const protocol of protocols) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`🔍 Testing ${protocol.name} (Index ${protocol.index})`);
    console.log(`${"=".repeat(50)}`);
    
    try {
      // Get token info
      const tokenInfo = await vault.tokensInfo(protocol.index);
      console.log(`📋 Configuration:`);
      console.log(`   Asset: ${tokenInfo.asset}`);
      console.log(`   TokenA (wrapped): ${tokenInfo.tokenA}`);
      console.log(`   Handler: ${tokenInfo.handler}`);
      
      // Get contracts
      const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const tokenA = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
      const wrapped = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
      
      // Check initial balances
      const initialAssetBalance = await asset.balanceOf(vaultAddress);
      const initialWrappedBalance = await tokenA.balanceOf(vaultAddress);
      
      console.log(`💰 Initial Balances:`);
      console.log(`   Asset: ${ethers.formatEther(initialAssetBalance)}`);
      console.log(`   Wrapped: ${ethers.formatEther(initialWrappedBalance)}`);
      
      if (initialAssetBalance === 0n) {
        console.log(`❌ No asset balance to test`);
        continue;
      }
      
      // Test different wrap amounts
      const testAmounts = [
        ethers.parseEther("0.001"),  // Very small
        ethers.parseEther("0.01"),   // Small
        ethers.parseEther("0.1")     // Medium
      ];
      
      for (const testAmount of testAmounts) {
        if (testAmount > initialAssetBalance) continue;
        
        console.log(`\n🧪 Testing wrap of ${ethers.formatEther(testAmount)} ${protocol.name}:`);
        
        try {
          // Step 1: Check current allowance
          const currentAllowance = await asset.allowance(vaultAddress, tokenInfo.tokenA);
          console.log(`   Current allowance: ${ethers.formatEther(currentAllowance)}`);
          
          // Step 2: Reset and set new allowance
          console.log(`   Setting allowance...`);
          if (currentAllowance > 0) {
            const resetTx = await asset.approve(tokenInfo.tokenA, 0);
            await resetTx.wait();
            console.log(`   ✅ Reset allowance to 0`);
          }
          
          const approveTx = await asset.approve(tokenInfo.tokenA, testAmount);
          await approveTx.wait();
          console.log(`   ✅ Approved ${ethers.formatEther(testAmount)}`);
          
          // Verify allowance
          const newAllowance = await asset.allowance(vaultAddress, tokenInfo.tokenA);
          console.log(`   Verified allowance: ${ethers.formatEther(newAllowance)}`);
          
          // Step 3: Check if we can get conversion rate
          console.log(`   Checking conversion functions...`);
          try {
            if (protocol.index === 1) {
              // GCKAIA uses different function
              const rate = await wrapped.getGCKLAYByWGCKLAY(ethers.parseEther("1"));
              console.log(`   Exchange rate (GCKAIA): 1 WGCKLAY = ${ethers.formatEther(rate)} GCKAIA`);
            } else {
              // KoKAIA and stKLAY use getUnwrappedAmount
              const rate = await wrapped.getUnwrappedAmount(ethers.parseEther("1"));
              console.log(`   Exchange rate: 1 wrapped = ${ethers.formatEther(rate)} asset`);
            }
          } catch (rateError) {
            console.log(`   ❌ Rate calculation failed: ${rateError.message}`);
          }
          
          // Step 4: Attempt wrap
          console.log(`   Attempting wrap...`);
          const wrapTx = await wrapped.wrap(testAmount);
          const receipt = await wrapTx.wait();
          console.log(`   ✅ Wrap transaction successful (Gas: ${receipt.gasUsed.toLocaleString()})`);
          
          // Step 5: Check results
          const finalAssetBalance = await asset.balanceOf(vaultAddress);
          const finalWrappedBalance = await tokenA.balanceOf(vaultAddress);
          
          const assetUsed = initialAssetBalance - finalAssetBalance;
          const wrappedReceived = finalWrappedBalance - initialWrappedBalance;
          
          console.log(`   📊 Results:`);
          console.log(`      Asset used: ${ethers.formatEther(assetUsed)}`);
          console.log(`      Wrapped received: ${ethers.formatEther(wrappedReceived)}`);
          
          if (wrappedReceived > 0) {
            const exchangeRate = assetUsed * 1000n / wrappedReceived;
            console.log(`      Exchange rate: 1 wrapped = ${ethers.formatUnits(exchangeRate, 3)} asset`);
            console.log(`   ✅ ${protocol.name} wrap SUCCESSFUL!`);
          } else {
            console.log(`   ❌ No wrapped tokens received`);
          }
          
          // Update balances for next test
          initialAssetBalance = finalAssetBalance;
          initialWrappedBalance = finalWrappedBalance;
          
        } catch (error) {
          console.log(`   ❌ Wrap failed: ${error.message}`);
          
          // Detailed error analysis
          if (error.message.includes("allowance")) {
            console.log(`   💡 Issue: Insufficient allowance or approve target wrong`);
          } else if (error.message.includes("arithmetic")) {
            console.log(`   💡 Issue: Mathematical overflow/underflow in wrap function`);
          } else if (error.message.includes("transfer")) {
            console.log(`   💡 Issue: Token transfer failed`);
          } else if (error.message.includes("balance")) {
            console.log(`   💡 Issue: Insufficient balance`);
          } else {
            console.log(`   💡 Issue: Unknown error in wrap function`);
          }
          
          // Try to get more details from the error
          if (error.data) {
            console.log(`   Error data: ${error.data}`);
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Failed to test ${protocol.name}: ${error.message}`);
    }
  }
  
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📋 WRAP TEST SUMMARY`);
  console.log(`${"=".repeat(50)}`);
  console.log(`Test completed for all LST protocols.`);
  console.log(`Check individual results above for success/failure status.`);
}

testIndividualWraps()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });