const { ethers } = require("hardhat");
const fs = require("fs");

async function testDirectWrap() {
  console.log("🔍 직접 wrap 테스트 - KoKAIA (LST 0)");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // LST 0 (KoKAIA) 정보
  const tokenInfo = await vault.tokensInfo(0);
  console.log(`\n📊 LST 0 (KoKAIA) 정보:`);
  console.log(`   Asset (KoKAIA): ${tokenInfo.asset}`);
  console.log(`   TokenA (wKoKAIA): ${tokenInfo.tokenA}`);
  console.log(`   Handler: ${tokenInfo.handler}`);
  
  const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  // 현재 잔액
  const vaultAssetBalance = await assetContract.balanceOf(vaultAddress);
  const vaultWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
  
  console.log(`\n💰 현재 잔액:`);
  console.log(`   Vault KoKAIA: ${ethers.formatEther(vaultAssetBalance)}`);
  console.log(`   Vault wKoKAIA: ${ethers.formatEther(vaultWrappedBalance)}`);
  
  // 사용자 잔액도 확인
  const userAssetBalance = await assetContract.balanceOf(signer.address);
  const userWrappedBalance = await wrappedContract.balanceOf(signer.address);
  
  console.log(`   User KoKAIA: ${ethers.formatEther(userAssetBalance)}`);
  console.log(`   User wKoKAIA: ${ethers.formatEther(userWrappedBalance)}`);
  
  if (vaultAssetBalance === 0n && userAssetBalance === 0n) {
    console.log(`\n❌ KoKAIA 잔액이 없어서 테스트 불가능`);
    return;
  }
  
  // 다양한 wrap 시도
  console.log(`\n🔧 Wrap 시도:`);
  
  // Handler == Asset인 경우 확인
  if (tokenInfo.handler === tokenInfo.asset) {
    console.log(`   💡 Handler가 Asset과 동일 - KoKAIA 자체가 wrap 함수 제공`);
    
    try {
      // KoKAIA 컨트랙트 직접 호출
      const kokaiaContract = await ethers.getContractAt([
        "function wrap(uint256 amount) returns (uint256)",
        "function unwrap(uint256 amount) returns (uint256)",
        "function getWrappedAmount(uint256 amount) view returns (uint256)",
        "function getUnwrappedAmount(uint256 amount) view returns (uint256)"
      ], tokenInfo.asset);
      
      const testAmount = ethers.parseEther("0.01");
      
      if (vaultAssetBalance >= testAmount) {
        console.log(`\n   1. Vault에서 wrap 시도 (${ethers.formatEther(testAmount)} KoKAIA)`);
        
        // Vault로 impersonate
        await ethers.provider.send("hardhat_impersonateAccount", [vaultAddress]);
        const vaultSigner = await ethers.getSigner(vaultAddress);
        
        try {
          // Approve first
          await assetContract.connect(vaultSigner).approve(tokenInfo.tokenA, testAmount);
          console.log(`      ✅ Approve 성공`);
          
          // Try wrap
          const wrapTx = await kokaiaContract.connect(vaultSigner).wrap(testAmount);
          const receipt = await wrapTx.wait();
          
          const newWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
          console.log(`      ✅ Wrap 성공! 새 wKoKAIA: ${ethers.formatEther(newWrappedBalance)}`);
          console.log(`      Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
          
        } catch (wrapError) {
          console.log(`      ❌ Wrap 실패: ${wrapError.message}`);
        }
        
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [vaultAddress]);
        
      } else if (userAssetBalance >= testAmount) {
        console.log(`\n   2. 사용자 계정에서 wrap 시도 (${ethers.formatEther(testAmount)} KoKAIA)`);
        
        try {
          // Approve
          await assetContract.approve(tokenInfo.tokenA, testAmount);
          console.log(`      ✅ Approve 성공`);
          
          // Try wrap
          const wrapTx = await kokaiaContract.wrap(testAmount);
          const receipt = await wrapTx.wait();
          
          const newUserWrappedBalance = await wrappedContract.balanceOf(signer.address);
          console.log(`      ✅ Wrap 성공! 새 wKoKAIA: ${ethers.formatEther(newUserWrappedBalance)}`);
          console.log(`      Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
          
          // 성공했으면 vault로 전송 테스트
          if (newUserWrappedBalance > 0) {
            console.log(`\n   3. Vault로 wKoKAIA 전송`);
            await wrappedContract.transfer(vaultAddress, newUserWrappedBalance);
            
            const finalVaultWrapped = await wrappedContract.balanceOf(vaultAddress);
            console.log(`      ✅ 전송 성공! Vault wKoKAIA: ${ethers.formatEther(finalVaultWrapped)}`);
          }
          
        } catch (wrapError) {
          console.log(`      ❌ Wrap 실패: ${wrapError.message}`);
        }
      }
      
      // Wrap ratio 확인
      try {
        const ratio = await kokaiaContract.getWrappedAmount(ethers.parseEther("1"));
        console.log(`\n   📈 Wrap 비율: 1 KoKAIA = ${ethers.formatEther(ratio)} wKoKAIA`);
      } catch (e) {
        console.log(`\n   📈 Wrap 비율 확인 실패`);
      }
      
    } catch (error) {
      console.log(`   ❌ KoKAIA 컨트랙트 호출 실패: ${error.message}`);
    }
  }
  
  // 최종 상태 확인
  console.log(`\n📊 최종 상태:`);
  const finalVaultAsset = await assetContract.balanceOf(vaultAddress);
  const finalVaultWrapped = await wrappedContract.balanceOf(vaultAddress);
  
  console.log(`   Vault KoKAIA: ${ethers.formatEther(finalVaultAsset)} (변화: ${ethers.formatEther(finalVaultAsset - vaultAssetBalance)})`);
  console.log(`   Vault wKoKAIA: ${ethers.formatEther(finalVaultWrapped)} (변화: ${ethers.formatEther(finalVaultWrapped - vaultWrappedBalance)})`);
  
  if (finalVaultWrapped > 0) {
    console.log(`\n🎉 Wrap 성공! 이제 LST swap을 테스트할 수 있습니다.`);
  }
}

testDirectWrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });