const { ethers } = require("hardhat");
const fs = require("fs");

async function compareUISwap() {
  console.log("🔍 Analyzing difference between UI swap and contract swap");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    console.log("📊 Comparing swap parameters and approach:");
    
    // Get stKLAY configuration
    const tokenInfo = await vault.tokensInfo(2);
    console.log("\nstKLAY Token Configuration:");
    console.log(`   asset (stKLAY): ${tokenInfo.asset}`);
    console.log(`   tokenA (wstKLAY): ${tokenInfo.tokenA}`);
    console.log(`   tokenB: ${tokenInfo.tokenB}`);
    console.log(`   tokenC (WKAIA): ${tokenInfo.tokenC}`);
    console.log(`   pool1: ${tokenInfo.pool1}`);
    console.log(`   pool2: ${tokenInfo.pool2}`);
    
    // Simulate what UI does vs what contract does
    console.log("\n🔄 UI Swap vs Contract Swap Comparison:");
    
    console.log("\n1️⃣ UI Swap Approach (Working):");
    console.log("   - Direct user interaction with Balancer");
    console.log("   - User approves tokens directly to Balancer Vault");
    console.log("   - Single transaction with proper slippage");
    console.log("   - Uses current market rates");
    console.log("   - Proper gas estimation");
    
    console.log("\n2️⃣ Contract Swap Approach (Failing):");
    console.log("   - Contract wraps stKLAY → wstKLAY first");
    console.log("   - Then calls Balancer swap via SwapContract");
    console.log("   - Two-step batch swap (wstKLAY → tokenB → WKAIA)");
    console.log("   - Fixed slippage limits");
    console.log("   - Potential timing/state issues");
    
    // Analyze specific differences
    console.log("\n🔍 Potential Issues in Contract Approach:");
    
    console.log("\n❌ Issue 1: Batch Swap Configuration");
    console.log("   Contract uses:");
    console.log("   - Step 1: wstKLAY → tokenB (amount = amountIn)");
    console.log("   - Step 2: tokenB → WKAIA (amount = 0, uses output from step 1)");
    console.log("   - This might cause calculation issues in Balancer");
    
    console.log("\n❌ Issue 2: Asset Array Order");
    console.log("   Contract creates assets array as:");
    console.log("   - assets[0] = tokenA (wstKLAY)");
    console.log("   - assets[1] = tokenB");
    console.log("   - assets[2] = tokenC (WKAIA)");
    console.log("   - Order must match Balancer pool token order exactly");
    
    console.log("\n❌ Issue 3: Limits Array");
    console.log("   Contract sets:");
    console.log("   - limits[0] = int256(amountIn) (positive = max input)");
    console.log("   - limits[1] = 0");
    console.log("   - limits[2] = -1_000_000_000 (negative = min output)");
    console.log("   - These limits might be too restrictive or incorrect");
    
    console.log("\n❌ Issue 4: Fund Management");
    console.log("   Contract uses:");
    console.log("   - sender: msg.sender (SwapContract)");
    console.log("   - recipient: msg.sender (SwapContract)");
    console.log("   - But tokens are in vault, not SwapContract");
    
    console.log("\n✅ Potential Fixes:");
    
    console.log("\n1️⃣ Fix Fund Management:");
    console.log("   - sender should be vault address (where tokens are)");
    console.log("   - recipient should be vault address (where we want WKAIA)");
    
    console.log("\n2️⃣ Fix Limits:");
    console.log("   - Use more reasonable slippage (5-10% instead of fixed values)");
    console.log("   - Calculate min output based on current exchange rates");
    
    console.log("\n3️⃣ Single-step Swap:");
    console.log("   - Instead of two-step batch, try direct wstKLAY → WKAIA");
    console.log("   - Check if there's a direct pool");
    
    console.log("\n4️⃣ Pre-validation:");
    console.log("   - Check token balances before swap");
    console.log("   - Validate pool has sufficient liquidity");
    console.log("   - Use estimateSwap to check feasibility");
    
    // Check current token balances for debugging
    console.log("\n💰 Current Token Balances in Vault:");
    
    const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wstKLAY = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
    const tokenB = await ethers.getContractAt("IERC20", tokenInfo.tokenB);
    const wkaia = await ethers.getContractAt("IERC20", tokenInfo.tokenC);
    
    console.log(`   stKLAY: ${ethers.formatEther(await stKLAY.balanceOf(vaultAddress))}`);
    console.log(`   wstKLAY: ${ethers.formatEther(await wstKLAY.balanceOf(vaultAddress))}`);
    console.log(`   tokenB: ${ethers.formatEther(await tokenB.balanceOf(vaultAddress))}`);
    console.log(`   WKAIA: ${ethers.formatEther(await wkaia.balanceOf(vaultAddress))}`);
    
    console.log("\n🎯 Next Steps:");
    console.log("1. Fix SwapContract fund management (sender/recipient)");
    console.log("2. Implement proper slippage calculation");
    console.log("3. Add pre-swap validation");
    console.log("4. Test with smaller amounts first");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

compareUISwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });