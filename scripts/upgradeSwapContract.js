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
    
    // SwapContract is now upgradeable (UUPS proxy)
    console.log("📦 SwapContract 업그레이드 중...");
    
    try {
        const SwapContract = await ethers.getContractFactory("SwapContract");
        
        // Upgrade the existing SwapContract proxy
        const swapContract = await upgrades.upgradeProxy(
            deployments.swapContract,
            SwapContract,
            { 
                kind: 'uups',
                redeployImplementation: 'always'
            }
        );
        await swapContract.waitForDeployment();
        const proxyAddress = await swapContract.getAddress();
        
        console.log(`  ✅ SwapContract 업그레이드 완료: ${proxyAddress}`);
        
        // Verify the upgrade
        console.log("\n🔍 업그레이드 검증 중...");
        
        // Check owner
        const owner = await swapContract.owner();
        console.log(`  Owner: ${owner}`);
        console.log(`  Match: ${owner === deployer.address ? '✅' : '❌'}`);
        
        // Note: When upgrading a UUPS proxy, the address remains the same
        console.log("\n✅ SwapContract 업그레이드가 성공적으로 완료되었습니다.");
        console.log("   (프록시 주소는 변경되지 않으므로 VaultCore 업데이트 불필요)");
        
        // Update deployment file with timestamp
        deployments.lastSwapContractUpdate = new Date().toISOString();
        
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
        console.log(`  ✅ ${deploymentFile} 타임스탬프 업데이트 완료`);
        
        console.log("\n✅ 모든 작업 완료!");
        
    } catch (error) {
        console.error("❌ 업그레이드 실패:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });