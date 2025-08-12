const { ethers } = require("hardhat");
const fs = require("fs");

async function testStKAIA() {
  console.log("🔍 stKAIA (LST 3) swap 테스트 - wrap 불필요");
  console.log("   UI 성공 TX: 0xf6a1f05e4d2e959f1bc55e69622e43d7729e63484189f2355eecb606e58fa0cd");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  // LST 3 (stKAIA) 정보
  const tokenInfo = await vault.tokensInfo(3);
  console.log(`\n📊 LST 3 (stKAIA) 정보:`);
  console.log(`   Asset (stKAIA): ${tokenInfo.asset}`);
  console.log(`   TokenA: ${tokenInfo.tokenA}`);
  console.log(`   TokenB: ${tokenInfo.tokenB}`);
  console.log(`   TokenC (WKAIA): ${tokenInfo.tokenC}`);
  console.log(`   💡 특징: Asset === TokenA (wrap 불필요)`);
  
  const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
  
  // 현재 잔액
  const vaultAssetBalance = await assetContract.balanceOf(vaultAddress);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log(`\n💰 현재 잔액:`);
  console.log(`   Vault stKAIA: ${ethers.formatEther(vaultAssetBalance)}`);
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
    console.log(`   사용 LST: LST 3 (stKAIA → WKAIA 직접 swap, wrap 불필요)`);
    
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
      
      // stKAIA의 경우 특별한 계산
      try {
        const stKaiaInterface = await ethers.getContractAt([
          "function getRatioStakingTokenByNativeToken(uint256) view returns (uint256)"
        ], tokenInfo.asset);
        
        const neededStKaia = await stKaiaInterface.getRatioStakingTokenByNativeToken(needFromLST);
        console.log(`   필요 stKAIA: ${ethers.formatEther(neededStKaia)} (${ethers.formatEther(needFromLST)} WKAIA 위해)`);
        
        if (neededStKaia > vaultAssetBalance) {
          console.log(`   ❌ stKAIA 부족 (보유: ${ethers.formatEther(vaultAssetBalance)})`);
          continue;
        }
      } catch (e) {
        console.log(`   getRatioStakingTokenByNativeToken 실패: ${e.message}`);
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
          console.log(`   💡 사용자 피드백: 10% slippage로는 문제 없다고 함`);
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
      console.log(`   🎉 LST 3 (stKAIA) swap 성공!`);
      
      // 성공 후 상태 확인
      const newVaultStKAIA = await assetContract.balanceOf(vaultAddress);
      const newVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      
      console.log(`\n   📊 Swap 후 변화:`);
      console.log(`      stKAIA: ${ethers.formatEther(vaultAssetBalance)} → ${ethers.formatEther(newVaultStKAIA)} (변화: ${ethers.formatEther(newVaultStKAIA - vaultAssetBalance)})`);
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
  const finalVaultStKAIA = await assetContract.balanceOf(vaultAddress);
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const finalTotalAssets = await vault.totalAssets();
  
  console.log(`   Vault stKAIA: ${ethers.formatEther(finalVaultStKAIA)}`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   Total assets: ${ethers.formatEther(finalTotalAssets)}`);
}

testStKAIA()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });