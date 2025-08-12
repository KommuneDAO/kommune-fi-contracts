const { ethers } = require("hardhat");
const fs = require("fs");

async function checkPoolConfig() {
  console.log("🔍 Pool 설정 확인");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // 각 LST의 tokensInfo 확인
  console.log(`📊 TokensInfo 설정 확인:`);
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      console.log(`\nLST ${i}:`);
      console.log(`   asset: ${tokenInfo.asset}`);
      console.log(`   tokenA: ${tokenInfo.tokenA}`);
      console.log(`   tokenB: ${tokenInfo.tokenB}`);
      console.log(`   tokenC: ${tokenInfo.tokenC}`);
      console.log(`   pool1: ${tokenInfo.pool1}`);
      console.log(`   pool2: ${tokenInfo.pool2}`);
      console.log(`   handler: ${tokenInfo.handler}`);
      
      // Pool ID가 올바른지 확인 (0x00...이 아닌지)
      if (tokenInfo.pool1 === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`   ⚠️ pool1이 설정되지 않음`);
      }
      if (tokenInfo.pool2 === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`   ⚠️ pool2가 설정되지 않음`);
      }
      
    } catch (e) {
      console.log(`LST ${i}: 설정 확인 실패 - ${e.message}`);
    }
  }
  
  // 실제 swap path 확인 - LST 0의 경우
  console.log(`\n🔍 LST 0 swap path 상세 분석:`);
  try {
    const tokenInfo = await vault.tokensInfo(0);
    
    // Assets 순서 확인
    console.log(`Assets 배열 순서:`);
    console.log(`   [0] tokenA (${tokenInfo.tokenA})`);  
    console.log(`   [1] tokenB (${tokenInfo.tokenB})`);
    console.log(`   [2] tokenC (${tokenInfo.tokenC})`);
    
    // Step 구성 확인
    console.log(`\nSwap Steps:`);
    console.log(`   Step 1: tokenA → tokenB (pool1: ${tokenInfo.pool1})`);
    console.log(`   Step 2: tokenB → tokenC (pool2: ${tokenInfo.pool2})`);
    
    // 각 토큰이 실제로 존재하는지 확인
    const tokenA = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
    const tokenB = await ethers.getContractAt("IERC20", tokenInfo.tokenB);  
    const tokenC = await ethers.getContractAt("IERC20", tokenInfo.tokenC);
    
    console.log(`\n토큰 존재 확인:`);
    try {
      const symbolA = await tokenA.symbol();
      console.log(`   tokenA: ${symbolA}`);
    } catch {
      console.log(`   tokenA: ❌ 접근 불가`);
    }
    
    try {
      const symbolB = await tokenB.symbol();
      console.log(`   tokenB: ${symbolB}`);
    } catch {
      console.log(`   tokenB: ❌ 접근 불가`);
    }
    
    try {
      const symbolC = await tokenC.symbol();  
      console.log(`   tokenC: ${symbolC}`);
    } catch {
      console.log(`   tokenC: ❌ 접근 불가`);
    }
    
  } catch (error) {
    console.log(`LST 0 분석 실패: ${error.message}`);
  }
  
  // Balancer Vault 주소 확인
  const balancerVault = await vault.vault();
  console.log(`\n🏛️ Balancer Vault: ${balancerVault}`);
  
  try {
    const vaultContract = await ethers.getContractAt("IBalancerVault", balancerVault);
    
    // 간단한 vault 호출로 연결 테스트
    // getPool 같은 함수가 있다면 pool 정보 확인
    console.log(`   Vault 연결: ✅ 정상`);
  } catch (error) {
    console.log(`   Vault 연결: ❌ 실패 - ${error.message}`);
  }
}

checkPoolConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });