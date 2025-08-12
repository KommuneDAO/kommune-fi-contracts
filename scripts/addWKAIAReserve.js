const { ethers } = require("hardhat");
const fs = require("fs");

async function addWKAIAReserve() {
  console.log("💰 Adding WKAIA reserve to vault for smoother withdrawals");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const wkaia = await ethers.getContractAt("IERC20", deployments.deploymentInfo.parameters.asset);
  
  try {
    // Add more WKAIA to vault for emergency withdrawals
    const reserveAmount = ethers.parseEther("0.5"); // 0.5 WKAIA reserve
    
    console.log(`Adding ${ethers.formatEther(reserveAmount)} WKAIA reserve to vault`);
    
    // Transfer WKAIA to vault
    const tx = await wkaia.transfer(vaultAddress, reserveAmount);
    await tx.wait();
    
    console.log("✅ WKAIA reserve added successfully");
    
    // Check new balance
    const vaultBalance = await wkaia.balanceOf(vaultAddress);
    console.log(`New vault WKAIA balance: ${ethers.formatEther(vaultBalance)} WKAIA`);
    
  } catch (error) {
    console.error("❌ Error adding reserve:", error.message);
  }
}

addWKAIAReserve()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });