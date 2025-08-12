const { ethers } = require("hardhat");
const fs = require("fs");

async function simpleWithdrawTest() {
  console.log("🧪 Simple withdraw test");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  console.log(`Testing with account: ${signer.address}`);
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    // Check user shares
    const userShares = await vault.balanceOf(signer.address);
    console.log(`User shares: ${ethers.formatEther(userShares)}`);
    
    if (userShares === 0n) {
      console.log("❌ User has no shares to withdraw");
      return;
    }
    
    // Try a very small withdrawal first
    const withdrawAmount = ethers.parseEther("0.01"); // 0.01 WKAIA
    console.log(`Attempting to withdraw: ${ethers.formatEther(withdrawAmount)} WKAIA`);
    
    // Check preview
    const requiredShares = await vault.previewWithdraw(withdrawAmount);
    console.log(`Required shares: ${ethers.formatEther(requiredShares)}`);
    
    if (userShares < requiredShares) {
      console.log("❌ Insufficient shares");
      return;
    }
    
    // Execute withdraw
    console.log("🚀 Executing withdraw...");
    const tx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
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

simpleWithdrawTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });