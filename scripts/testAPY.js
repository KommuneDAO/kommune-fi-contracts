const { ethers } = require("hardhat");
const fs = require("fs");

require("dotenv").config();

const networkName = hre.network.name;

async function main() {
  console.log("🧪 Testing APY functions on", networkName);

  // Load deployments
  const deploymentFile = `deployments-${networkName}.json`;
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  if (!vaultAddress) {
    throw new Error("KVaultV2 address not found in deployments");
  }

  console.log("Using KVaultV2 at:", vaultAddress);

  // Get contract instance
  const KVaultV2 = await ethers.getContractFactory("KVaultV2");
  const vault = KVaultV2.attach(vaultAddress);

  try {
    // Test getAllAPY function
    console.log("\n📊 Current APY values:");
    const allAPY = await vault.getAllAPY();
    for (let i = 0; i < 4; i++) {
      const protocolNames = ["KoKAIA", "GCKAIA", "stKLAY", "stKAIA"];
      const apyValue = Number(allAPY[i]);
      console.log(`   ${i}: ${protocolNames[i]}: ${apyValue}% (${(apyValue / 100).toFixed(2)}%)`);
    }

    // Test individual getAPY function
    console.log("\n🔍 Individual APY queries:");
    for (let i = 0; i < 4; i++) {
      const apy = await vault.getAPY(i);
      const apyBP = await vault.getAPYInBasisPoints(i);
      console.log(`   Index ${i}: ${Number(apy)}% (${Number(apyBP)} basis points)`);
    }

    // Test operator status
    const [signer] = await ethers.getSigners();
    const isOperator = await vault.operators(signer.address);
    console.log(`\n🔑 Signer ${signer.address} is operator: ${isOperator}`);

    if (isOperator) {
      console.log("\n⚙️  Testing APY updates (as operator):");
      
      // Test setting individual APY
      console.log("   Setting APY for index 0 to 5.75%...");
      const tx1 = await vault.setAPY(0, 575); // 5.75%
      await tx1.wait();
      
      const newAPY = await vault.getAPY(0);
      console.log(`   ✅ New APY for index 0: ${Number(newAPY)}%`);

      // Test batch APY update
      console.log("   Setting batch APY values...");
      const newAPYs = [625, 550, 475, 500]; // 6.25%, 5.50%, 4.75%, 5.00%
      const tx2 = await vault.setMultipleAPY(newAPYs);
      await tx2.wait();
      
      const updatedAPYs = await vault.getAllAPY();
      console.log("   ✅ Updated APY values:");
      for (let i = 0; i < 4; i++) {
        console.log(`      ${i}: ${Number(updatedAPYs[i])}%`);
      }
    } else {
      console.log("   ⚠️  Skipping APY updates - not an operator");
    }

  } catch (error) {
    console.error("❌ Error testing APY functions:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });