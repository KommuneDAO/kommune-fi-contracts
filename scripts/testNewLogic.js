const { ethers } = require("hardhat");
const fs = require("fs");

async function testNewLogic() {
  console.log("🔍 새 역산 로직 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  const targetAmount = ethers.parseEther("0.05");
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const lack = targetAmount - vaultWKAIA;
  
  console.log("📋 상황:");
  console.log(`   목표: ${ethers.formatEther(targetAmount)} WKAIA`);
  console.log(`   Vault 보유: ${ethers.formatEther(vaultWKAIA)} WKAIA`);  
  console.log(`   LST에서 필요: ${ethers.formatEther(lack)} WKAIA`);
  
  // 각 LST에 대해 estimateSwap 테스트
  console.log(`\n📊 각 LST별 estimateSwap 테스트:`);
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      console.log(`\nLST ${i}:`);
      
      if (i < 3) {
        // estimateSwap 테스트
        try {
          const estimated = await vault.estimateSwap.staticCall(i, lack);
          console.log(`   estimateSwap(${ethers.formatEther(lack)}): ${ethers.formatEther(estimated)} wrapped tokens 필요`);
          
          // getUnwrappedAmount 테스트
          const wrappedContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
          let assetNeeded;
          
          if (i === 0 || i === 2) {
            assetNeeded = await wrappedContract.getUnwrappedAmount(estimated);
          } else {
            assetNeeded = await wrappedContract.getGCKLAYByWGCKLAY(estimated);
          }
          
          console.log(`   getUnwrappedAmount(${ethers.formatEther(estimated)}): ${ethers.formatEther(assetNeeded)} asset 필요`);
          
          // 현재 잔액 확인
          const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const currentAsset = await assetContract.balanceOf(vaultAddress);
          const currentWrapped = await wrappedContract.balanceOf(vaultAddress);
          
          console.log(`   현재 asset: ${ethers.formatEther(currentAsset)}`);
          console.log(`   현재 wrapped: ${ethers.formatEther(currentWrapped)}`);
          console.log(`   충분한가: ${currentAsset >= assetNeeded ? "예" : "아니오"}`);
          
        } catch (estimateError) {
          console.log(`   estimateSwap 실패: ${estimateError.message}`);
        }
      } else {
        // stKAIA 케이스
        try {
          const stKaiaContract = await ethers.getContractAt("IStKaia", tokenInfo.asset);
          const needed = await stKaiaContract.getRatioStakingTokenByNativeToken(lack);
          
          console.log(`   getRatioStakingTokenByNativeToken(${ethers.formatEther(lack)}): ${ethers.formatEther(needed)} stKAIA 필요`);
          
          const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
          const currentAsset = await assetContract.balanceOf(vaultAddress);
          console.log(`   현재 stKAIA: ${ethers.formatEther(currentAsset)}`);
          console.log(`   충분한가: ${currentAsset >= needed ? "예" : "아니오"}`);
          
        } catch (stKaiaError) {
          console.log(`   stKAIA 계산 실패: ${stKaiaError.message}`);
        }
      }
      
    } catch (e) {
      console.log(`LST ${i}: 전체 테스트 실패`);
    }
  }
  
  // 실제 withdrawal 한 번 더 시도
  console.log(`\n🧪 실제 withdrawal 시도:`);
  try {
    const preBalance = await wkaia.balanceOf(signer.address);
    const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
    const receipt = await withdrawTx.wait();
    
    const postBalance = await wkaia.balanceOf(signer.address);
    const received = postBalance - preBalance;
    
    console.log(`✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
    console.log(`Gas: ${receipt.gasUsed.toLocaleString()}`);
    
  } catch (error) {
    console.log(`❌ 실패: ${error.message}`);
    
    if (error.data === "0x4e487b710000000000000000000000000000000000000000000000000000000000000011") {
      console.log(`💡 Panic 0x11: Arithmetic underflow/overflow`);
      console.log(`   이는 여전히 계산 과정에서 언더플로우가 발생함을 의미`);
    }
  }
}

testNewLogic()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });