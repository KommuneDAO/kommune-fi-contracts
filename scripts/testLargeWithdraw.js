const { ethers } = require("hardhat");
const fs = require("fs");

async function testLargeWithdraw() {
  console.log("🧪 Testing larger withdraw that requires LST → WKAIA conversion");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const wkaia = await ethers.getContractAt("IERC20", deployments.deploymentInfo.parameters.asset);
  
  try {
    // Check current vault WKAIA balance
    const vaultWKAIABalance = await wkaia.balanceOf(vaultAddress);
    console.log(`Current vault WKAIA balance: ${ethers.formatEther(vaultWKAIABalance)}`);
    
    // Test withdrawal larger than WKAIA balance to force LST conversion
    const withdrawAmount = vaultWKAIABalance + ethers.parseEther("0.2"); // 0.2 WKAIA more than available
    console.log(`Testing withdraw of ${ethers.formatEther(withdrawAmount)} WKAIA (requires LST conversion)`);
    
    // Check if user has enough shares
    const userShares = await vault.balanceOf(signer.address);
    const requiredShares = await vault.previewWithdraw(withdrawAmount);
    
    console.log(`User shares: ${ethers.formatEther(userShares)}`);
    console.log(`Required shares: ${ethers.formatEther(requiredShares)}`);
    
    if (userShares < requiredShares) {
      console.log("❌ User doesn't have enough shares for this test");
      return;
    }
    
    // Execute the withdraw
    console.log("🚀 Executing large withdraw (will trigger LST → WKAIA conversion)...");
    const tx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Large withdraw successful! Gas used: ${receipt.gasUsed.toLocaleString()}`);
    
    // Check what happened
    const newVaultWKAIABalance = await wkaia.balanceOf(vaultAddress);
    console.log(`New vault WKAIA balance: ${ethers.formatEther(newVaultWKAIABalance)}`);
    
    console.log("🎉 LST → WKAIA conversion worked successfully!");
    
  } catch (error) {
    console.error("❌ Large withdraw failed:", error.message);
    
    if (error.data) {
      try {
        const decodedError = vault.interface.parseError(error.data);
        console.error("Decoded error:", decodedError.name, decodedError.args);
      } catch (e) {
        console.error("Raw error data:", error.data);
      }
    }
    
    // This tells us what specific part of LST conversion is failing
    if (error.message.includes("arithmetic")) {
      console.error("💡 Still hitting arithmetic issues in LST conversion process");
    } else if (error.message.includes("Pool")) {
      console.error("💡 Balancer pool related issue");
    } else if (error.message.includes("approve")) {
      console.error("💡 Approval related issue");
    }
  }
}

testLargeWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });