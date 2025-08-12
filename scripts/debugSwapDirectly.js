const { ethers } = require("hardhat");
const fs = require("fs");

async function debugSwapDirectly() {
  console.log("🔍 직접 swap 테스트 (vault 경유하지 않음)");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const swapContract = await ethers.getContractAt("SwapContract", swapContractAddress);
  
  // LST 3 (stKAIA) 테스트 - wrap 불필요
  const tokenInfo = await vault.tokensInfo(3);
  console.log("\n📊 LST 3 (stKAIA) 정보:");
  console.log(`   Asset/TokenA: ${tokenInfo.asset}`);
  console.log(`   TokenB: ${tokenInfo.tokenB}`);
  console.log(`   TokenC: ${tokenInfo.tokenC}`);
  console.log(`   Pool1: ${tokenInfo.pool1}`);
  console.log(`   Pool2: ${tokenInfo.pool2}`);
  
  const stKAIA = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const tokenB = await ethers.getContractAt("IERC20", tokenInfo.tokenB);
  const wkaia = await ethers.getContractAt("IERC20", tokenInfo.tokenC);
  
  // 테스트 금액
  const testAmount = ethers.parseEther("0.01");
  
  // SwapContract에 stKAIA 전송
  const myBalance = await stKAIA.balanceOf(signer.address);
  console.log(`\n💰 내 stKAIA 잔액: ${ethers.formatEther(myBalance)}`);
  
  if (myBalance >= testAmount) {
    console.log(`   SwapContract에 ${ethers.formatEther(testAmount)} stKAIA 전송`);
    await stKAIA.transfer(swapContractAddress, testAmount);
    
    const swapContractBalance = await stKAIA.balanceOf(swapContractAddress);
    console.log(`   SwapContract stKAIA 잔액: ${ethers.formatEther(swapContractBalance)}`);
    
    // Balancer Vault에 approve
    console.log("\n🔧 Approve 설정:");
    const approvalTx = await stKAIA.approve(balancerVault, testAmount);
    await approvalTx.wait();
    console.log(`   ✅ Balancer Vault에 approve 완료`);
    
    // 직접 swap 시도
    console.log("\n🔄 Swap 시도:");
    try {
      // SwapContract를 통한 swap
      const swapTx = await swapContract.swap(
        tokenInfo,
        balancerVault,
        testAmount,
        0  // numWrap = 0 (stKAIA는 wrap 불필요)
      );
      
      const receipt = await swapTx.wait();
      console.log(`   ✅ Swap 성공!`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      
      // 결과 확인
      const finalWKAIA = await wkaia.balanceOf(swapContractAddress);
      console.log(`   받은 WKAIA: ${ethers.formatEther(finalWKAIA)}`);
      
    } catch (error) {
      console.log(`   ❌ Swap 실패: ${error.message}`);
      
      if (error.message.includes("BAL#401")) {
        console.log("\n   🔍 BAL#401 오류 분석:");
        
        // 토큰 잔액 확인
        const balA = await stKAIA.balanceOf(swapContractAddress);
        const balB = await tokenB.balanceOf(swapContractAddress);
        const balC = await wkaia.balanceOf(swapContractAddress);
        
        console.log(`      SwapContract 잔액:`);
        console.log(`      - stKAIA: ${ethers.formatEther(balA)}`);
        console.log(`      - TokenB: ${ethers.formatEther(balB)}`);
        console.log(`      - WKAIA: ${ethers.formatEther(balC)}`);
        
        // Approve 확인
        const allowance = await stKAIA.allowance(swapContractAddress, balancerVault);
        console.log(`      SwapContract → Balancer allowance: ${ethers.formatEther(allowance)}`);
      }
    }
  } else {
    console.log(`   ❌ stKAIA 부족`);
  }
}

debugSwapDirectly()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });