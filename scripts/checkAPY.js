const { ethers } = require("hardhat");
const fs = require("fs");

async function checkAPY() {
  console.log("🔍 Checking APY values");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    console.log("📊 Current APY values:");
    for (let i = 0; i < 4; i++) {
      const apy = await vault.getAPY(i);
      const apyInBP = await vault.getAPYInBasisPoints(i);
      console.log(`   Index ${i}: getAPY()=${apy} (${Number(apy)/100}%), getAPYInBasisPoints()=${apyInBP}`);
    }
    
    console.log("\n📊 Internal lstAPY values:");
    for (let i = 0; i < 4; i++) {
      try {
        const lstAPY = await vault.lstAPY(i);
        console.log(`   lstAPY[${i}] = ${lstAPY} (divided by 10 = ${Number(lstAPY) / 10})`);
      } catch (error) {
        console.log(`   lstAPY[${i}] = Error: ${error.message}`);
      }
    }
    
    // Test calcWeight logic manually
    console.log("\n🧮 Manual weight calculation:");
    let totalWeight = 0;
    const weights = [];
    for (let i = 0; i < 4; i++) {
      try {
        const lstAPY = await vault.lstAPY(i);
        const weight = Number(lstAPY) / 10;
        weights.push(weight);
        totalWeight += weight;
        console.log(`   weights[${i}] = ${weight}`);
      } catch (error) {
        console.log(`   weights[${i}] = Error: ${error.message}`);
        weights.push(0);
      }
    }
    console.log(`   Total weight: ${totalWeight}`);
    
    if (totalWeight === 0) {
      console.log("❌ PROBLEM: Total weight is 0! This will cause division by zero.");
    } else {
      console.log("✅ Total weight is non-zero, should be fine.");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkAPY()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });