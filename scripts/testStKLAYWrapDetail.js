const { ethers } = require("hardhat");
const fs = require("fs");

async function testStKLAYWrapDetail() {
  console.log("🔍 Detailed stKLAY wrap testing");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    const tokenInfo = await vault.tokensInfo(2);
    const stKLAY = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const wstKLAY = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
    
    console.log("📊 Before wrap:");
    const beforeStKLAY = await stKLAY.balanceOf(vaultAddress);
    const beforeWstKLAY = await wstKLAY.balanceOf(vaultAddress);
    console.log(`   stKLAY: ${ethers.formatEther(beforeStKLAY)}`);
    console.log(`   wstKLAY: ${ethers.formatEther(beforeWstKLAY)}`);
    
    // Test with a specific amount
    const wrapAmount = ethers.parseEther("0.1"); // Try to wrap 0.1 stKLAY
    console.log(`\n🧪 Wrapping ${ethers.formatEther(wrapAmount)} stKLAY`);
    
    if (beforeStKLAY >= wrapAmount) {
      // Reset approve first
      console.log("   Resetting approve to 0...");
      let tx = await stKLAY.approve(tokenInfo.tokenA, 0);
      await tx.wait();
      
      // Approve the amount
      console.log("   Approving wrap amount...");
      tx = await stKLAY.approve(tokenInfo.tokenA, wrapAmount);
      await tx.wait();
      
      // Check allowance
      const allowance = await stKLAY.allowance(vaultAddress, tokenInfo.tokenA);
      console.log(`   Allowance set: ${ethers.formatEther(allowance)}`);
      
      // Perform wrap
      console.log("   Performing wrap...");
      tx = await wstKLAY.wrap(wrapAmount);
      const receipt = await tx.wait();
      console.log(`   Wrap transaction gas: ${receipt.gasUsed.toLocaleString()}`);
      
      // Check balances after
      console.log("\n📊 After wrap:");
      const afterStKLAY = await stKLAY.balanceOf(vaultAddress);
      const afterWstKLAY = await wstKLAY.balanceOf(vaultAddress);
      console.log(`   stKLAY: ${ethers.formatEther(afterStKLAY)} (change: ${ethers.formatEther(afterStKLAY - beforeStKLAY)})`);
      console.log(`   wstKLAY: ${ethers.formatEther(afterWstKLAY)} (change: ${ethers.formatEther(afterWstKLAY - beforeWstKLAY)})`);
      
      // Check exchange rate
      if (afterWstKLAY > beforeWstKLAY) {
        const stKLAYUsed = beforeStKLAY - afterStKLAY;
        const wstKLAYReceived = afterWstKLAY - beforeWstKLAY;
        const exchangeRate = stKLAYUsed * 1000n / wstKLAYReceived; // multiply by 1000 for precision
        console.log(`\n📈 Exchange rate: 1 wstKLAY = ${ethers.formatUnits(exchangeRate, 3)} stKLAY`);
        
        if (afterWstKLAY > 0) {
          console.log("✅ Wrap successful - wstKLAY received!");
        }
      } else {
        console.log("❌ No wstKLAY received from wrap");
        
        // Check if there were any events
        console.log("\n🔍 Checking transaction logs for events...");
        const logs = receipt.logs;
        console.log(`   Found ${logs.length} logs in transaction`);
        
        for (let i = 0; i < logs.length; i++) {
          try {
            const parsed = stKLAY.interface.parseLog(logs[i]);
            console.log(`   Event ${i}: ${parsed.name} - ${parsed.args}`);
          } catch (e) {
            try {
              const parsed = wstKLAY.interface.parseLog(logs[i]);
              console.log(`   Event ${i}: ${parsed.name} - ${parsed.args}`);
            } catch (e2) {
              console.log(`   Event ${i}: Unknown event`);
            }
          }
        }
      }
      
    } else {
      console.log("❌ Insufficient stKLAY balance for test");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

testStKLAYWrapDetail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });