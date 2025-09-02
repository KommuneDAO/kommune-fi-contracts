const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("\n🔧 SwapContract 업그레이드 (캐시 문제 해결 버전)");
    console.log("═".repeat(60));
    
    const [deployer] = await ethers.getSigners();
    const networkName = (await ethers.provider.getNetwork()).name;
    const profile = process.env.PROFILE || 'stable';
    
    // Load deployment file
    const deploymentFile = `deployments-${profile}-${networkName}.json`;
    if (!fs.existsSync(deploymentFile)) {
        console.error(`❌ ${deploymentFile} 파일이 없습니다.`);
        console.log(`사용 가능한 프로필: stable, balanced`);
        process.exit(1);
    }
    
    const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    
    console.log(`\n📊 Profile: ${profile.toUpperCase()}`);
    console.log(`📋 현재 배포 정보:`);
    console.log(`  Network: ${networkName}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  SwapContract Proxy: ${deployments.swapContract}`);
    
    // Get current implementation
    const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const currentImpl = await ethers.provider.getStorage(deployments.swapContract, implSlot);
    const currentImplAddress = '0x' + currentImpl.slice(-40);
    console.log(`  Current Implementation: ${currentImplAddress}`);
    
    console.log("\n📦 SwapContract 업그레이드 중...");
    
    try {
        const SwapContract = await ethers.getContractFactory("SwapContract");
        
        // Deploy new implementation directly first
        console.log("  새 구현체 직접 배포 중...");
        const newImpl = await upgrades.deployImplementation(SwapContract, {
            kind: 'uups',
            redeployImplementation: 'always'
        });
        console.log(`  ✓ 새 구현체 배포됨: ${newImpl}`);
        
        // Upgrade proxy
        console.log("  프록시 업그레이드 중...");
        const swapContract = await upgrades.upgradeProxy(
            deployments.swapContract,
            SwapContract,
            {
                kind: 'uups',
                useDeployedImplementation: true,
                unsafeSkipStorageCheck: true
            }
        );
        await swapContract.waitForDeployment();
        console.log("  ✅ SwapContract 업그레이드 완료");
        
        // Verify new implementation
        const newImplStorage = await ethers.provider.getStorage(deployments.swapContract, implSlot);
        const newImplAddress = '0x' + newImplStorage.slice(-40);
        console.log(`  New Implementation: ${newImplAddress}`);
        
        if (currentImplAddress === newImplAddress) {
            console.log("  ⚠️  경고: Implementation이 변경되지 않았습니다!");
            console.log("     수동 업그레이드를 시도합니다...");
            
            // Manual deployment and upgrade
            const manualImpl = await SwapContract.deploy();
            await manualImpl.waitForDeployment();
            const manualImplAddress = await manualImpl.getAddress();
            console.log(`  ✓ 수동 구현체 배포됨: ${manualImplAddress}`);
            
            // Upgrade using upgradeToAndCall
            const uupsABI = ["function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"];
            const proxy = new ethers.Contract(deployments.swapContract, uupsABI, deployer);
            
            console.log("  프록시 직접 업그레이드 중...");
            const tx = await proxy.upgradeToAndCall(manualImplAddress, '0x');
            await tx.wait();
            console.log("  ✅ 직접 업그레이드 완료");
        } else {
            console.log("  ✅ Implementation이 성공적으로 변경되었습니다!");
        }
        
        // Test functionality
        console.log("\n🔍 기능 테스트...");
        const owner = await swapContract.owner();
        console.log(`  Owner: ${owner}`);
        
        // Update deployment file
        deployments.lastSwapContractUpgrade = new Date().toISOString();
        const finalImpl = await ethers.provider.getStorage(deployments.swapContract, implSlot);
        deployments.swapContractImplementation = '0x' + finalImpl.slice(-40);
        
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
        console.log("\n✅ 배포 정보 업데이트 완료");
        
    } catch (error) {
        console.error("\n❌ 업그레이드 실패:", error.message);
        
        console.log("\n💡 해결 방법:");
        console.log("1. 캐시 정리: rm -rf .openzeppelin cache artifacts");
        console.log("2. 재컴파일: npx hardhat compile");
        console.log("3. 다시 시도: PROFILE=stable npx hardhat run scripts/upgradeSwapContractFixed.js --network kaia");
        
        process.exit(1);
    }
}

// Helper function to clean cache before upgrade
async function cleanCache() {
    console.log("\n🧹 캐시 정리 중...");
    
    const cacheDirs = ['.openzeppelin', 'cache', 'artifacts/build-info'];
    
    for (const dir of cacheDirs) {
        if (fs.existsSync(dir)) {
            console.log(`  Removing ${dir}...`);
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
    
    console.log("  ✓ 캐시 정리 완료");
}

// Optional: Run cache cleaning before upgrade
if (process.env.CLEAN_CACHE === 'true') {
    cleanCache().then(() => main()).catch(console.error);
} else {
    main().catch(console.error);
}

// 사용법:
// PROFILE=stable npx hardhat run scripts/upgradeSwapContractFixed.js --network kaia
// CLEAN_CACHE=true PROFILE=stable npx hardhat run scripts/upgradeSwapContractFixed.js --network kaia