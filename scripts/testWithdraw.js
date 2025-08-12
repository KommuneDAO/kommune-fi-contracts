const { ethers } = require("hardhat");
const fs = require("fs");

async function testWithdraw() {
  console.log("🧪 Testing 0.1 WKAIA withdraw after vault upgrade");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  console.log(`Using KVaultV2 at: ${vaultAddress} on ${networkName}`);
  
  const [signer] = await ethers.getSigners();
  console.log(`Testing with account: ${signer.address}`);
  
  // Get contract instances
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const wkaia = await ethers.getContractAt("IERC20", deployments.deploymentInfo.parameters.asset);
  
  try {
    // Check current balances
    console.log("\n📊 Pre-test Status:");
    const userWKAIABalance = await wkaia.balanceOf(signer.address);
    const userVaultShares = await vault.balanceOf(signer.address);
    const totalAssets = await vault.totalAssets();
    const totalShares = await vault.totalSupply();
    
    console.log(`   User WKAIA balance: ${ethers.formatEther(userWKAIABalance)} WKAIA`);
    console.log(`   User vault shares: ${ethers.formatEther(userVaultShares)} shares`);
    console.log(`   Total vault assets: ${ethers.formatEther(totalAssets)} WKAIA`);
    console.log(`   Total vault shares: ${ethers.formatEther(totalShares)} shares`);
    
    // Check if user has sufficient shares to withdraw 0.1 WKAIA
    const withdrawAmount = ethers.parseEther("0.1");
    const requiredShares = await vault.previewWithdraw(withdrawAmount);
    
    console.log(`\n🔍 Withdraw Analysis:`);
    console.log(`   Withdraw amount: ${ethers.formatEther(withdrawAmount)} WKAIA`);
    console.log(`   Required shares: ${ethers.formatEther(requiredShares)} shares`);
    console.log(`   User has sufficient shares: ${userVaultShares >= requiredShares}`);
    
    if (userVaultShares < requiredShares) {
      console.log("❌ User doesn't have sufficient shares for withdrawal");
      return;
    }
    
    // Check current LST balances in vault
    console.log("\n📊 Current Vault LST Balances:");
    
    for (let i = 0; i < 4; i++) {
      const protocolNames = ["KoKAIA", "GCKAIA", "stKLAY", "stKAIA"];
      try {
        const tokenInfo = await vault.tokensInfo(i);
        if (tokenInfo.asset !== ethers.ZeroAddress) {
          const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const balance = await asset.balanceOf(vaultAddress);
          
          console.log(`   ${protocolNames[i]} (${i}): ${ethers.formatEther(balance)} tokens`);
          
          if (i < 3 && tokenInfo.tokenA !== ethers.ZeroAddress) {
            const wrappedAsset = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
            const wrappedBalance = await wrappedAsset.balanceOf(vaultAddress);
            console.log(`     └─ Wrapped: ${ethers.formatEther(wrappedBalance)} tokens`);
          }
        } else {
          console.log(`   ${protocolNames[i]} (${i}): Not initialized`);
        }
      } catch (error) {
        console.log(`   ${protocolNames[i]} (${i}): Error reading balance - ${error.message}`);
      }
    }
    
    // Perform withdraw test
    console.log("\n🚀 Executing withdraw...");
    const tx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    // Wait for transaction confirmation
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log(`   ✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toLocaleString()}`);
    
    // Check post-withdraw balances
    console.log("\n📊 Post-withdraw Status:");
    const newUserWKAIABalance = await wkaia.balanceOf(signer.address);
    const newUserVaultShares = await vault.balanceOf(signer.address);
    const newTotalAssets = await vault.totalAssets();
    const newTotalShares = await vault.totalSupply();
    
    console.log(`   User WKAIA balance: ${ethers.formatEther(newUserWKAIABalance)} WKAIA (+${ethers.formatEther(newUserWKAIABalance - userWKAIABalance)})`);
    console.log(`   User vault shares: ${ethers.formatEther(newUserVaultShares)} shares (-${ethers.formatEther(userVaultShares - newUserVaultShares)})`);
    console.log(`   Total vault assets: ${ethers.formatEther(newTotalAssets)} WKAIA (-${ethers.formatEther(totalAssets - newTotalAssets)})`);
    console.log(`   Total vault shares: ${ethers.formatEther(newTotalShares)} shares (-${ethers.formatEther(totalShares - newTotalShares)})`);
    
    // Verify withdraw worked correctly
    const wkaiaReceived = newUserWKAIABalance - userWKAIABalance;
    const expectedAmount = withdrawAmount;
    const tolerance = ethers.parseEther("0.001"); // 0.1% tolerance
    
    console.log("\n✅ Withdraw Test Results:");
    console.log(`   Expected: ${ethers.formatEther(expectedAmount)} WKAIA`);
    console.log(`   Received: ${ethers.formatEther(wkaiaReceived)} WKAIA`);
    console.log(`   Difference: ${ethers.formatEther(wkaiaReceived - expectedAmount)} WKAIA`);
    
    if (wkaiaReceived >= expectedAmount - tolerance && wkaiaReceived <= expectedAmount + tolerance) {
      console.log("🎉 Withdraw test PASSED! stKLAY wrap issue has been resolved.");
    } else {
      console.log("❌ Withdraw test FAILED! Amount received is outside expected range.");
    }
    
  } catch (error) {
    console.error("❌ Withdraw test failed:", error.message);
    
    // Try to decode the error
    if (error.data) {
      try {
        const decodedError = vault.interface.parseError(error.data);
        console.error("   Decoded error:", decodedError);
      } catch (decodeError) {
        console.error("   Raw error data:", error.data);
      }
    }
    
    // Check if it's still the transferFrom issue
    if (error.message.includes("transferFrom") || error.message.includes("ERC20")) {
      console.error("💡 This appears to be an ERC20 transfer issue. The approve fix may need additional refinement.");
    }
  }
}

testWithdraw()
  .then(() => {
    console.log("\n🏁 Withdraw test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test script error:", error);
    process.exit(1);
  });