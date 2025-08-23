const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔧 ShareVault 업그레이드\n");
    
    const [deployer] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    
    // Get profile from environment variable or use default
    const profile = process.env.PROFILE || 'stable';
    console.log(`📊 Profile: ${profile.toUpperCase()}`);
    
    // Load deployment addresses based on profile
    const deploymentFile = profile === 'stable' || profile === 'balanced' 
        ? `deployments-${profile}-${networkName}.json`
        : `deployments-${networkName}.json`;
    
    if (!fs.existsSync(deploymentFile)) {
        console.error(`❌ ${deploymentFile} not found.`);
        console.error(`   Please run deployFresh${profile === 'balanced' ? 'Balanced' : 'Stable'}.js first.`);
        console.error(`   Or use PROFILE=stable or PROFILE=balanced to select a different profile.`);
        process.exit(1);
    }
    
    const deployments = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    
    console.log("📋 현재 배포 정보:");
    console.log(`  Network: ${networkName}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  ShareVault: ${deployments.shareVault}`);
    console.log(`  VaultCore: ${deployments.vaultCore}`);
    
    // Force import if needed
    console.log("\n📦 ShareVault 업그레이드 중...");
    
    try {
        const ShareVault = await ethers.getContractFactory("ShareVault");
        
        // Try to force import the proxy
        try {
            await upgrades.forceImport(deployments.shareVault, ShareVault);
            console.log("  ✓ 프록시 임포트 완료");
        } catch (e) {
            // Already imported or registered
            console.log("  ✓ 프록시 이미 등록됨");
        }
        
        // Upgrade the proxy
        const shareVault = await upgrades.upgradeProxy(deployments.shareVault, ShareVault);
        await shareVault.waitForDeployment();
        console.log("  ✅ ShareVault 업그레이드 성공");
        
        // Verify VaultCore connection
        console.log("\n🔍 연결 상태 확인...");
        const vaultCore = await shareVault.vaultCore();
        
        if (vaultCore !== deployments.vaultCore) {
            console.log("  ⚠️ VaultCore 주소 불일치!");
            console.log(`    Expected: ${deployments.vaultCore}`);
            console.log(`    Actual: ${vaultCore}`);
            console.log("\n  VaultCore 재설정이 필요할 수 있습니다.");
        } else {
            console.log("  ✅ VaultCore 연결 정상");
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
        
        // Check authorization
        const owner = await shareVault.owner();
        console.log(`\n👤 Owner: ${owner}`);
        console.log(`   현재 계정 일치: ${owner === deployer.address ? "✅" : "❌"}`);
        
        // Update timestamp in deployment file
        deployments.lastShareVaultUpgrade = new Date().toISOString();
        fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
        
        console.log("\n✅ ShareVault 업그레이드 완료!");
        console.log("\n📝 다음 단계:");
        console.log("  1. VaultCore와의 연결 상태 확인");
        console.log("  2. 필요시 setVaultCore() 호출");
        console.log("  3. 기능 테스트 실행");
        
    } catch (error) {
        console.error("\n❌ ShareVault 업그레이드 실패:");
        console.error(error.message);
        
        // Provide troubleshooting hints
        if (error.message.includes("Ownable")) {
            console.error("\n💡 힌트: Owner 권한이 없습니다. 올바른 계정으로 실행하세요.");
        } else if (error.message.includes("not a contract")) {
            console.error("\n💡 힌트: 주소에 컨트랙트가 없습니다. deployment 파일을 확인하세요.");
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