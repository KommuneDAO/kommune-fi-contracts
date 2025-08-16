const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔧 VaultCore 업그레이드\n");
    
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
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    console.log(`  ShareVault: ${deployments.shareVault}`);
    console.log(`  SwapContract: ${deployments.swapContract}`);
    
    console.log("\n📦 VaultCore 업그레이드 중...");
    
    // Force import the proxy if not registered
    try {
        const VaultCore = await ethers.getContractFactory("VaultCore");
        try {
            await upgrades.forceImport(deployments.vaultCore, VaultCore);
            console.log("  ✓ 프록시 임포트 완료");
        } catch (e) {
            console.log("  ✓ 프록시 이미 등록됨");
        }
        
        // Upgrade VaultCore with unsafeAllow for delegatecall
        const vaultCore = await upgrades.upgradeProxy(
            deployments.vaultCore, 
            VaultCore,
            { unsafeAllow: ['delegatecall'] }  // Allow delegatecall for ClaimManager
        );
        await vaultCore.waitForDeployment();
        console.log("  ✅ VaultCore 업그레이드 성공");
    
        // Check connections
        console.log("\n🔍 연결 상태 확인...");
        
        // Check ShareVault connection
        const shareVaultInCore = await vaultCore.shareVault();
        if (shareVaultInCore !== deployments.shareVault) {
            console.log("  ⚠️ ShareVault 주소 불일치. 업데이트 중...");
            await vaultCore.setShareVault(deployments.shareVault);
            console.log("  ✅ ShareVault 주소 업데이트 완료");
        } else {
            console.log("  ✅ ShareVault 연결 정상");
        }
        
        // Check SwapContract connection
        const currentSwapContract = await vaultCore.swapContract();
        if (currentSwapContract !== deployments.swapContract) {
            console.log("  ⚠️ SwapContract 주소 불일치. 업데이트 중...");
            await vaultCore.setSwapContract(deployments.swapContract);
            console.log("  ✅ SwapContract 주소 업데이트 완료");
        } else {
            console.log("  ✅ SwapContract 연결 정상");
        }
        
        // Check SwapContract authorization
        const swapContract = await ethers.getContractAt("SwapContract", deployments.swapContract);
        const authorizedCaller = await swapContract.authorizedCaller();
        
        if (authorizedCaller !== deployments.vaultCore) {
            console.log("\n⚠️ SwapContract 권한 설정 필요");
            if (authorizedCaller === ethers.ZeroAddress) {
                await swapContract.setAuthorizedCaller(deployments.vaultCore);
                console.log("✅ SwapContract 권한 설정 완료");
            } else {
                console.log("❌ SwapContract에 다른 권한자 설정됨:", authorizedCaller);
            }
        } else {
            console.log("  ✅ SwapContract 권한 정상");
        }
        
        // Check ClaimManager connection if exists
        if (deployments.claimManager) {
            const claimManagerInCore = await vaultCore.claimManager();
            if (claimManagerInCore !== deployments.claimManager) {
                console.log("  ⚠️ ClaimManager 주소 불일치. 업데이트 중...");
                await vaultCore.setClaimManager(deployments.claimManager);
                console.log("  ✅ ClaimManager 주소 업데이트 완료");
            } else {
                console.log("  ✅ ClaimManager 연결 정상");
            }
        }
    
        // 업그레이드 후 totalAssets 확인
        const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
        const wkaia = await ethers.getContractAt("IERC20", deployments.wkaia);
        
        console.log("\n📊 업그레이드 후 상태:");
        
        // 직접 getTotalAssets 호출
        const vaultCoreTotalAssets = await vaultCore.getTotalAssets();
        const shareVaultTotalAssets = await shareVault.totalAssets();
        const vaultCoreWKAIA = await wkaia.balanceOf(deployments.vaultCore);
        const kaiaBalance = await ethers.provider.getBalance(deployments.vaultCore);
        
        console.log(`  VaultCore.getTotalAssets(): ${ethers.formatEther(vaultCoreTotalAssets)} WKAIA`);
        console.log(`  ShareVault.totalAssets(): ${ethers.formatEther(shareVaultTotalAssets)} WKAIA`);
        console.log(`  VaultCore WKAIA Balance: ${ethers.formatEther(vaultCoreWKAIA)}`);
        console.log(`  VaultCore KAIA Balance: ${ethers.formatEther(kaiaBalance)}`);
    
        // LST별 상세 확인
        console.log("\n📈 LST 잔액 상세:");
        const lstNames = ["wKoKAIA", "wGCKAIA", "wstKLAY", "stKAIA"];
        let manualTotal = kaiaBalance + vaultCoreWKAIA;
        
        for (let i = 0; i < 4; i++) {
            const tokenInfo = await vaultCore.tokensInfo(i);
            const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
            const assetBalance = await assetContract.balanceOf(deployments.vaultCore);
            
            let wrappedBalance = 0n;
            if (i < 3) {
                const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
                wrappedBalance = await wrappedContract.balanceOf(deployments.vaultCore);
            }
            
            const lstTotal = assetBalance + wrappedBalance;
            manualTotal += lstTotal;
            
            if (lstTotal > 0n) {
                console.log(`  ${lstNames[i]}:`);
                if (assetBalance > 0n) console.log(`    Asset: ${ethers.formatEther(assetBalance)}`);
                if (wrappedBalance > 0n) console.log(`    Wrapped: ${ethers.formatEther(wrappedBalance)}`);
                console.log(`    Total: ${ethers.formatEther(lstTotal)}`);
            }
        }
        
        console.log("\n✅ 최종 검증:");
        console.log(`  Manual Total: ${ethers.formatEther(manualTotal)}`);
        console.log(`  VaultCore Total: ${ethers.formatEther(vaultCoreTotalAssets)}`);
        console.log(`  계산 일치: ${manualTotal === vaultCoreTotalAssets ? "✅" : "❌"}`);
        
        // ShareVault totalAssets도 업데이트되었는지 확인
        const shareVaultMatch = shareVaultTotalAssets === vaultCoreTotalAssets;
        console.log(`  ShareVault 일치: ${shareVaultMatch ? "✅" : "❌"}`);
        
        if (manualTotal === vaultCoreTotalAssets && shareVaultMatch) {
            console.log("\n🎉 VaultCore 업그레이드 완료!");
        } else {
            console.log("\n📊 차이 분석:");
            console.log(`  Manual - VaultCore: ${ethers.formatEther(manualTotal - vaultCoreTotalAssets)}`);
            console.log(`  ShareVault - VaultCore: ${ethers.formatEther(shareVaultTotalAssets - vaultCoreTotalAssets)}`);
        }
        
        // Update timestamp in deployment file
        deployments.lastVaultCoreUpgrade = new Date().toISOString();
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
        
        console.log("\n📝 다음 단계:");
        console.log("  1. testIntegrated.js로 기능 테스트");
        console.log("  2. 필요시 ShareVault 업그레이드");
        console.log("  3. 모든 연결 상태 재확인");
        
    } catch (error) {
        console.error("\n❌ VaultCore 업그레이드 실패:");
        console.error(error.message);
        
        if (error.message.includes("Ownable")) {
            console.error("\n💡 힌트: Owner 권한이 없습니다. 올바른 계정으로 실행하세요.");
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
