const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * LST Staking 상태 및 기능 확인
 */
async function checkLSTStaking() {
  console.log("🔍 LST Staking 상태 확인");
  console.log("=" .repeat(50));
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", deployments.KVaultV2);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log(`📍 Network: ${networkName}`);
  console.log(`📍 Vault: ${deployments.KVaultV2}`);
  console.log();
  
  // 1. 현재 LST 잔액 확인
  console.log("📊 1. 현재 LST 잔액");
  const lstNames = ['KoKAIA', 'GCKAIA', 'stKLAY', 'stKAIA'];
  
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const lstContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const balance = await lstContract.balanceOf(deployments.KVaultV2);
      
      console.log(`   ${lstNames[i]} (${tokenInfo.asset})`);
      console.log(`     Vault Balance: ${ethers.formatEther(balance)}`);
      console.log(`     Handler: ${tokenInfo.handler}`);
    } catch (error) {
      console.log(`   ${lstNames[i]}: 조회 실패 - ${error.message}`);
    }
    console.log();
  }
  
  // 2. APY 설정 확인
  console.log("📊 2. APY 설정 확인");
  for (let i = 0; i < 4; i++) {
    try {
      const apy = await vault.getAPY(i);
      console.log(`   ${lstNames[i]} APY: ${apy}%`);
    } catch (error) {
      console.log(`   ${lstNames[i]} APY: 조회 실패`);
    }
  }
  console.log();
  
  // 3. investRatio 확인
  console.log("📊 3. Investment 설정");
  try {
    const investRatio = await vault.investRatio();
    console.log(`   InvestRatio: ${investRatio} / 10000 (${(investRatio / 100).toFixed(1)}%)`);
  } catch (error) {
    console.log(`   InvestRatio 조회 실패: ${error.message}`);
  }
  console.log();
  
  // 4. 작은 금액으로 Deposit 후 LST 변화 확인
  console.log("🔬 4. LST Staking 테스트");
  
  try {
    const depositAmount = ethers.parseEther("0.01"); // 매우 작은 금액
    
    console.log(`   ${ethers.formatEther(depositAmount)} WKAIA 예치 테스트`);
    
    // LST 잔액 Before
    const lstBalancesBefore = [];
    for (let i = 0; i < 4; i++) {
      try {
        const tokenInfo = await vault.tokensInfo(i);
        const lstContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await lstContract.balanceOf(deployments.KVaultV2);
        lstBalancesBefore[i] = balance;
      } catch (error) {
        lstBalancesBefore[i] = 0n;
      }
    }
    
    // Vault KAIA 잔액 Before
    const vaultKAIABefore = await ethers.provider.getBalance(deployments.KVaultV2);
    const vaultWKAIABefore = await wkaia.balanceOf(deployments.KVaultV2);
    
    console.log(`   Vault KAIA Before: ${ethers.formatEther(vaultKAIABefore)}`);
    console.log(`   Vault WKAIA Before: ${ethers.formatEther(vaultWKAIABefore)}`);
    
    // Deposit 실행
    await wkaia.approve(deployments.KVaultV2, 0);
    await wkaia.approve(deployments.KVaultV2, depositAmount);
    
    const depositTx = await vault.deposit(depositAmount, signer.address);
    const receipt = await depositTx.wait();
    
    console.log(`   ✅ Deposit 성공! Gas: ${receipt.gasUsed.toLocaleString()}`);
    
    // LST 잔액 After
    const lstBalancesAfter = [];
    for (let i = 0; i < 4; i++) {
      try {
        const tokenInfo = await vault.tokensInfo(i);
        const lstContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const balance = await lstContract.balanceOf(deployments.KVaultV2);
        lstBalancesAfter[i] = balance;
      } catch (error) {
        lstBalancesAfter[i] = 0n;
      }
    }
    
    // Vault KAIA 잔액 After
    const vaultKAIAAfter = await ethers.provider.getBalance(deployments.KVaultV2);
    const vaultWKAIAAfter = await wkaia.balanceOf(deployments.KVaultV2);
    
    console.log();
    console.log("   📈 Staking 결과:");
    console.log(`   Vault KAIA After: ${ethers.formatEther(vaultKAIAAfter)}`);
    console.log(`   Vault WKAIA After: ${ethers.formatEther(vaultWKAIAAfter)}`);
    
    let anyLSTIncreased = false;
    
    for (let i = 0; i < 4; i++) {
      const increase = lstBalancesAfter[i] - lstBalancesBefore[i];
      if (increase > 0) {
        console.log(`   ${lstNames[i]} 증가: +${ethers.formatEther(increase)}`);
        anyLSTIncreased = true;
      } else if (increase === 0n) {
        console.log(`   ${lstNames[i]}: 변화 없음`);
      }
    }
    
    if (!anyLSTIncreased) {
      console.log("   ⚠️  LST 토큰 증가 없음 - Staking 실패 또는 최소 금액 부족");
      
      // Transaction logs 확인
      console.log("\n   📋 Transaction Events:");
      if (receipt.logs.length === 0) {
        console.log("   이벤트 없음 - staking이 수행되지 않았을 가능성");
      } else {
        console.log(`   ${receipt.logs.length}개의 이벤트 발생`);
      }
    } else {
      console.log("   ✅ LST Staking 성공!");
    }
    
  } catch (error) {
    console.log(`   ❌ Staking 테스트 실패: ${error.message}`);
  }
  
  return true;
}

if (require.main === module) {
  checkLSTStaking()
    .then(() => {
      console.log("\n🎉 LST 상태 확인 완료!");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { checkLSTStaking };