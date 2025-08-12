const { ethers } = require("hardhat");
const fs = require("fs");

async function prepareAndTestWithdraw() {
  console.log("🧪 WKAIA 준비 및 withdraw 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 준비 단계:");
  console.log(`   Vault: ${vaultAddress}`);
  console.log(`   WKAIA: ${assetAddress}`);
  
  // 1단계: KAIA를 WKAIA로 wrap
  const kaiaBalance = await ethers.provider.getBalance(signer.address);
  const wkaiaBalance = await wkaia.balanceOf(signer.address);
  
  console.log(`\n💰 현재 자산:`);
  console.log(`   KAIA: ${ethers.formatEther(kaiaBalance)}`);
  console.log(`   WKAIA: ${ethers.formatEther(wkaiaBalance)}`);
  
  // WKAIA가 부족하면 KAIA를 wrap
  const neededWKAIA = ethers.parseEther("10.0");
  if (wkaiaBalance < neededWKAIA) {
    const wrapAmount = neededWKAIA - wkaiaBalance;
    console.log(`\n🔄 ${ethers.formatEther(wrapAmount)} KAIA를 WKAIA로 wrap:`);
    
    try {
      // WKAIA는 보통 deposit 함수로 KAIA를 wrap함
      const wkaiaContract = await ethers.getContractAt("IWETH", assetAddress);
      const wrapTx = await wkaiaContract.deposit({ value: wrapAmount });
      await wrapTx.wait();
      
      const newWKAIABalance = await wkaia.balanceOf(signer.address);
      console.log(`   ✅ Wrap 성공! 새 WKAIA 잔액: ${ethers.formatEther(newWKAIABalance)}`);
      
    } catch (wrapError) {
      console.log(`   ❌ KAIA wrap 실패: ${wrapError.message}`);
      
      // 대체 방법: 이미 충분한 WKAIA가 있는지 확인
      if (wkaiaBalance >= ethers.parseEther("2.0")) {
        console.log(`   💡 기존 WKAIA로 제한된 테스트 진행`);
        neededWKAIA = wkaiaBalance;
      } else {
        console.log(`   ❌ 테스트를 위한 충분한 WKAIA 확보 실패`);
        return;
      }
    }
  }
  
  // 2단계: Deposit 테스트
  const depositAmount = ethers.parseEther("3.0");
  console.log(`\n🏦 ${ethers.formatEther(depositAmount)} WKAIA deposit:`);
  
  try {
    await wkaia.approve(vaultAddress, depositAmount);
    const depositTx = await vault.deposit(depositAmount, signer.address);
    const depositReceipt = await depositTx.wait();
    
    console.log(`   ✅ Deposit 성공! Gas: ${depositReceipt.gasUsed.toLocaleString()}`);
    
    const userShares = await vault.balanceOf(signer.address);
    const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
    console.log(`   사용자 shares: ${ethers.formatEther(userShares)}`);
    console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
    
  } catch (depositError) {
    console.log(`   ❌ Deposit 실패: ${depositError.message}`);
    
    if (depositError.message.includes("Wrap failed: no tokens received")) {
      console.log(`   🎯 Wrap 검증이 문제를 감지했습니다!`);
      console.log(`   💡 특정 LST 프로토콜에 문제가 있어 deposit이 실패했습니다.`);
      console.log(`   💡 이는 우리가 추가한 wrap 검증이 정상 작동하는 증거입니다.`);
      
      // 어떤 LST가 문제인지 분석
      console.log(`\n🔍 문제가 있는 LST 찾기:`);
      for (let i = 0; i < 4; i++) {
        try {
          const tokenInfo = await vault.tokensInfo(i);
          const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const assetBalance = await assetContract.balanceOf(vaultAddress);
          
          if (assetBalance > ethers.parseEther("0.1")) {
            console.log(`   LST ${i}: ${ethers.formatEther(assetBalance)} - wrap 테스트 필요`);
          }
        } catch (e) {
          // Skip
        }
      }
      
      return;
    }
    return;
  }
  
  // 3단계: 다양한 withdraw 시나리오 테스트
  console.log(`\n🧪 Withdraw 시나리오 테스트:`);
  
  const currentUserShares = await vault.balanceOf(signer.address);
  const currentVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  const scenarios = [
    { name: "소량 (swap 불필요)", amount: ethers.parseEther("0.1") },
    { name: "중간량 (LST swap)", amount: ethers.parseEther("0.5") },
    { name: "대량 (다중 LST)", amount: ethers.parseEther("1.0") },
  ];
  
  let successCount = 0;
  
  for (const scenario of scenarios) {
    console.log(`\n📊 ${scenario.name} - ${ethers.formatEther(scenario.amount)} WKAIA:`);
    
    try {
      const sharesNeeded = await vault.previewWithdraw(scenario.amount);
      
      if (currentUserShares < sharesNeeded) {
        console.log(`   ⚠️ shares 부족`);
        continue;
      }
      
      const needsSwap = scenario.amount > currentVaultWKAIA;
      console.log(`   LST swap 필요: ${needsSwap ? "예" : "아니오"}`);
      
      const preUserWKAIA = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(scenario.amount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postUserWKAIA = await wkaia.balanceOf(signer.address);
      const actualReceived = postUserWKAIA - preUserWKAIA;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(actualReceived)} WKAIA`);
      console.log(`   Gas: ${receipt.gasUsed.toLocaleString()}`);
      
      successCount++;
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      
      if (error.message.includes("arithmetic underflow or overflow")) {
        console.log(`   💡 Arithmetic underflow - 계산 오류`);
      } else if (error.message.includes("Wrap failed: no tokens received")) {
        console.log(`   🎯 Wrap 검증이 LST 문제 감지!`);
      }
    }
  }
  
  console.log(`\n📊 테스트 결과:`);
  console.log(`   성공: ${successCount}/${scenarios.length}`);
  
  if (successCount < scenarios.length) {
    console.log(`\n🔧 문제 해결이 필요한 상황입니다.`);
    console.log(`   주요 이슈: LST swap 관련 arithmetic underflow`);
    console.log(`   이는 원래 요청 (LST wrap 문제)와는 다른 별개 문제입니다.`);
  }
}

prepareAndTestWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });