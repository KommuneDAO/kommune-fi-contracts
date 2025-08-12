const { ethers } = require("hardhat");
const fs = require("fs");

async function thresholdTest() {
  console.log("📊 Withdrawal threshold 테스트 - LST swap 시작점 찾기");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 현재 Vault 상태:");
  
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const userShares = await vault.balanceOf(signer.address);
  const totalAssets = await vault.totalAssets();
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  console.log(`   총 자산: ${ethers.formatEther(totalAssets)}`);
  console.log(`   사용자 shares: ${ethers.formatEther(userShares)}`);
  
  console.log(`\n🔍 LST 잔액 확인:`);
  let totalLSTValue = 0n;
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const balance = await assetContract.balanceOf(vaultAddress);
      console.log(`   LST ${i}: ${ethers.formatEther(balance)}`);
      totalLSTValue += balance;
    } catch (e) {
      console.log(`   LST ${i}: 조회 실패`);
    }
  }
  
  console.log(`   총 LST 잔액: ${ethers.formatEther(totalLSTValue)}`);
  console.log(`   WKAIA threshold: ${ethers.formatEther(vaultWKAIA)} (이 이상 withdraw시 LST swap 필요)`);
  
  // 테스트 시나리오들 - threshold 주위 값들
  const testAmounts = [
    ethers.parseEther("0.05"),  // Very safe
    ethers.parseEther("0.08"),  // Near threshold
    ethers.parseEther("0.09"),  // Just above threshold - needs minimal LST swap
    ethers.parseEther("0.15"),  // Moderate LST swap
    ethers.parseEther("0.3"),   // Significant LST swap
  ];
  
  console.log(`\n🧪 Threshold 테스트 시나리오:`);
  
  for (let i = 0; i < testAmounts.length; i++) {
    const amount = testAmounts[i];
    const needsSwap = amount > vaultWKAIA;
    const swapRequired = needsSwap ? amount - vaultWKAIA : 0n;
    
    console.log(`\n${i+1}. ${ethers.formatEther(amount)} WKAIA withdrawal:`);
    console.log(`   LST swap 필요: ${needsSwap ? "예" : "아니오"}`);
    if (needsSwap) {
      console.log(`   필요한 swap 량: ${ethers.formatEther(swapRequired)} WKAIA`);
    }
    
    try {
      const sharesNeeded = await vault.previewWithdraw(amount);
      if (userShares < sharesNeeded) {
        console.log(`   ⚠️ Shares 부족 - 건너뜀`);
        continue;
      }
      
      const preBalance = await wkaia.balanceOf(signer.address);
      
      console.log(`   💵 실행 중...`);
      const withdrawTx = await vault.withdraw(amount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      const accuracy = (received * 100n) / amount;
      
      console.log(`   ✅ 성공! 받은: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   정확도: ${accuracy}%, Gas: ${receipt.gasUsed.toLocaleString()}`);
      
      // Update vault WKAIA for next test
      const newVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      if (newVaultWKAIA !== vaultWKAIA) {
        console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} → ${ethers.formatEther(newVaultWKAIA)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      
      if (error.message.includes("arithmetic underflow")) {
        console.log(`   💡 Arithmetic underflow - LST swap 계산 오류`);
      } else if (error.message.includes("Wrap failed")) {
        console.log(`   🎯 Wrap 검증이 LST 문제를 감지`);
      } else if (error.message.includes("execution reverted")) {
        console.log(`   💡 Transaction reverted - 내부 로직 오류`);
      }
      
      // 첫 번째 실패에서 중단하여 문제점 집중 분석
      console.log(`\n🛑 ${ethers.formatEther(amount)} WKAIA에서 실패 - 여기서 문제 시작`);
      break;
    }
  }
  
  console.log(`\n📋 Threshold 분석 결과:`);
  console.log(`   현재 Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  console.log(`   이 이하 withdrawal: LST swap 불필요 (성공해야 함)`);
  console.log(`   이 이상 withdrawal: LST swap 필요 (실패 가능성)`);
  console.log(`   총 LST 자산: ${ethers.formatEther(totalLSTValue)}`);
  console.log(`   총 가능 withdrawal: ${ethers.formatEther(totalAssets)}`);
}

thresholdTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });