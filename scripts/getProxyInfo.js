const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  const networkName = hre.network.name;
  console.log("\n🏗️ [ Upgradeable Contract Proxy Information ]\n");
  console.log(`📡 Network: ${networkName}\n`);
  
  // Load deployment file
  const deploymentsFile = `deployments-${networkName}.json`;
  
  if (!fs.existsSync(deploymentsFile)) {
    console.log(`❌ Error: ${deploymentsFile} not found.`);
    console.log(`   Please deploy contracts first using deployment scripts.`);
    process.exit(1);
  }
  
  const deployments = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));
  console.log(`📄 Loaded deployment info from: ${deploymentsFile}\n`);
  
  // Check KVaultV2 and SwapContract
  const contracts = ["KVaultV2", "SwapContract"];
  const results = {};
  
  for (const contractName of contracts) {
    const address = deployments[contractName];
    
    if (!address) {
      console.log(`⚠️  ${contractName} not found in deployment file`);
      continue;
    }
    
    console.log(`🔍 ${contractName}`);
    console.log(`   📍 Proxy: ${address}`);
    
    try {
      const admin = await upgrades.erc1967.getAdminAddress(address);
      const implementation = await upgrades.erc1967.getImplementationAddress(address);
      
      console.log(`   👤 Admin: ${admin}`);
      console.log(`   🔧 Implementation: ${implementation}`);
      
      // Try to get owner of the admin contract
      let adminOwner = null;
      try {
        // ProxyAdmin typically uses Ownable, so owner is at slot 0
        const ownerSlot = "0x0"; // Standard Ownable owner storage slot
        const ownerData = await ethers.provider.getStorage(admin, ownerSlot);
        
        if (ownerData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          adminOwner = "0x" + ownerData.slice(-40);
          console.log(`   👑 Admin Owner: ${adminOwner}`);
        } else {
          // Try using a simple ABI to call owner()
          const simpleABI = ["function owner() view returns (address)"];
          const adminContract = new ethers.Contract(admin, simpleABI, ethers.provider);
          try {
            adminOwner = await adminContract.owner();
            console.log(`   👑 Admin Owner: ${adminOwner}`);
          } catch (e) {
            // Owner not found
            console.log(`   ℹ️  Admin owner: Unable to determine (may not be Ownable)`);
          }
        }
      } catch (e) {
        console.log(`   ℹ️  Admin owner check failed: ${e.message.split('\n')[0]}`);
      }
      
      console.log();
      
      results[contractName] = { proxy: address, admin, implementation, adminOwner };
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }
  
  // Summary
  console.log("=" .repeat(60));
  console.log("📊 Summary:");
  
  const admins = [...new Set(Object.values(results).map(r => r.admin).filter(a => a))];
  if (admins.length > 0) {
    console.log(`\n📋 Unique Proxy Admins: ${admins.length}`);
    admins.forEach((admin, i) => {
      const contracts = Object.entries(results)
        .filter(([_, r]) => r.admin === admin);
      const contractNames = contracts.map(([name, _]) => name);
      const adminOwner = contracts[0][1].adminOwner;
      
      console.log(`   ${i + 1}. ${admin}`);
      console.log(`      ├─ Manages: ${contractNames.join(", ")}`);
      if (adminOwner) {
        console.log(`      └─ Owned by: ${adminOwner}`);
      }
    });
  }
  
  // Check if all admin owners are the same
  const owners = [...new Set(Object.values(results).map(r => r.adminOwner).filter(o => o))];
  if (owners.length === 1) {
    console.log(`\n🔑 All proxy admins are controlled by: ${owners[0]}`);
  } else if (owners.length > 1) {
    console.log(`\n⚠️  Different owners control the proxy admins:`);
    owners.forEach(owner => {
      const contracts = Object.entries(results)
        .filter(([_, r]) => r.adminOwner === owner)
        .map(([name, _]) => name);
      console.log(`   • ${owner}: controls ${contracts.join(", ")}`);
    });
  }
  
  console.log("\n✅ Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });