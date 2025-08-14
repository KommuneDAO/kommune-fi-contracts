const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Deploying separated vault architecture...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Configuration
    const WKAIA = "0x043c471bEe060e00A56CcD02c0Ca286808a5A436";
    const BALANCER_VAULT = "0x1c9074AA147648567015287B0d4185Cb4E04F86d";
    const SWAP_CONTRACT = "0x829718DBf5e19AB36ab305ac7A7c6C9995bB5F15";
    
    const basisPointsFees = 10; // 0.1%
    const investRatio = 9000; // 90%
    const treasury = deployer.address;
    
    // 1. Deploy VaultCore
    console.log("1. Deploying VaultCore...");
    const VaultCore = await ethers.getContractFactory("VaultCore");
    const vaultCore = await upgrades.deployProxy(
        VaultCore,
        [WKAIA, BALANCER_VAULT, SWAP_CONTRACT, investRatio],
        { 
            initializer: "initialize",
            kind: "uups"
        }
    );
    await vaultCore.waitForDeployment();
    const vaultCoreAddress = await vaultCore.getAddress();
    console.log("VaultCore deployed at:", vaultCoreAddress);
    
    // 2. Deploy ShareVault  
    console.log("\n2. Deploying ShareVault...");
    const ShareVault = await ethers.getContractFactory("ShareVault");
    const shareVault = await upgrades.deployProxy(
        ShareVault,
        [WKAIA, vaultCoreAddress, basisPointsFees, treasury],
        {
            initializer: "initialize",
            kind: "uups"
        }
    );
    await shareVault.waitForDeployment();
    const shareVaultAddress = await shareVault.getAddress();
    console.log("ShareVault deployed at:", shareVaultAddress);
    
    // 3. Configure contracts
    console.log("\n3. Configuring contracts...");
    
    // Set ShareVault in VaultCore
    let tx = await vaultCore.setShareVault(shareVaultAddress);
    await tx.wait();
    console.log("ShareVault set in VaultCore");
    
    // 4. Set APY values
    console.log("\n4. Setting APY values...");
    const apyValues = [500, 600, 700, 800]; // 5%, 6%, 7%, 8%
    for (let i = 0; i < 4; i++) {
        tx = await vaultCore.setAPY(i, apyValues[i] * 10);
        await tx.wait();
        console.log(`APY for LST ${i} set to ${apyValues[i]/100}%`);
    }
    
    // 5. Save deployment info
    const networkName = hre.network.name;
    const deployments = {
        shareVault: shareVaultAddress,
        vaultCore: vaultCoreAddress,
        swapContract: SWAP_CONTRACT,
        wkaia: WKAIA,
        balancerVault: BALANCER_VAULT,
        network: networkName,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
        `./deployments-${networkName}.json`,
        JSON.stringify(deployments, null, 2)
    );
    
    console.log("\n========== Deployment Summary ==========");
    console.log("ShareVault:", shareVaultAddress);
    console.log("VaultCore:", vaultCoreAddress);
    console.log("SwapContract:", SWAP_CONTRACT);
    console.log("=========================================");
    
    console.log("\n✅ Deployment complete!");
    console.log(`Deployment info saved to deployments-${networkName}.json`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });