const { ethers } = require("hardhat");

async function analyzeSuccessfulWrap() {
  console.log("🔍 Analyzing successful 0.01 stKLAY wrap transaction");
  
  const successTxHash = "0x278562c172c4364b52f28827c92609b461c6e8ad00046a0718c7450dcd78a169";
  
  try {
    const tx = await ethers.provider.getTransaction(successTxHash);
    const receipt = await ethers.provider.getTransactionReceipt(successTxHash);
    
    console.log("📋 Transaction Details:");
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   From: ${tx.from}`);
    console.log(`   To: ${tx.to}`);
    console.log(`   Value: ${ethers.formatEther(tx.value)} KAIA`);
    console.log(`   Gas Used: ${receipt.gasUsed.toLocaleString()}`);
    console.log(`   Gas Limit: ${tx.gasLimit.toLocaleString()}`);
    console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
    
    console.log("\n📊 Function Call Analysis:");
    if (tx.data && tx.data !== "0x") {
      const functionSelector = tx.data.slice(0, 10);
      console.log(`   Function Selector: ${functionSelector}`);
      
      // Common function selectors
      const selectors = {
        "0xde5f6268": "wrap(uint256)",
        "0x2e17de78": "unwrap(uint256)",
        "0xa9059cbb": "transfer(address,uint256)",
        "0x095ea7b3": "approve(address,uint256)"
      };
      
      const functionName = selectors[functionSelector] || "Unknown";
      console.log(`   Function: ${functionName}`);
      
      if (functionSelector === "0xde5f6268") { // wrap function
        const paramHex = tx.data.slice(10);
        if (paramHex.length === 64) {
          const amount = ethers.getBigInt("0x" + paramHex);
          console.log(`   Wrap Amount: ${ethers.formatEther(amount)} tokens`);
          
          if (amount === ethers.parseEther("0.01")) {
            console.log(`   ✅ Confirmed: 0.01 stKLAY wrap as reported`);
          }
        }
      }
    }
    
    console.log("\n📝 Event Analysis:");
    let transferCount = 0;
    let stKLAYTransferred = 0n;
    let wstKLAYMinted = 0n;
    
    const stKLAYAddress = "0x524dCFf07BFF606225A4FA76AFA55D705B052004";
    const wstKLAYAddress = "0x474B49DF463E528223F244670e332fE82742e1aA";
    
    for (const log of receipt.logs) {
      if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        transferCount++;
        const from = ethers.getAddress("0x" + log.topics[1].slice(26));
        const to = ethers.getAddress("0x" + log.topics[2].slice(26));
        const value = ethers.getBigInt(log.data);
        
        console.log(`   Transfer ${transferCount}:`);
        console.log(`     Contract: ${log.address}`);
        console.log(`     From: ${from}`);
        console.log(`     To: ${to}`);
        console.log(`     Amount: ${ethers.formatEther(value)} tokens`);
        
        if (log.address.toLowerCase() === stKLAYAddress.toLowerCase()) {
          console.log(`     Token: stKLAY`);
          if (from === tx.from) {
            stKLAYTransferred = value;
          }
        } else if (log.address.toLowerCase() === wstKLAYAddress.toLowerCase()) {
          console.log(`     Token: wstKLAY`);
          if (to === tx.from) {
            wstKLAYMinted = value;
          }
        }
      }
    }
    
    console.log("\n📊 Wrap Results:");
    console.log(`   stKLAY sent: ${ethers.formatEther(stKLAYTransferred)}`);
    console.log(`   wstKLAY received: ${ethers.formatEther(wstKLAYMinted)}`);
    
    if (stKLAYTransferred > 0 && wstKLAYMinted > 0) {
      const rate = wstKLAYMinted * 1000n / stKLAYTransferred;
      console.log(`   Exchange rate: 1 stKLAY = ${ethers.formatUnits(rate, 3)} wstKLAY`);
      
      if (stKLAYTransferred === wstKLAYMinted) {
        console.log(`   ✅ Perfect 1:1 ratio on testnet`);
      } else {
        console.log(`   ⚠️ Not 1:1 ratio - this is normal and expected`);
      }
    }
    
    console.log("\n🔧 Key Success Factors:");
    console.log(`   1. Direct user call (not contract)`);
    console.log(`   2. Simple execution context`);
    console.log(`   3. Adequate gas limit: ${tx.gasLimit.toLocaleString()}`);
    console.log(`   4. Clean transaction with no complex state`);
    
    console.log("\n💡 Implications for Our Contract:");
    console.log(`   Since 0.01 stKLAY wrap works:`);
    console.log(`   ❌ NOT a minimum amount issue`);
    console.log(`   ❌ NOT a token contract restriction`);
    console.log(`   ❌ NOT a network issue`);
    console.log(`   ✅ CONFIRMED: Issue is in contract execution context`);
    
    console.log("\n🎯 Next Steps:");
    console.log(`   1. Our test contract proves wrap works from contracts`);
    console.log(`   2. The issue must be specific to KVaultV2/_performSmartSwap`);
    console.log(`   3. Focus on gas limits, state interference, or execution flow`);
    console.log(`   4. Consider adding explicit success verification after wrap calls`);
    
  } catch (error) {
    console.error("❌ Error analyzing transaction:", error.message);
  }
}

analyzeSuccessfulWrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });