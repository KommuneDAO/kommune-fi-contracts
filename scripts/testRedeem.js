const { ethers } = require("hardhat");
const fs = require("fs");

async function testRedeem() {
  console.log("🧪 Testing redeem instead of withdraw");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    const userShares = await vault.balanceOf(signer.address);
    console.log(`User shares: ${ethers.formatEther(userShares)}`);
    
    // Try to redeem a small amount of shares
    const redeemShares = ethers.parseEther("0.01"); // 0.01 shares
    console.log(`Attempting to redeem: ${ethers.formatEther(redeemShares)} shares`);
    
    if (userShares < redeemShares) {
      console.log("❌ Insufficient shares");
      return;
    }
    
    // Check preview first
    const expectedAssets = await vault.previewRedeem(redeemShares);
    console.log(`Expected assets: ${ethers.formatEther(expectedAssets)} WKAIA`);
    
    // Execute redeem
    console.log("🚀 Executing redeem...");
    const tx = await vault.redeem(redeemShares, signer.address, signer.address);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Success! Gas used: ${receipt.gasUsed.toLocaleString()}`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.data) {
      try {
        const decodedError = vault.interface.parseError(error.data);
        console.error("Decoded error:", decodedError.name, decodedError.args);
      } catch (e) {
        console.error("Raw error data:", error.data);
      }
    }
  }
}

testRedeem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });