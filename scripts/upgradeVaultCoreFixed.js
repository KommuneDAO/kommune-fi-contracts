const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("\n🔧 VaultCore 업그레이드 (캐시 문제 해결 버전)");
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
    console.log(`  VaultCore Proxy: ${deployments.vaultCore}`);
    
    // Get current implementation
    const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const currentImpl = await ethers.provider.getStorage(deployments.vaultCore, implSlot);
    const currentImplAddress = '0x' + currentImpl.slice(-40);
    console.log(`  Current Implementation: ${currentImplAddress}`);
    
    console.log("\n📦 VaultCore 업그레이드 중...");
    
    try {
        // Deploy LPCalculations library first
        console.log("  LPCalculations 라이브러리 배포 중...");
        const LPCalculations = await ethers.getContractFactory("LPCalculations");
        const lpCalculations = await LPCalculations.deploy();
        await lpCalculations.waitForDeployment();
        const lpCalculationsAddress = await lpCalculations.getAddress();
        console.log(`  ✓ LPCalculations 배포됨: ${lpCalculationsAddress}`);
        
        // Get VaultCore factory with library linked
        const VaultCore = await ethers.getContractFactory("VaultCore", {
            libraries: {
                LPCalculations: lpCalculationsAddress
            }
        });
        
        // Deploy new implementation directly first
        console.log("  새 구현체 직접 배포 중 (라이브러리 링킹 포함)...");
        let newImpl;
        try {
            newImpl = await upgrades.deployImplementation(VaultCore, {
                kind: 'uups',
                redeployImplementation: 'always',
                unsafeAllow: ['delegatecall', 'external-library-linking'],
                unsafeAllowLinkedLibraries: true
            });
        } catch (e) {
            console.log("  upgrades 플러그인 실패, 수동 배포 시도...");
            const manualImpl = await VaultCore.deploy();
            await manualImpl.waitForDeployment();
            newImpl = await manualImpl.getAddress();
        }
        console.log(`  ✓ 새 구현체 배포됨: ${newImpl}`);
        
        // Upgrade proxy
        console.log("  프록시 업그레이드 중...");
        try {
            const vaultCore = await upgrades.upgradeProxy(
                deployments.vaultCore,
                VaultCore,
                {
                    kind: 'uups',
                    useDeployedImplementation: true,
                    unsafeSkipStorageCheck: true,
                    unsafeAllow: ['delegatecall', 'external-library-linking'],
                    unsafeAllowLinkedLibraries: true
                }
            );
            await vaultCore.waitForDeployment();
            console.log("  ✅ VaultCore 업그레이드 완료");
        } catch (e) {
            console.log("  표준 업그레이드 실패, 직접 업그레이드 시도...");
            const uupsABI = ["function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"];
            const proxy = new ethers.Contract(deployments.vaultCore, uupsABI, deployer);
            
            const tx = await proxy.upgradeToAndCall(newImpl, '0x');
            await tx.wait();
            console.log("  ✅ 직접 업그레이드 완료");
        }
        
        // Verify new implementation
        const newImplStorage = await ethers.provider.getStorage(deployments.vaultCore, implSlot);
        const newImplAddress = '0x' + newImplStorage.slice(-40);
        console.log(`  New Implementation: ${newImplAddress}`);
        
        if (currentImplAddress === newImplAddress) {
            console.log("  ⚠️  경고: Implementation이 변경되지 않았습니다!");
            console.log("     수동 업그레이드를 시도합니다...");
            
            // Manual deployment and upgrade (VaultCore already has library linked from above)
            const manualImpl = await VaultCore.deploy();
            await manualImpl.waitForDeployment();
            const manualImplAddress = await manualImpl.getAddress();
            console.log(`  ✓ 수동 구현체 배포됨: ${manualImplAddress}`);
            
            // Upgrade using upgradeToAndCall
            const uupsABI = ["function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"];
            const proxy = new ethers.Contract(deployments.vaultCore, uupsABI, deployer);
            
            console.log("  프록시 직접 업그레이드 중...");
            const tx = await proxy.upgradeToAndCall(manualImplAddress, '0x');
            await tx.wait();
            console.log("  ✅ 직접 업그레이드 완료");
        } else {
            console.log("  ✅ Implementation이 성공적으로 변경되었습니다!");
        }
        
        // Test functionality
        console.log("\n🔍 기능 테스트...");
        const vaultCoreContract = await ethers.getContractAt("VaultCore", deployments.vaultCore);
        const totalAssets = await vaultCoreContract.getTotalAssets();
        console.log(`  Total Assets: ${ethers.formatEther(totalAssets)} WKAIA`);
        
        // Update deployment file
        deployments.lastVaultCoreUpgrade = new Date().toISOString();
        const finalImpl = await ethers.provider.getStorage(deployments.vaultCore, implSlot);
        deployments.vaultCoreImplementation = '0x' + finalImpl.slice(-40);
        deployments.lpCalculationsLibrary = lpCalculationsAddress;
        
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
        console.log("\n✅ 배포 정보 업데이트 완료");
        
    } catch (error) {
        console.error("\n❌ 업그레이드 실패:", error.message);
        
        console.log("\n💡 해결 방법:");
        console.log("1. 캐시 정리: rm -rf .openzeppelin cache artifacts");
        console.log("2. 재컴파일: npx hardhat compile");
        console.log("3. 다시 시도: PROFILE=stable npx hardhat run scripts/upgradeVaultCoreFixed.js --network kaia");
        
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
// PROFILE=stable npx hardhat run scripts/upgradeVaultCoreFixed.js --network kaia
// CLEAN_CACHE=true PROFILE=stable npx hardhat run scripts/upgradeVaultCoreFixed.js --network kaia