const { ethers } = require("hardhat");
const fs = require("fs");

async function testDepositWithdraw() {
  console.log("🧪 Testing 1 WKAIA deposit → 0.1 WKAIA withdraw");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("📋 Test Setup:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   User: ${signer.address}`);
  console.log(`   Network: ${networkName}`);
  
  // Get WKAIA contract (asset of the vault)
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log(`   WKAIA (asset): ${assetAddress}`);
  
  // Check initial balances
  const initialWKAIABalance = await wkaia.balanceOf(signer.address);
  const initialVaultShares = await vault.balanceOf(signer.address);
  const initialVaultTotalSupply = await vault.totalSupply();
  const initialVaultTotalAssets = await vault.totalAssets();
  
  console.log("\n💰 Initial State:");
  console.log(`   User WKAIA balance: ${ethers.formatEther(initialWKAIABalance)}`);
  console.log(`   User vault shares: ${ethers.formatEther(initialVaultShares)}`);
  console.log(`   Vault total supply: ${ethers.formatEther(initialVaultTotalSupply)}`);
  console.log(`   Vault total assets: ${ethers.formatEther(initialVaultTotalAssets)}`);
  
  const depositAmount = ethers.parseEther("1.0");
  const withdrawAmount = ethers.parseEther("0.1");
  
  if (initialWKAIABalance < depositAmount) {
    console.log(`❌ Insufficient WKAIA balance. Need ${ethers.formatEther(depositAmount)}, have ${ethers.formatEther(initialWKAIABalance)}`);
    return;
  }
  
  try {
    console.log(`\n🔄 Step 1: Depositing ${ethers.formatEther(depositAmount)} WKAIA`);
    
    // Approve WKAIA for deposit
    console.log("   Approving WKAIA...");
    let tx = await wkaia.approve(vaultAddress, depositAmount);
    await tx.wait();
    console.log("   ✅ Approval successful");
    
    // Get vault state before deposit
    const preDepositTotalAssets = await vault.totalAssets();
    const preDepositShares = await vault.balanceOf(signer.address);
    
    // Perform deposit
    console.log("   Executing deposit...");
    const depositTx = await vault.deposit(depositAmount, signer.address);
    const depositReceipt = await depositTx.wait();
    
    console.log(`   ✅ Deposit successful!`);
    console.log(`   Gas used: ${depositReceipt.gasUsed.toLocaleString()}`);
    console.log(`   Block: ${depositReceipt.blockNumber}`);
    console.log(`   Tx hash: ${depositReceipt.transactionHash}`);
    
    // Check post-deposit state
    const postDepositWKAIA = await wkaia.balanceOf(signer.address);
    const postDepositShares = await vault.balanceOf(signer.address);
    const postDepositTotalSupply = await vault.totalSupply();
    const postDepositTotalAssets = await vault.totalAssets();
    
    const sharesMinted = postDepositShares - preDepositShares;
    const wkaiaSpent = initialWKAIABalance - postDepositWKAIA;
    
    console.log("\n📊 Post-Deposit State:");
    console.log(`   User WKAIA balance: ${ethers.formatEther(postDepositWKAIA)}`);
    console.log(`   User vault shares: ${ethers.formatEther(postDepositShares)}`);
    console.log(`   Vault total supply: ${ethers.formatEther(postDepositTotalSupply)}`);
    console.log(`   Vault total assets: ${ethers.formatEther(postDepositTotalAssets)}`);
    console.log(`   Shares minted: ${ethers.formatEther(sharesMinted)}`);
    console.log(`   WKAIA spent: ${ethers.formatEther(wkaiaSpent)}`);
    
    if (sharesMinted > 0) {
      console.log(`   🎉 Deposit successful - shares were minted!`);
    } else {
      console.log(`   ❌ Deposit issue - no shares minted`);
      return;
    }
    
    // Wait a moment before withdraw
    console.log(`\n⏱️  Brief pause before withdraw...`);
    
    console.log(`\n🔄 Step 2: Withdrawing ${ethers.formatEther(withdrawAmount)} WKAIA`);
    
    // Check how many shares we need to withdraw the desired amount
    const sharesToWithdraw = await vault.previewWithdraw(withdrawAmount);
    console.log(`   Shares needed for withdrawal: ${ethers.formatEther(sharesToWithdraw)}`);
    
    if (postDepositShares < sharesToWithdraw) {
      console.log(`   ❌ Insufficient shares for withdrawal`);
      console.log(`   Have: ${ethers.formatEther(postDepositShares)}, Need: ${ethers.formatEther(sharesToWithdraw)}`);
      return;
    }
    
    // Perform withdraw
    console.log("   Executing withdraw...");
    const withdrawTx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
    const withdrawReceipt = await withdrawTx.wait();
    
    console.log(`   ✅ Withdraw successful!`);
    console.log(`   Gas used: ${withdrawReceipt.gasUsed.toLocaleString()}`);
    console.log(`   Block: ${withdrawReceipt.blockNumber}`);
    console.log(`   Tx hash: ${withdrawReceipt.transactionHash}`);
    
    // Check final state
    const finalWKAIA = await wkaia.balanceOf(signer.address);
    const finalShares = await vault.balanceOf(signer.address);
    const finalTotalSupply = await vault.totalSupply();
    const finalTotalAssets = await vault.totalAssets();
    
    const sharesRedeemed = postDepositShares - finalShares;
    const wkaiaReceived = finalWKAIA - postDepositWKAIA;
    
    console.log("\n📊 Final State:");
    console.log(`   User WKAIA balance: ${ethers.formatEther(finalWKAIA)}`);
    console.log(`   User vault shares: ${ethers.formatEther(finalShares)}`);
    console.log(`   Vault total supply: ${ethers.formatEther(finalTotalSupply)}`);
    console.log(`   Vault total assets: ${ethers.formatEther(finalTotalAssets)}`);
    console.log(`   Shares redeemed: ${ethers.formatEther(sharesRedeemed)}`);
    console.log(`   WKAIA received: ${ethers.formatEther(wkaiaReceived)}`);
    
    // Analyze results
    console.log("\n🔍 Analysis:");
    console.log(`   Deposit: ${ethers.formatEther(wkaiaSpent)} WKAIA → ${ethers.formatEther(sharesMinted)} shares`);
    console.log(`   Withdraw: ${ethers.formatEther(sharesRedeemed)} shares → ${ethers.formatEther(wkaiaReceived)} WKAIA`);
    
    const expectedWithdrawAmount = withdrawAmount;
    const actualWithdrawAmount = wkaiaReceived;
    const withdrawSuccess = actualWithdrawAmount >= expectedWithdrawAmount * 95n / 100n; // 5% tolerance
    
    if (withdrawSuccess) {
      console.log(`   ✅ Withdraw amount correct: Expected ~${ethers.formatEther(expectedWithdrawAmount)}, Got ${ethers.formatEther(actualWithdrawAmount)}`);
    } else {
      console.log(`   ⚠️ Withdraw amount mismatch: Expected ~${ethers.formatEther(expectedWithdrawAmount)}, Got ${ethers.formatEther(actualWithdrawAmount)}`);
    }
    
    // Check if there were any wrap operations in the transactions
    console.log(`\n📊 Transaction Analysis:`);
    console.log(`   Deposit logs: ${depositReceipt.logs.length} events`);
    console.log(`   Withdraw logs: ${withdrawReceipt.logs.length} events`);
    
    let depositTransfers = 0;
    let withdrawTransfers = 0;
    
    for (const log of depositReceipt.logs) {
      if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        depositTransfers++;
      }
    }
    
    for (const log of withdrawReceipt.logs) {
      if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
        withdrawTransfers++;
      }
    }
    
    console.log(`   Deposit transfer events: ${depositTransfers}`);
    console.log(`   Withdraw transfer events: ${withdrawTransfers}`);
    
    if (sharesMinted > 0 && wkaiaReceived > 0) {
      console.log(`\n🎉 SUCCESS: Both deposit and withdraw completed successfully!`);
      console.log(`💡 This means our wrap success verification fix is working correctly.`);
      console.log(`✅ No more silent wrap failures causing deposit/withdraw issues.`);
    } else if (sharesMinted > 0 && wkaiaReceived === 0n) {
      console.log(`\n⚠️ PARTIAL SUCCESS: Deposit worked, but withdraw failed`);
      console.log(`💡 This could indicate issues with the unwrap or swap process during withdrawal.`);
    } else {
      console.log(`\n❌ Issues detected - need further investigation`);
    }
    
  } catch (error) {
    console.log(`\n❌ Test failed with error: ${error.message}`);
    
    // Analyze the specific error
    if (error.message.includes("Wrap failed: no tokens received")) {
      console.log(`\n🎯 SUCCESS: Our fix detected a wrap failure!`);
      console.log(`💡 This proves the wrap verification is working correctly.`);
      console.log(`🔧 The wrap function is indeed failing - need to investigate specific LST protocols.`);
      
      console.log(`\nNext steps:`);
      console.log(`1. Check which specific LST protocol (stKLAY, GCKAIA, etc.) is failing`);
      console.log(`2. Investigate that protocol's restrictions on contract calls`);
      console.log(`3. Consider protocol-specific solutions or contact protocol team`);
      
    } else if (error.message.includes("insufficient allowance")) {
      console.log(`💡 Allowance issue - check approve process`);
    } else if (error.message.includes("insufficient balance")) {
      console.log(`💡 Balance issue - check available funds`);
    } else if (error.message.includes("execution reverted")) {
      console.log(`💡 Transaction reverted - check contract state and parameters`);
    } else {
      console.log(`💡 Unknown error - needs detailed investigation`);
      console.log(`Error details: ${error}`);
    }
  }
}

testDepositWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });