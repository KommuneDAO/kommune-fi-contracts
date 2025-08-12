const { ethers } = require("hardhat");
const fs = require("fs");

async function debugEstimateSwap() {
  console.log("🔍 estimateSwap 디버깅");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const vaultAddress = deployments.KVaultV2;
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  // LST 3 테스트
  const targetAmount = ethers.parseEther("0.005");
  
  console.log(`\n📊 estimateSwap 테스트 (LST 3, ${ethers.formatEther(targetAmount)} WKAIA):`);
  
  try {
    const result = await vault.estimateSwap.staticCall(3, targetAmount);
    console.log(`   결과: ${ethers.formatEther(result)} stKAIA 필요`);
  } catch (error) {
    console.log(`   ❌ 실패: ${error.message}`);
    
    // 더 자세한 오류 정보
    if (error.data) {
      console.log(`   오류 데이터: ${error.data}`);
    }
    if (error.reason) {
      console.log(`   오류 이유: ${error.reason}`);
    }
  }
}

debugEstimateSwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });