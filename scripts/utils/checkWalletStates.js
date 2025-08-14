const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
    console.log("Checking wallet states...\n");
    
    const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", "utf8"));
    const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault);
    const provider = ethers.provider;
    
    // Get all wallet addresses
    const wallets = [];
    
    // Main signer from hardhat config (KAIROS_PRIVATE_KEY)
    const [mainSigner] = await ethers.getSigners();
    wallets.push({ name: "Main (KAIROS_PRIVATE_KEY)", address: mainSigner.address, signer: mainSigner });
    
    // PRIVATE_KEY wallet (if different)
    if (process.env.PRIVATE_KEY) {
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        wallets.push({ name: "PRIVATE_KEY", address: wallet.address, signer: wallet });
    }
    
    // TESTER1 wallet
    if (process.env.TESTER1_PRIV_KEY) {
        const wallet = new ethers.Wallet(process.env.TESTER1_PRIV_KEY, provider);
        wallets.push({ name: "TESTER1", address: wallet.address, signer: wallet });
    }
    
    // TESTER2 wallet
    if (process.env.TESTER2_PRIV_KEY) {
        const wallet = new ethers.Wallet(process.env.TESTER2_PRIV_KEY, provider);
        wallets.push({ name: "TESTER2", address: wallet.address, signer: wallet });
    }
    
    console.log("=== WALLET STATES ===");
    console.log("┌─────────────────────────┬──────────────────────────────────────────┬──────────────────┬──────────────────┐");
    console.log("│ Wallet                  │ Address                                  │ KAIA Balance     │ Shares           │");
    console.log("├─────────────────────────┼──────────────────────────────────────────┼──────────────────┼──────────────────┤");
    
    for (const wallet of wallets) {
        const kaiaBalance = await provider.getBalance(wallet.address);
        const shares = await shareVault.balanceOf(wallet.address);
        
        console.log(
            `│ ${wallet.name.padEnd(23)} │ ${wallet.address} │ ${ethers.formatEther(kaiaBalance).padEnd(16)} │ ${ethers.formatEther(shares).padEnd(16)} │`
        );
    }
    
    console.log("└─────────────────────────┴──────────────────────────────────────────┴──────────────────┴──────────────────┘");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });