const { ethers } = require("hardhat");
const fs = require('fs');
require("dotenv").config();

async function main() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║         SWAPCONTRACT ASSET RECOVERY TOOL                    ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Get network info
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const networkName = chainId === 8217n ? "kaia" : "kairos";
    
    console.log(`📡 Network: ${networkName} (Chain ID: ${chainId})`);
    console.log(`🔧 Purpose: Recover any stranded assets from SwapContract to VaultCore\n`);

    // Load deployment addresses
    let deployments;
    try {
        // Try stable deployment first
        deployments = JSON.parse(fs.readFileSync(`deployments-stable-${networkName}.json`, 'utf8'));
        console.log("📋 Using STABLE deployment configuration");
    } catch {
        try {
            // Fallback to balanced deployment
            deployments = JSON.parse(fs.readFileSync(`deployments-balanced-${networkName}.json`, 'utf8'));
            console.log("📋 Using BALANCED deployment configuration");
        } catch {
            // Final fallback to regular deployment
            deployments = JSON.parse(fs.readFileSync(`deployments-${networkName}.json`, 'utf8'));
            console.log("📋 Using standard deployment configuration");
        }
    }

    const swapContractAddress = deployments.swapContract;
    const vaultCoreAddress = deployments.vaultCore;
    
    console.log(`SwapContract: ${swapContractAddress}`);
    console.log(`VaultCore: ${vaultCoreAddress}\n`);

    // Connect to SwapContract
    const swapContract = await ethers.getContractAt("SwapContract", swapContractAddress);
    
    // Check authorized caller
    const authorizedCaller = await swapContract.authorizedCaller();
    console.log(`✅ Authorized Caller: ${authorizedCaller}`);
    
    if (authorizedCaller === ethers.ZeroAddress) {
        console.log("❌ ERROR: Authorized caller not set in SwapContract!");
        console.log("   Please set VaultCore as authorized caller first.");
        process.exit(1);
    }
    
    if (authorizedCaller.toLowerCase() !== vaultCoreAddress.toLowerCase()) {
        console.log("⚠️  WARNING: Authorized caller is not VaultCore!");
        console.log(`   Expected: ${vaultCoreAddress}`);
        console.log(`   Actual: ${authorizedCaller}`);
    }

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                   CHECKING TOKEN BALANCES                   ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Define tokens to check based on network
    let tokens = [];
    let tokenNames = [];
    
    if (chainId === 8217n) {
        // Mainnet tokens
        tokens = [
            "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432", // WKAIA
            "0xdEC2Cc84f0a37Ef917f63212FE8ba7494b0E4B15", // wKoKAIA
            "0xa9999999c3D05Fb75cE7230e0D22F5625527d583", // wGCKAIA
            "0x031fB2854029885E1D46b394c8B7881c8ec6AD63", // wstKLAY
            "0x42952B873ed6f7f0A7E4992E2a9818E3A9001995", // stKAIA
            "0xA1338309658D3Da331C747518d0bb414031F22fd", // KoKAIA
            "0x999999999939Ba65AbB254339eEc0b2A0daC80E9", // GCKAIA
            "0xF80F2b22932fCEC6189b9153aA18662b15CC9C00", // stKLAY
            "0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487"  // BPT
        ];
        tokenNames = [
            "WKAIA", "wKoKAIA", "wGCKAIA", "wstKLAY", "stKAIA",
            "KoKAIA", "GCKAIA", "stKLAY", "BPT"
        ];
    } else {
        // Testnet (Kairos) tokens
        tokens = [
            "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106", // WKAIA
            "0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317", // wKoKAIA
            "0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601", // wGCKAIA
            "0x474B49DF463E528223F244670e332fE82742e1aA", // wstKLAY
            "0x45886b01276c45Fe337d3758b94DD8D7F3951d97", // stKAIA
            "0xb15782EFbC2034E366670599F3997f94c7333FF9", // KoKAIA
            "0x4EC04F4D46D7e34EBf0C3932B65068168FDcE7f6", // GCKAIA
            "0x524dCFf07BFF606225A4FA76AFA55D705B052004", // stKLAY
            "0xCC163330E85C34788840773E32917E2F51878B95", // BPT pool1
            "0x6634d606f477a7fb14159839a9b7ad9ad4295436"  // BPT pool2 (lowercase for checksum)
        ];
        tokenNames = [
            "WKAIA", "wKoKAIA", "wGCKAIA", "wstKLAY", "stKAIA",
            "KoKAIA", "GCKAIA", "stKLAY", "BPT1", "BPT2"
        ];
    }

    // Check balances
    console.log("🔍 Checking token balances in SwapContract...\n");
    const balances = await swapContract.getTokenBalances(tokens);
    
    let tokensToRecover = [];
    let hasStrandedAssets = false;
    let totalValueStranded = 0n;
    
    for (let i = 0; i < tokens.length; i++) {
        if (balances[i] > 0n) {
            hasStrandedAssets = true;
            tokensToRecover.push(tokens[i]);
            const formattedBalance = ethers.formatEther(balances[i]);
            console.log(`⚠️  ${tokenNames[i]}: ${formattedBalance} (${tokens[i]})`);
            totalValueStranded += balances[i];
        } else {
            console.log(`✅ ${tokenNames[i]}: 0 (clean)`);
        }
    }

    console.log("\n════════════════════════════════════════════════════════════════");
    
    if (!hasStrandedAssets) {
        console.log("\n✨ RESULT: No stranded assets found in SwapContract!");
        console.log("   The contract is clean. No recovery needed.\n");
        console.log("🎉 SwapContract asset check completed successfully!");
        return;
    }

    // Assets found - proceed with recovery
    console.log(`\n⚠️  STRANDED ASSETS DETECTED!`);
    console.log(`   Total approximate value: ${ethers.formatEther(totalValueStranded)} tokens`);
    console.log(`   Number of tokens affected: ${tokensToRecover.length}`);
    
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    RECOVERING ASSETS                        ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    console.log(`🚀 Recovering ${tokensToRecover.length} tokens to VaultCore...`);
    console.log(`   Target: ${vaultCoreAddress}\n`);
    
    try {
        // Execute recovery
        const tx = await swapContract.returnAssetsToVault(tokensToRecover);
        console.log(`📤 Transaction submitted: ${tx.hash}`);
        console.log("   Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Parse events to show recovered amounts
        console.log("\n📊 Recovery Summary:");
        const events = receipt.logs
            .filter(log => log.address.toLowerCase() === swapContractAddress.toLowerCase())
            .map(log => {
                try {
                    return swapContract.interface.parseLog(log);
                } catch {
                    return null;
                }
            })
            .filter(event => event && event.name === 'AssetReturned');
        
        for (const event of events) {
            const tokenIndex = tokens.indexOf(event.args[0]);
            const tokenName = tokenIndex >= 0 ? tokenNames[tokenIndex] : 'Unknown';
            const amount = ethers.formatEther(event.args[1]);
            console.log(`   ✅ Recovered ${amount} ${tokenName}`);
        }
        
        console.log("\n🎉 Asset recovery completed successfully!");
        console.log(`   All stranded assets have been returned to VaultCore.`);
        
    } catch (error) {
        console.error("\n❌ ERROR: Failed to recover assets!");
        console.error(`   Reason: ${error.message}`);
        
        if (error.message.includes("Ownable")) {
            console.error("   You need to be the owner of SwapContract to recover assets.");
        } else if (error.message.includes("Authorized caller not set")) {
            console.error("   The authorized caller (VaultCore) is not set in SwapContract.");
        }
        
        process.exit(1);
    }

    // Final verification
    console.log("\n🔍 Verifying cleanup...");
    const finalBalances = await swapContract.getTokenBalances(tokensToRecover);
    const allClean = finalBalances.every(balance => balance === 0n);
    
    if (allClean) {
        console.log("✅ Verification successful: All tokens recovered!");
    } else {
        console.log("⚠️  WARNING: Some tokens may still remain:");
        for (let i = 0; i < tokensToRecover.length; i++) {
            if (finalBalances[i] > 0n) {
                const tokenIndex = tokens.indexOf(tokensToRecover[i]);
                console.log(`   - ${tokenNames[tokenIndex]}: ${ethers.formatEther(finalBalances[i])}`);
            }
        }
    }
    
    console.log("\n════════════════════════════════════════════════════════════════");
    console.log("Asset recovery process completed.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });