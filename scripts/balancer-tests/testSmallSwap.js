const { ethers } = require("hardhat");
const fs = require("fs");

async function testSmallSwap() {
  console.log("🔍 소량 LST swap 테스트 (0.1 정도)");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  // 현재 상태
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const userShares = await vault.balanceOf(signer.address);
  const totalAssets = await vault.totalAssets();
  
  console.log(`\n📊 현재 상태:`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
  
  // LST 정보 확인
  console.log(`\n📋 LST 상태:`);
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const assetBalance = await assetContract.balanceOf(vaultAddress);
      
      if (assetBalance > ethers.parseEther("0.01")) {
        console.log(`   LST ${i}: ${ethers.formatEther(assetBalance)} asset`);
        
        if (i < 3) {
          const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
          const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
          console.log(`          ${ethers.formatEther(wrappedBalance)} wrapped`);
        }
      }
    } catch (e) {
      // Skip
    }
  }
  
  // 소량 테스트 - LST swap이 필요한 양
  const testAmounts = ["0.01", "0.02", "0.05", "0.1"];
  
  for (const amount of testAmounts) {
    const targetAmount = ethers.parseEther(amount);
    const currentVaultWKAIA = await wkaia.balanceOf(vaultAddress);
    const needLST = targetAmount > currentVaultWKAIA;
    
    console.log(`\n💰 테스트: ${amount} WKAIA withdrawal`);
    console.log(`   현재 Vault WKAIA: ${ethers.formatEther(currentVaultWKAIA)}`);
    console.log(`   LST swap 필요: ${needLST ? `예 (${ethers.formatEther(targetAmount - currentVaultWKAIA)} WKAIA)` : "아니오"}`);
    
    try {
      // Preview 먼저 확인
      const sharesNeeded = await vault.previewWithdraw(targetAmount);
      console.log(`   필요한 shares: ${ethers.formatEther(sharesNeeded)}`);
      
      if (sharesNeeded > userShares) {
        console.log(`   ❌ Shares 부족 (보유: ${ethers.formatEther(userShares)})`);
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
          console.log(`   💡 여전히 BAL#401 오류`);
        }
        continue;
      }
      
      // 실제 withdrawal 실행
      const preBalance = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      
      if (needLST) {
        console.log(`   🎉 LST swap 성공적으로 실행됨!`);
      }
      
      // 성공하면 다음 테스트를 위해 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const finalUserShares = await vault.balanceOf(signer.address);
  const finalTotalAssets = await vault.totalAssets();
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   User shares: ${ethers.formatEther(finalUserShares)} (변화: ${ethers.formatEther(finalUserShares - userShares)})`);
  console.log(`   Total assets: ${ethers.formatEther(finalTotalAssets)}`);
  
  // 성공한 transaction 분석
  console.log(`\n📝 사용자 제공 성공 TX: 0xf30b93a152246b164f2f05bff070648318398b073b852e899d4d164b44e3087f`);
  console.log(`   이 transaction은 wKoKAIA liquidity 추가 및 swap 성공을 나타냅니다.`);
}

testSmallSwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });