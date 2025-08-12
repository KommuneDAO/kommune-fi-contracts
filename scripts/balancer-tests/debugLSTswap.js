const { ethers } = require("hardhat");
const fs = require("fs");

async function debugLSTswap() {
  console.log("🔍 LST swap 실패 원인 상세 분석");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 현재 상황:");
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const targetAmount = ethers.parseEther("0.05");
  const lack = targetAmount - vaultWKAIA;
  
  console.log(`   Target withdrawal: ${ethers.formatEther(targetAmount)} WKAIA`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  console.log(`   Need from LST: ${ethers.formatEther(lack)} WKAIA`);
  
  // selectAsset 시뮬레이션
  console.log(`\n🔍 selectAsset 분석:`);
  try {
    const [idx, avail] = await vault.selectAsset(lack);
    console.log(`   선택된 LST index: ${idx}`);
    console.log(`   사용 가능 금액: ${ethers.formatEther(avail)} WKAIA`);
    console.log(`   충분한가: ${avail >= lack ? "예" : "아니오"}`);
    
    if (avail >= lack) {
      console.log(`\n🧪 단일 LST swap 시도 (index ${idx}):`);
      
      // 해당 LST 상세 정보
      const tokenInfo = await vault.tokensInfo(idx);
      console.log(`   Asset: ${tokenInfo.asset}`);
      console.log(`   TokenA: ${tokenInfo.tokenA}`);
      
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const assetBalance = await assetContract.balanceOf(vaultAddress);
      console.log(`   Asset balance: ${ethers.formatEther(assetBalance)}`);
      
      if (idx < 3) {
        const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
        const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
        console.log(`   Wrapped balance: ${ethers.formatEther(wrappedBalance)}`);
        
        // Wrap amount 계산 시뮬레이션
        console.log(`\n📊 Wrap 계산 시뮬레이션:`);
        const buffer = (lack * 25n) / 100n;  // 25% buffer
        const actual = lack + buffer;
        console.log(`   필요량 + 25% buffer: ${ethers.formatEther(actual)} WKAIA`);
        
        const maxUsable = (assetBalance * 70n) / 100n;
        console.log(`   70% 한계: ${ethers.formatEther(maxUsable)}`);
        
        const finalActual = actual > maxUsable ? maxUsable : actual;
        console.log(`   최종 사용량: ${ethers.formatEther(finalActual)} WKAIA`);
        
        if (finalActual > wrappedBalance) {
          const reqWrap = finalActual - wrappedBalance;
          console.log(`   필요한 wrap: ${ethers.formatEther(reqWrap)} WKAIA`);
          
          // Wrap ratio 확인
          try {
            let wrapNeeded;
            if (idx === 0) {
              const wrappedContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
              wrapNeeded = await wrappedContract.getUnwrappedAmount(reqWrap);
            } else if (idx === 1) {
              const wrappedContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
              wrapNeeded = await wrappedContract.getGCKLAYByWGCKLAY(reqWrap);
            } else if (idx === 2) {
              const wrappedContract = await ethers.getContractAt("IWrapped", tokenInfo.tokenA);
              wrapNeeded = await wrappedContract.getUnwrappedAmount(reqWrap);
            }
            
            console.log(`   실제 wrap 필요량: ${ethers.formatEther(wrapNeeded)}`);
            console.log(`   Asset 충분한가: ${assetBalance >= wrapNeeded ? "예" : "아니오"}`);
            
            if (assetBalance < wrapNeeded) {
              console.log(`   ❌ Wrap 실패 예상: Asset 부족`);
              console.log(`   보유: ${ethers.formatEther(assetBalance)}, 필요: ${ethers.formatEther(wrapNeeded)}`);
            }
            
          } catch (wrapError) {
            console.log(`   ❌ Wrap ratio 계산 실패: ${wrapError.message}`);
          }
        }
      }
    } else {
      console.log(`\n🧪 다중 LST 조합 필요:`);
      console.log(`   사용 가능: ${ethers.formatEther(avail)}`);
      console.log(`   부족분: ${ethers.formatEther(lack - avail)}`);
    }
    
  } catch (selectError) {
    console.log(`   ❌ selectAsset 실패: ${selectError.message}`);
  }
  
  // 전체 LST 상태 확인
  console.log(`\n📊 전체 LST 상태:`);
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const balance = await assetContract.balanceOf(vaultAddress);
      
      console.log(`\nLST ${i}:`);
      console.log(`   Asset balance: ${ethers.formatEther(balance)}`);
      
      if (i < 3) {
        const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
        const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
        console.log(`   Wrapped balance: ${ethers.formatEther(wrappedBalance)}`);
        
        // 총 가치 계산
        const totalValue = balance + wrappedBalance;  // 간단한 1:1 가정
        console.log(`   총 가치 (approximate): ${ethers.formatEther(totalValue)}`);
      }
    } catch (e) {
      console.log(`LST ${i}: 조회 실패`);
    }
  }
}

debugLSTswap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });