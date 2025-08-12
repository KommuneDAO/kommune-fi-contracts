const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * 고급 테스트 스위트: 다양한 withdraw 시나리오 및 LST swap 테스트
 * - 다양한 금액별 withdraw 시나리오
 * - LST swap 로직 검증
 * - 다중 LST 활용 테스트
 * - 가스 효율성 분석
 */

async function advancedTestSuite() {
  console.log("🔬 KommuneFi Vault 고급 테스트 스위트 시작");
  console.log("=" .repeat(60));
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 고급 테스트 환경:");
  console.log(`   네트워크: ${networkName}`);
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   테스터: ${signer.address}`);
  console.log();
  
  let passedTests = 0;
  let totalTests = 0;
  const results = [];
  const gasMetrics = [];
  
  // 테스트 실행 함수
  async function runTest(testName, testFunction) {
    totalTests++;
    console.log(`🔍 ${testName}`);
    try {
      const result = await testFunction();
      if (result.success) {
        passedTests++;
        console.log(`   ✅ ${result.message}`);
      } else {
        console.log(`   ❌ ${result.message}`);
      }
      results.push({ name: testName, ...result });
      
      // Gas 메트릭 수집
      if (result.data && result.data.gasUsed) {
        gasMetrics.push({
          test: testName,
          gasUsed: result.data.gasUsed,
          category: result.data.category || 'unknown'
        });
      }
    } catch (error) {
      console.log(`   💥 예외 발생: ${error.message}`);
      results.push({ name: testName, success: false, message: error.message });
    }
    console.log();
  }
  
  // LST 상태 조회 헬퍼 함수
  async function getLSTBalances() {
    const lstBalances = [];
    const lstNames = ['KoKAIA', 'GCKAIA', 'stKLAY', 'stKAIA'];
    
    for (let i = 0; i <= 3; i++) {
      const tokenInfo = await vault.tokensInfo(i);
      const lstContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const balance = await lstContract.balanceOf(vaultAddress);
      lstBalances.push({
        index: i,
        name: lstNames[i],
        address: tokenInfo.asset,
        balance: balance
      });
    }
    return lstBalances;
  }
  
  // 충분한 테스트 자금 확보
  await runTest("테스트 자금 준비", async () => {
    const requiredAmount = ethers.parseEther("5.0");
    const userWKAIA = await wkaia.balanceOf(signer.address);
    
    if (userWKAIA < requiredAmount) {
      return { 
        success: false, 
        message: `테스트 자금 부족: 보유 ${ethers.formatEther(userWKAIA)}, 필요 ${ethers.formatEther(requiredAmount)}` 
      };
    }
    
    try {
      // 테스트용 예치
      const depositAmount = ethers.parseEther("3.0");
      await wkaia.approve(vaultAddress, depositAmount);
      const depositTx = await vault.deposit(depositAmount, signer.address);
      const receipt = await depositTx.wait();
      
      return {
        success: true,
        message: `${ethers.formatEther(depositAmount)} WKAIA 예치 완료`,
        data: { gasUsed: receipt.gasUsed, category: 'setup' }
      };
    } catch (error) {
      return { success: false, message: `예치 실패: ${error.message}` };
    }
  });
  
  // 시나리오별 withdraw 테스트
  const withdrawScenarios = [
    {
      name: "마이크로 출금",
      amount: ethers.parseEther("0.01"),
      expectedSwap: false,
      description: "LST swap 불필요한 최소 금액"
    },
    {
      name: "소액 출금",
      amount: ethers.parseEther("0.1"),
      expectedSwap: false,
      description: "Vault 잔액으로 처리 가능한 금액"
    },
    {
      name: "중간 출금",
      amount: ethers.parseEther("0.5"),
      expectedSwap: true,
      description: "단일 LST swap 필요한 금액"
    },
    {
      name: "대량 출금",
      amount: ethers.parseEther("1.0"),
      expectedSwap: true,
      description: "다중 LST swap 필요한 금액"
    },
    {
      name: "최대 출금",
      amount: ethers.parseEther("2.0"),
      expectedSwap: true,
      description: "모든 LST 활용 필요한 금액"
    }
  ];
  
  for (const scenario of withdrawScenarios) {
    await runTest(`${scenario.name} (${ethers.formatEther(scenario.amount)} WKAIA)`, async () => {
      try {
        const userShares = await vault.balanceOf(signer.address);
        const sharesNeeded = await vault.previewWithdraw(scenario.amount);
        
        if (userShares < sharesNeeded) {
          return { 
            success: false, 
            message: `Shares 부족: 보유 ${ethers.formatEther(userShares)}, 필요 ${ethers.formatEther(sharesNeeded)}` 
          };
        }
        
        // 현재 Vault WKAIA 잔액 확인
        const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
        const needsSwap = scenario.amount > vaultWKAIA;
        
        // LST 상태 기록 (before)
        const lstBefore = await getLSTBalances();
        const userBalanceBefore = await wkaia.balanceOf(signer.address);
        
        // Withdraw 실행
        const withdrawTx = await vault.withdraw(scenario.amount, signer.address, signer.address);
        const receipt = await withdrawTx.wait();
        
        // 결과 검증
        const userBalanceAfter = await wkaia.balanceOf(signer.address);
        const received = userBalanceAfter - userBalanceBefore;
        const lstAfter = await getLSTBalances();
        
        // LST 잔액 변화 분석
        let lstChanges = [];
        let swapDetected = false;
        
        for (let i = 0; i < lstBefore.length; i++) {
          const change = lstBefore[i].balance - lstAfter[i].balance;
          if (change > 0) {
            lstChanges.push({
              name: lstBefore[i].name,
              change: ethers.formatEther(change)
            });
            swapDetected = true;
          }
        }
        
        // 정확도 검증 (3% 허용오차)
        const tolerance = scenario.amount * 3n / 100n;
        const accurate = received >= scenario.amount - tolerance;
        
        let message = `받음: ${ethers.formatEther(received)} WKAIA (Gas: ${receipt.gasUsed.toLocaleString()})`;
        
        if (swapDetected) {
          message += `, LST swap: ${lstChanges.map(c => `${c.name}(-${c.change})`).join(', ')}`;
        }
        
        // 예상과 실제 swap 필요성 비교
        const swapExpected = scenario.expectedSwap;
        const swapActual = swapDetected || needsSwap;
        
        if (swapExpected !== swapActual) {
          message += ` [예상 swap: ${swapExpected}, 실제: ${swapActual}]`;
        }
        
        return {
          success: accurate && received > 0,
          message: message,
          data: { 
            gasUsed: receipt.gasUsed, 
            category: swapDetected ? 'swap-withdraw' : 'direct-withdraw',
            received: received,
            lstChanges: lstChanges,
            swapDetected: swapDetected
          }
        };
        
      } catch (error) {
        if (error.message.includes("Wrap failed: no tokens received")) {
          return { 
            success: false, 
            message: "LST wrap 실패 - 프로토콜 제한사항 (검증 로직 작동 중)" 
          };
        } else if (error.message.includes("arithmetic underflow")) {
          return { 
            success: false, 
            message: "산술 언더플로우 - 계산 로직 개선 필요" 
          };
        } else if (error.message.includes("insufficient liquidity")) {
          return { 
            success: false, 
            message: "DEX 유동성 부족" 
          };
        }
        
        return { success: false, message: `실패: ${error.message}` };
      }
    });
  }
  
  // Gas 효율성 분석
  await runTest("가스 효율성 분석", async () => {
    if (gasMetrics.length === 0) {
      return { success: false, message: "가스 메트릭 데이터 없음" };
    }
    
    const directWithdraws = gasMetrics.filter(m => m.category === 'direct-withdraw');
    const swapWithdraws = gasMetrics.filter(m => m.category === 'swap-withdraw');
    
    let analysis = [];
    
    if (directWithdraws.length > 0) {
      const avgDirectGas = directWithdraws.reduce((sum, m) => sum + Number(m.gasUsed), 0) / directWithdraws.length;
      analysis.push(`Direct withdraw 평균: ${avgDirectGas.toLocaleString()} gas`);
    }
    
    if (swapWithdraws.length > 0) {
      const avgSwapGas = swapWithdraws.reduce((sum, m) => sum + Number(m.gasUsed), 0) / swapWithdraws.length;
      analysis.push(`Swap withdraw 평균: ${avgSwapGas.toLocaleString()} gas`);
      
      if (directWithdraws.length > 0) {
        const avgDirectGas = directWithdraws.reduce((sum, m) => sum + Number(m.gasUsed), 0) / directWithdraws.length;
        const gasIncrease = ((avgSwapGas - avgDirectGas) / avgDirectGas * 100).toFixed(1);
        analysis.push(`Swap 추가 비용: +${gasIncrease}%`);
      }
    }
    
    return {
      success: true,
      message: analysis.join(', '),
      data: { gasMetrics: gasMetrics }
    };
  });
  
  // LST 토큰별 임계값 테스트
  await runTest("LST 임계값 준수 검증", async () => {
    try {
      const lstNames = ['KoKAIA', 'GCKAIA', 'stKLAY', 'stKAIA'];
      let violations = [];
      
      for (let i = 0; i <= 3; i++) {
        const tokenInfo = await vault.tokensInfo(i);
        const lstContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await lstContract.balanceOf(vaultAddress);
        
        if (balance > 0 && balance < tokenInfo.threshold) {
          violations.push(`${lstNames[i]}: ${ethers.formatEther(balance)} < ${ethers.formatEther(tokenInfo.threshold)}`);
        }
      }
      
      if (violations.length === 0) {
        return { success: true, message: "모든 LST 임계값 준수" };
      } else {
        return { 
          success: false, 
          message: `임계값 위반: ${violations.join(', ')}` 
        };
      }
    } catch (error) {
      return { success: false, message: `검증 실패: ${error.message}` };
    }
  });
  
  // 결과 요약
  console.log("=" .repeat(60));
  console.log("📊 고급 테스트 결과 요약");
  console.log("=" .repeat(60));
  console.log(`총 테스트: ${totalTests}`);
  console.log(`성공: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`실패: ${totalTests - passedTests}`);
  console.log();
  
  // 카테고리별 통계
  const categories = {};
  for (const result of results) {
    if (result.data && result.data.category) {
      const cat = result.data.category;
      if (!categories[cat]) categories[cat] = { success: 0, total: 0 };
      categories[cat].total++;
      if (result.success) categories[cat].success++;
    }
  }
  
  console.log("📈 카테고리별 성공률:");
  for (const [category, stats] of Object.entries(categories)) {
    const rate = ((stats.success / stats.total) * 100).toFixed(1);
    console.log(`   ${category}: ${stats.success}/${stats.total} (${rate}%)`);
  }
  console.log();
  
  // 실패한 테스트 상세 정보
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log("❌ 실패한 테스트:");
    for (const failure of failures) {
      console.log(`   • ${failure.name}: ${failure.message}`);
    }
    console.log();
  }
  
  // 권장사항
  console.log("💡 분석 결과:");
  if (passedTests === totalTests) {
    console.log("   🎉 모든 고급 테스트 통과! 시스템이 안정적으로 작동합니다.");
  } else if (passedTests / totalTests >= 0.8) {
    console.log("   ✅ 대부분의 기능이 정상 작동하나 일부 개선이 필요합니다.");
  } else {
    console.log("   ⚠️  주요 기능에 문제가 있습니다. 시스템 점검이 필요합니다.");
  }
  
  // 다음 단계 추천
  if (failures.some(f => f.message.includes("Wrap failed"))) {
    console.log("   🔧 LST wrap 실패 감지: 특정 LST 프로토콜의 제한사항을 확인하세요.");
  }
  
  if (failures.some(f => f.message.includes("arithmetic underflow"))) {
    console.log("   🔧 산술 오류 감지: 계산 로직의 경계 조건을 개선하세요.");
  }
  
  return { passedTests, totalTests, results, gasMetrics };
}

// 스크립트 직접 실행시
if (require.main === module) {
  advancedTestSuite()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { advancedTestSuite };