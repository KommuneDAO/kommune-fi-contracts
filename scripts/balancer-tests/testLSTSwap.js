const { ethers } = require("hardhat");
const fs = require("fs");

async function testLSTSwap() {
  console.log("🔍 LST swap 역산 로직 테스트");
  
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
  
  // LST swap이 필요한 양을 요청 (Vault WKAIA보다 많은 양)
  const targetAmount = ethers.parseEther("0.02");
  const lack = targetAmount - vaultWKAIA;
  
  console.log(`요청 금액: ${ethers.formatEther(targetAmount)} WKAIA`);
  console.log(`부족 금액: ${ethers.formatEther(lack)} WKAIA (LST에서 확보 필요)`);
  
  // 각 LST의 새로운 역산 로직이 올바르게 계산하는지 확인
  console.log(`\n📊 새 역산 로직 검증:`);
  for (let i = 0; i < 3; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      console.log(`\nLST ${i}:`);
      
      // Step 1: estimateSwap으로 필요한 wrapped token 양 계산
      const estimated = await vault.estimateSwap.staticCall(i, lack);
      console.log(`   1단계 - estimateSwap(${ethers.formatEther(lack)}): ${ethers.formatEther(estimated)} wrapped tokens 필요`);
      
      // Step 2: 현재 wrapped balance 확인
      const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
      const currentWrapped = await wrappedContract.balanceOf(vaultAddress);
      console.log(`   2단계 - 현재 wrapped balance: ${ethers.formatEther(currentWrapped)}`);
      
      const needToWrap = estimated > currentWrapped ? estimated - currentWrapped : 0n;
      console.log(`   2단계 - 추가 wrap 필요: ${ethers.formatEther(needToWrap)}`);
      
      if (needToWrap > 0) {
        // Step 3: getUnwrappedAmount로 필요한 asset 양 계산
        let assetNeeded;
        if (i === 0 || i === 2) {
          assetNeeded = await wrappedContract.getUnwrappedAmount(needToWrap);
        } else {
          assetNeeded = await wrappedContract.getGCKLAYByWGCKLAY(needToWrap);
        }
        console.log(`   3단계 - 필요한 asset 양: ${ethers.formatEther(assetNeeded)}`);
        
        // Step 4: 현재 asset balance 확인
        const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const currentAsset = await assetContract.balanceOf(vaultAddress);
        console.log(`   4단계 - 현재 asset balance: ${ethers.formatEther(currentAsset)}`);
        console.log(`   4단계 - Asset 충분한가: ${currentAsset >= assetNeeded ? "✅ 예" : "❌ 아니오"}`);
        
        if (currentAsset < assetNeeded) {
          console.log(`   ⚠️ 부족한 양: ${ethers.formatEther(assetNeeded - currentAsset)}`);
        }
      } else {
        console.log(`   ✅ 추가 wrap 불필요 - 현재 wrapped balance 충분`);
      }
      
    } catch (error) {
      console.log(`   ❌ LST ${i} 계산 실패: ${error.message}`);
    }
  }
  
  // 실제 withdrawal 시도
  console.log(`\n🧪 실제 withdrawal 시도 (${ethers.formatEther(targetAmount)} WKAIA):`);
  
  try {
    const preBalance = await wkaia.balanceOf(signer.address);
    console.log(`실행 전 사용자 WKAIA: ${ethers.formatEther(preBalance)}`);
    
    // Gas estimation
    try {
      const gasEstimate = await vault.withdraw.estimateGas(
        targetAmount, 
        signer.address, 
        signer.address
      );
      console.log(`예상 Gas: ${gasEstimate.toLocaleString()}`);
    } catch (gasError) {
      console.log(`Gas estimation 실패: ${gasError.message}`);
    }
    
    const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
    const receipt = await withdrawTx.wait();
    
    const postBalance = await wkaia.balanceOf(signer.address);
    const received = postBalance - preBalance;
    
    console.log(`✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
    console.log(`Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
    
  } catch (error) {
    console.log(`❌ 실패: ${error.message}`);
    
    if (error.data === "0x4e487b710000000000000000000000000000000000000000000000000000000000000011") {
      console.log(`💡 Panic 0x11: Arithmetic underflow/overflow`);
      console.log(`   역산 계산에도 불구하고 여전히 underflow 발생`);
      console.log(`   가능한 원인:`);
      console.log(`   1. swap 실행 중 slippage로 예상보다 적은 WKAIA 획득`);
      console.log(`   2. 실제 wrap ratio가 예상과 다름`);
      console.log(`   3. DEX pool 상태 변화`);
    }
  }
}

testLSTSwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });