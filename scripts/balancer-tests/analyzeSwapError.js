const { ethers } = require("hardhat");
const fs = require("fs");

async function analyzeSwapError() {
  console.log("🔍 Analyzing swap error causes");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const swapContract = await ethers.getContractAt("SwapContract", swapContractAddress);
  
  try {
    console.log("📊 Analyzing token info and balances for swap process:");
    
    // Test with stKLAY (index 2) which was the original problem
    const index = 2;
    const tokenInfo = await vault.tokensInfo(index);
    
    console.log(`\nstKLAY (Index ${index}) Configuration:`);
    console.log(`   asset (stKLAY): ${tokenInfo.asset}`);
    console.log(`   tokenA (wstKLAY): ${tokenInfo.tokenA}`);
    console.log(`   tokenB: ${tokenInfo.tokenB}`);
    console.log(`   tokenC (WKAIA): ${tokenInfo.tokenC}`);
    console.log(`   pool1: ${tokenInfo.pool1}`);
    console.log(`   pool2: ${tokenInfo.pool2}`);
    
    // Check balances
    const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wstKLAY = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
    const tokenB = await ethers.getContractAt("IERC20", tokenInfo.tokenB);
    
    const stKLAYBalance = await stKLAY.balanceOf(vaultAddress);
    const wstKLAYBalance = await wstKLAY.balanceOf(vaultAddress);
    const tokenBBalance = await tokenB.balanceOf(vaultAddress);
    
    console.log(`\n💰 Current Balances:`);
    console.log(`   stKLAY: ${ethers.formatEther(stKLAYBalance)}`);
    console.log(`   wstKLAY: ${ethers.formatEther(wstKLAYBalance)}`);
    console.log(`   tokenB: ${ethers.formatEther(tokenBBalance)}`);
    
    // Test wrap process step by step
    console.log(`\n🧪 Testing wrap process:`);
    if (stKLAYBalance > 0) {
      const testWrapAmount = ethers.parseEther("0.01");
      console.log(`   Trying to wrap ${ethers.formatEther(testWrapAmount)} stKLAY`);
      
      try {
        // Get unwrapped amount needed
        const wrapped = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
        const requiredStKLAY = await wrapped.getUnwrappedAmount(testWrapAmount);
        console.log(`   Required stKLAY: ${ethers.formatEther(requiredStKLAY)}`);
        
        if (stKLAYBalance >= requiredStKLAY) {
          // Test the actual swap function call parameters
          console.log(`\n🔧 Testing swap function parameters:`);
          console.log(`   TokenInfo: ${JSON.stringify({
            asset: tokenInfo.asset,
            tokenA: tokenInfo.tokenA,
            tokenB: tokenInfo.tokenB,
            tokenC: tokenInfo.tokenC,
            pool1: tokenInfo.pool1,
            pool2: tokenInfo.pool2
          }, null, 2)}`);
          console.log(`   Vault address: ${deployments.deploymentInfo.parameters.vault}`);
          console.log(`   AmountIn: ${ethers.formatEther(testWrapAmount)}`);
          console.log(`   NumWrap: ${ethers.formatEther(requiredStKLAY)}`);
          
          // Check if pools exist
          const balancerVault = await ethers.getContractAt("IBalancerVault", deployments.deploymentInfo.parameters.vault);
          
          console.log(`\n🏊 Checking Balancer pools:`);
          
          try {
            const pool1Tokens = await balancerVault.getPoolTokens(tokenInfo.pool1);
            console.log(`   Pool1 tokens: ${pool1Tokens.tokens.length} tokens`);
            console.log(`   Pool1 balances: ${pool1Tokens.balances.map(b => ethers.formatEther(b)).join(', ')}`);
          } catch (error) {
            console.log(`   ❌ Pool1 error: ${error.message}`);
          }
          
          try {
            const pool2Tokens = await balancerVault.getPoolTokens(tokenInfo.pool2);
            console.log(`   Pool2 tokens: ${pool2Tokens.tokens.length} tokens`);
            console.log(`   Pool2 balances: ${pool2Tokens.balances.map(b => ethers.formatEther(b)).join(', ')}`);
          } catch (error) {
            console.log(`   ❌ Pool2 error: ${error.message}`);
          }
          
          // Check for potential division by zero causes
          console.log(`\n⚠️ Potential Division by Zero Causes:`);
          
          // 1. Zero amount checks
          if (testWrapAmount === 0n) {
            console.log(`   ❌ AmountIn is zero`);
          }
          if (requiredStKLAY === 0n) {
            console.log(`   ❌ NumWrap (requiredStKLAY) is zero`);
          }
          
          // 2. Pool balance checks
          try {
            const pool1Tokens = await balancerVault.getPoolTokens(tokenInfo.pool1);
            const hasZeroBalance = pool1Tokens.balances.some(balance => balance === 0n);
            if (hasZeroBalance) {
              console.log(`   ❌ Pool1 has zero balance for some tokens`);
            }
          } catch (e) {}
          
          try {
            const pool2Tokens = await balancerVault.getPoolTokens(tokenInfo.pool2);
            const hasZeroBalance = pool2Tokens.balances.some(balance => balance === 0n);
            if (hasZeroBalance) {
              console.log(`   ❌ Pool2 has zero balance for some tokens`);
            }
          } catch (e) {}
          
          // 3. Token existence checks
          if (tokenInfo.tokenA === ethers.ZeroAddress) {
            console.log(`   ❌ TokenA is zero address`);
          }
          if (tokenInfo.tokenB === ethers.ZeroAddress) {
            console.log(`   ❌ TokenB is zero address`);
          }
          if (tokenInfo.tokenC === ethers.ZeroAddress) {
            console.log(`   ❌ TokenC is zero address`);
          }
          
          console.log(`\n💡 Most likely causes of Panic(17) in swap:`);
          console.log(`   1. Empty Balancer pool (zero liquidity)`);
          console.log(`   2. Pool doesn't exist or misconfigured`);
          console.log(`   3. Token pair not properly set up in pool`);
          console.log(`   4. Slippage calculation overflow`);
          console.log(`   5. Balancer internal calculation with zero denominator`);
          
        } else {
          console.log(`   ❌ Insufficient stKLAY for wrap test`);
        }
        
      } catch (error) {
        console.log(`   ❌ Wrap calculation error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Analysis error:", error.message);
  }
}

analyzeSwapError()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });