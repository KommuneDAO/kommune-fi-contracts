const { ethers } = require("hardhat");
const fs = require("fs");

async function stepByStepWithdraw() {
  console.log("🔍 단계별 withdrawal 디버깅");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  const targetAmount = ethers.parseEther("0.05");
  
  console.log("📋 1단계: 현재 상태");
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const userShares = await vault.balanceOf(signer.address);
  
  console.log(`   Target: ${ethers.formatEther(targetAmount)} WKAIA`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  
  // Preview 확인
  console.log("\n📋 2단계: Preview 계산");
  try {
    const sharesNeeded = await vault.previewWithdraw(targetAmount);
    console.log(`   필요한 shares: ${ethers.formatEther(sharesNeeded)}`);
    console.log(`   Shares 충분: ${userShares >= sharesNeeded ? "예" : "아니오"}`);
  } catch (previewError) {
    console.log(`   ❌ Preview 실패: ${previewError.message}`);
    return;
  }
  
  // 작은 양으로 먼저 테스트
  const smallAmount = ethers.parseEther("0.025");  // Vault WKAIA보다 약간 많음
  console.log(`\n📋 3단계: 작은 양 테스트 (${ethers.formatEther(smallAmount)} WKAIA)`);
  
  try {
    const preBalance = await wkaia.balanceOf(signer.address);
    console.log(`   실행 전 사용자 WKAIA: ${ethers.formatEther(preBalance)}`);
    
    // Gas estimation
    const gasEstimate = await vault.withdraw.estimateGas(
      smallAmount, 
      signer.address, 
      signer.address
    );
    console.log(`   예상 Gas: ${gasEstimate.toLocaleString()}`);
    
    const withdrawTx = await vault.withdraw(smallAmount, signer.address, signer.address);
    const receipt = await withdrawTx.wait();
    
    const postBalance = await wkaia.balanceOf(signer.address);
    const received = postBalance - preBalance;
    
    console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
    console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
    
    // 이제 더 큰 양 시도
    console.log(`\n📋 4단계: 원래 목표량 테스트 (${ethers.formatEther(targetAmount)} WKAIA)`);
    
    const preBalance2 = await wkaia.balanceOf(signer.address);
    const withdrawTx2 = await vault.withdraw(targetAmount, signer.address, signer.address);
    const receipt2 = await withdrawTx2.wait();
    
    const postBalance2 = await wkaia.balanceOf(signer.address);
    const received2 = postBalance2 - preBalance2;
    
    console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received2)} WKAIA`);
    console.log(`   Gas 사용: ${receipt2.gasUsed.toLocaleString()}`);
    
  } catch (error) {
    console.log(`   ❌ 실패: ${error.message}`);
    
    // 더 상세한 에러 분석
    if (error.data) {
      console.log(`   Error data: ${error.data}`);
    }
    
    // 특정 에러 타입 분석
    if (error.message.includes("arithmetic underflow")) {
      console.log(`\n🔍 Arithmetic Underflow 분석:`);
      console.log(`   LST swap 계산에서 언더플로우 발생`);
      console.log(`   가능한 원인:`);
      console.log(`   1. Wrap ratio 계산 오류`);
      console.log(`   2. Slippage 계산 초과`);
      console.log(`   3. Balance 부족으로 인한 subtraction 오류`);
    }
    
    // 현재 vault 상태 다시 확인
    console.log(`\n📊 실패 후 상태:`);
    const currentVaultWKAIA = await wkaia.balanceOf(vaultAddress);
    console.log(`   Vault WKAIA: ${ethers.formatEther(currentVaultWKAIA)}`);
    
    // LST 상태도 확인
    for (let i = 0; i < 4; i++) {
      try {
        const tokenInfo = await vault.tokensInfo(i);
        const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await assetContract.balanceOf(vaultAddress);
        
        if (balance > ethers.parseEther("0.1")) {
          console.log(`   LST ${i}: ${ethers.formatEther(balance)} (사용 가능)`);
        }
      } catch (e) {
        // Skip
      }
    }
  }
}

stepByStepWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });