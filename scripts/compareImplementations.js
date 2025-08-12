const { ethers } = require("hardhat");
const fs = require("fs");

async function compareImplementations() {
  console.log("🔍 Comparing working test contract vs failing vault implementation");
  
  console.log("\n📋 Working Test Contract Implementation:");
  console.log("   ✅ IERC20(stKLAY).approve(wstKLAY, 0)");
  console.log("   ✅ IERC20(stKLAY).approve(wstKLAY, amount)");
  console.log("   ✅ IWrapped(wstKLAY).wrap(amount)");
  console.log("   Result: SUCCESS - 1:1 exchange rate");
  
  console.log("\n📋 KVaultV2 Implementation (lines 522-526):");
  console.log("   ✅ IERC20(tokensInfo[index].asset).approve(tokensInfo[index].tokenA, 0)");
  console.log("   ✅ IERC20(tokensInfo[index].asset).approve(tokensInfo[index].tokenA, wrap)");
  console.log("   ❌ IWrapped(tokensInfo[index].tokenA).wrap(wrap)");
  console.log("   Result: FAIL - transaction succeeds but no tokens transferred");
  
  console.log("\n📋 SwapContract Implementation (lines 24-28):");
  console.log("   ✅ IERC20(token.asset).approve(token.tokenA, 0)");
  console.log("   ✅ IERC20(token.asset).approve(token.tokenA, numWrap)");
  console.log("   ❌ IWrapped(token.tokenA).wrap(numWrap)");
  console.log("   Result: FAIL - same as vault");
  
  // Let's check the exact addresses and parameters being used
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("\n🔍 Checking Token Configuration:");
  const tokenInfo = await vault.tokensInfo(2); // stKLAY index
  
  console.log(`   tokensInfo[2].asset: ${tokenInfo.asset}`);
  console.log(`   tokensInfo[2].tokenA: ${tokenInfo.tokenA}`);
  console.log(`   Expected stKLAY: 0x524dCFf07BFF606225A4FA76AFA55D705B052004`);
  console.log(`   Expected wstKLAY: 0x474B49DF463E528223F244670e332fE82742e1aA`);
  
  const addressesMatch = 
    tokenInfo.asset.toLowerCase() === "0x524dCFf07BFF606225A4FA76AFA55D705B052004".toLowerCase() &&
    tokenInfo.tokenA.toLowerCase() === "0x474B49DF463E528223F244670e332fE82742e1aA".toLowerCase();
  
  console.log(`   ✅ Addresses match: ${addressesMatch}`);
  
  if (!addressesMatch) {
    console.log(`   ⚠️ Address mismatch could be causing issues!`);
  }
  
  // Check if there are any execution context differences
  console.log("\n🔍 Execution Context Analysis:");
  
  // Check vault balances to see current state
  const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wstKLAY = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  const vaultStKLAYBalance = await stKLAY.balanceOf(vaultAddress);
  const vaultWstKLAYBalance = await wstKLAY.balanceOf(vaultAddress);
  
  console.log(`   Vault stKLAY balance: ${ethers.formatEther(vaultStKLAYBalance)}`);
  console.log(`   Vault wstKLAY balance: ${ethers.formatEther(vaultWstKLAYBalance)}`);
  
  // Test if vault can approve (basic sanity check)
  try {
    const currentAllowance = await stKLAY.allowance(vaultAddress, tokenInfo.tokenA);
    console.log(`   Current vault allowance: ${ethers.formatEther(currentAllowance)}`);
    console.log(`   ✅ Vault allowance readable`);
  } catch (error) {
    console.log(`   ❌ Cannot read vault allowance: ${error.message}`);
  }
  
  console.log("\n💡 Key Differences to Investigate:");
  console.log("   1. Gas Context:");
  console.log(`      - Test Contract: Simple execution`);
  console.log(`      - KVaultV2: Complex function with multiple operations`);
  console.log(`      - SwapContract: Called from vault → swapContract → wrap`);
  
  console.log("   2. Execution Path:");
  console.log(`      - Test Contract: Direct call`);
  console.log(`      - KVaultV2: _performSmartSwap() internal function`);
  console.log(`      - SwapContract: swap() external function called by vault`);
  
  console.log("   3. State Variables:");
  console.log(`      - Test Contract: Clean state`);
  console.log(`      - KVaultV2: Complex state with balances, ratios, etc.`);
  console.log(`      - SwapContract: Separate contract state`);
  
  console.log("   4. Function Context:");
  console.log(`      - Test Contract: Dedicated function`);
  console.log(`      - KVaultV2: Part of rebalancing logic`);
  console.log(`      - SwapContract: Part of multi-step swap process`);
  
  console.log("\n🔧 Next Steps:");
  console.log("   1. Check gas usage and limits in _performSmartSwap");
  console.log("   2. Verify the 'wrap' variable calculation in KVaultV2:516-519");
  console.log("   3. Check if there are any state changes affecting the wrap call");
  console.log("   4. Test with exact same amount calculations as vault");
  console.log("   5. Check for any reentrancy or state issues");
}

compareImplementations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });