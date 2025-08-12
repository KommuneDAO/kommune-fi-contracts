const { ethers } = require("hardhat");
const fs = require("fs");

async function testSingleLSTSwap() {
  console.log("🔍 단일 LST swap 직접 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const balancerVault = await vault.vault();
  
  // LST 0 사용해서 직접 swap 테스트
  const tokenInfo = await vault.tokensInfo(0);
  const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log(`\n📊 LST 0 정보:`);
  console.log(`   Asset (KoKAIA): ${tokenInfo.asset}`);
  console.log(`   TokenA (wrapped): ${tokenInfo.tokenA}`);
  console.log(`   TokenB (intermediate): ${tokenInfo.tokenB}`);
  console.log(`   TokenC (WKAIA): ${tokenInfo.tokenC}`);
  console.log(`   Pool1: ${tokenInfo.pool1}`);
  console.log(`   Pool2: ${tokenInfo.pool2}`);
  
  // 현재 잔액
  const assetBalance = await assetContract.balanceOf(vaultAddress);
  const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  
  console.log(`\n💰 현재 잔액:`);
  console.log(`   KVaultV2 asset: ${ethers.formatEther(assetBalance)}`);
  console.log(`   KVaultV2 wrapped: ${ethers.formatEther(wrappedBalance)}`);
  console.log(`   KVaultV2 WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  
  if (assetBalance === 0n) {
    console.log(`❌ Asset 잔액이 없어서 테스트 불가능`);
    return;
  }
  
  console.log(`\n🔧 단계별 swap 테스트:`);
  
  try {
    // Step 1: 소량의 asset을 wrap
    const wrapAmount = ethers.parseEther("0.01");
    console.log(`   1. ${ethers.formatEther(wrapAmount)} asset wrap 시도...`);
    
    if (wrapAmount > assetBalance) {
      console.log(`❌ Wrap할 asset 부족`);
      return;
    }
    
    // Asset approve for wrapping
    await assetContract.approve(tokenInfo.tokenA, wrapAmount);
    
    // 실제 wrap - LST마다 다른 인터페이스 시도
    try {
      // KoKAIA의 경우 일반적인 wrap 함수 시도
      const wrapperContract = await ethers.getContractAt([
        "function wrap(uint256 amount)",
        "function deposit(uint256 amount)", 
        "function mint(uint256 amount)"
      ], tokenInfo.tokenA);
      
      let wrapTx;
      try {
        wrapTx = await wrapperContract.wrap(wrapAmount);
      } catch (e1) {
        try {
          wrapTx = await wrapperContract.deposit(wrapAmount);
        } catch (e2) {
          wrapTx = await wrapperContract.mint(wrapAmount);
        }
      }
      
      await wrapTx.wait();
      
      const newWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
      console.log(`   ✅ Wrap 성공! 새 wrapped balance: ${ethers.formatEther(newWrappedBalance)}`);
      
      // Step 2: SwapContract로 wrapped token 전송
      const transferAmount = newWrappedBalance; // 전체 전송
      console.log(`   2. SwapContract로 ${ethers.formatEther(transferAmount)} 전송...`);
      
      await wrappedContract.transfer(swapContractAddress, transferAmount);
      
      const swapBalance = await wrappedContract.balanceOf(swapContractAddress);
      console.log(`   ✅ 전송 성공! SwapContract balance: ${ethers.formatEther(swapBalance)}`);
      
      // Step 3: 직접 SwapContract.swap 호출
      console.log(`   3. SwapContract.swap 직접 호출...`);
      
      const swapContract = await ethers.getContractAt("SwapContract", swapContractAddress);
      
      const tokenInfoStruct = {
        asset: tokenInfo.asset,
        tokenA: tokenInfo.tokenA,
        tokenB: tokenInfo.tokenB,
        tokenC: tokenInfo.tokenC,
        pool1: tokenInfo.pool1,
        pool2: tokenInfo.pool2,
        handler: tokenInfo.handler
      };
      
      // KVaultV2로 impersonate해서 호출
      await ethers.provider.send("hardhat_impersonateAccount", [vaultAddress]);
      const vaultSigner = await ethers.getSigner(vaultAddress);
      
      try {
        const swapTx = await swapContract.connect(vaultSigner).swap(
          tokenInfoStruct,
          balancerVault,
          transferAmount,
          0 // numWrap = 0 (이미 wrap됨)
        );
        
        const receipt = await swapTx.wait();
        console.log(`   ✅ Swap 성공! Gas: ${receipt.gasUsed.toLocaleString()}`);
        
        // 최종 결과 확인
        const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
        const gainedWKAIA = finalVaultWKAIA - vaultWKAIA;
        
        console.log(`   💰 결과: ${ethers.formatEther(gainedWKAIA)} WKAIA 획득`);
        console.log(`   📈 교환 비율: ${ethers.formatEther(wrapAmount)} asset → ${ethers.formatEther(gainedWKAIA)} WKAIA`);
        
      } catch (swapError) {
        console.log(`   ❌ Swap 실패: ${swapError.message}`);
        
        if (swapError.message.includes("BAL#401")) {
          console.log(`   💡 BAL#401 오류 - 여전히 Balancer 문제`);
          
          // 더 상세한 분석
          console.log(`\n🔍 BAL#401 상세 분석:`);
          console.log(`   가능한 원인:`);
          console.log(`   1. Pool이 실제로 존재하지 않음`);
          console.log(`   2. Pool이 비활성화됨`);
          console.log(`   3. Token이 pool에 등록되지 않음`);
          console.log(`   4. Liquidity 부족`);
          console.log(`   5. Assets 순서 여전히 잘못됨`);
          
        } else if (swapError.message.includes("Amount must be positive")) {
          console.log(`   💡 Amount must be positive - transferred amount가 0`);
        }
      }
      
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [vaultAddress]);
      
    } catch (wrapError) {
      console.log(`   ❌ Wrap 실패: ${wrapError.message}`);
    }
    
  } catch (error) {
    console.log(`❌ 전체 테스트 실패: ${error.message}`);
  }
}

testSingleLSTSwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });