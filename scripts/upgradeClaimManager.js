const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔧 ClaimManager 업그레이드\n");
    
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
    
    if (deployments.claimManager) {
        console.log(`  Current ClaimManager: ${deployments.claimManager}`);
    } else {
        console.log(`  ClaimManager: Not deployed yet`);
    }
    
    // Deploy new ClaimManager
    console.log("\n📦 새 ClaimManager 배포 중...");
    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    const newClaimManager = await ClaimManager.deploy();
    await newClaimManager.waitForDeployment();
    const newClaimManagerAddress = await newClaimManager.getAddress();
    
    console.log(`  ✅ 새 ClaimManager 배포: ${newClaimManagerAddress}`);
    
    // Update VaultCore to use new ClaimManager
    console.log("\n🔄 VaultCore에 새 ClaimManager 설정 중...");
    const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore);
    
    // Check current ClaimManager
    const currentClaimManager = await vaultCore.claimManager();
    if (currentClaimManager !== ethers.ZeroAddress) {
        console.log(`  이전 ClaimManager: ${currentClaimManager}`);
    }
    
    // Set new ClaimManager
    const tx = await vaultCore.setClaimManager(newClaimManagerAddress);
    await tx.wait();
    console.log("  ✅ 새 ClaimManager 설정 완료");
    
    // Verify the update
    const updatedClaimManager = await vaultCore.claimManager();
    if (updatedClaimManager === newClaimManagerAddress) {
        console.log("  ✅ ClaimManager 업데이트 검증 완료");
    } else {
        console.log("  ❌ ClaimManager 업데이트 실패!");
        process.exit(1);
    }
    
    // Save deployment
    const oldClaimManager = deployments.claimManager;
    deployments.claimManager = newClaimManagerAddress;
    if (oldClaimManager) {
        deployments.claimManagerOld = oldClaimManager;
    }
    deployments.lastClaimManagerUpgrade = new Date().toISOString();
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
    
    console.log("\n✅ ClaimManager 업그레이드 완료!");
    
    console.log("\n📊 업그레이드 요약:");
    if (oldClaimManager) {
        console.log(`  이전 ClaimManager: ${oldClaimManager}`);
    }
    console.log(`  새 ClaimManager: ${newClaimManagerAddress}`);
    
    console.log("\n📝 다음 단계:");
    console.log("  1. unstake 기능 테스트");
    console.log("  2. 7일 대기 후 claim 테스트");
    console.log("  3. 기존 unstake 요청 마이그레이션 (필요시)");
    
    console.log("\n⚠️  주의사항:");
    console.log("  - 기존 unstake 요청은 새 ClaimManager로 이전되지 않습니다");
    console.log("  - 필요시 수동으로 마이그레이션 작업 필요");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });