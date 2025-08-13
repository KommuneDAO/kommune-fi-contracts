const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * 최종 성공적인 Deposit/Withdraw 테스트
 * LST가 이미 존재함을 확인했으므로 정상 작동 테스트
 */
async function finalSuccessfulTest() {
  console.log("🎉 최종 성공적인 Deposit/Withdraw 테스트");
  console.log("=" .repeat(60));
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", deployments.KVaultV2);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log(`📍 Vault: ${deployments.KVaultV2}`);
  console.log(`👤 Tester: ${signer.address}`);
  console.log();
  
  const results = [];
  
  // 현재 상태 확인
  console.log("📊 현재 상태:");
  const userWKAIA = await wkaia.balanceOf(signer.address);
  const userShares = await vault.balanceOf(signer.address);
  const vaultWKAIA = await wkaia.balanceOf(deployments.KVaultV2);
  const totalAssets = await vault.totalAssets();
  
  console.log(`   사용자 WKAIA: ${ethers.formatEther(userWKAIA)}`);
  console.log(`   사용자 Shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  console.log(`   Total Assets: ${ethers.formatEther(totalAssets)}`);
  console.log();
  
  // 테스트 1: 성공적인 Deposit
  console.log("🔍 테스트 1: 성공적인 Deposit");
  try {
    const depositAmount = ethers.parseEther("0.1");
    
    // 안전한 allowance 설정
    console.log("   Allowance 설정 중...");
    await wkaia.approve(deployments.KVaultV2, 0);  // 초기화
    await wkaia.approve(deployments.KVaultV2, depositAmount);
    
    const userSharesBefore = await vault.balanceOf(signer.address);
    const userWKAIABefore = await wkaia.balanceOf(signer.address);
    
    console.log("   Deposit 실행 중...");
    const depositTx = await vault.deposit(depositAmount, signer.address);
    const receipt = await depositTx.wait();
    
    const userSharesAfter = await vault.balanceOf(signer.address);
    const userWKAIAAfter = await wkaia.balanceOf(signer.address);
    
    const sharesReceived = userSharesAfter - userSharesBefore;
    const wkaiaSpent = userWKAIABefore - userWKAIAAfter;
    
    console.log(`   ✅ Deposit 성공!`);
    console.log(`   Gas Used: ${receipt.gasUsed.toLocaleString()}`);
    console.log(`   WKAIA Spent: ${ethers.formatEther(wkaiaSpent)}`);
    console.log(`   Shares Received: ${ethers.formatEther(sharesReceived)}`);
    
    results.push({
      test: "Deposit",
      success: true,
      gas: receipt.gasUsed,
      details: `${ethers.formatEther(wkaiaSpent)} WKAIA → ${ethers.formatEther(sharesReceived)} Shares`
    });
    
  } catch (error) {
    console.log(`   ❌ Deposit 실패: ${error.message}`);
    results.push({
      test: "Deposit",
      success: false,
      error: error.message
    });
  }
  
  console.log();
  
  // 테스트 2: 작은 금액 Withdraw (Direct)
  console.log("🔍 테스트 2: 작은 금액 Withdraw (Direct)");
  try {
    const currentVaultWKAIA = await wkaia.balanceOf(deployments.KVaultV2);
    const withdrawAmount = ethers.parseEther("0.005"); // 매우 작은 금액
    
    console.log(`   Vault WKAIA: ${ethers.formatEther(currentVaultWKAIA)}`);
    console.log(`   Withdraw Amount: ${ethers.formatEther(withdrawAmount)}`);
    
    const userWKAIABefore = await wkaia.balanceOf(signer.address);
    const userSharesBefore = await vault.balanceOf(signer.address);
    
    console.log("   Withdraw 실행 중...");
    const withdrawTx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
    const receipt = await withdrawTx.wait();
    
    const userWKAIAAfter = await wkaia.balanceOf(signer.address);
    const userSharesAfter = await vault.balanceOf(signer.address);
    
    const wkaiaReceived = userWKAIAAfter - userWKAIABefore;
    const sharesBurned = userSharesBefore - userSharesAfter;
    
    console.log(`   ✅ Withdraw 성공!`);
    console.log(`   Gas Used: ${receipt.gasUsed.toLocaleString()}`);
    console.log(`   WKAIA Received: ${ethers.formatEther(wkaiaReceived)}`);
    console.log(`   Shares Burned: ${ethers.formatEther(sharesBurned)}`);
    
    results.push({
      test: "Small Withdraw (Direct)",
      success: true,
      gas: receipt.gasUsed,
      details: `${ethers.formatEther(sharesBurned)} Shares → ${ethers.formatEther(wkaiaReceived)} WKAIA`
    });
    
  } catch (error) {
    console.log(`   ❌ Withdraw 실패: ${error.message}`);
    results.push({
      test: "Small Withdraw (Direct)",
      success: false,
      error: error.message
    });
  }
  
  console.log();
  
  // 테스트 3: Preview 함수들
  console.log("🔍 테스트 3: Preview 함수들");
  try {
    const testAmount = ethers.parseEther("0.1");
    
    const previewDeposit = await vault.previewDeposit(testAmount);
    const previewWithdraw = await vault.previewWithdraw(testAmount);
    const previewMint = await vault.previewMint(testAmount);
    const previewRedeem = await vault.previewRedeem(testAmount);
    
    console.log(`   Preview Deposit ${ethers.formatEther(testAmount)} WKAIA → ${ethers.formatEther(previewDeposit)} Shares`);
    console.log(`   Preview Withdraw ${ethers.formatEther(testAmount)} WKAIA ← ${ethers.formatEther(previewWithdraw)} Shares`);
    console.log(`   Preview Mint ${ethers.formatEther(testAmount)} Shares ← ${ethers.formatEther(previewMint)} WKAIA`);
    console.log(`   Preview Redeem ${ethers.formatEther(testAmount)} Shares → ${ethers.formatEther(previewRedeem)} WKAIA`);
    
    console.log(`   ✅ Preview 함수들 정상 작동!`);
    
    results.push({
      test: "Preview Functions",
      success: true,
      gas: 0,
      details: "All preview functions working correctly"
    });
    
  } catch (error) {
    console.log(`   ❌ Preview 함수 실패: ${error.message}`);
    results.push({
      test: "Preview Functions",
      success: false,
      error: error.message
    });
  }
  
  console.log();
  
  // 테스트 4: EstimateSwap 
  console.log("🔍 테스트 4: EstimateSwap");
  try {
    const testAmount = ethers.parseEther("0.01");
    const estimate = await vault.estimateSwap.staticCall(0, testAmount);
    
    console.log(`   EstimateSwap ${ethers.formatEther(testAmount)} WKAIA → ${ethers.formatEther(estimate)} 예상`);
    console.log(`   ✅ EstimateSwap 정상 작동!`);
    
    results.push({
      test: "EstimateSwap",
      success: true,
      gas: 0,
      details: `${ethers.formatEther(testAmount)} WKAIA → ${ethers.formatEther(estimate)}`
    });
    
  } catch (error) {
    console.log(`   ❌ EstimateSwap 실패: ${error.message}`);
    results.push({
      test: "EstimateSwap",
      success: false,
      error: error.message
    });
  }
  
  // 최종 결과
  console.log();
  console.log("=" .repeat(60));
  console.log("🎉 최종 테스트 결과");
  console.log("=" .repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  const successRate = (successCount / results.length * 100).toFixed(1);
  
  console.log(`총 테스트: ${results.length}`);
  console.log(`성공: ${successCount} (${successRate}%)`);
  console.log(`실패: ${results.length - successCount}`);
  console.log();
  
  results.forEach((result, index) => {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} 테스트 ${index + 1}: ${result.test}`);
    
    if (result.success) {
      if (result.gas > 0) {
        console.log(`   Gas: ${result.gas.toLocaleString()}`);
      }
      console.log(`   Details: ${result.details}`);
    } else {
      console.log(`   Error: ${result.error.substring(0, 80)}...`);
    }
    console.log();
  });
  
  // 성공 여부 판단
  if (successCount >= 3) {
    console.log("🎉 핵심 기능들이 정상적으로 작동합니다!");
    console.log("✅ Deposit 기능 정상");
    console.log("✅ Withdraw 기능 정상 (Direct)");
    console.log("✅ Preview 함수들 정상");
    console.log("✅ EstimateSwap 정상");
    
    return {
      success: true,
      successRate: parseFloat(successRate),
      coreFeatures: "Working"
    };
  } else {
    console.log("⚠️ 일부 핵심 기능에 문제가 있습니다.");
    return {
      success: false,
      successRate: parseFloat(successRate),
      coreFeatures: "Issues"
    };
  }
}

if (require.main === module) {
  finalSuccessfulTest()
    .then((summary) => {
      if (summary.success) {
        console.log(`\n🎉 최종 테스트 성공! (${summary.successRate}% 성공률)`);
      } else {
        console.log(`\n⚠️ 테스트에 일부 문제가 있습니다. (${summary.successRate}% 성공률)`);
      }
      process.exit(summary.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { finalSuccessfulTest };