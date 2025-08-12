const { ethers } = require("hardhat");
const fs = require("fs");

async function testGradualWithdraw() {
  console.log("🔍 점진적 withdrawal 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  console.log(`현재 Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  
  // 점진적으로 증가하는 양으로 테스트
  const testAmounts = ["0.011", "0.012", "0.013", "0.014", "0.015"];
  
  for (const amount of testAmounts) {
    const targetAmount = ethers.parseEther(amount);
    const currentVaultWKAIA = await wkaia.balanceOf(vaultAddress);
    const lack = targetAmount > currentVaultWKAIA ? targetAmount - currentVaultWKAIA : 0n;
    
    console.log(`\n💰 테스트: ${amount} WKAIA`);
    console.log(`   현재 Vault WKAIA: ${ethers.formatEther(currentVaultWKAIA)}`);
    console.log(`   LST 필요량: ${ethers.formatEther(lack)}`);
    
    try {
      const preBalance = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      
      // 잠시 대기
      console.log(`   ⏱️ 다음 테스트 전 3초 대기...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      
      // 실패 원인 분석
      if (error.message.includes("BAL#")) {
        console.log(`   💡 Balancer 오류 - DEX pool 상태 문제`);
      } else if (error.data === "0x4e487b710000000000000000000000000000000000000000000000000000000000000011") {
        console.log(`   💡 Arithmetic underflow - 수학적 계산 오류`);
      } else {
        console.log(`   💡 기타 오류`);
      }
      
      // 실패 시 다음 테스트를 위해 더 오래 대기
      console.log(`   ⏱️ 실패 후 5초 대기...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // 최종 상태 확인
  console.log(`\n📊 최종 상태:`);
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const userShares = await vault.balanceOf(signer.address);
  const totalAssets = await vault.totalAssets();
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
}

testGradualWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });