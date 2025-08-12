const { ethers } = require("hardhat");
const fs = require("fs");

async function testWstKLAY() {
  console.log("🔍 wstKLAY (LST 2) swap 테스트");
  console.log("   UI 성공 TX: 0x3902b3542d716b139a7970339b11630174ff601c66a1681a5b9a50fa0f61fc71");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  // LST 2 (stKLAY) 정보
  const tokenInfo = await vault.tokensInfo(2);
  console.log(`\n📊 LST 2 (stKLAY) 정보:`);
  console.log(`   Asset (stKLAY): ${tokenInfo.asset}`);
  console.log(`   TokenA (wstKLAY): ${tokenInfo.tokenA}`);
  console.log(`   TokenB: ${tokenInfo.tokenB}`);
  console.log(`   TokenC (WKAIA): ${tokenInfo.tokenC}`);
  
  const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  // 현재 잔액
  const vaultAssetBalance = await assetContract.balanceOf(vaultAddress);
  const vaultWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log(`\n💰 현재 잔액:`);
  console.log(`   Vault stKLAY: ${ethers.formatEther(vaultAssetBalance)}`);
  console.log(`   Vault wstKLAY: ${ethers.formatEther(vaultWrappedBalance)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  
  // 소량 테스트
  const testAmounts = ["0.01", "0.05", "0.1"];
  
  for (const amount of testAmounts) {
    const targetAmount = ethers.parseEther(amount);
    const currentVaultWKAIA = await wkaia.balanceOf(vaultAddress);
    
    if (targetAmount <= currentVaultWKAIA) {
      console.log(`\n💰 ${amount} WKAIA는 LST swap 불필요 (Vault에 충분)`);
      continue;
    }
    
    const needFromLST = targetAmount - currentVaultWKAIA;
    
    console.log(`\n💰 테스트: ${amount} WKAIA withdrawal`);
    console.log(`   현재 Vault WKAIA: ${ethers.formatEther(currentVaultWKAIA)}`);
    console.log(`   LST에서 필요: ${ethers.formatEther(needFromLST)} WKAIA`);
    console.log(`   사용 LST: LST 2 (stKLAY → wstKLAY → WKAIA)`);
    
    try {
      // Preview
      const sharesNeeded = await vault.previewWithdraw(targetAmount);
      const userShares = await vault.balanceOf(signer.address);
      
      console.log(`   필요 shares: ${ethers.formatEther(sharesNeeded)}`);
      console.log(`   보유 shares: ${ethers.formatEther(userShares)}`);
      
      if (sharesNeeded > userShares) {
        console.log(`   ❌ Shares 부족`);
        continue;
      }
      
      // estimateSwap으로 필요한 양 계산
      try {
        const estimated = await vault.estimateSwap.staticCall(2, needFromLST);
        console.log(`   estimateSwap: ${ethers.formatEther(needFromLST)} WKAIA → ${ethers.formatEther(estimated)} wstKLAY 필요`);
      } catch (e) {
        console.log(`   estimateSwap 실패: ${e.message}`);
      }
      
      // Gas estimation
      try {
        const gasEstimate = await vault.withdraw.estimateGas(
          targetAmount, 
          signer.address, 
          signer.address
        );
        console.log(`   예상 Gas: ${gasEstimate.toLocaleString()}`);
      } catch (gasError) {
        console.log(`   ❌ Gas estimation 실패: ${gasError.message}`);
        
        if (gasError.message.includes("BAL#401")) {
          console.log(`   💡 BAL#401 - Balancer 오류`);
          
          // 상세 분석
          console.log(`\n   🔍 상세 분석:`);
          const currentStKLAY = await assetContract.balanceOf(vaultAddress);
          const currentWstKLAY = await wrappedContract.balanceOf(vaultAddress);
          console.log(`      stKLAY balance: ${ethers.formatEther(currentStKLAY)}`);
          console.log(`      wstKLAY balance: ${ethers.formatEther(currentWstKLAY)}`);
          
          if (currentWstKLAY === 0n) {
            console.log(`      ⚠️ wstKLAY가 0 - wrap이 실행되지 않음!`);
          }
        }
        continue;
      }
      
      // 실제 withdrawal
      const preBalance = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      console.log(`   🎉 LST 2 (stKLAY/wstKLAY) swap 성공!`);
      
      // 성공 후 상태 확인
      const newVaultStKLAY = await assetContract.balanceOf(vaultAddress);
      const newVaultWstKLAY = await wrappedContract.balanceOf(vaultAddress);
      const newVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      
      console.log(`\n   📊 Swap 후 변화:`);
      console.log(`      stKLAY: ${ethers.formatEther(vaultAssetBalance)} → ${ethers.formatEther(newVaultStKLAY)} (변화: ${ethers.formatEther(newVaultStKLAY - vaultAssetBalance)})`);
      console.log(`      wstKLAY: ${ethers.formatEther(vaultWrappedBalance)} → ${ethers.formatEther(newVaultWstKLAY)} (변화: ${ethers.formatEther(newVaultWstKLAY - vaultWrappedBalance)})`);
      console.log(`      WKAIA: ${ethers.formatEther(vaultWKAIA)} → ${ethers.formatEther(newVaultWKAIA)} (변화: ${ethers.formatEther(newVaultWKAIA - vaultWKAIA)})`);
      
      break; // 성공하면 종료
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      
      if (error.message.includes("BAL#401")) {
        console.log(`   💡 BAL#401 - Balancer 오류`);
      } else if (error.data === "0x4e487b710000000000000000000000000000000000000000000000000000000000000011") {
        console.log(`   💡 Arithmetic underflow/overflow`);
      }
    }
  }
  
  // 최종 상태
  console.log(`\n📊 최종 상태:`);
  const finalVaultStKLAY = await assetContract.balanceOf(vaultAddress);
  const finalVaultWstKLAY = await wrappedContract.balanceOf(vaultAddress);
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const finalTotalAssets = await vault.totalAssets();
  
  console.log(`   Vault stKLAY: ${ethers.formatEther(finalVaultStKLAY)}`);
  console.log(`   Vault wstKLAY: ${ethers.formatEther(finalVaultWstKLAY)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   Total assets: ${ethers.formatEther(finalTotalAssets)}`);
}

testWstKLAY()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });