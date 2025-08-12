const { ethers } = require("hardhat");
const fs = require("fs");

async function testStepByStep() {
  console.log("🔍 Testing LST → WKAIA conversion step by step");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const swapContract = await ethers.getContractAt("SwapContract", swapContractAddress);
  
  try {
    console.log("📊 Testing individual protocol swap capabilities:");
    
    for (let index = 0; index < 3; index++) { // Skip index 3 (stKAIA) as it doesn't use wrap
      const protocolNames = ["KoKAIA", "GCKAIA", "stKLAY"];
      console.log(`\n🧪 Testing ${protocolNames[index]} (Index ${index}):`);
      
      const tokenInfo = await vault.tokensInfo(index);
      const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const tokenA = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
      
      // Check balances
      const assetBalance = await asset.balanceOf(vaultAddress);
      const tokenABalance = await tokenA.balanceOf(vaultAddress);
      
      console.log(`   Asset balance: ${ethers.formatEther(assetBalance)}`);
      console.log(`   TokenA balance: ${ethers.formatEther(tokenABalance)}`);
      
      if (assetBalance > 0) {
        // Test small wrap first
        const testAmount = ethers.parseEther("0.01");
        console.log(`   Testing wrap of ${ethers.formatEther(testAmount)} tokens...`);
        
        try {
          // Step 1: Manual wrap test
          console.log("   Step 1: Manual wrap...");
          
          // Reset approve
          await asset.approve(tokenInfo.tokenA, 0);
          await asset.approve(tokenInfo.tokenA, testAmount);
          
          // Wrap
          const wrapped = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
          const wrapTx = await wrapped.wrap(testAmount);
          await wrapTx.wait();
          
          const newTokenABalance = await tokenA.balanceOf(vaultAddress);
          console.log(`   ✅ Wrap successful: ${ethers.formatEther(newTokenABalance)} tokenA`);
          
          if (newTokenABalance > 0) {
            // Step 2: Manual approve to Balancer
            console.log("   Step 2: Approve to Balancer...");
            await tokenA.approve(deployments.deploymentInfo.parameters.vault, newTokenABalance);
            console.log("   ✅ Balancer approve successful");
            
            // Step 3: Test swap via SwapContract
            console.log("   Step 3: Testing swap...");
            try {
              const swapTx = await swapContract.swap(
                tokenInfo,
                deployments.deploymentInfo.parameters.vault,
                newTokenABalance,
                0 // No additional wrap needed
              );
              await swapTx.wait();
              console.log("   ✅ Swap successful!");
              
            } catch (swapError) {
              console.log(`   ❌ Swap failed: ${swapError.message}`);
              
              if (swapError.message.includes("arithmetic")) {
                console.log("   💡 Arithmetic error in Balancer swap");
              } else if (swapError.message.includes("Pool")) {
                console.log("   💡 Pool configuration issue");
              } else if (swapError.message.includes("Balance")) {
                console.log("   💡 Insufficient balance or allowance");
              }
            }
          } else {
            console.log("   ❌ Wrap produced no tokenA");
          }
          
        } catch (wrapError) {
          console.log(`   ❌ Wrap failed: ${wrapError.message}`);
        }
      } else {
        console.log("   ⏭️ No asset balance to test");
      }
    }
    
    // Test which protocol would be selected for withdraw
    console.log("\n🎯 Testing asset selection logic:");
    
    const testWithdrawAmount = ethers.parseEther("0.2");
    console.log(`   For withdraw amount: ${ethers.formatEther(testWithdrawAmount)} WKAIA`);
    
    // Simulate selectAsset logic
    let maxValue = 0n;
    let selectedIndex = 0;
    
    for (let i = 0; i < 4; i++) {
      const tokenInfo = await vault.tokensInfo(i);
      const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const balance = await asset.balanceOf(vaultAddress);
      
      // Simplified value calculation (1:1 ratio for testing)
      const value = balance;
      
      console.log(`   Index ${i}: ${ethers.formatEther(value)} value`);
      
      if (value >= testWithdrawAmount && value > maxValue) {
        maxValue = value;
        selectedIndex = i;
      }
    }
    
    console.log(`   Selected index: ${selectedIndex} with value: ${ethers.formatEther(maxValue)}`);
    
    if (maxValue >= testWithdrawAmount) {
      console.log("   ✅ Single asset can fulfill withdrawal");
    } else {
      console.log("   ❌ Multi-asset withdrawal required");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testStepByStep()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });