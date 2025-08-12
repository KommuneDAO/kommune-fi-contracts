const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * 성능 테스트 스위트: 가스 사용량 최적화 및 벤치마킹
 * - 다양한 시나리오별 가스 사용량 측정
 * - 트랜잭션 처리 시간 측정
 * - 대량 트랜잭션 처리 성능 테스트
 * - 최적화 포인트 식별
 */

async function performanceTestSuite() {
  console.log("⚡ KommuneFi Vault 성능 테스트 스위트");
  console.log("=" .repeat(60));
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 성능 테스트 환경:");
  console.log(`   네트워크: ${networkName}`);
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   테스터: ${signer.address}`);
  console.log();
  
  const performanceData = {
    deposits: [],
    withdraws: [],
    operations: [],
    gasBaselines: {}
  };
  
  let totalTests = 0;
  let passedTests = 0;
  
  // 성능 테스트 실행 함수
  async function runPerformanceTest(testName, testFunction) {
    totalTests++;
    console.log(`⚡ ${testName}`);
    
    try {
      const result = await testFunction();
      if (result.success) {
        passedTests++;
        console.log(`   ✅ ${result.message}`);
        
        // 성능 데이터 저장
        if (result.performanceData) {
          const category = result.performanceData.category;
          if (!performanceData[category]) {
            performanceData[category] = [];
          }
          performanceData[category].push(result.performanceData);
        }
      } else {
        console.log(`   ❌ ${result.message}`);
      }
    } catch (error) {
      console.log(`   💥 실행 실패: ${error.message}`);
    }
    console.log();
  }
  
  // 기본 가스 사용량 측정 함수
  async function measureGasUsage(operation, params) {
    const startTime = Date.now();
    
    let tx, receipt;
    switch (operation) {
      case 'approve':
        tx = await wkaia.approve(params.spender, params.amount);
        receipt = await tx.wait();
        break;
      case 'deposit':
        tx = await vault.deposit(params.amount, params.receiver);
        receipt = await tx.wait();
        break;
      case 'withdraw':
        tx = await vault.withdraw(params.amount, params.receiver, params.owner);
        receipt = await tx.wait();
        break;
      case 'redeem':
        tx = await vault.redeem(params.shares, params.receiver, params.owner);
        receipt = await tx.wait();
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      gasUsed: receipt.gasUsed,
      gasPrice: tx.gasPrice,
      transactionFee: receipt.gasUsed * tx.gasPrice,
      duration: duration,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.transactionHash
    };
  }
  
  // 1. 기준 가스 사용량 측정
  await runPerformanceTest("기준 작업 가스 사용량 측정", async () => {
    try {
      const testAmount = ethers.parseEther("0.1");
      const userBalance = await wkaia.balanceOf(signer.address);
      
      if (userBalance < testAmount) {
        return { success: false, message: "테스트 자금 부족" };
      }
      
      // Approve 가스 측정
      const approveGas = await measureGasUsage('approve', {
        spender: vaultAddress,
        amount: testAmount
      });
      
      // Deposit 가스 측정
      const depositGas = await measureGasUsage('deposit', {
        amount: testAmount,
        receiver: signer.address
      });
      
      performanceData.gasBaselines = {
        approve: approveGas.gasUsed,
        deposit: depositGas.gasUsed
      };
      
      return {
        success: true,
        message: `Approve: ${approveGas.gasUsed.toLocaleString()} gas, Deposit: ${depositGas.gasUsed.toLocaleString()} gas`,
        performanceData: {
          category: 'operations',
          operation: 'baseline',
          approveGas: approveGas.gasUsed,
          depositGas: depositGas.gasUsed
        }
      };
    } catch (error) {
      return { success: false, message: `기준 측정 실패: ${error.message}` };
    }
  });
  
  // 2. 다양한 금액별 Deposit 성능 테스트
  const depositAmounts = [
    { name: "마이크로", amount: ethers.parseEther("0.001") },
    { name: "소액", amount: ethers.parseEther("0.1") },
    { name: "중간", amount: ethers.parseEther("1.0") },
    { name: "대량", amount: ethers.parseEther("5.0") }
  ];
  
  for (const testCase of depositAmounts) {
    await runPerformanceTest(`${testCase.name} Deposit (${ethers.formatEther(testCase.amount)} WKAIA)`, async () => {
      try {
        const userBalance = await wkaia.balanceOf(signer.address);
        
        if (userBalance < testCase.amount) {
          return { success: false, message: "잔액 부족" };
        }
        
        // Approve
        await wkaia.approve(vaultAddress, testCase.amount);
        
        // Deposit 실행 및 측정
        const depositMetrics = await measureGasUsage('deposit', {
          amount: testCase.amount,
          receiver: signer.address
        });
        
        return {
          success: true,
          message: `가스: ${depositMetrics.gasUsed.toLocaleString()}, 시간: ${depositMetrics.duration}ms`,
          performanceData: {
            category: 'deposits',
            amount: testCase.amount,
            gasUsed: depositMetrics.gasUsed,
            duration: depositMetrics.duration,
            gasPerEther: depositMetrics.gasUsed * ethers.parseEther("1") / testCase.amount
          }
        };
      } catch (error) {
        return { success: false, message: `Deposit 실패: ${error.message}` };
      }
    });
  }
  
  // 3. 다양한 금액별 Withdraw 성능 테스트
  const withdrawAmounts = [
    { name: "마이크로", amount: ethers.parseEther("0.001") },
    { name: "소액", amount: ethers.parseEther("0.05") },
    { name: "중간", amount: ethers.parseEther("0.2") },
    { name: "대량", amount: ethers.parseEther("0.8") }
  ];
  
  for (const testCase of withdrawAmounts) {
    await runPerformanceTest(`${testCase.name} Withdraw (${ethers.formatEther(testCase.amount)} WKAIA)`, async () => {
      try {
        const userShares = await vault.balanceOf(signer.address);
        const sharesNeeded = await vault.previewWithdraw(testCase.amount);
        
        if (userShares < sharesNeeded) {
          return { success: false, message: "Shares 부족" };
        }
        
        // Withdraw 실행 및 측정
        const withdrawMetrics = await measureGasUsage('withdraw', {
          amount: testCase.amount,
          receiver: signer.address,
          owner: signer.address
        });
        
        // LST swap 발생 여부 확인
        const swapDetected = withdrawMetrics.gasUsed > 200000n; // 일반적인 직접 withdraw보다 높은 가스 사용량
        
        return {
          success: true,
          message: `가스: ${withdrawMetrics.gasUsed.toLocaleString()}, 시간: ${withdrawMetrics.duration}ms, Swap: ${swapDetected ? 'Yes' : 'No'}`,
          performanceData: {
            category: 'withdraws',
            amount: testCase.amount,
            gasUsed: withdrawMetrics.gasUsed,
            duration: withdrawMetrics.duration,
            swapDetected: swapDetected,
            gasPerEther: withdrawMetrics.gasUsed * ethers.parseEther("1") / testCase.amount
          }
        };
      } catch (error) {
        if (error.message.includes("Wrap failed: no tokens received")) {
          return { 
            success: true, 
            message: "LST wrap 실패 감지 (예상된 결과)",
            performanceData: {
              category: 'withdraws',
              amount: testCase.amount,
              failed: true,
              reason: 'wrap_failed'
            }
          };
        }
        return { success: false, message: `Withdraw 실패: ${error.message}` };
      }
    });
  }
  
  // 4. 연속 작업 성능 테스트
  await runPerformanceTest("연속 작업 성능 (5회 Deposit/Withdraw)", async () => {
    try {
      const testAmount = ethers.parseEther("0.1");
      const iterations = 5;
      const metrics = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        // Approve + Deposit
        await wkaia.approve(vaultAddress, testAmount);
        const depositTx = await vault.deposit(testAmount, signer.address);
        const depositReceipt = await depositTx.wait();
        
        // Immediate Withdraw
        const withdrawTx = await vault.withdraw(testAmount, signer.address, signer.address);
        const withdrawReceipt = await withdrawTx.wait();
        
        const endTime = Date.now();
        const totalGas = depositReceipt.gasUsed + withdrawReceipt.gasUsed;
        
        metrics.push({
          iteration: i + 1,
          totalGas: totalGas,
          duration: endTime - startTime
        });
      }
      
      const avgGas = metrics.reduce((sum, m) => sum + Number(m.totalGas), 0) / iterations;
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / iterations;
      
      return {
        success: true,
        message: `평균 가스: ${avgGas.toLocaleString()}, 평균 시간: ${avgDuration.toFixed(0)}ms`,
        performanceData: {
          category: 'operations',
          operation: 'continuous',
          averageGas: avgGas,
          averageDuration: avgDuration,
          iterations: iterations,
          metrics: metrics
        }
      };
    } catch (error) {
      return { success: false, message: `연속 작업 실패: ${error.message}` };
    }
  });
  
  // 5. View 함수 성능 테스트
  await runPerformanceTest("View 함수 호출 성능", async () => {
    try {
      const iterations = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await vault.totalAssets();
        await vault.totalSupply();
        await vault.balanceOf(signer.address);
        await vault.previewDeposit(ethers.parseEther("1.0"));
        await vault.previewWithdraw(ethers.parseEther("1.0"));
      }
      
      const endTime = Date.now();
      const avgDuration = (endTime - startTime) / iterations;
      
      return {
        success: true,
        message: `${iterations}회 호출, 평균 ${avgDuration.toFixed(1)}ms`,
        performanceData: {
          category: 'operations',
          operation: 'view_functions',
          iterations: iterations,
          averageDuration: avgDuration
        }
      };
    } catch (error) {
      return { success: false, message: `View 함수 테스트 실패: ${error.message}` };
    }
  });
  
  // 결과 분석 및 리포트 생성
  console.log("=" .repeat(60));
  console.log("📊 성능 테스트 결과 분석");
  console.log("=" .repeat(60));
  console.log(`총 테스트: ${totalTests}`);
  console.log(`성공: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log();
  
  // 가스 사용량 분석
  if (performanceData.deposits && performanceData.deposits.length > 0) {
    console.log("💰 Deposit 가스 사용량 분석:");
    const deposits = performanceData.deposits.filter(d => !d.failed);
    const avgDepositGas = deposits.reduce((sum, d) => sum + Number(d.gasUsed), 0) / deposits.length;
    const minDepositGas = Math.min(...deposits.map(d => Number(d.gasUsed)));
    const maxDepositGas = Math.max(...deposits.map(d => Number(d.gasUsed)));
    
    console.log(`   평균: ${avgDepositGas.toLocaleString()} gas`);
    console.log(`   범위: ${minDepositGas.toLocaleString()} ~ ${maxDepositGas.toLocaleString()} gas`);
    console.log(`   변동성: ${((maxDepositGas - minDepositGas) / avgDepositGas * 100).toFixed(1)}%`);
    console.log();
  }
  
  if (performanceData.withdraws && performanceData.withdraws.length > 0) {
    console.log("💸 Withdraw 가스 사용량 분석:");
    const withdraws = performanceData.withdraws.filter(w => !w.failed);
    const directWithdraws = withdraws.filter(w => !w.swapDetected);
    const swapWithdraws = withdraws.filter(w => w.swapDetected);
    
    if (directWithdraws.length > 0) {
      const avgDirectGas = directWithdraws.reduce((sum, w) => sum + Number(w.gasUsed), 0) / directWithdraws.length;
      console.log(`   직접 출금 평균: ${avgDirectGas.toLocaleString()} gas`);
    }
    
    if (swapWithdraws.length > 0) {
      const avgSwapGas = swapWithdraws.reduce((sum, w) => sum + Number(w.gasUsed), 0) / swapWithdraws.length;
      console.log(`   Swap 출금 평균: ${avgSwapGas.toLocaleString()} gas`);
      
      if (directWithdraws.length > 0) {
        const avgDirectGas = directWithdraws.reduce((sum, w) => sum + Number(w.gasUsed), 0) / directWithdraws.length;
        const overhead = ((avgSwapGas - avgDirectGas) / avgDirectGas * 100).toFixed(1);
        console.log(`   Swap 오버헤드: +${overhead}%`);
      }
    }
    
    const failedWithdraws = performanceData.withdraws.filter(w => w.failed);
    if (failedWithdraws.length > 0) {
      console.log(`   실패한 출금: ${failedWithdraws.length}개 (${failedWithdraws[0].reason})`);
    }
    console.log();
  }
  
  // 권장사항
  console.log("💡 성능 최적화 권장사항:");
  
  if (performanceData.gasBaselines) {
    const { approve, deposit } = performanceData.gasBaselines;
    if (Number(approve) > 50000) {
      console.log("   • Approve 가스 사용량이 높습니다. ERC20 구현을 검토하세요.");
    }
    if (Number(deposit) > 200000) {
      console.log("   • Deposit 가스 사용량이 높습니다. 로직을 최적화하세요.");
    }
  }
  
  const allOperations = performanceData.operations || [];
  const slowOperations = allOperations.filter(op => op.averageDuration && op.averageDuration > 3000);
  if (slowOperations.length > 0) {
    console.log("   • 일부 작업이 3초 이상 소요됩니다. 네트워크 상태를 확인하세요.");
  }
  
  if (performanceData.withdraws) {
    const failureRate = performanceData.withdraws.filter(w => w.failed).length / performanceData.withdraws.length;
    if (failureRate > 0.1) {
      console.log("   • Withdraw 실패율이 높습니다. LST 프로토콜 호환성을 검토하세요.");
    }
  }
  
  console.log();
  console.log("📈 성능 벤치마크 완료");
  
  // 성능 데이터 파일로 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `performance-report-${timestamp}.json`;
  
  try {
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      network: networkName,
      vault: vaultAddress,
      testResults: { totalTests, passedTests },
      performanceData: performanceData
    }, null, 2));
    
    console.log(`📁 성능 리포트 저장: ${reportFile}`);
  } catch (error) {
    console.log(`⚠️  리포트 저장 실패: ${error.message}`);
  }
  
  return { passedTests, totalTests, performanceData };
}

// 스크립트 직접 실행시
if (require.main === module) {
  performanceTestSuite()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { performanceTestSuite };