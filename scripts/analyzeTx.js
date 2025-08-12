const { ethers } = require("hardhat");

async function analyzeTx() {
  console.log("🔍 Analyzing successful wrap transaction");
  
  const txHash = "0xa5be7e9be663bf063f61122fa6f1c403b1dc363b4e089f512416e16f3148b463";
  
  try {
    // Get transaction details
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("📋 Transaction Details:");
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Value: ${ethers.formatEther(tx.value)} KAIA`);
    console.log(`   Gas Used: ${receipt.gasUsed.toLocaleString()}`);
    console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
    
    console.log("\n📊 Input Data Analysis:");
    console.log(`   Data: ${tx.data}`);
    
    // Try to decode the function call
    if (tx.data && tx.data !== "0x") {
      const functionSelector = tx.data.slice(0, 10);
      console.log(`   Function Selector: ${functionSelector}`);
      
      // Common function selectors
      const knownSelectors = {
        "0xa9059cbb": "transfer(address,uint256)",
        "0x095ea7b3": "approve(address,uint256)",
        "0xea598cb0": "deposit(uint256)",
        "0xde5f6268": "wrap(uint256)",
        "0x23b872dd": "transferFrom(address,address,uint256)",
        "0x40c10f19": "mint(address,uint256)",
        "0xa0712d68": "mint(uint256)",
        "0x42842e0e": "safeTransferFrom(address,address,uint256)",
      };
      
      if (knownSelectors[functionSelector]) {
        console.log(`   Function: ${knownSelectors[functionSelector]}`);
      } else {
        console.log(`   Function: Unknown (${functionSelector})`);
      }
      
      // Try to decode parameters
      if (tx.data.length > 10) {
        const params = tx.data.slice(10);
        console.log(`   Parameters (hex): ${params}`);
        
        // If it's a simple uint256 parameter (common for wrap)
        if (params.length === 64) {
          try {
            const amount = ethers.getBigInt("0x" + params);
            console.log(`   Amount parameter: ${ethers.formatEther(amount)} tokens`);
          } catch (e) {
            console.log(`   Could not decode as uint256`);
          }
        }
      }
    }
    
    console.log("\n📝 Event Logs:");
    if (receipt.logs && receipt.logs.length > 0) {
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\n   Log ${i + 1}:`);
        console.log(`     Address: ${log.address}`);
        console.log(`     Topics: ${log.topics}`);
        console.log(`     Data: ${log.data}`);
        
        // Try to decode common events
        try {
          // Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
          if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
            const from = ethers.getAddress("0x" + log.topics[1].slice(26));
            const to = ethers.getAddress("0x" + log.topics[2].slice(26));
            const value = ethers.getBigInt(log.data);
            console.log(`     ✅ Transfer Event: ${from} → ${to}, ${ethers.formatEther(value)} tokens`);
          }
          // Approval event
          else if (log.topics[0] === "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925") {
            const owner = ethers.getAddress("0x" + log.topics[1].slice(26));
            const spender = ethers.getAddress("0x" + log.topics[2].slice(26));
            const value = ethers.getBigInt(log.data);
            console.log(`     ✅ Approval Event: ${owner} approved ${spender}, ${ethers.formatEther(value)} tokens`);
          }
          else {
            console.log(`     Unknown event type`);
          }
        } catch (decodeError) {
          console.log(`     Could not decode event`);
        }
      }
    } else {
      console.log("   No logs found");
    }
    
    console.log("\n💡 Analysis Summary:");
    console.log("Compare this successful transaction with our failed attempts:");
    console.log("1. Function called and parameters");
    console.log("2. Target contract address");
    console.log("3. Token transfer events");
    console.log("4. Approval events");
    
  } catch (error) {
    console.error("❌ Error analyzing transaction:", error.message);
  }
}

analyzeTx()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });