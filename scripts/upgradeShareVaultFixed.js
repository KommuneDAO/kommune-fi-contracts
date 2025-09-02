const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("\n🔧 ShareVault 업그레이드 (캐시 문제 해결 버전)");
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
    console.log(`  ShareVault Proxy: ${deployments.shareVault}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    
    // Get current implementation
    const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const currentImpl = await ethers.provider.getStorage(deployments.shareVault, implSlot);
    const currentImplAddress = '0x' + currentImpl.slice(-40);
    console.log(`  Current Implementation: ${currentImplAddress}`);
    
    // Method 1: Force new implementation deployment
    console.log("\n📦 방법 1: forceImport와 새 구현체 강제 배포");
    
    try {
        const ShareVault = await ethers.getContractFactory("ShareVault");
        
        // Option 1: Use validateUpgrade to check compatibility
        console.log("  검증 중...");
        await upgrades.validateUpgrade(deployments.shareVault, ShareVault, {
            kind: 'uups',
            unsafeSkipStorageCheck: false
        });
        console.log("  ✓ 업그레이드 호환성 검증 완료");
        
        // Option 2: Deploy new implementation directly
        console.log("  새 구현체 배포 중...");
        const newImpl = await upgrades.deployImplementation(ShareVault, {
            kind: 'uups',
            // Force new deployment even if bytecode seems unchanged
            redeployImplementation: 'always'
        });
        console.log(`  ✓ 새 구현체 배포됨: ${newImpl}`);
        
        // Option 3: Upgrade proxy to new implementation
        console.log("  프록시 업그레이드 중...");
        const shareVault = await upgrades.upgradeProxy(
            deployments.shareVault,
            ShareVault,
            {
                kind: 'uups',
                // Force using the new implementation
                useDeployedImplementation: true,
                // Skip storage check if needed
                unsafeSkipStorageCheck: true
            }
        );
        await shareVault.waitForDeployment();
        console.log("  ✅ ShareVault 업그레이드 완료");
        
        // Verify new implementation
        const newImplStorage = await ethers.provider.getStorage(deployments.shareVault, implSlot);
        const newImplAddress = '0x' + newImplStorage.slice(-40);
        console.log(`  New Implementation: ${newImplAddress}`);
        
        if (currentImplAddress === newImplAddress) {
            console.log("  ⚠️  경고: Implementation이 변경되지 않았습니다!");
            console.log("     방법 2를 시도합니다...");
            
            // Method 2: Manual deployment and upgrade
            console.log("\n📦 방법 2: 수동 배포 및 업그레이드");
            const manualImpl = await ShareVault.deploy();
            await manualImpl.waitForDeployment();
            const manualImplAddress = await manualImpl.getAddress();
            console.log(`  ✓ 수동 구현체 배포됨: ${manualImplAddress}`);
            
            // Upgrade using upgradeToAndCall
            const uupsABI = ["function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"];
            const proxy = new ethers.Contract(deployments.shareVault, uupsABI, deployer);
            
            console.log("  프록시 직접 업그레이드 중...");
            const tx = await proxy.upgradeToAndCall(manualImplAddress, '0x');
            await tx.wait();
            console.log("  ✅ 직접 업그레이드 완료");
            
            // Update manifest manually
            const networkFiles = `.openzeppelin/${networkName}.json`;
            if (fs.existsSync(networkFiles)) {
                const manifest = JSON.parse(fs.readFileSync(networkFiles, 'utf8'));
                
                // Find and update the implementation
                if (manifest.impls) {
                    for (const key in manifest.impls) {
                        if (manifest.impls[key].address === currentImplAddress) {
                            // Keep old one but add new one
                            const newKey = ethers.keccak256(ethers.toUtf8Bytes(Date.now().toString()));
                            manifest.impls[newKey] = {
                                address: manualImplAddress,
                                txHash: tx.hash,
                                layout: manifest.impls[key].layout
                            };
                            break;
                        }
                    }
                }
                
                // Update proxy implementation reference
                if (manifest.proxies) {
                    manifest.proxies.forEach(proxy => {
                        if (proxy.address === deployments.shareVault) {
                            proxy.implementation = manualImplAddress;
                        }
                    });
                }
                
                fs.writeFileSync(networkFiles, JSON.stringify(manifest, null, 2));
                console.log("  ✓ OpenZeppelin manifest 업데이트됨");
            }
        } else {
            console.log("  ✅ Implementation이 성공적으로 변경되었습니다!");
        }
        
        // Test new functions
        console.log("\n🔍 기능 테스트...");
        
        // Test totalDepositors
        try {
            const totalDepositors = await shareVault.totalDepositors();
            console.log(`  ✅ totalDepositors: ${totalDepositors}`);
        } catch (error) {
            console.log("  ❌ totalDepositors 실패:", error.message.substring(0, 50));
        }
        
        // Test version if exists
        try {
            const version = await shareVault.version();
            console.log(`  ✅ Version: ${version}`);
        } catch (error) {
            console.log("  ℹ️  Version 함수 없음 (정상)");
        }
        
        // Check current state
        console.log("\n📊 현재 상태:");
        const totalSupply = await shareVault.totalSupply();
        const totalAssets = await shareVault.totalAssets();
        console.log(`  Total Supply: ${ethers.formatEther(totalSupply)} shares`);
        console.log(`  Total Assets: ${ethers.formatEther(totalAssets)} WKAIA`);
        
        if (totalSupply > 0n) {
            const sharePrice = (totalAssets * ethers.parseEther("1")) / totalSupply;
            console.log(`  Share Price: ${ethers.formatEther(sharePrice)} WKAIA/share`);
        }
        
        // Update deployment file
        deployments.lastShareVaultUpgrade = new Date().toISOString();
        const finalImpl = await ethers.provider.getStorage(deployments.shareVault, implSlot);
        deployments.shareVaultImplementation = '0x' + finalImpl.slice(-40);
        
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
        console.log("\n✅ 배포 정보 업데이트 완료");
        
    } catch (error) {
        console.error("\n❌ 업그레이드 실패:", error.message);
        
        // Cleanup suggestion
        console.log("\n💡 해결 방법:");
        console.log("1. 캐시 정리: rm -rf .openzeppelin cache artifacts");
        console.log("2. 재컴파일: npx hardhat compile");
        console.log("3. 다시 시도: PROFILE=stable npx hardhat run scripts/upgradeShareVaultFixed.js --network kaia");
        
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
// PROFILE=stable npx hardhat run scripts/upgradeShareVaultFixed.js --network kaia
// CLEAN_CACHE=true PROFILE=stable npx hardhat run scripts/upgradeShareVaultFixed.js --network kaia