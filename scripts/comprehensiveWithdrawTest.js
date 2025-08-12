const { ethers } = require("hardhat");
const fs = require("fs");

async function comprehensiveWithdrawTest() {
  console.log("🧪 포괄적인 withdraw 테스트 및 수정");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 테스트 설정:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   WKAIA: ${assetAddress}`);
  console.log(`   사용자: ${signer.address}`);
  
  // 1단계: 현재 상태 확인
  const initialUserWKAIA = await wkaia.balanceOf(signer.address);
  const initialUserShares = await vault.balanceOf(signer.address);
  const initialVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log("\n💰 초기 상태:");
  console.log(`   사용자 WKAIA: ${ethers.formatEther(initialUserWKAIA)}`);
  console.log(`   사용자 shares: ${ethers.formatEther(initialUserShares)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(initialVaultWKAIA)}`);
  
  // 2단계: 충분한 WKAIA 확보 및 deposit
  const additionalDeposit = ethers.parseEther("5.0"); // 충분한 테스트 자금
  
  console.log(`\n🏦 ${ethers.formatEther(additionalDeposit)} WKAIA 추가 deposit:`);
  
  if (initialUserWKAIA >= additionalDeposit) {
    try {
      await wkaia.approve(vaultAddress, additionalDeposit);
      const depositTx = await vault.deposit(additionalDeposit, signer.address);
      await depositTx.wait();
      
      const newUserShares = await vault.balanceOf(signer.address);
      const newVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      
      console.log(`   ✅ Deposit 성공!`);
      console.log(`   새로운 shares: ${ethers.formatEther(newUserShares)}`);
      console.log(`   새로운 Vault WKAIA: ${ethers.formatEther(newVaultWKAIA)}`);
      
    } catch (depositError) {
      console.log(`   ❌ Deposit 실패: ${depositError.message}`);
      if (depositError.message.includes("Wrap failed: no tokens received")) {
        console.log(`   🎯 Wrap 검증이 작동 중! 특정 LST에 문제가 있습니다.`);
      }
      return;
    }
  } else {
    console.log(`   ❌ WKAIA 부족. 보유: ${ethers.formatEther(initialUserWKAIA)}, 필요: ${ethers.formatEther(additionalDeposit)}`);
    return;
  }
  
  // 3단계: 다양한 withdraw 시나리오 테스트
  const testScenarios = [
    { name: "소량 withdraw (swap 불필요)", amount: ethers.parseEther("0.05") },
    { name: "중간량 withdraw (최소 LST swap)", amount: ethers.parseEther("0.2") },
    { name: "대량 withdraw (다중 LST swap)", amount: ethers.parseEther("0.8") },
    { name: "최대량 withdraw (전체 LST 활용)", amount: ethers.parseEther("2.0") },
  ];
  
  console.log("\n🧪 다양한 withdraw 시나리오 테스트:");
  
  let successCount = 0;
  const currentUserShares = await vault.balanceOf(signer.address);
  
  for (const scenario of testScenarios) {
    console.log(`\n📊 ${scenario.name}:`);
    console.log(`   목표 출금액: ${ethers.formatEther(scenario.amount)} WKAIA`);
    
    try {
      // Preview withdrawal
      const sharesNeeded = await vault.previewWithdraw(scenario.amount);
      console.log(`   필요 shares: ${ethers.formatEther(sharesNeeded)}`);
      
      if (currentUserShares < sharesNeeded) {
        console.log(`   ⚠️ shares 부족. 보유: ${ethers.formatEther(currentUserShares)}`);
        continue;
      }
      
      // Check current vault state
      const preWithdrawVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      const preWithdrawUserWKAIA = await wkaia.balanceOf(signer.address);
      const needsSwap = scenario.amount > preWithdrawVaultWKAIA;
      
      console.log(`   현재 Vault WKAIA: ${ethers.formatEther(preWithdrawVaultWKAIA)}`);
      console.log(`   LST swap 필요: ${needsSwap ? "예" : "아니오"}`);
      
      if (needsSwap) {
        const deficit = scenario.amount - preWithdrawVaultWKAIA;
        console.log(`   부족분: ${ethers.formatEther(deficit)} WKAIA`);
      }
      
      // Attempt withdrawal
      console.log(`   출금 시도 중...`);
      const withdrawTx = await vault.withdraw(scenario.amount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      // Check results
      const postWithdrawUserWKAIA = await wkaia.balanceOf(signer.address);
      const actualReceived = postWithdrawUserWKAIA - preWithdrawUserWKAIA;
      
      console.log(`   ✅ 성공! Gas: ${receipt.gasUsed.toLocaleString()}`);
      console.log(`   실제 수령: ${ethers.formatEther(actualReceived)} WKAIA`);
      console.log(`   정확도: ${((actualReceived * 100n) / scenario.amount)}%`);
      
      successCount++;
      
      // Analyze transaction events for debugging
      let batchSwapCount = 0;
      let multiAssetWithdrawCount = 0;
      
      for (const log of receipt.logs) {
        try {
          const decoded = vault.interface.parseLog(log);
          if (decoded) {
            if (decoded.name === "BatchSwap") {
              batchSwapCount++;
            } else if (decoded.name === "MultiAssetWithdraw") {
              multiAssetWithdrawCount++;
              console.log(`   MultiAssetWithdraw: used=${decoded.args[1]}, swapped=${ethers.formatEther(decoded.args[2])}`);
            }
          }
        } catch (e) {
          // Not a vault event
        }
      }
      
      if (batchSwapCount > 0) {
        console.log(`   🔄 ${batchSwapCount}개 BatchSwap 실행됨`);
      }
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      
      // Detailed error analysis
      if (error.message.includes("arithmetic underflow or overflow")) {
        console.log(`   💡 Arithmetic underflow 감지 - 계산 로직 수정 필요`);
      } else if (error.message.includes("Wrap failed: no tokens received")) {
        console.log(`   🎯 Wrap 검증이 문제 감지! 특정 LST 프로토콜 이슈`);
      } else if (error.message.includes("insufficient liquidity")) {
        console.log(`   💡 DEX 유동성 부족`);
      } else {
        console.log(`   💡 알 수 없는 오류 - 추가 조사 필요`);
      }
    }
  }
  
  console.log(`\n📊 테스트 결과 요약:`);
  console.log(`   성공한 시나리오: ${successCount}/${testScenarios.length}`);
  console.log(`   성공률: ${(successCount * 100 / testScenarios.length).toFixed(1)}%`);
  
  if (successCount === testScenarios.length) {
    console.log(`   🎉 모든 withdraw 시나리오 성공!`);
  } else {
    console.log(`   ⚠️ ${testScenarios.length - successCount}개 시나리오 실패 - 수정 필요`);
    
    console.log(`\n🔧 수정이 필요한 영역:`);
    console.log(`   1. Arithmetic underflow 완전 해결`);
    console.log(`   2. LST swap 계산 로직 보완`);
    console.log(`   3. Edge case 처리 강화`);
    console.log(`   4. 오류 복구 메커니즘 구현`);
  }
  
  // 최종 상태 확인
  const finalUserShares = await vault.balanceOf(signer.address);
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log(`\n💰 최종 상태:`);
  console.log(`   사용자 남은 shares: ${ethers.formatEther(finalUserShares)}`);
  console.log(`   Vault 남은 WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
}

comprehensiveWithdrawTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });