const { ethers } = require("hardhat");
const fs = require("fs");

require("dotenv").config();

const networkName = hre.network.name;

async function main() {
  console.log("🔄 Resetting APY values to correct format on", networkName);

  // Load deployments
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;

  console.log("Using KVaultV2 at:", vaultAddress);

  // Get contract instance
  const KVaultV2 = await ethers.getContractFactory("KVaultV2");
  const vault = KVaultV2.attach(vaultAddress);

  try {
    console.log("\n📊 Current APY values (before reset):");
    const currentAPYs = await vault.getAllAPY();
    for (let i = 0; i < 4; i++) {
      console.log(`   ${i}: ${Number(currentAPYs[i])}%`);
    }

    // Reset APY values to correct defaults
    console.log("\n🔄 Setting correct APY values:");
    // const correctAPYs = [500, 475, 525, 450]; // 5.00%, 4.75%, 5.25%, 4.50%
    const correctAPYs = [710, 560, 737, 550];
    
    const tx = await vault.setMultipleAPY(correctAPYs);
    await tx.wait();
    console.log("   ✅ APY values updated");

    console.log("\n📊 New APY values (after reset):");
    const newAPYs = await vault.getAllAPY();
    for (let i = 0; i < 4; i++) {
      const protocolNames = ["KoKAIA", "GCKAIA", "stKLAY", "stKAIA"];
      console.log(`   ${i}: ${protocolNames[i]}: ${Number(newAPYs[i])}% (${(Number(newAPYs[i]) / 100).toFixed(2)}%)`);
    }

    console.log("\n✅ APY reset completed successfully!");

  } catch (error) {
    console.error("❌ Error resetting APY:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });