const { ethers } = require("hardhat");
const fs = require("fs");

async function checkTokenInfo() {
  console.log("🔍 Checking token info and pool configuration");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    console.log("📊 Token Info for all protocols:");
    
    for (let i = 0; i < 4; i++) {
      const protocolNames = ["KoKAIA", "GCKAIA", "stKLAY", "stKAIA"];
      console.log(`\n${protocolNames[i]} (Index ${i}):`);
      
      try {
        const tokenInfo = await vault.tokensInfo(i);
        console.log(`   asset: ${tokenInfo.asset}`);
        console.log(`   tokenA: ${tokenInfo.tokenA}`);
        console.log(`   tokenB: ${tokenInfo.tokenB}`);
        console.log(`   tokenC: ${tokenInfo.tokenC}`);
        console.log(`   handler: ${tokenInfo.handler}`);
        console.log(`   pool1: ${tokenInfo.pool1}`);
        console.log(`   pool2: ${tokenInfo.pool2}`);
        
        // Check if pools are set
        if (tokenInfo.pool1 === ethers.ZeroHash) {
          console.log("   ❌ Pool1 not set (Zero hash)");
        }
        if (tokenInfo.pool2 === ethers.ZeroHash) {
          console.log("   ❌ Pool2 not set (Zero hash)");
        }
        
        if (i < 3) {
          // Check wrapped token balance
          const wrappedToken = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
          const wrappedBalance = await wrappedToken.balanceOf(vaultAddress);
          console.log(`   Wrapped balance: ${ethers.formatEther(wrappedBalance)}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error reading token info: ${error.message}`);
      }
    }
    
    // Check which protocol is selected for withdrawal
    console.log("\n🎯 Checking asset selection for 0.1 WKAIA:");
    try {
      // This might give us insight into which protocol is being selected
      const testAmount = ethers.parseEther("0.1");
      console.log(`   Testing selection for ${ethers.formatEther(testAmount)} WKAIA`);
      
      // We can't call selectAsset directly as it's internal, but we can check balances
      for (let i = 0; i < 4; i++) {
        const tokenInfo = await vault.tokensInfo(i);
        if (tokenInfo.asset !== ethers.ZeroAddress) {
          const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const balance = await asset.balanceOf(vaultAddress);
          console.log(`   Index ${i}: ${ethers.formatEther(balance)} tokens available`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error in asset selection test: ${error.message}`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkTokenInfo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });