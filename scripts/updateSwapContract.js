const { ethers } = require("hardhat");
const fs = require("fs");

async function updateSwapContract() {
  console.log("🔄 SwapContract 업데이트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  
  // 새로운 SwapContract 배포
  console.log("📦 새로운 SwapContract 배포...");
  const SwapContract = await ethers.getContractFactory("SwapContract");
  const newSwapContract = await SwapContract.deploy();
  await newSwapContract.waitForDeployment();
  
  const newSwapAddress = await newSwapContract.getAddress();
  console.log(`✅ 새 SwapContract: ${newSwapAddress}`);
  
  // Initialize
  await newSwapContract.initialize();
  console.log("✅ SwapContract initialized");
  
  // Vault에서 SwapContract 업데이트
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  try {
    const updateTx = await vault.setSwapContract(newSwapAddress);
    await updateTx.wait();
    console.log("✅ Vault SwapContract 업데이트 완료");
    
    // 배포 정보 업데이트
    deployments.SwapContract = newSwapAddress;
    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
    console.log("✅ 배포 정보 업데이트됨");
    
  } catch (error) {
    console.log(`❌ SwapContract 업데이트 실패: ${error.message}`);
    console.log("💡 Owner 권한이 필요할 수 있습니다.");
  }
  
  console.log("\n🔧 적용된 SwapContract 개선사항:");
  console.log("   ✅ Safe int256 conversions in Balancer limits");
  console.log("   ✅ Wrap success verification");
  console.log("   ✅ Overflow protection for large amounts");
}

updateSwapContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });