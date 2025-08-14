const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔧 SwapContract 업그레이드\n");
    console.log("⚠️  주의: SwapContract는 FINALIZED 상태입니다.");
    console.log("⚠️  꼭 필요한 경우에만 업그레이드하세요!\n");
    
    const [deployer] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    const deploymentFile = `deployments-${networkName}.json`;
    
    if (!fs.existsSync(deploymentFile)) {
        console.error(`❌ ${deploymentFile} not found. Please run deployFresh.js first.`);
        process.exit(1);
    }
    
    const deployments = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    
    console.log("📋 현재 배포 정보:");
    console.log(`  Network: ${networkName}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  SwapContract: ${deployments.swapContract}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    
    // Confirmation prompt
    console.log("\n❗ SwapContract는 이미 최적화되어 있습니다.");
    console.log("❗ 모든 4개 LST에 대해 테스트 완료되었습니다.");
    console.log("❗ 정말로 업그레이드가 필요합니까?\n");
    
    // Note: SwapContract is NOT upgradeable (not a proxy)
    // This script is for deploying a NEW SwapContract if needed
    
    console.log("📦 새 SwapContract 배포 중...");
    
    try {
        const SwapContract = await ethers.getContractFactory("SwapContract");
        
        // Deploy new SwapContract (not upgradeable)
        const swapContract = await SwapContract.deploy();
        await swapContract.waitForDeployment();
        const newAddress = await swapContract.getAddress();
        
        console.log(`  ✅ 새 SwapContract 배포: ${newAddress}`);
        
        // Set authorized caller to VaultCore
        console.log("\n🔐 VaultCore 권한 설정 중...");
        const tx = await swapContract.setAuthorizedCaller(deployments.vaultCore);
        await tx.wait();
        console.log(`  ✅ VaultCore 권한 설정 완료`);
        
        // Update VaultCore to use new SwapContract
        console.log("\n🔄 VaultCore에 새 SwapContract 연결 중...");
        const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
        const updateTx = await vaultCore.setSwapContract(newAddress);
        await updateTx.wait();
        console.log(`  ✅ VaultCore 업데이트 완료`);
        
        // Verify the update
        const currentSwap = await vaultCore.swapContract();
        if (currentSwap === newAddress) {
            console.log("  ✅ 연결 확인 완료");
        } else {
            console.log("  ❌ 연결 실패!");
            process.exit(1);
        }
        
        // Update deployment file
        const oldAddress = deployments.swapContract;
        deployments.swapContract = newAddress;
        deployments.swapContractOld = oldAddress;
        deployments.lastSwapContractUpdate = new Date().toISOString();
        
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
        
        console.log("\n✅ SwapContract 교체 완료!");
        console.log(`  이전 주소: ${oldAddress}`);
        console.log(`  새 주소: ${newAddress}`);
        
        console.log("\n📝 다음 단계:");
        console.log("  1. testIntegrated.js로 기능 테스트");
        console.log("  2. 모든 4개 LST swap 테스트");
        console.log("  3. 가스 사용량 확인");
        
    } catch (error) {
        console.error("\n❌ SwapContract 교체 실패:");
        console.error(error.message);
        
        if (error.message.includes("Ownable")) {
            console.error("\n💡 힌트: VaultCore owner 권한이 필요합니다.");
        }
        
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });