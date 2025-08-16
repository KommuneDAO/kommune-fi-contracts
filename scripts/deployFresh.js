const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const { contracts } = require("../config/constants");
const { ChainId } = require("../config/config");

async function main() {
    console.log("🚀 Fresh Deployment of KommuneFi V2 System");
    console.log("════════════════════════════════════════════════\n");
    
    const [deployer] = await ethers.getSigners();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    const chainIdEnum = chainId === 8217n ? ChainId.KAIA : ChainId.KAIROS;
    
    console.log("📋 Deployment Configuration:");
    console.log("  Network:", networkName);
    console.log("  ChainId:", chainId);
    console.log("  Deployer:", deployer.address);
    console.log("  Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "KAIA\n");
    
    // Get network constants
    const WKAIA = contracts.wkaia[chainIdEnum];
    const BALANCER_VAULT = contracts.vault[chainIdEnum];
    const TREASURY = contracts.treasury[chainIdEnum];
    
    if (!WKAIA || !BALANCER_VAULT || !TREASURY) {
        throw new Error(`No constants defined for chainId: ${chainId}`);
    }
    
    console.log("📍 Network Constants:");
    console.log("  WKAIA:", WKAIA);
    console.log("  Balancer Vault:", BALANCER_VAULT);
    console.log("  Treasury:", TREASURY);
    console.log("");
    
    const deployments = {};
    
    // 1. Deploy SwapContract
    console.log("1️⃣ Deploying SwapContract...");
    const SwapContract = await ethers.getContractFactory("SwapContract");
    const swapContract = await SwapContract.deploy();
    await swapContract.waitForDeployment();
    deployments.swapContract = await swapContract.getAddress();
    console.log("   ✅ SwapContract deployed at:", deployments.swapContract);
    
    // 2. Deploy VaultCore (UUPS Proxy)
    console.log("\n2️⃣ Deploying VaultCore...");
    const VaultCore = await ethers.getContractFactory("VaultCore");
    const vaultCore = await upgrades.deployProxy(
        VaultCore,
        [
            WKAIA,
            BALANCER_VAULT,
            deployments.swapContract,
            10000  // 100% invest ratio
        ],
        { 
            initializer: "initialize",
            kind: 'uups',
            unsafeAllow: ["delegatecall"]
        }
    );
    await vaultCore.waitForDeployment();
    deployments.vaultCore = await vaultCore.getAddress();
    console.log("   ✅ VaultCore deployed at:", deployments.vaultCore);
    
    // 3. Deploy ShareVault (UUPS Proxy) 
    console.log("\n3️⃣ Deploying ShareVault...");
    const ShareVault = await ethers.getContractFactory("ShareVault");
    const shareVault = await upgrades.deployProxy(
        ShareVault,
        [
            WKAIA,                     // asset (WKAIA)
            deployments.vaultCore,     // vaultCore
            1000,                      // basisPointsFees (10%)
            TREASURY                   // treasury address from constants
        ],
        { 
            initializer: "initialize",
            kind: 'uups'
        }
    );
    await shareVault.waitForDeployment();
    deployments.shareVault = await shareVault.getAddress();
    console.log("   ✅ ShareVault deployed at:", deployments.shareVault);
    
    // 4. Configure connections
    console.log("\n4️⃣ Configuring connections...");
    
    // Set ShareVault in VaultCore
    await vaultCore.setShareVault(deployments.shareVault);
    console.log("   ✅ VaultCore.setShareVault completed");
    
    // Set SwapContract authorized caller
    await swapContract.setAuthorizedCaller(deployments.vaultCore);
    console.log("   ✅ SwapContract.setAuthorizedCaller completed");
    
    // 5. Set initial APY (for testing)
    console.log("\n5️⃣ Setting initial APY...");
    await vaultCore.setAPY(0, 2500); // wKoKAIA: 25%
    await vaultCore.setAPY(1, 2500); // wGCKAIA: 25%
    await vaultCore.setAPY(2, 2500); // wstKLAY: 25%
    await vaultCore.setAPY(3, 2500); // stKAIA: 25%
    console.log("   ✅ APY set to 25% for all LSTs");
    
    // 6. Save deployment addresses
    console.log("\n6️⃣ Saving deployment addresses...");
    deployments.wkaia = WKAIA;
    deployments.balancerVault = BALANCER_VAULT;
    deployments.chainId = chainId.toString();
    deployments.network = networkName;
    deployments.deployedAt = new Date().toISOString();
    
    const filename = `deployments-${networkName}.json`;
    fs.writeFileSync(filename, JSON.stringify(deployments, null, 2));
    console.log(`   ✅ Deployment addresses saved to ${filename}`);
    
    // 7. Verify deployment
    console.log("\n7️⃣ Verifying deployment...");
    
    // Check connections
    const vcShareVault = await vaultCore.shareVault();
    const vcSwapContract = await vaultCore.swapContract();
    const svVaultCore = await shareVault.vaultCore();
    const scAuthorized = await swapContract.authorizedCaller();
    
    console.log("   ShareVault <-> VaultCore:", 
        vcShareVault === deployments.shareVault && svVaultCore === deployments.vaultCore ? "✅" : "❌");
    console.log("   VaultCore -> SwapContract:", 
        vcSwapContract === deployments.swapContract ? "✅" : "❌");
    console.log("   SwapContract authorized:", 
        scAuthorized === deployments.vaultCore ? "✅" : "❌");
    
    // Check APY
    const apy0 = await vaultCore.lstAPY(0);
    const apy1 = await vaultCore.lstAPY(1);
    const apy2 = await vaultCore.lstAPY(2);
    const apy3 = await vaultCore.lstAPY(3);
    console.log("   APY configured:", 
        apy0 === 2500n && apy1 === 2500n && apy2 === 2500n && apy3 === 2500n ? "✅" : "❌");
    
    // Check initial state
    const totalAssets = await shareVault.totalAssets();
    const totalSupply = await shareVault.totalSupply();
    console.log("\n   Initial State:");
    console.log("   Total Assets:", ethers.formatEther(totalAssets));
    console.log("   Total Supply:", ethers.formatEther(totalSupply));
    
    console.log("\n════════════════════════════════════════════════");
    console.log("🎉 Fresh Deployment Complete!");
    console.log("════════════════════════════════════════════════");
    console.log("\n📝 Summary:");
    console.log("  ShareVault:", deployments.shareVault);
    console.log("  VaultCore:", deployments.vaultCore);
    console.log("  SwapContract:", deployments.swapContract);
    console.log("  WKAIA:", deployments.wkaia);
    console.log("\n💡 Next Steps:");
    console.log("  1. Run deposit tests");
    console.log("  2. Run withdrawal tests");
    console.log("  3. Monitor for any stuck tokens");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });