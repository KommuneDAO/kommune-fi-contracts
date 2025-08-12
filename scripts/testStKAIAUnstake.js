const { ethers } = require("hardhat");
const fs = require("fs");

async function testStKAIAUnstake() {
  console.log("🧪 Testing stKAIA unstake process (simplest path)");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    console.log("📊 Before unstake test:");
    
    // Get stKAIA info
    const tokenInfo = await vault.tokensInfo(3);
    const stKAIA = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wkaia = await ethers.getContractAt("IERC20", deployments.deploymentInfo.parameters.asset);
    
    const stKAIABalance = await stKAIA.balanceOf(vaultAddress);
    const wkaiaBalance = await wkaia.balanceOf(vaultAddress);
    const kaiaBalance = await ethers.provider.getBalance(vaultAddress);
    
    console.log(`   stKAIA balance: ${ethers.formatEther(stKAIABalance)}`);
    console.log(`   WKAIA balance: ${ethers.formatEther(wkaiaBalance)}`);
    console.log(`   KAIA balance: ${ethers.formatEther(kaiaBalance)}`);
    
    // Test small unstake directly
    if (stKAIABalance > 0) {
      const unstakeAmount = ethers.parseEther("0.01"); // Small test amount
      console.log(`\n🚀 Testing direct unstake of ${ethers.formatEther(unstakeAmount)} stKAIA equivalent`);
      
      try {
        // Get the stKAIA handler
        const stKAIAHandler = await ethers.getContractAt("IStKaia", tokenInfo.handler);
        
        // Calculate required stKAIA for native amount
        const requiredStKAIA = await ethers.getContractAt("IStKaia", tokenInfo.asset).then(
          contract => contract.getRatioStakingTokenByNativeToken(unstakeAmount)
        );
        
        console.log(`   Required stKAIA: ${ethers.formatEther(requiredStKAIA)}`);
        console.log(`   Available stKAIA: ${ethers.formatEther(stKAIABalance)}`);
        console.log(`   Sufficient: ${stKAIABalance >= requiredStKAIA}`);
        
        if (stKAIABalance >= requiredStKAIA) {
          // Test approve
          console.log("   Testing approve...");
          await stKAIA.approve(tokenInfo.handler, 0);
          await stKAIA.approve(tokenInfo.handler, requiredStKAIA);
          console.log("   ✅ Approve successful");
          
          // Test unstake
          console.log("   Testing unstake...");
          const unstakeTx = await stKAIAHandler.unstake(
            "0x1856E6fDbF8FF701Fa1aB295E1bf229ABaB56899", // BugHole
            vaultAddress, // recipient
            requiredStKAIA
          );
          await unstakeTx.wait();
          console.log("   ✅ Unstake successful");
          
          // Check results
          const newKAIABalance = await ethers.provider.getBalance(vaultAddress);
          console.log(`   New KAIA balance: ${ethers.formatEther(newKAIABalance)}`);
          console.log(`   KAIA received: ${ethers.formatEther(newKAIABalance - kaiaBalance)}`);
          
          // Test KAIA to WKAIA conversion
          if (newKAIABalance > kaiaBalance) {
            console.log("   Testing KAIA → WKAIA conversion...");
            const kaiaReceived = newKAIABalance - kaiaBalance;
            const wkaiaContract = await ethers.getContractAt("IWKaia", deployments.deploymentInfo.parameters.asset);
            const depositTx = await wkaiaContract.deposit({value: kaiaReceived});
            await depositTx.wait();
            console.log("   ✅ KAIA → WKAIA conversion successful");
            
            const finalWKAIABalance = await wkaia.balanceOf(vaultAddress);
            console.log(`   Final WKAIA balance: ${ethers.formatEther(finalWKAIABalance)}`);
            console.log(`   WKAIA gained: ${ethers.formatEther(finalWKAIABalance - wkaiaBalance)}`);
          }
          
        } else {
          console.log("   ❌ Insufficient stKAIA for test");
        }
        
      } catch (error) {
        console.log(`   ❌ Direct unstake failed: ${error.message}`);
        if (error.data) {
          console.log(`   Error data: ${error.data}`);
        }
      }
    } else {
      console.log("❌ No stKAIA balance for testing");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testStKAIAUnstake()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });