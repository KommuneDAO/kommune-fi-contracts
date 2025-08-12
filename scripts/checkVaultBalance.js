const { ethers } = require("hardhat");
const fs = require("fs");

async function checkVaultBalance() {
  console.log("🔍 Checking vault balances");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const wkaia = await ethers.getContractAt("IERC20", deployments.deploymentInfo.parameters.asset);
  
  try {
    console.log("📊 Vault Balances:");
    
    // WKAIA balance
    const wkaiaBalance = await wkaia.balanceOf(vaultAddress);
    console.log(`   WKAIA: ${ethers.formatEther(wkaiaBalance)} WKAIA`);
    
    // Native KAIA balance
    const kaiaBalance = await ethers.provider.getBalance(vaultAddress);
    console.log(`   KAIA: ${ethers.formatEther(kaiaBalance)} KAIA`);
    
    // Total assets (should call totalAssets())
    const totalAssets = await vault.totalAssets();
    console.log(`   Total Assets: ${ethers.formatEther(totalAssets)} WKAIA`);
    
    // Total shares
    const totalShares = await vault.totalSupply();
    console.log(`   Total Shares: ${ethers.formatEther(totalShares)} shares`);
    
    // Calculate ratio
    if (totalShares > 0) {
      const assetsPerShare = totalAssets * 1000000n / totalShares; // multiply by 1M for precision
      console.log(`   Assets per share: ${ethers.formatUnits(assetsPerShare, 6)} WKAIA`);
    } else {
      console.log("   ❌ Total shares is 0 - this could cause division by zero!");
    }
    
    console.log("\n📊 LST Balances:");
    for (let i = 0; i < 4; i++) {
      const protocolNames = ["KoKAIA", "GCKAIA", "stKLAY", "stKAIA"];
      try {
        const tokenInfo = await vault.tokensInfo(i);
        if (tokenInfo.asset !== ethers.ZeroAddress) {
          const asset = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const balance = await asset.balanceOf(vaultAddress);
          console.log(`   ${protocolNames[i]}: ${ethers.formatEther(balance)} tokens`);
        }
      } catch (error) {
        console.log(`   ${protocolNames[i]}: Error - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkVaultBalance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });