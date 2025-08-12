const { ethers } = require("hardhat");
const fs = require("fs");

async function findWrapFunction() {
  console.log("🔍 올바른 wrap 함수 찾기");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // 각 LST의 wrap 함수 찾기
  for (let i = 0; i < 4; i++) {
    const tokenInfo = await vault.tokensInfo(i);
    console.log(`\n📊 LST ${i}:`);
    console.log(`   Asset: ${tokenInfo.asset}`);
    console.log(`   TokenA: ${tokenInfo.tokenA}`);
    
    if (i === 3) {
      console.log(`   → stKAIA는 wrap 불필요 (asset === tokenA)`);
      continue;
    }
    
    const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const assetBalance = await assetContract.balanceOf(vaultAddress);
    
    console.log(`   Asset balance: ${ethers.formatEther(assetBalance)}`);
    
    if (assetBalance === 0n) {
      console.log(`   → Asset 부족으로 테스트 불가`);
      continue;
    }
    
    // 다양한 wrap 함수 시그니처 시도
    const wrapFunctions = [
      "function wrap(uint256 amount)",
      "function deposit(uint256 amount)", 
      "function mint(uint256 amount)",
      "function stake(uint256 amount)",
      "function wrap(uint256 amount) returns (uint256)",
      "function wrapKaia(uint256 amount)",
      "function convertToShares(uint256 assets)"
    ];
    
    const testAmount = ethers.parseEther("0.001"); // 아주 작은 양으로 테스트
    
    if (testAmount > assetBalance) {
      console.log(`   → 테스트 양 ${ethers.formatEther(testAmount)}도 부족`);
      continue;
    }
    
    // Approve first
    try {
      await assetContract.approve(tokenInfo.tokenA, testAmount);
      console.log(`   ✅ Approve 성공`);
    } catch (approveError) {
      console.log(`   ❌ Approve 실패: ${approveError.message}`);
      continue;
    }
    
    let wrapSuccess = false;
    
    for (const funcSig of wrapFunctions) {
      try {
        console.log(`   🧪 시도: ${funcSig}`);
        
        const wrapperContract = await ethers.getContractAt([funcSig], tokenInfo.tokenA);
        
        // 함수명 추출
        const funcName = funcSig.split('(')[0].split(' ')[1];
        
        const balanceBefore = await ethers.getContractAt("IERC20", tokenInfo.tokenA).then(c => 
          c.balanceOf(vaultAddress)
        );
        
        const wrapTx = await wrapperContract[funcName](testAmount);
        await wrapTx.wait();
        
        const balanceAfter = await ethers.getContractAt("IERC20", tokenInfo.tokenA).then(c => 
          c.balanceOf(vaultAddress)
        );
        
        const gained = balanceAfter - balanceBefore;
        
        if (gained > 0) {
          console.log(`   ✅ 성공! ${funcName} 함수 작동`);
          console.log(`   💰 ${ethers.formatEther(testAmount)} asset → ${ethers.formatEther(gained)} wrapped`);
          console.log(`   📈 Wrap 비율: ${Number(gained) / Number(testAmount)}`);
          wrapSuccess = true;
          break;
        } else {
          console.log(`   ❌ ${funcName}: 실행됐지만 wrapped token 증가 없음`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${funcSig.split('(')[0].split(' ')[1]}: ${error.message}`);
      }
    }
    
    if (!wrapSuccess) {
      console.log(`   ❌ LST ${i}: 모든 wrap 함수 실패`);
      
      // Contract code 확인
      const code = await ethers.provider.getCode(tokenInfo.tokenA);
      if (code === "0x") {
        console.log(`   💡 TokenA 컨트랙트가 존재하지 않음!`);
      } else {
        console.log(`   💡 TokenA 컨트랙트는 존재하지만 표준 wrap 함수 없음`);
      }
    } else {
      console.log(`   🎉 LST ${i}: Wrap 성공적으로 찾음!`);
    }
  }
}

findWrapFunction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });