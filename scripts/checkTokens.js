const { ethers } = require("hardhat");
const fs = require("fs");

async function checkTokens() {
  console.log("🔍 토큰 주소 유효성 확인");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  for (let i = 0; i < 3; i++) { // LST 0, 1, 2만 체크 (3은 다름)
    const tokenInfo = await vault.tokensInfo(i);
    console.log(`\nLST ${i} 토큰 확인:`);
    
    const addresses = [
      { name: "tokenA", addr: tokenInfo.tokenA },
      { name: "tokenB", addr: tokenInfo.tokenB }, 
      { name: "tokenC", addr: tokenInfo.tokenC }
    ];
    
    for (const token of addresses) {
      try {
        // 가장 기본적인 방법: bytecode 확인
        const code = await ethers.provider.getCode(token.addr);
        if (code === "0x") {
          console.log(`   ${token.name}: ❌ 컨트랙트 없음 (${token.addr})`);
        } else {
          console.log(`   ${token.name}: ✅ 컨트랙트 존재 (${token.addr})`);
          
          // 추가: 기본 호출 시도
          try {
            const balance = await ethers.provider.getBalance(token.addr);
            console.log(`      Balance: ${ethers.formatEther(balance)} KAIA`);
          } catch {
            console.log(`      Balance: 확인 불가`);
          }
        }
      } catch (error) {
        console.log(`   ${token.name}: ❌ 확인 실패 - ${error.message}`);
      }
    }
  }
  
  // Pool ID도 간단히 확인
  console.log(`\n🔍 Pool ID 형식 확인:`);
  for (let i = 0; i < 3; i++) {
    const tokenInfo = await vault.tokensInfo(i);
    console.log(`LST ${i}:`);
    console.log(`   pool1: ${tokenInfo.pool1} (길이: ${tokenInfo.pool1.length})`);
    console.log(`   pool2: ${tokenInfo.pool2} (길이: ${tokenInfo.pool2.length})`);
    
    // 올바른 pool ID는 64 문자 (0x + 62 hex chars)여야 함
    if (tokenInfo.pool1.length !== 66) {
      console.log(`   ⚠️ pool1 길이 비정상`);
    }
    if (tokenInfo.pool2.length !== 66) {
      console.log(`   ⚠️ pool2 길이 비정상`);
    }
  }
}

checkTokens()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });