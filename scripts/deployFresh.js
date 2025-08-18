const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const { contracts } = require("../config/constants");
const { ChainId } = require("../config/config");

async function main() {
    console.log("🚀 COMPLETELY FRESH DEPLOYMENT - IGNORING ALL OLD CONTRACTS");
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
    
    console.log("📍 Network Constants:");
    console.log("  WKAIA:", WKAIA);
    console.log("  Balancer Vault:", BALANCER_VAULT);
    console.log("  Treasury:", TREASURY);
    console.log("");
    
    const newDeployments = {};
    
    // 1. Deploy ClaimManager (non-upgradeable)
    console.log("1️⃣ Deploying ClaimManager (non-upgradeable)...");
    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    const claimManager = await ClaimManager.deploy();
    await claimManager.waitForDeployment();
    newDeployments.claimManager = await claimManager.getAddress();
    console.log("   ✅ ClaimManager deployed at:", newDeployments.claimManager);
    
    // 2. Deploy SwapContract (as upgradeable proxy)
    console.log("\n2️⃣ Deploying SwapContract (UUPS proxy)...");
    const SwapContract = await ethers.getContractFactory("SwapContract");
    const swapContract = await upgrades.deployProxy(
        SwapContract,
        [deployer.address], // Initialize with deployer as owner
        { 
            initializer: "initialize",
            kind: 'uups',
            redeployImplementation: 'always' // Force new implementation
        }
    );
    await swapContract.waitForDeployment();
    newDeployments.swapContract = await swapContract.getAddress();
    console.log("   ✅ SwapContract deployed at:", newDeployments.swapContract);
    
    // 3. Deploy VaultCore (UUPS Proxy)
    console.log("\n3️⃣ Deploying VaultCore (UUPS proxy)...");
    const VaultCore = await ethers.getContractFactory("VaultCore");
    const vaultCore = await upgrades.deployProxy(
        VaultCore,
        [
            WKAIA,
            BALANCER_VAULT,
            newDeployments.swapContract,
            9000  // 90% invest ratio
        ],
        { 
            initializer: "initialize",
            kind: 'uups',
            unsafeAllow: ["delegatecall"],
            redeployImplementation: 'always' // Force new implementation
        }
    );
    await vaultCore.waitForDeployment();
    newDeployments.vaultCore = await vaultCore.getAddress();
    console.log("   ✅ VaultCore deployed at:", newDeployments.vaultCore);
    
    // 4. Deploy ShareVault (UUPS Proxy) 
    console.log("\n4️⃣ Deploying ShareVault (UUPS proxy)...");
    const ShareVault = await ethers.getContractFactory("ShareVault");
    const shareVault = await upgrades.deployProxy(
        ShareVault,
        [
            WKAIA,                      // asset (WKAIA)
            newDeployments.vaultCore,   // vaultCore
            1000,                       // basisPointsFees (10%)
            TREASURY                    // treasury address
        ],
        { 
            initializer: "initialize",
            kind: 'uups',
            redeployImplementation: 'always' // Force new implementation
        }
    );
    await shareVault.waitForDeployment();
    newDeployments.shareVault = await shareVault.getAddress();
    console.log("   ✅ ShareVault deployed at:", newDeployments.shareVault);
    
    // 5. Configure connections
    console.log("\n5️⃣ Configuring connections...");
    
    // Set ShareVault in VaultCore
    let tx = await vaultCore.setShareVault(newDeployments.shareVault);
    await tx.wait();
    console.log("   ✅ VaultCore.setShareVault completed");
    
    // Set ClaimManager in VaultCore
    tx = await vaultCore.setClaimManager(newDeployments.claimManager);
    await tx.wait();
    console.log("   ✅ VaultCore.setClaimManager completed");
    
    // Set SwapContract authorized caller
    tx = await swapContract.setAuthorizedCaller(newDeployments.vaultCore);
    await tx.wait();
    console.log("   ✅ SwapContract.setAuthorizedCaller completed");
    
    // 6. LST tokens are already configured in VaultCore initialization
    console.log("\n6️⃣ LST tokens already configured in contract initialization");
    
    // Verify token configuration
    const token0 = await vaultCore.tokensInfo(0);
    console.log("   ✅ wKoKAIA configured:", token0.handler !== "0x0000000000000000000000000000000000000000");
    const token1 = await vaultCore.tokensInfo(1);
    console.log("   ✅ wGCKAIA configured:", token1.handler !== "0x0000000000000000000000000000000000000000");
    const token2 = await vaultCore.tokensInfo(2);
    console.log("   ✅ wstKLAY configured:", token2.handler !== "0x0000000000000000000000000000000000000000");
    const token3 = await vaultCore.tokensInfo(3);
    console.log("   ✅ stKAIA configured:", token3.handler !== "0x0000000000000000000000000000000000000000");
    
    // 7. Set initial APY
    console.log("\n7️⃣ Setting initial APY...");
    await vaultCore.setAPY(0, 2500); // wKoKAIA: 25%
    await vaultCore.setAPY(1, 2500); // wGCKAIA: 25%
    await vaultCore.setAPY(2, 2500); // wstKLAY: 25%
    await vaultCore.setAPY(3, 2500); // stKAIA: 25%
    console.log("   ✅ APY set to 25% for all LSTs");
    
    // 8. Save deployment addresses
    console.log("\n8️⃣ Saving deployment addresses...");
    newDeployments.wkaia = WKAIA;
    newDeployments.balancerVault = BALANCER_VAULT;
    newDeployments.chainId = chainId.toString();
    newDeployments.network = networkName;
    newDeployments.deployedAt = new Date().toISOString();
    
    const filename = `deployments-${networkName}.json`;
    fs.writeFileSync(filename, JSON.stringify(newDeployments, null, 2));
    console.log(`   ✅ Deployment addresses saved to ${filename}`);
    
    // 9. Verify deployment
    console.log("\n9️⃣ Verifying deployment...");
    
    // Check connections
    const vcShareVault = await vaultCore.shareVault();
    const vcSwapContract = await vaultCore.swapContract();
    const vcClaimManager = await vaultCore.claimManager();
    const svVaultCore = await shareVault.vaultCore();
    const scAuthorized = await swapContract.authorizedCaller();
    
    console.log("   ShareVault <-> VaultCore:", 
        vcShareVault === newDeployments.shareVault && svVaultCore === newDeployments.vaultCore ? "✅" : "❌");
    console.log("   VaultCore -> SwapContract:", 
        vcSwapContract === newDeployments.swapContract ? "✅" : "❌");
    console.log("   VaultCore -> ClaimManager:", 
        vcClaimManager === newDeployments.claimManager ? "✅" : "❌");
    console.log("   SwapContract authorized:", 
        scAuthorized === newDeployments.vaultCore ? "✅" : "❌");
    
    // Check APY
    const apy0 = await vaultCore.lstAPY(0);
    const apy1 = await vaultCore.lstAPY(1);
    const apy2 = await vaultCore.lstAPY(2);
    const apy3 = await vaultCore.lstAPY(3);
    console.log("   APY configured:", 
        apy0 === 2500n && apy1 === 2500n && apy2 === 2500n && apy3 === 2500n ? "✅" : "❌");
    
    // Check invest ratio
    const investRatio = await vaultCore.investRatio();
    console.log("   Invest ratio:", investRatio.toString(), `(${investRatio / 100n}% to LSTs)`);
    
    console.log("\n════════════════════════════════════════════════");
    console.log("🎉 COMPLETELY FRESH DEPLOYMENT COMPLETE!");
    console.log("════════════════════════════════════════════════");
    console.log("\n📝 New Deployment Summary:");
    console.log("  ShareVault:", newDeployments.shareVault);
    console.log("  VaultCore:", newDeployments.vaultCore);
    console.log("  SwapContract:", newDeployments.swapContract);
    console.log("  ClaimManager:", newDeployments.claimManager);
    console.log("  WKAIA:", newDeployments.wkaia);
    console.log("\n💡 Next Steps:");
    console.log("  1. Test WKAIA deposits with Standard ERC4626");
    console.log("  2. Test native KAIA deposits");
    console.log("  3. Test withdrawals");
    console.log("  4. Verify all security fixes");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });