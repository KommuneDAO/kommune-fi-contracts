const { ethers } = require("hardhat");
const fs = require("fs");

async function debugWrap() {
  console.log("🔍 Wrap 문제 디버깅");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // LST 1 (GCKAIA) 테스트
  const index = 1;
  const tokenInfo = await vault.tokensInfo(index);
  
  console.log(`\n📊 LST ${index} (GCKAIA) 정보:`);
  console.log(`   Asset: ${tokenInfo.asset}`);
  console.log(`   TokenA: ${tokenInfo.tokenA}`);
  
  // 필요한 양 계산 시뮬레이션
  const targetWKAIA = ethers.parseEther("0.01");
  
  console.log(`\n🔧 Wrap 계산 시뮬레이션 (${ethers.formatEther(targetWKAIA)} WKAIA 필요):`);
  
  try {
    // Step 1: estimateSwap
    const requiredWrapped = await vault.estimateSwap.staticCall(index, targetWKAIA);
    console.log(`   1. estimateSwap: ${ethers.formatEther(requiredWrapped)} wGCKAIA 필요`);
    
    // 5% buffer 추가
    const bufferWrapped = (requiredWrapped * 105n) / 100n;
    console.log(`   2. Buffer 포함: ${ethers.formatEther(bufferWrapped)} wGCKAIA`);
    
    // Step 2: getGCKLAYByWGCKLAY 시도
    const wrappedInterface = await ethers.getContractAt([
      "function getGCKLAYByWGCKLAY(uint256) view returns (uint256)",
      "function getWGCKLAYByGCKLAY(uint256) view returns (uint256)",
      "function wrap(uint256)",
      "function unwrap(uint256)"
    ], tokenInfo.tokenA);
    
    const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
    
    let assetNeeded;
    try {
      assetNeeded = await wrappedInterface.getGCKLAYByWGCKLAY(bufferWrapped);
      console.log(`   3. getGCKLAYByWGCKLAY: ${ethers.formatEther(assetNeeded)} GCKAIA 필요`);
    } catch (e) {
      assetNeeded = (bufferWrapped * 101n) / 100n;
      console.log(`   3. Fallback 계산: ${ethers.formatEther(assetNeeded)} GCKAIA 필요`);
    }
    
    // Step 3: 현재 잔액 확인
    const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const currentAsset = await assetContract.balanceOf(vaultAddress);
    
    console.log(`   4. 현재 GCKAIA 잔액: ${ethers.formatEther(currentAsset)}`);
    console.log(`   5. 충분한가: ${currentAsset >= assetNeeded ? "✅ 예" : "❌ 아니오"}`);
    
    if (currentAsset >= assetNeeded) {
      // 실제 wrap 테스트
      console.log(`\n🧪 실제 wrap 테스트:`);
      
      const wrapAmount = assetNeeded < currentAsset ? assetNeeded : currentAsset;
      console.log(`   Wrap 시도: ${ethers.formatEther(wrapAmount)} GCKAIA`);
      
      // Approve
      await assetContract.approve(tokenInfo.tokenA, wrapAmount);
      console.log(`   ✅ Approve 성공`);
      
      // Wrap 전 잔액
      const wrappedBefore = await wrappedContract.balanceOf(vaultAddress);
      console.log(`   Wrap 전 wGCKAIA: ${ethers.formatEther(wrappedBefore)}`);
      
      try {
        // Wrap 실행
        const wrapTx = await wrappedInterface.wrap(wrapAmount);
        const receipt = await wrapTx.wait();
        
        // Wrap 후 잔액
        const wrappedAfter = await wrappedContract.balanceOf(vaultAddress);
        const gained = wrappedAfter - wrappedBefore;
        
        console.log(`   ✅ Wrap 성공!`);
        console.log(`   Wrap 후 wGCKAIA: ${ethers.formatEther(wrappedAfter)}`);
        console.log(`   증가량: ${ethers.formatEther(gained)}`);
        console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
        
        if (gained === 0n) {
          console.log(`   ⚠️ 경고: Wrap이 실행되었지만 wGCKAIA가 증가하지 않음!`);
        }
        
      } catch (wrapError) {
        console.log(`   ❌ Wrap 실패: ${wrapError.message}`);
        
        // 대체 방법 시도
        console.log(`\n   🔄 대체 방법 시도:`);
        
        try {
          // deposit 함수 시도
          const depositContract = await ethers.getContractAt([
            "function deposit(uint256) returns (uint256)"
          ], tokenInfo.tokenA);
          
          await assetContract.approve(tokenInfo.tokenA, wrapAmount);
          const depositTx = await depositContract.deposit(wrapAmount);
          await depositTx.wait();
          
          const wrappedAfter2 = await wrappedContract.balanceOf(vaultAddress);
          console.log(`   ✅ deposit 함수 성공! wGCKAIA: ${ethers.formatEther(wrappedAfter2)}`);
          
        } catch (depositError) {
          console.log(`   ❌ deposit도 실패: ${depositError.message}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ 전체 실패: ${error.message}`);
  }
}

debugWrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });