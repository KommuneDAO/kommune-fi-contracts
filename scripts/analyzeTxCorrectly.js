const { ethers } = require("hardhat");

async function analyzeTxCorrectly() {
  console.log("🔍 Re-analyzing the successful wrap transaction correctly");
  
  const txHash = "0xa5be7e9be663bf063f61122fa6f1c403b1dc363b4e089f512416e16f3148b463";
  
  try {
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("📋 Transaction Analysis:");
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toLocaleString()}`);
    
    // Analyze input data
    console.log(`\n📊 Function Call Analysis:`);
    console.log(`   Input Data: ${tx.data}`);
    
    if (tx.data && tx.data !== "0x") {
      const functionSelector = tx.data.slice(0, 10);
      console.log(`   Function Selector: ${functionSelector}`);
      
      // Check if it's wrap function
      const wrapSelector = "0xde5f6268"; // wrap(uint256)
      if (functionSelector === wrapSelector) {
        console.log(`   ✅ Function: wrap(uint256)`);
        
        // Decode parameter
        const paramHex = tx.data.slice(10);
        if (paramHex.length === 64) {
          const amount = ethers.getBigInt("0x" + paramHex);
          console.log(`   Parameter: ${amount} wei`);
          console.log(`   Amount: ${ethers.formatEther(amount)} tokens`);
        }
      } else {
        console.log(`   Function: Unknown (${functionSelector})`);
      }
    }
    
    console.log(`\n📝 Transfer Events Analysis:`);
    
    let stKLAYTransferred = 0n;
    let wstKLAYMinted = 0n;
    let transferCount = 0;
    
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      
      // Transfer event signature
      if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        transferCount++;
        const from = ethers.getAddress("0x" + log.topics[1].slice(26));
        const to = ethers.getAddress("0x" + log.topics[2].slice(26));
        const value = ethers.getBigInt(log.data);
        
        console.log(`\n   Transfer ${transferCount}:`);
        console.log(`     Contract: ${log.address}`);
        console.log(`     From: ${from}`);
        console.log(`     To: ${to}`);
        console.log(`     Amount: ${ethers.formatEther(value)} tokens`);
        
        // Identify which token based on contract address
        const stKLAYAddress = "0x524dCFf07BFF606225A4FA76AFA55D705B052004";
        const wstKLAYAddress = "0x474B49DF463E528223F244670e332fE82742e1aA";
        
        if (log.address.toLowerCase() === stKLAYAddress.toLowerCase()) {
          console.log(`     Token: stKLAY`);
          if (from === tx.from) {
            stKLAYTransferred = value;
            console.log(`     ✅ User sent ${ethers.formatEther(value)} stKLAY`);
          }
        } else if (log.address.toLowerCase() === wstKLAYAddress.toLowerCase()) {
          console.log(`     Token: wstKLAY`);
          if (to === tx.from && from === ethers.ZeroAddress) {
            wstKLAYMinted = value;
            console.log(`     ✅ User received ${ethers.formatEther(value)} wstKLAY (minted)`);
          }
        }
      }
    }
    
    console.log(`\n📊 Wrap Results Summary:`);
    console.log(`   stKLAY sent: ${ethers.formatEther(stKLAYTransferred)}`);
    console.log(`   wstKLAY received: ${ethers.formatEther(wstKLAYMinted)}`);
    
    if (stKLAYTransferred > 0 && wstKLAYMinted > 0) {
      // Calculate exchange rate
      const rate = wstKLAYMinted * 1000n / stKLAYTransferred;
      console.log(`   Exchange Rate: 1 stKLAY = ${ethers.formatUnits(rate, 3)} wstKLAY`);
      
      if (stKLAYTransferred === wstKLAYMinted) {
        console.log(`   ✅ Perfect 1:1 ratio as expected`);
      } else {
        console.log(`   ⚠️ Not 1:1 ratio - investigate further`);
      }
    }
    
    console.log(`\n🔧 Test Script Issues to Fix:`);
    console.log(`1. Check wrapped token balance on correct address (user vs vault)`);
    console.log(`2. Verify we're reading the right contract for wstKLAY balance`);
    console.log(`3. Ensure we're checking balance after transaction completion`);
    console.log(`4. Confirm the wrapped token contract address is correct`);
    
  } catch (error) {
    console.error("❌ Error analyzing transaction:", error.message);
  }
}

analyzeTxCorrectly()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });