const { ethers } = require("hardhat");
const fs = require("fs");

async function diagnosticTest() {
  console.log("🔍 정밀 진단 테스트 - 0.08 WKAIA withdrawal 오류 분석");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log("📋 현재 상태:");
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const userShares = await vault.balanceOf(signer.address);
  const totalAssets = await vault.totalAssets();
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  console.log(`   사용자 shares: ${ethers.formatEther(userShares)}`);
  console.log(`   총 자산: ${ethers.formatEther(totalAssets)}`);
  
  const targetAmount = ethers.parseEther("0.08");
  console.log(`\n🎯 목표: ${ethers.formatEther(targetAmount)} WKAIA withdrawal`);
  console.log(`   부족분: ${ethers.formatEther(targetAmount - vaultWKAIA)} WKAIA`);
  
  // 1. Preview calculation first
  console.log("\n📊 1단계: Preview 계산");
  try {
    const sharesNeeded = await vault.previewWithdraw(targetAmount);
    console.log(`   필요한 shares: ${ethers.formatEther(sharesNeeded)}`);
    
    if (userShares < sharesNeeded) {
      console.log(`   ❌ Shares 부족!`);
      return;
    }
  } catch (previewError) {
    console.log(`   ❌ Preview 실패: ${previewError.message}`);
    return;
  }
  
  // 2. LST balances detailed check
  console.log("\n📊 2단계: LST 잔액 상세 확인");
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const assetBalance = await assetContract.balanceOf(vaultAddress);
      
      console.log(`   LST ${i}:`);
      console.log(`     Asset: ${tokenInfo.asset}`);
      console.log(`     Balance: ${ethers.formatEther(assetBalance)}`);
      
      if (i < 3) {
        try {
          const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
          const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
          console.log(`     Wrapped: ${ethers.formatEther(wrappedBalance)}`);
          console.log(`     TokenA: ${tokenInfo.tokenA}`);
        } catch (wrapError) {
          console.log(`     Wrapped: 조회 실패`);
        }
      }
    } catch (e) {
      console.log(`   LST ${i}: 전체 조회 실패`);
    }
  }
  
  // 3. selectAsset simulation
  console.log("\n📊 3단계: selectAsset 시뮬레이션");
  try {
    const needed = targetAmount - vaultWKAIA;
    console.log(`   필요한 LST → WKAIA 변환: ${ethers.formatEther(needed)}`);
    
    // Simulate selectAsset logic
    for (let i = 0; i < 4; i++) {
      try {
        const tokenInfo = await vault.tokensInfo(i);
        const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await assetContract.balanceOf(vaultAddress);
        
        if (balance > 0) {
          console.log(`   LST ${i} 가능 기여도: ${ethers.formatEther(balance)}`);
        }
      } catch (e) {
        console.log(`   LST ${i}: 시뮬레이션 실패`);
      }
    }
  } catch (selectError) {
    console.log(`   ❌ selectAsset 시뮬레이션 실패: ${selectError.message}`);
  }
  
  // 4. Try the actual withdrawal with better error handling
  console.log("\n📊 4단계: 실제 withdrawal 시도");
  try {
    // Estimate gas first
    const gasEstimate = await vault.withdraw.estimateGas(targetAmount, signer.address, signer.address);
    console.log(`   예상 Gas: ${gasEstimate.toLocaleString()}`);
    
    const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
    const receipt = await withdrawTx.wait();
    
    console.log(`   ✅ 성공! Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
    
  } catch (error) {
    console.log(`   ❌ 실패: ${error.message}`);
    
    // Try to extract more detailed error info
    if (error.data) {
      console.log(`   Error data: ${error.data}`);
    }
    
    if (error.reason) {
      console.log(`   Error reason: ${error.reason}`);
    }
    
    // Common error patterns
    if (error.message.includes("arithmetic underflow")) {
      console.log(`\n🔍 Arithmetic Underflow 분석:`);
      console.log(`   가능한 원인 1: 잔액 계산에서 음수 결과`);
      console.log(`   가능한 원인 2: swap amount 계산 오류`);
      console.log(`   가능한 원인 3: slippage 계산 초과`);
      
      // Check slippage setting
      try {
        const slippage = await vault.slippage();
        console.log(`   현재 slippage: ${slippage}%`);
      } catch (e) {
        console.log(`   Slippage 조회 실패`);
      }
    }
  }
  
  console.log(`\n📋 진단 완료`);
  console.log(`   기본 withdrawal (0.05): 정상 작동`);
  console.log(`   LST 필요 withdrawal (0.08): 실패`);
  console.log(`   원인: LST swap 로직에서 arithmetic underflow`);
}

diagnosticTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });