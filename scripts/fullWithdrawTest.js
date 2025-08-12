const { ethers } = require("hardhat");
const fs = require("fs");

async function fullWithdrawTest() {
  console.log("🔍 전체 withdrawal 과정 단계별 분석");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  const balancerVault = await vault.vault();
  
  // 현재 상태
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  console.log(`현재 Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  
  // LST swap이 필요한 양 요청
  const targetAmount = ethers.parseEther("0.008"); // Vault WKAIA보다 살짝 많음
  const lackAmount = targetAmount - vaultWKAIA;
  
  console.log(`목표 금액: ${ethers.formatEther(targetAmount)} WKAIA`);
  console.log(`부족 금액: ${ethers.formatEther(lackAmount)} WKAIA`);
  
  if (lackAmount <= 0) {
    console.log("❌ LST swap이 필요하지 않은 양입니다.");
    return;
  }
  
  // LST 0 정보
  const tokenInfo = await vault.tokensInfo(0);
  const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  console.log(`\n📊 LST 0 현재 상태:`);
  const assetBalance = await assetContract.balanceOf(vaultAddress);
  const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
  
  console.log(`   Asset balance: ${ethers.formatEther(assetBalance)}`);
  console.log(`   Wrapped balance: ${ethers.formatEther(wrappedBalance)}`);
  
  console.log(`\n🔧 단계별 실행:`);
  
  try {
    // Step 1: estimateSwap으로 필요한 wrapped token 계산
    console.log(`   1. estimateSwap 호출...`);
    const estimatedWrapped = await vault.estimateSwap.staticCall(0, lackAmount);
    console.log(`   필요한 wrapped tokens: ${ethers.formatEther(estimatedWrapped)}`);
    
    // Step 2: getUnwrappedAmount로 필요한 asset 계산 (manual)
    // LST 0의 경우 KoKAIA이므로 getUnwrappedAmount 사용
    console.log(`   2. 필요한 asset 계산 (manual)...`);
    const bufferWrapped = (estimatedWrapped * 105n) / 100n; // 5% buffer
    console.log(`   Buffer 포함 wrapped: ${ethers.formatEther(bufferWrapped)}`);
    
    const needToWrap = bufferWrapped; // 현재 wrapped balance가 0이므로 전체 필요
    
    console.log(`   Wrap 필요량: ${ethers.formatEther(needToWrap)}`);
    
    if (needToWrap === 0n) {
      console.log(`   ✅ Wrap 불필요`);
    } else {
      console.log(`   3. Asset wrap 실행...`);
      
      // Asset이 충분한지 확인
      if (assetBalance < needToWrap) {
        console.log(`   ❌ Asset 부족 (필요: ${ethers.formatEther(needToWrap)}, 보유: ${ethers.formatEther(assetBalance)})`);
        return;
      }
      
      // Wrap을 위한 approve (KVaultV2 → TokenA wrapper)
      await assetContract.approve(tokenInfo.tokenA, needToWrap);
      
      // Wrap 실행 (적절한 interface 필요)
      console.log(`   Wrap 시도...`);
      
      try {
        // KoKaia의 경우 단순 wrap 함수 호출
        const wrapTx = await assetContract.approve(tokenInfo.tokenA, needToWrap);
        await wrapTx.wait();
        
        // 실제 wrap 호출 - KoKaia 인터페이스 시도
        const kokaiaWrapper = await ethers.getContractAt([
          "function wrap(uint256 amount)"
        ], tokenInfo.tokenA);
        
        const actualWrapTx = await kokaiaWrapper.wrap(needToWrap);
        await actualWrapTx.wait();
        
        const newWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
        console.log(`   ✅ Wrap 성공! 새 wrapped balance: ${ethers.formatEther(newWrappedBalance)}`);
        
        // Step 4: SwapContract로 wrapped token 전송
        console.log(`   4. SwapContract로 전송...`);
        const finalWrapped = await wrappedContract.balanceOf(vaultAddress);
        
        await wrappedContract.transfer(swapContractAddress, finalWrapped);
        
        const swapBalance = await wrappedContract.balanceOf(swapContractAddress);
        console.log(`   ✅ 전송 성공! SwapContract balance: ${ethers.formatEther(swapBalance)}`);
        
        // Step 5: SwapContract에서 approve 및 swap
        console.log(`   5. SwapContract approve & swap...`);
        
        // 실제 swap 호출
        const tokenInfoStruct = {
          asset: tokenInfo.asset,
          tokenA: tokenInfo.tokenA,
          tokenB: tokenInfo.tokenB,
          tokenC: tokenInfo.tokenC,
          pool1: tokenInfo.pool1,
          pool2: tokenInfo.pool2,
          handler: tokenInfo.handler
        };
        
        const swapResult = await vault.swap(0, finalWrapped, 0);
        console.log(`   ✅ Swap 성공!`);
        
        const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
        console.log(`   최종 Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)} (증가: ${ethers.formatEther(finalVaultWKAIA - vaultWKAIA)})`);
        
      } catch (wrapError) {
        console.log(`   ❌ Wrap/Swap 실패: ${wrapError.message}`);
        
        if (wrapError.message.includes("BAL#401")) {
          console.log(`   💡 BAL#401 - approve 문제 가능성`);
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ estimateSwap 실패: ${error.message}`);
  }
}

fullWithdrawTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });