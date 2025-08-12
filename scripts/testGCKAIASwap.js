const { ethers } = require("hardhat");
const fs = require("fs");

async function testGCKAIASwap() {
  console.log("🔍 GCKAIA (LST 1) swap 테스트");
  console.log("   UI 성공 TX: 0xc61e4804d8c0de582d04adf7741dd70f1671fea0e8e0ff534b94a3261e5870d3");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  // LST 1 (GCKAIA) 정보
  const tokenInfo = await vault.tokensInfo(1);
  console.log(`\n📊 LST 1 (GCKAIA) 정보:`);
  console.log(`   Asset (GCKAIA): ${tokenInfo.asset}`);
  console.log(`   TokenA (wGCKAIA): ${tokenInfo.tokenA}`);
  console.log(`   TokenB: ${tokenInfo.tokenB}`);
  console.log(`   TokenC (WKAIA): ${tokenInfo.tokenC}`);
  console.log(`   Pool1: ${tokenInfo.pool1}`);
  console.log(`   Pool2: ${tokenInfo.pool2}`);
  
  const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  // 현재 잔액
  const vaultAssetBalance = await assetContract.balanceOf(vaultAddress);
  const vaultWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log(`\n💰 현재 잔액:`);
  console.log(`   Vault GCKAIA: ${ethers.formatEther(vaultAssetBalance)}`);
  console.log(`   Vault wGCKAIA: ${ethers.formatEther(vaultWrappedBalance)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  
  // LST swap이 필요한 양으로 withdrawal 테스트
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
    console.log(`   사용 LST: LST 1 (GCKAIA → wGCKAIA → WKAIA)`);
    
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
          
          // 더 자세한 분석
          console.log(`\n   🔍 상세 분석:`);
          console.log(`      GCKAIA balance: ${ethers.formatEther(vaultAssetBalance)}`);
          console.log(`      wGCKAIA balance: ${ethers.formatEther(vaultWrappedBalance)}`);
          
          // estimateSwap 테스트
          try {
            const estimated = await vault.estimateSwap.staticCall(1, needFromLST);
            console.log(`      estimateSwap: ${ethers.formatEther(needFromLST)} WKAIA 필요 → ${ethers.formatEther(estimated)} wGCKAIA 필요`);
          } catch (e) {
            console.log(`      estimateSwap 실패: ${e.message}`);
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
      console.log(`   🎉 LST 1 (GCKAIA) swap 성공!`);
      
      // 성공 후 상태 확인
      const newVaultGCKAIA = await assetContract.balanceOf(vaultAddress);
      const newVaultWGCKAIA = await wrappedContract.balanceOf(vaultAddress);
      const newVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      
      console.log(`\n   📊 Swap 후 변화:`);
      console.log(`      GCKAIA: ${ethers.formatEther(vaultAssetBalance)} → ${ethers.formatEther(newVaultGCKAIA)} (변화: ${ethers.formatEther(newVaultGCKAIA - vaultAssetBalance)})`);
      console.log(`      wGCKAIA: ${ethers.formatEther(vaultWrappedBalance)} → ${ethers.formatEther(newVaultWGCKAIA)} (변화: ${ethers.formatEther(newVaultWGCKAIA - vaultWrappedBalance)})`);
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
  const finalVaultGCKAIA = await assetContract.balanceOf(vaultAddress);
  const finalVaultWGCKAIA = await wrappedContract.balanceOf(vaultAddress);
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const finalTotalAssets = await vault.totalAssets();
  
  console.log(`   Vault GCKAIA: ${ethers.formatEther(finalVaultGCKAIA)}`);
  console.log(`   Vault wGCKAIA: ${ethers.formatEther(finalVaultWGCKAIA)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   Total assets: ${ethers.formatEther(finalTotalAssets)}`);
}

testGCKAIASwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });