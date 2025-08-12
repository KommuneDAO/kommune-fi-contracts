const { ethers } = require("hardhat");
const fs = require("fs");

async function debugWithdraw() {
  console.log("🔍 Debugging stKLAY wrap issue in withdraw");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    // Check current balances
    console.log("\n📊 Current LST Balances:");
    const tokensInfo = await vault.getTokensInfo();
    
    for (let i = 0; i < 4; i++) {
      const assetBalance = await ethers.getContractAt("IERC20", tokensInfo[i].asset).then(
        contract => contract.balanceOf(vaultAddress)
      );
      console.log(`   Index ${i}: ${ethers.formatEther(assetBalance)} tokens`);
      
      if (i < 3) {
        const wrappedBalance = await ethers.getContractAt("IERC20", tokensInfo[i].tokenA).then(
          contract => contract.balanceOf(vaultAddress)
        );
        console.log(`   Index ${i} Wrapped: ${ethers.formatEther(wrappedBalance)} tokens`);
        
        // Check allowance
        const allowance = await ethers.getContractAt("IERC20", tokensInfo[i].asset).then(
          contract => contract.allowance(vaultAddress, tokensInfo[i].tokenA)
        );
        console.log(`   Index ${i} Allowance: ${ethers.formatEther(allowance)} tokens`);
      }
    }
    
    // Simulate withdraw plan for 0.1 WKAIA
    console.log("\n🧮 Simulating withdraw plan for 0.1 WKAIA:");
    const withdrawAmount = ethers.parseEther("0.1");
    
    // This would help us see which assets are being used
    console.log(`   Withdraw amount: ${ethers.formatEther(withdrawAmount)} WKAIA`);
    
  } catch (error) {
    console.error("❌ Debug error:", error.message);
  }
}

debugWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });