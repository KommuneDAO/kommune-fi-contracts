const { ethers } = require("hardhat");
const fs = require("fs");

async function minimalWithdrawTest() {
  console.log("🔬 최소한의 withdrawal 테스트 - 기본 문제 격리");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 기본 정보:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   WKAIA: ${assetAddress}`);
  console.log(`   User: ${signer.address}`);
  
  // 현재 상태 확인
  const userShares = await vault.balanceOf(signer.address);
  const userWKAIA = await wkaia.balanceOf(signer.address);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const totalShares = await vault.totalSupply();
  
  console.log(`\n📊 현재 상태:`);
  console.log(`   사용자 shares: ${ethers.formatEther(userShares)}`);
  console.log(`   사용자 WKAIA: ${ethers.formatEther(userWKAIA)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  console.log(`   Total shares: ${ethers.formatEther(totalShares)}`);
  
  if (userShares === 0n) {
    console.log("\n⚠️ 사용자 shares가 없습니다. 먼저 deposit이 필요합니다.");
    return;
  }
  
  // 1. 가장 작은 withdrawal 시도 (0.01 WKAIA)
  console.log(`\n🧪 Test 1: 0.01 WKAIA withdrawal (최소량)`);
  const minAmount = ethers.parseEther("0.01");
  
  try {
    // Preview 먼저 확인
    const sharesNeeded = await vault.previewWithdraw(minAmount);
    console.log(`   필요한 shares: ${ethers.formatEther(sharesNeeded)}`);
    
    if (userShares < sharesNeeded) {
      console.log(`   ❌ Shares 부족 - 건너뜀`);
    } else {
      const preBalance = await wkaia.balanceOf(signer.address);
      
      console.log(`   실행 전 WKAIA: ${ethers.formatEther(preBalance)}`);
      
      const withdrawTx = await vault.withdraw(minAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
    }
    
  } catch (error) {
    console.log(`   ❌ 실패: ${error.message}`);
    
    // 상세 오류 분석
    if (error.message.includes("execution reverted")) {
      console.log(`   💡 Transaction reverted - 컨트랙트 내부 오류`);
      
      // 구체적인 revert reason 찾기
      if (error.message.includes("Wrap failed")) {
        console.log(`   🎯 Wrap 검증이 문제를 감지했습니다`);
      } else if (error.message.includes("arithmetic underflow")) {
        console.log(`   🔢 Arithmetic underflow 발생`);
      } else if (error.message.includes("insufficient")) {
        console.log(`   💰 잔액 부족`);
      } else {
        console.log(`   🔍 정확한 오류 원인을 찾기 위해 detailed debug 필요`);
      }
    }
    
    return; // 첫 번째 테스트가 실패하면 더 진행하지 않음
  }
  
  // 2. Preview vs actual test
  console.log(`\n🧪 Test 2: Preview vs Actual 검증`);
  const testAmount = ethers.parseEther("0.05");
  
  try {
    const previewShares = await vault.previewWithdraw(testAmount);
    const previewAssets = await vault.previewRedeem(previewShares);
    
    console.log(`   Preview withdraw ${ethers.formatEther(testAmount)} → shares: ${ethers.formatEther(previewShares)}`);
    console.log(`   Preview redeem ${ethers.formatEther(previewShares)} → assets: ${ethers.formatEther(previewAssets)}`);
    
    if (previewAssets !== testAmount) {
      console.log(`   ⚠️ Preview 불일치! 예상: ${ethers.formatEther(testAmount)}, 실제: ${ethers.formatEther(previewAssets)}`);
    } else {
      console.log(`   ✅ Preview 일치`);
    }
    
  } catch (previewError) {
    console.log(`   ❌ Preview 실패: ${previewError.message}`);
  }
  
  // 3. Vault state verification
  console.log(`\n🧪 Test 3: Vault 상태 검증`);
  
  try {
    // LST balances 확인
    console.log(`   LST 잔액 확인:`);
    for (let i = 0; i < 4; i++) {
      try {
        const tokenInfo = await vault.tokensInfo(i);
        const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await assetContract.balanceOf(vaultAddress);
        console.log(`   LST ${i}: ${ethers.formatEther(balance)} ${tokenInfo.asset}`);
      } catch (e) {
        console.log(`   LST ${i}: 조회 실패`);
      }
    }
    
    // Total assets 확인
    const totalAssets = await vault.totalAssets();
    console.log(`   총 자산: ${ethers.formatEther(totalAssets)} WKAIA`);
    
    // Exchange rate 확인
    if (totalShares > 0) {
      const exchangeRate = (totalAssets * ethers.parseEther("1")) / totalShares;
      console.log(`   Exchange rate: ${ethers.formatEther(exchangeRate)} WKAIA per share`);
    }
    
  } catch (stateError) {
    console.log(`   ❌ 상태 확인 실패: ${stateError.message}`);
  }
  
  console.log(`\n📋 진단 결과:`);
  console.log(`   1. 첫 번째 최소 withdrawal이 성공하면 기본 로직은 정상`);
  console.log(`   2. 실패하면 근본적인 문제가 있음`);
  console.log(`   3. Preview 불일치는 계산 로직 문제`);
  console.log(`   4. LST 잔액 문제는 wrap/swap 관련 이슈`);
}

minimalWithdrawTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });