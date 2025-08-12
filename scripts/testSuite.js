const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * 통합 테스트 스위트: 컨트랙트 배포 후 deposit/withdraw 검증
 * - 컨트랙트 배포 및 설정 확인
 * - 기본 deposit/withdraw 기능 테스트
 * - 다양한 시나리오 및 에러 케이스 검증
 */

async function testSuite() {
  console.log("🧪 KommuneFi Vault 통합 테스트 스위트 시작");
  console.log("=" .repeat(60));
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  
  // 배포 파일 존재 확인
  if (!fs.existsSync(deploymentFile)) {
    console.log(`❌ 배포 파일을 찾을 수 없습니다: ${deploymentFile}`);
    console.log(`먼저 컨트랙트를 배포하세요: npx hardhat run scripts/deploy.js --network ${networkName}`);
    return;
  }
  
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  if (!vaultAddress) {
    console.log("❌ KVaultV2 주소를 찾을 수 없습니다");
    return;
  }
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 테스트 환경:");
  console.log(`   네트워크: ${networkName}`);
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   WKAIA (asset): ${assetAddress}`);
  console.log(`   테스터: ${signer.address}`);
  console.log();
  
  let passedTests = 0;
  let totalTests = 0;
  const results = [];
  
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
    } catch (error) {
      console.log(`   💥 예외 발생: ${error.message}`);
      results.push({ name: testName, success: false, message: error.message });
    }
    console.log();
  }
  
  // 1. 컨트랙트 상태 검증
  await runTest("컨트랙트 배포 상태 확인", async () => {
    try {
      const totalSupply = await vault.totalSupply();
      const totalAssets = await vault.totalAssets();
      const asset = await vault.asset();
      
      return {
        success: true,
        message: `Total Supply: ${ethers.formatEther(totalSupply)}, Total Assets: ${ethers.formatEther(totalAssets)}, Asset: ${asset}`,
        data: { totalSupply, totalAssets, asset }
      };
    } catch (error) {
      return { success: false, message: `컨트랙트 호출 실패: ${error.message}` };
    }
  });
  
  // 2. 사용자 초기 잔액 확인
  await runTest("사용자 초기 잔액 확인", async () => {
    const userWKAIA = await wkaia.balanceOf(signer.address);
    const userShares = await vault.balanceOf(signer.address);
    
    return {
      success: true,
      message: `WKAIA: ${ethers.formatEther(userWKAIA)}, Shares: ${ethers.formatEther(userShares)}`,
      data: { userWKAIA, userShares }
    };
  });
  
  // 3. LST 토큰 상태 확인
  await runTest("LST 토큰 설정 확인", async () => {
    try {
      const lstInfo = [];
      const lstNames = ['KoKAIA', 'GCKAIA', 'stKLAY', 'stKAIA'];
      
      for (let i = 0; i <= 3; i++) {
        const tokenInfo = await vault.tokensInfo(i);
        const lstContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const vaultBalance = await lstContract.balanceOf(vaultAddress);
        
        lstInfo.push({
          index: i,
          name: lstNames[i],
          address: tokenInfo.asset,
          threshold: ethers.formatEther(tokenInfo.threshold),
          vaultBalance: ethers.formatEther(vaultBalance)
        });
      }
      
      return {
        success: true,
        message: `${lstInfo.length}개 LST 토큰 확인됨`,
        data: lstInfo
      };
    } catch (error) {
      return { success: false, message: `LST 정보 조회 실패: ${error.message}` };
    }
  });
  
  // 4. 소액 Deposit 테스트
  await runTest("소액 Deposit 테스트 (0.1 WKAIA)", async () => {
    const depositAmount = ethers.parseEther("0.1");
    const userWKAIA = await wkaia.balanceOf(signer.address);
    
    if (userWKAIA < depositAmount) {
      return { success: false, message: `WKAIA 잔액 부족: ${ethers.formatEther(userWKAIA)}` };
    }
    
    try {
      const preShares = await vault.balanceOf(signer.address);
      
      // Approve 및 Deposit
      await wkaia.approve(vaultAddress, depositAmount);
      const depositTx = await vault.deposit(depositAmount, signer.address);
      const receipt = await depositTx.wait();
      
      const postShares = await vault.balanceOf(signer.address);
      const sharesMinted = postShares - preShares;
      
      if (sharesMinted > 0) {
        return {
          success: true,
          message: `${ethers.formatEther(sharesMinted)} shares 발행됨 (Gas: ${receipt.gasUsed.toLocaleString()})`,
          data: { sharesMinted, gasUsed: receipt.gasUsed }
        };
      } else {
        return { success: false, message: "Shares가 발행되지 않음" };
      }
    } catch (error) {
      if (error.message.includes("Wrap failed: no tokens received")) {
        return { 
          success: false, 
          message: "Wrap 실패 감지 - LST 프로토콜 이슈 (수정 사항이 올바르게 작동 중)" 
        };
      }
      return { success: false, message: `Deposit 실패: ${error.message}` };
    }
  });
  
  // 5. 소액 Withdraw 테스트
  await runTest("소액 Withdraw 테스트 (0.05 WKAIA)", async () => {
    const withdrawAmount = ethers.parseEther("0.05");
    const userShares = await vault.balanceOf(signer.address);
    
    try {
      const sharesNeeded = await vault.previewWithdraw(withdrawAmount);
      
      if (userShares < sharesNeeded) {
        return { success: false, message: `Shares 부족: 보유 ${ethers.formatEther(userShares)}, 필요 ${ethers.formatEther(sharesNeeded)}` };
      }
      
      const preBalance = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(withdrawAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      // 5% 허용 오차로 검증
      const tolerance = withdrawAmount * 5n / 100n;
      if (received >= withdrawAmount - tolerance) {
        return {
          success: true,
          message: `${ethers.formatEther(received)} WKAIA 수령 (Gas: ${receipt.gasUsed.toLocaleString()})`,
          data: { received, gasUsed: receipt.gasUsed }
        };
      } else {
        return { 
          success: false, 
          message: `수령액 부족: 예상 ${ethers.formatEther(withdrawAmount)}, 실제 ${ethers.formatEther(received)}` 
        };
      }
    } catch (error) {
      return { success: false, message: `Withdraw 실패: ${error.message}` };
    }
  });
  
  // 결과 요약
  console.log("=" .repeat(60));
  console.log("📊 테스트 결과 요약");
  console.log("=" .repeat(60));
  console.log(`총 테스트: ${totalTests}`);
  console.log(`성공: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`실패: ${totalTests - passedTests}`);
  console.log();
  
  // 상세 결과
  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${result.name}`);
    if (!result.success && result.message) {
      console.log(`   → ${result.message}`);
    }
  }
  
  console.log();
  if (passedTests === totalTests) {
    console.log("🎉 모든 기본 테스트 통과! 고급 테스트를 실행하세요:");
    console.log("   npx hardhat run scripts/advancedTestSuite.js --network kairos");
  } else {
    console.log("⚠️  일부 테스트 실패. 컨트랙트 상태를 확인하세요.");
  }
  
  return { passedTests, totalTests, results };
}

// 스크립트 직접 실행시
if (require.main === module) {
  testSuite()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testSuite };