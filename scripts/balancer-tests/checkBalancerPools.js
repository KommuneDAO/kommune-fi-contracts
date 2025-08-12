const { ethers } = require("hardhat");
const fs = require("fs");

async function checkBalancerPools() {
  console.log("🔍 Checking Balancer pools directly");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    // Get Balancer Vault address
    const balancerVaultAddr = deployments.deploymentInfo.parameters.vault;
    console.log(`Balancer Vault address: ${balancerVaultAddr}`);
    
    // Check if Balancer Vault contract exists
    const code = await ethers.provider.getCode(balancerVaultAddr);
    if (code === "0x") {
      console.log("❌ Balancer Vault contract does not exist!");
      return;
    } else {
      console.log("✅ Balancer Vault contract exists");
    }
    
    // Get token info for all protocols
    console.log("\n📊 Pool configurations:");
    
    for (let i = 0; i < 4; i++) {
      const protocolNames = ["KoKAIA", "GCKAIA", "stKLAY", "stKAIA"];
      const tokenInfo = await vault.tokensInfo(i);
      
      console.log(`\n${protocolNames[i]} (Index ${i}):`);
      console.log(`   Pool1: ${tokenInfo.pool1}`);
      console.log(`   Pool2: ${tokenInfo.pool2}`);
      
      // Check if pools are zero
      if (tokenInfo.pool1 === ethers.ZeroHash) {
        console.log("   ❌ Pool1 is zero hash");
      }
      if (tokenInfo.pool2 === ethers.ZeroHash) {
        console.log("   ❌ Pool2 is zero hash");
      }
      
      // Try to interact with Balancer Vault using low-level calls
      try {
        const balancerVault = new ethers.Contract(
          balancerVaultAddr,
          [
            "function getPoolTokens(bytes32 poolId) external view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)"
          ],
          ethers.provider
        );
        
        if (tokenInfo.pool1 !== ethers.ZeroHash) {
          try {
            const pool1Data = await balancerVault.getPoolTokens(tokenInfo.pool1);
            console.log(`   Pool1 tokens: ${pool1Data.tokens.length}`);
            console.log(`   Pool1 balances: ${pool1Data.balances.map(b => ethers.formatEther(b)).join(', ')}`);
            
            // Check for zero balances
            const hasZeroBalance = pool1Data.balances.some(balance => balance === 0n);
            if (hasZeroBalance) {
              console.log("   ❌ Pool1 has zero balance - this will cause division by zero!");
            }
          } catch (error) {
            console.log(`   ❌ Pool1 query failed: ${error.message}`);
          }
        }
        
        if (tokenInfo.pool2 !== ethers.ZeroHash) {
          try {
            const pool2Data = await balancerVault.getPoolTokens(tokenInfo.pool2);
            console.log(`   Pool2 tokens: ${pool2Data.tokens.length}`);
            console.log(`   Pool2 balances: ${pool2Data.balances.map(b => ethers.formatEther(b)).join(', ')}`);
            
            // Check for zero balances
            const hasZeroBalance = pool2Data.balances.some(balance => balance === 0n);
            if (hasZeroBalance) {
              console.log("   ❌ Pool2 has zero balance - this will cause division by zero!");
            }
          } catch (error) {
            console.log(`   ❌ Pool2 query failed: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Balancer interaction failed: ${error.message}`);
      }
    }
    
    // Check if pools are shared between protocols
    console.log("\n🔄 Pool sharing analysis:");
    const allPools = [];
    for (let i = 0; i < 4; i++) {
      const tokenInfo = await vault.tokensInfo(i);
      allPools.push({index: i, pool1: tokenInfo.pool1, pool2: tokenInfo.pool2});
    }
    
    // Find shared pools
    const pool1s = allPools.map(p => p.pool1);
    const pool2s = allPools.map(p => p.pool2);
    
    console.log("Pool1 sharing:");
    pool1s.forEach((pool, i) => {
      const others = pool1s.filter((p, j) => j !== i && p === pool);
      if (others.length > 0) {
        console.log(`   Index ${i} shares Pool1 with others`);
      }
    });
    
    console.log("Pool2 sharing:");
    pool2s.forEach((pool, i) => {
      const others = pool2s.filter((p, j) => j !== i && p === pool);
      if (others.length > 0) {
        console.log(`   Index ${i} shares Pool2 with others`);
      }
    });
    
    console.log("\n💡 Swap Error Root Causes Summary:");
    console.log("1. 🏊 Empty liquidity pools (most likely)");
    console.log("2. 🔗 Incorrect pool IDs");
    console.log("3. 💱 Token pair mismatches in pools");
    console.log("4. ⚖️ Insufficient pool balances for swap amounts");
    console.log("5. 🧮 Balancer internal math with zero denominators");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkBalancerPools()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });