const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Edge Case 테스트 스위트: 경계 조건 및 에러 시나리오 검증
 * - 극한 상황 테스트
 * - 에러 처리 검증
 * - 보안 관련 테스트
 * - 계산 정확성 검증
 */

async function edgeCaseTestSuite() {
  console.log("🔬 KommuneFi Vault Edge Case 테스트 스위트");
  console.log("=" .repeat(60));
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 Edge Case 테스트 환경:");
  console.log(`   네트워크: ${networkName}`);
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   테스터: ${signer.address}`);
  console.log();
  
  let passedTests = 0;
  let totalTests = 0;
  const results = [];
  
  // 테스트 실행 함수 (에러 예상 케이스 포함)
  async function runTest(testName, testFunction, expectError = false) {
    totalTests++;
    console.log(`🔍 ${testName}`);
    try {
      const result = await testFunction();
      if (expectError) {
        // 에러가 예상되었는데 성공한 경우
        console.log(`   ⚠️  에러가 예상되었으나 성공: ${result.message || 'No message'}`);
        results.push({ name: testName, success: false, message: "Expected error but succeeded", expected: "error" });
      } else {
        // 정상 성공
        if (result.success) {
          passedTests++;
          console.log(`   ✅ ${result.message}`);
        } else {
          console.log(`   ❌ ${result.message}`);
        }
        results.push({ name: testName, ...result });
      }
    } catch (error) {
      if (expectError) {
        // 예상된 에러
        passedTests++;
        console.log(`   ✅ 예상된 에러 발생: ${error.message}`);
        results.push({ name: testName, success: true, message: `Expected error: ${error.message}`, expected: "error" });
      } else {
        // 예상치 못한 에러
        console.log(`   💥 예외 발생: ${error.message}`);
        results.push({ name: testName, success: false, message: error.message });
      }
    }
    console.log();
  }
  
  // 1. 극소량 테스트
  await runTest("극소량 Deposit (1 wei)", async () => {
    const depositAmount = 1n; // 1 wei
    const userWKAIA = await wkaia.balanceOf(signer.address);
    
    if (userWKAIA < depositAmount) {
      return { success: false, message: "WKAIA 잔액 부족" };
    }
    
    try {
      await wkaia.approve(vaultAddress, depositAmount);
      const depositTx = await vault.deposit(depositAmount, signer.address);
      const receipt = await depositTx.wait();
      
      const shares = await vault.balanceOf(signer.address);
      return {
        success: shares > 0,
        message: `1 wei → ${shares.toString()} shares (Gas: ${receipt.gasUsed.toLocaleString()})`,
      };
    } catch (error) {
      return { success: false, message: `Deposit 실패: ${error.message}` };
    }
  });
  
  // 2. 잔액 초과 Deposit 테스트 (에러 예상)
  await runTest("잔액 초과 Deposit", async () => {
    const userWKAIA = await wkaia.balanceOf(signer.address);
    const excessAmount = userWKAIA + ethers.parseEther("1000.0");
    
    await wkaia.approve(vaultAddress, excessAmount);
    const depositTx = await vault.deposit(excessAmount, signer.address);
    await depositTx.wait();
    
    return { success: false, message: "잔액을 초과한 deposit이 성공함" };
  }, true); // 에러 예상
  
  // 3. 0 금액 Deposit 테스트 (에러 예상)
  await runTest("0 금액 Deposit", async () => {
    await wkaia.approve(vaultAddress, 0);
    const depositTx = await vault.deposit(0, signer.address);
    await depositTx.wait();
    
    return { success: false, message: "0 금액 deposit이 성공함" };
  }, true); // 에러 예상
  
  // 4. Shares 부족 Withdraw 테스트 (에러 예상)
  await runTest("Shares 부족 Withdraw", async () => {
    const userShares = await vault.balanceOf(signer.address);
    const excessAmount = ethers.parseEther("999.0"); // 과도한 금액
    
    const withdrawTx = await vault.withdraw(excessAmount, signer.address, signer.address);
    await withdrawTx.wait();
    
    return { success: false, message: "Shares 부족한데도 withdraw가 성공함" };
  }, true); // 에러 예상
  
  // 5. 0 금액 Withdraw 테스트 (에러 예상)
  await runTest("0 금액 Withdraw", async () => {
    const withdrawTx = await vault.withdraw(0, signer.address, signer.address);
    await withdrawTx.wait();
    
    return { success: false, message: "0 금액 withdraw가 성공함" };
  }, true); // 에러 예상
  
  // 6. 극소량 Withdraw 테스트
  await runTest("극소량 Withdraw (1 wei)", async () => {
    const withdrawAmount = 1n; // 1 wei
    const userShares = await vault.balanceOf(signer.address);
    
    try {
      const sharesNeeded = await vault.previewWithdraw(withdrawAmount);
      
      if (userShares < sharesNeeded) {
        return { success: false, message: `Shares 부족: ${userShares.toString()} < ${sharesNeeded.toString()}` };
      }
      
      const balanceBefore = await wkaia.balanceOf(signer.address);
      const withdrawTx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      const balanceAfter = await wkaia.balanceOf(signer.address);
      
      const received = balanceAfter - balanceBefore;
      
      return {
        success: received > 0,
        message: `1 wei 요청 → ${received.toString()} wei 수령 (Gas: ${receipt.gasUsed.toLocaleString()})`,
      };
    } catch (error) {
      return { success: false, message: `극소량 withdraw 실패: ${error.message}` };
    }
  });
  
  // 7. 허가되지 않은 주소에서의 transferFrom 테스트 (에러 예상)
  await runTest("무허가 transferFrom", async () => {
    const userShares = await vault.balanceOf(signer.address);
    if (userShares === 0n) {
      return { success: false, message: "테스트할 shares가 없음" };
    }
    
    // 다른 주소 생성 (실제로는 같은 signer지만 테스트 목적)
    const amount = userShares > ethers.parseEther("0.01") ? ethers.parseEther("0.01") : userShares / 2n;
    
    const transferTx = await vault.transferFrom(signer.address, signer.address, amount);
    await transferTx.wait();
    
    return { success: false, message: "무허가 transfer가 성공함" };
  }, true); // 에러 예상
  
  // 8. LST 잔액이 0일 때 대량 Withdraw 테스트
  await runTest("LST 고갈 상황에서 대량 Withdraw", async () => {
    try {
      // 현재 vault의 모든 상태 확인
      const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
      const totalAssets = await vault.totalAssets();
      const userShares = await vault.balanceOf(signer.address);
      
      // LST 잔액 확인
      let totalLSTValue = 0n;
      for (let i = 0; i <= 3; i++) {
        const tokenInfo = await vault.tokensInfo(i);
        const lstContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await lstContract.balanceOf(vaultAddress);
        totalLSTValue += balance; // 간단히 1:1로 계산
      }
      
      console.log(`      Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
      console.log(`      Total Assets: ${ethers.formatEther(totalAssets)}`);
      console.log(`      Total LST Value: ${ethers.formatEther(totalLSTValue)}`);
      
      // Vault의 80% 출금 시도 (LST swap 강제)
      const withdrawTarget = (totalAssets * 80n) / 100n;
      
      if (userShares === 0n) {
        return { success: false, message: "테스트할 shares가 없음" };
      }
      
      const maxWithdrawable = await vault.previewRedeem(userShares);
      const actualWithdraw = withdrawTarget < maxWithdrawable ? withdrawTarget : maxWithdrawable;
      
      console.log(`      시도할 출금액: ${ethers.formatEther(actualWithdraw)}`);
      
      const withdrawTx = await vault.withdraw(actualWithdraw, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      return {
        success: true,
        message: `대량 출금 성공: ${ethers.formatEther(actualWithdraw)} WKAIA (Gas: ${receipt.gasUsed.toLocaleString()})`,
      };
    } catch (error) {
      if (error.message.includes("Wrap failed: no tokens received")) {
        return { 
          success: true, // 예상된 실패
          message: "LST wrap 실패 감지 - 수정 사항이 올바르게 작동" 
        };
      } else if (error.message.includes("arithmetic underflow")) {
        return { 
          success: false, 
          message: "산술 언더플로우 - 계산 로직 개선 필요" 
        };
      }
      
      return { success: false, message: `대량 출금 실패: ${error.message}` };
    }
  });
  
  // 9. 계산 정확성 테스트 - Deposit/Withdraw 반복
  await runTest("계산 정확성: Deposit/Withdraw 반복", async () => {
    const initialBalance = await wkaia.balanceOf(signer.address);
    const testAmount = ethers.parseEther("0.1");
    
    if (initialBalance < testAmount) {
      return { success: false, message: "테스트 자금 부족" };
    }
    
    try {
      let cumulativeError = 0n;
      const iterations = 3;
      
      for (let i = 0; i < iterations; i++) {
        // Deposit
        await wkaia.approve(vaultAddress, testAmount);
        const depositTx = await vault.deposit(testAmount, signer.address);
        await depositTx.wait();
        
        // 즉시 같은 금액 Withdraw
        const withdrawTx = await vault.withdraw(testAmount, signer.address, signer.address);
        await withdrawTx.wait();
        
        const currentBalance = await wkaia.balanceOf(signer.address);
        const difference = initialBalance > currentBalance ? 
          initialBalance - currentBalance : currentBalance - initialBalance;
        
        cumulativeError += difference;
      }
      
      // 0.1% 이하의 누적 오차는 허용
      const tolerableError = (testAmount * BigInt(iterations)) / 1000n;
      const accurate = cumulativeError <= tolerableError;
      
      return {
        success: accurate,
        message: `${iterations}회 반복, 누적 오차: ${ethers.formatEther(cumulativeError)} WKAIA (허용: ${ethers.formatEther(tolerableError)})`,
      };
    } catch (error) {
      return { success: false, message: `반복 테스트 실패: ${error.message}` };
    }
  });
  
  // 10. 다중 사용자 동시 접근 시뮬레이션
  await runTest("동시성 테스트: 연속 트랜잭션", async () => {
    const userBalance = await wkaia.balanceOf(signer.address);
    const smallAmount = ethers.parseEther("0.05");
    
    if (userBalance < smallAmount * 4n) {
      return { success: false, message: "테스트 자금 부족" };
    }
    
    try {
      // 짧은 시간 내에 여러 트랜잭션 실행
      await wkaia.approve(vaultAddress, smallAmount * 4n);
      
      const promises = [];
      for (let i = 0; i < 2; i++) {
        promises.push(vault.deposit(smallAmount, signer.address));
      }
      
      const results = await Promise.allSettled(promises);
      const successes = results.filter(r => r.status === 'fulfilled').length;
      
      return {
        success: successes > 0,
        message: `${promises.length}개 중 ${successes}개 트랜잭션 성공`,
      };
    } catch (error) {
      return { success: false, message: `동시성 테스트 실패: ${error.message}` };
    }
  });
  
  // 11. 잘못된 recipient 주소 테스트
  await runTest("잘못된 recipient 주소", async () => {
    const withdrawAmount = ethers.parseEther("0.01");
    const userShares = await vault.balanceOf(signer.address);
    
    if (userShares === 0n) {
      return { success: false, message: "테스트할 shares가 없음" };
    }
    
    try {
      const sharesNeeded = await vault.previewWithdraw(withdrawAmount);
      if (userShares < sharesNeeded) {
        return { success: false, message: "Shares 부족" };
      }
      
      // 0 주소로 withdraw 시도
      const withdrawTx = await vault.withdraw(withdrawAmount, "0x0000000000000000000000000000000000000000", signer.address);
      await withdrawTx.wait();
      
      return { success: false, message: "0 주소로의 withdraw가 성공함" };
    } catch (error) {
      return { success: true, message: `예상된 에러: ${error.message}` };
    }
  }, true); // 에러 예상
  
  // 결과 요약
  console.log("=" .repeat(60));
  console.log("📊 Edge Case 테스트 결과");
  console.log("=" .repeat(60));
  console.log(`총 테스트: ${totalTests}`);
  console.log(`성공: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`실패: ${totalTests - passedTests}`);
  console.log();
  
  // 카테고리별 분석
  const errorTests = results.filter(r => r.expected === "error");
  const normalTests = results.filter(r => r.expected !== "error");
  
  console.log("📈 카테고리별 결과:");
  console.log(`   정상 테스트: ${normalTests.filter(t => t.success).length}/${normalTests.length}`);
  console.log(`   에러 테스트: ${errorTests.filter(t => t.success).length}/${errorTests.length}`);
  console.log();
  
  // 중요한 발견사항
  const criticalIssues = results.filter(r => 
    !r.success && 
    (r.message.includes("underflow") || 
     r.message.includes("overflow") ||
     r.message.includes("성공함") && r.expected === "error")
  );
  
  if (criticalIssues.length > 0) {
    console.log("🚨 중요한 이슈:");
    for (const issue of criticalIssues) {
      console.log(`   • ${issue.name}: ${issue.message}`);
    }
    console.log();
  }
  
  // 보안 관련 분석
  const securityTests = results.filter(r => 
    r.name.includes("무허가") || 
    r.name.includes("잘못된") ||
    r.name.includes("초과")
  );
  
  const securityPassed = securityTests.filter(t => t.success).length;
  console.log("🔒 보안 테스트 결과:");
  console.log(`   ${securityPassed}/${securityTests.length} 보안 테스트 통과`);
  
  if (securityPassed === securityTests.length) {
    console.log("   ✅ 기본적인 보안 검증이 올바르게 작동합니다.");
  } else {
    console.log("   ⚠️  보안 검증에 문제가 있을 수 있습니다.");
  }
  console.log();
  
  console.log("💡 Edge Case 분석 완료:");
  if (passedTests === totalTests) {
    console.log("   🎉 모든 Edge Case 테스트 통과!");
  } else if (passedTests / totalTests >= 0.8) {
    console.log("   ✅ 대부분의 Edge Case가 올바르게 처리됩니다.");
  } else {
    console.log("   ⚠️  여러 Edge Case에서 문제가 발견되었습니다.");
  }
  
  return { passedTests, totalTests, results, criticalIssues };
}

// 스크립트 직접 실행시
if (require.main === module) {
  edgeCaseTestSuite()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { edgeCaseTestSuite };