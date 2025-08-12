const { ethers } = require("hardhat");
const fs = require("fs");

async function setSwapContract() {
  console.log("🔗 SwapContract 연결 시도");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  const vaultAddress = deployments.KVaultV2;
  const newSwapAddress = "0x97B54eaD9894bf00Fc76E804679d8988079f1216";
  
  const [signer] = await ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);
  
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    // Check if the function exists
    console.log("📋 Vault 함수 목록 확인...");
    
    // Try different possible function names
    const possibleFunctions = [
      "setSwapContract",
      "updateSwapContract", 
      "setSwapContractAddress",
      "swapContract"
    ];
    
    for (const funcName of possibleFunctions) {
      try {
        if (vault.interface.getFunction(funcName)) {
          console.log(`✅ 함수 발견: ${funcName}`);
        }
      } catch (e) {
        console.log(`❌ 함수 없음: ${funcName}`);
      }
    }
    
    // Try to call setSwapContract if it exists
    const setSwapTx = await vault.setSwapContract(newSwapAddress);
    await setSwapTx.wait();
    
    console.log("✅ SwapContract 연결 성공!");
    
    // Update deployment file
    deployments.SwapContract = newSwapAddress;
    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
    console.log("✅ 배포 정보 업데이트됨");
    
  } catch (error) {
    console.log(`❌ 연결 실패: ${error.message}`);
    
    // Check current swap contract
    try {
      const currentSwap = await vault.swapContract();
      console.log(`📋 현재 SwapContract: ${currentSwap}`);
      
      // If it's the same, we're good
      if (currentSwap.toLowerCase() === newSwapAddress.toLowerCase()) {
        console.log("✅ 이미 올바른 SwapContract가 설정되어 있습니다!");
        
        deployments.SwapContract = newSwapAddress;
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
      }
    } catch (e) {
      console.log(`❌ 현재 SwapContract 조회 실패: ${e.message}`);
    }
  }
}

setSwapContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });