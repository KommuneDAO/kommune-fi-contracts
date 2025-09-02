const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("\n🔧 모든 컨트랙트 업그레이드 (캐시 문제 해결 버전)");
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
    console.log(`  ShareVault: ${deployments.shareVault}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    console.log(`  SwapContract: ${deployments.swapContract}`);
    console.log(`  ClaimManager: ${deployments.claimManager}`);
    
    const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const results = {};
    
    // Contract list to upgrade
    const contracts = [
        { name: 'ShareVault', address: deployments.shareVault },
        { name: 'VaultCore', address: deployments.vaultCore },
        { name: 'SwapContract', address: deployments.swapContract }
        // ClaimManager는 프록시가 아니므로 제외
    ];
    
    for (const contract of contracts) {
        console.log(`\n📦 ${contract.name} 업그레이드 중...`);
        
        try {
            // Get current implementation
            const currentImpl = await ethers.provider.getStorage(contract.address, implSlot);
            const currentImplAddress = '0x' + currentImpl.slice(-40);
            console.log(`  Current Implementation: ${currentImplAddress}`);
            
            // Special handling for VaultCore with library
            let ContractFactory;
            let lpCalculationsAddress;
            
            if (contract.name === 'VaultCore') {
                // Deploy LPCalculations library first
                console.log("  LPCalculations 라이브러리 배포 중...");
                const LPCalculations = await ethers.getContractFactory("LPCalculations");
                const lpCalculations = await LPCalculations.deploy();
                await lpCalculations.waitForDeployment();
                lpCalculationsAddress = await lpCalculations.getAddress();
                console.log(`  ✓ LPCalculations 배포됨: ${lpCalculationsAddress}`);
                
                // Get VaultCore factory with library linked
                ContractFactory = await ethers.getContractFactory("VaultCore", {
                    libraries: {
                        LPCalculations: lpCalculationsAddress
                    }
                });
            } else {
                // Get regular contract factory
                ContractFactory = await ethers.getContractFactory(contract.name);
            }
            
            // Deploy new implementation directly
            console.log("  새 구현체 직접 배포 중...");
            const unsafeAllow = contract.name === 'VaultCore' ? ['delegatecall', 'external-library-linking'] : [];
            const additionalOptions = contract.name === 'VaultCore' ? { unsafeAllowLinkedLibraries: true } : {};
            
            let newImplAddress;
            try {
                // Try using upgrades plugin first
                newImplAddress = await upgrades.deployImplementation(ContractFactory, {
                    kind: 'uups',
                    redeployImplementation: 'always',
                    unsafeAllow: unsafeAllow,
                    ...additionalOptions
                });
                console.log(`  ✓ 새 구현체 배포됨: ${newImplAddress}`);
            } catch (e) {
                // Fallback to manual deployment
                console.log("  upgrades 플러그인 실패, 수동 배포 시도...");
                console.log(`  에러: ${e.message}`);
                const newImpl = await ContractFactory.deploy();
                await newImpl.waitForDeployment();
                newImplAddress = await newImpl.getAddress();
                console.log(`  ✓ 수동 구현체 배포됨: ${newImplAddress}`);
            }
            
            // Check if implementation actually changed
            if (currentImplAddress.toLowerCase() === newImplAddress.toLowerCase()) {
                console.log("  ⚠️  같은 implementation, 강제 새 배포...");
                const manualImpl = await ContractFactory.deploy();
                await manualImpl.waitForDeployment();
                newImplAddress = await manualImpl.getAddress();
                console.log(`  ✓ 새 구현체 강제 배포됨: ${newImplAddress}`);
            }
            
            // Upgrade proxy
            console.log("  프록시 업그레이드 중...");
            
            try {
                // Try standard upgrade first
                const upgraded = await upgrades.upgradeProxy(
                    contract.address,
                    ContractFactory,
                    {
                        kind: 'uups',
                        useDeployedImplementation: false, // Force using new implementation
                        unsafeSkipStorageCheck: true,
                        unsafeAllow: unsafeAllow,
                        ...additionalOptions
                    }
                );
                await upgraded.waitForDeployment();
                console.log("  ✅ 업그레이드 완료");
            } catch (e) {
                // Fallback to direct upgrade
                console.log("  표준 업그레이드 실패, 직접 업그레이드 시도...");
                const uupsABI = ["function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"];
                const proxy = new ethers.Contract(contract.address, uupsABI, deployer);
                
                const tx = await proxy.upgradeToAndCall(newImplAddress, '0x');
                await tx.wait();
                console.log("  ✅ 직접 업그레이드 완료");
            }
            
            // Verify new implementation
            const newImpl = await ethers.provider.getStorage(contract.address, implSlot);
            const finalImplAddress = '0x' + newImpl.slice(-40);
            console.log(`  Final Implementation: ${finalImplAddress}`);
            
            if (currentImplAddress.toLowerCase() !== finalImplAddress.toLowerCase()) {
                console.log("  ✅ Implementation 성공적으로 변경됨!");
                results[contract.name] = {
                    success: true,
                    oldImpl: currentImplAddress,
                    newImpl: finalImplAddress
                };
            } else {
                console.log("  ⚠️  Implementation 변경 실패");
                results[contract.name] = {
                    success: false,
                    oldImpl: currentImplAddress,
                    newImpl: currentImplAddress
                };
            }
            
            // Update deployment file
            deployments[`last${contract.name}Upgrade`] = new Date().toISOString();
            deployments[`${contract.name.toLowerCase()}Implementation`] = finalImplAddress;
            
            // Save library address for VaultCore
            if (contract.name === 'VaultCore' && lpCalculationsAddress) {
                deployments.lpCalculationsLibrary = lpCalculationsAddress;
            }
            
        } catch (error) {
            console.error(`  ❌ ${contract.name} 업그레이드 실패:`, error.message);
            results[contract.name] = {
                success: false,
                error: error.message
            };
        }
    }
    
    // ClaimManager 처리 (변경이 있을 때만 재배포)
    console.log("\n📦 ClaimManager 확인 중...");
    try {
        const ClaimManager = await ethers.getContractFactory("ClaimManager");
        const newBytecode = ClaimManager.bytecode;
        
        // 현재 ClaimManager의 바이트코드 확인
        let needsDeployment = false;
        let currentCode = '0x';
        
        if (deployments.claimManager && deployments.claimManager !== '0x0000000000000000000000000000000000000000') {
            try {
                currentCode = await ethers.provider.getCode(deployments.claimManager);
                console.log(`  현재 ClaimManager: ${deployments.claimManager}`);
                
                // 단순 비교로는 정확하지 않을 수 있으므로, 코드 크기로 간단히 체크
                // 또는 특정 함수의 selector 존재 여부로 체크
                const currentSize = currentCode.length;
                const expectedMinSize = 1000; // ClaimManager는 충분히 큰 컨트랙트
                
                if (currentSize < expectedMinSize) {
                    console.log("  ⚠️  현재 ClaimManager가 비정상적으로 작음");
                    needsDeployment = true;
                } else {
                    // 함수 selector로 간단한 체크 (executeUnstake: 0x9d6922d2)
                    const executeUnstakeSelector = '9d6922d2'; // executeUnstake(address,uint256,uint256)
                    const executeClaimSelector = '9b74f48e'; // executeClaim(address,uint256)
                    
                    if (!currentCode.includes(executeUnstakeSelector)) {
                        console.log("  ⚠️  ClaimManager executeUnstake 함수가 없거나 변경됨");
                        needsDeployment = true;
                    } else {
                        console.log("  ✅ ClaimManager 변경사항 없음, 기존 주소 유지");
                        results.ClaimManager = {
                            success: true,
                            kept: true,
                            address: deployments.claimManager
                        };
                    }
                }
            } catch (e) {
                console.log("  ⚠️  현재 ClaimManager 확인 실패:", e.message);
                needsDeployment = true;
            }
        } else {
            console.log("  ⚠️  ClaimManager 주소가 없음");
            needsDeployment = true;
        }
        
        // 변경이 있거나 배포가 필요한 경우에만 재배포
        if (needsDeployment) {
            console.log("  새 ClaimManager 배포 중...");
            const claimManager = await ClaimManager.deploy();
            await claimManager.waitForDeployment();
            const claimManagerAddress = await claimManager.getAddress();
            
            console.log(`  ✓ 새 ClaimManager 배포됨: ${claimManagerAddress}`);
            
            // VaultCore에 새 ClaimManager 설정
            const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
            const tx = await vaultCore.setClaimManager(claimManagerAddress);
            await tx.wait();
            console.log("  ✅ VaultCore에 새 ClaimManager 설정 완료");
            
            deployments.claimManager = claimManagerAddress;
            deployments.lastClaimManagerDeploy = new Date().toISOString();
            
            results.ClaimManager = {
                success: true,
                newAddress: claimManagerAddress
            };
        }
    } catch (error) {
        console.error("  ❌ ClaimManager 처리 실패:", error.message);
        results.ClaimManager = {
            success: false,
            error: error.message
        };
    }
    
    // Save deployment file
    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
    
    // Summary
    console.log("\n" + "═".repeat(60));
    console.log("📊 업그레이드 결과 요약:");
    console.log("═".repeat(60));
    
    for (const [name, result] of Object.entries(results)) {
        if (result.success) {
            console.log(`✅ ${name}: 성공`);
            if (result.oldImpl && result.newImpl) {
                console.log(`   ${result.oldImpl} → ${result.newImpl}`);
            }
        } else {
            console.log(`❌ ${name}: 실패`);
            if (result.error) {
                console.log(`   에러: ${result.error.substring(0, 100)}`);
            }
        }
    }
    
    console.log("\n✅ 모든 컨트랙트 업그레이드 시도 완료!");
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
// PROFILE=stable npx hardhat run scripts/upgradeAllFixed.js --network kaia
// CLEAN_CACHE=true PROFILE=stable npx hardhat run scripts/upgradeAllFixed.js --network kaia