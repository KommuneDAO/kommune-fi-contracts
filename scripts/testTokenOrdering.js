const { ethers } = require("hardhat");
const fs = require("fs");

async function testTokenOrdering() {
  console.log("🔍 토큰 순서 확인 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  console.log("\n📊 모든 LST 토큰 정보:");
  
  for (let i = 0; i <= 3; i++) {
    const tokenInfo = await vault.tokensInfo(i);
    
    console.log(`\n📌 LST ${i}:`);
    console.log(`   Asset: ${tokenInfo.asset}`);
    console.log(`   TokenA: ${tokenInfo.tokenA}`);
    console.log(`   TokenB: ${tokenInfo.tokenB}`);
    console.log(`   TokenC: ${tokenInfo.tokenC}`);
    console.log(`   Pool1: ${tokenInfo.pool1}`);
    console.log(`   Pool2: ${tokenInfo.pool2}`);
    
    // 정렬 시뮬레이션
    const addresses = [tokenInfo.tokenA, tokenInfo.tokenB, tokenInfo.tokenC];
    const sorted = [...addresses].sort((a, b) => {
      const aBig = BigInt(a);
      const bBig = BigInt(b);
      return aBig > bBig ? 1 : -1;
    });
    
    console.log("\n   정렬 후 순서:");
    sorted.forEach((addr, idx) => {
      let label = "";
      if (addr === tokenInfo.tokenA) label = "tokenA";
      else if (addr === tokenInfo.tokenB) label = "tokenB";
      else if (addr === tokenInfo.tokenC) label = "tokenC";
      console.log(`   [${idx}] ${addr} (${label})`);
    });
    
    // 인덱스 계산
    let tokenAIndex, tokenBIndex, tokenCIndex;
    sorted.forEach((addr, idx) => {
      if (addr === tokenInfo.tokenA) tokenAIndex = idx;
      else if (addr === tokenInfo.tokenB) tokenBIndex = idx;
      else if (addr === tokenInfo.tokenC) tokenCIndex = idx;
    });
    
    console.log("\n   계산된 인덱스:");
    console.log(`   tokenA index: ${tokenAIndex}`);
    console.log(`   tokenB index: ${tokenBIndex}`);
    console.log(`   tokenC index: ${tokenCIndex}`);
    
    console.log("\n   Swap 경로:");
    console.log(`   GIVEN_IN: [${tokenAIndex}]tokenA → [${tokenBIndex}]tokenB (pool1) → [${tokenCIndex}]tokenC (pool2)`);
    console.log(`   GIVEN_OUT: [${tokenCIndex}]tokenC ← [${tokenBIndex}]tokenB (pool2) ← [${tokenAIndex}]tokenA (pool1)`);
  }
}

testTokenOrdering()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });