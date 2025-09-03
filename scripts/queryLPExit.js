const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * Query LP Exit Value using BalancerQueries
 * 
 * Usage:
 *   npx hardhat run scripts/queryLPExit.js --network kaia
 *   
 * With custom LP amount:
 *   LP_AMOUNT=10 npx hardhat run scripts/queryLPExit.js --network kaia
 *   
 * With specific token:
 *   LP_AMOUNT=10 EXIT_TOKEN=wKoKAIA npx hardhat run scripts/queryLPExit.js --network kaia
 *   
 * Available EXIT_TOKEN options:
 *   - wstKLAY (index 0)
 *   - stKAIA (index 1)
 *   - SKLAY (index 2)
 *   - wGCKAIA (index 3)
 *   - wKoKAIA (index 4)
 *   - all (default, shows all tokens)
 */

async function queryLPExit() {
    console.log("\n" + "=".repeat(90));
    console.log("📊 Balancer LP Exit Value Query Tool");
    console.log("=".repeat(90));
    
    const [signer] = await ethers.getSigners();
    
    // Configuration from environment variables
    const lpAmountInput = process.env.LP_AMOUNT || "0"; // 0 means use VaultCore balance
    const exitTokenChoice = process.env.EXIT_TOKEN || "all";
    const network = hre.network.name;
    
    // Determine profile from network
    const profile = process.env.PROFILE || "balanced"; // default to balanced
    
    // Load deployment based on network and profile
    let deploymentFile;
    if (network === "kaia" || network === "mainnet") {
        deploymentFile = `deployments-${profile}-kaia.json`;
    } else if (network === "kairos" || network === "testnet") {
        deploymentFile = `deployments-${profile}-kairos.json`;
    } else {
        console.error(`Unsupported network: ${network}`);
        return;
    }
    
    if (!fs.existsSync(deploymentFile)) {
        console.error(`Deployment file not found: ${deploymentFile}`);
        return;
    }
    
    const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    const vaultCoreAddress = deployments.vaultCore;
    
    // Network-specific addresses
    const isMainnet = network === "kaia" || network === "mainnet";
    const balancerQueries = isMainnet ? 
        "0xF03Be4b9f68FA1206d00c1cA4fDB5BfB9A82184b" : 
        "0x8F018316Ec5DA6951C91229858beE06947cd4dd2"; // Kairos testnet
    
    const poolId = isMainnet ?
        "0xa006e8df6a3cbc66d4d707c97a9fdaf026096487000000000000000000000000" :
        "0x0339d5eb6d195ba90b13ed1bceaa97ebd198b10600000000000000000000002e"; // Kairos testnet
    
    const lpToken = isMainnet ?
        "0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487" :
        "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198B106"; // Kairos testnet (same as WKAIA on testnet)
    
    // Token configuration
    let assets, tokenNames, exitIndices;
    
    if (isMainnet) {
        // Mainnet order (from VaultCore)
        assets = [
            "0x031fB2854029885E1D46b394c8B7881c8ec6AD63",  // wstKLAY
            "0x42952B873ed6f7f0A7E4992E2a9818E3A9001995",  // stKAIA
            "0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487",  // BPT (self)
            "0xA323d7386b671E8799dcA3582D6658FdcDcD940A",  // SKLAY
            "0xa9999999c3D05Fb75cE7230e0D22F5625527d583",  // wGCKAIA
            "0xdEC2Cc84f0a37Ef917f63212FE8ba7494b0E4B15"   // wKoKAIA
        ];
        
        tokenNames = ["wstKLAY", "stKAIA", "BPT", "SKLAY", "wGCKAIA", "wKoKAIA"];
        
        exitIndices = [
            { index: 0, poolIndex: 0, name: "wstKLAY" },
            { index: 1, poolIndex: 1, name: "stKAIA" },
            { index: 2, poolIndex: 3, name: "SKLAY" },
            { index: 3, poolIndex: 4, name: "wGCKAIA" },
            { index: 4, poolIndex: 5, name: "wKoKAIA" }
        ];
    } else {
        // Testnet order
        assets = [
            "0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601",  // wGCKAIA
            "0x45886b01276c45Fe337d3758b94DD8D7F3951d97",  // stKAIA
            "0x474B49DF463E528223F244670e332fE82742e1aA",  // wstKLAY
            "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198B106",  // BPT (WKAIA on testnet)
            "0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317"   // wKoKAIA
        ];
        
        tokenNames = ["wGCKAIA", "stKAIA", "wstKLAY", "BPT", "wKoKAIA"];
        
        exitIndices = [
            { index: 0, poolIndex: 0, name: "wGCKAIA" },
            { index: 1, poolIndex: 1, name: "stKAIA" },
            { index: 2, poolIndex: 2, name: "wstKLAY" },
            { index: 3, poolIndex: 4, name: "wKoKAIA" }
        ];
    }
    
    console.log(`\n📍 Network: ${network} (${isMainnet ? 'Mainnet' : 'Testnet'})`);
    console.log(`📍 Profile: ${profile.toUpperCase()}`);
    console.log(`📍 VaultCore: ${vaultCoreAddress}`);
    
    // Contract ABIs
    const erc20ABI = [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)"
    ];
    
    const balancerQueriesABI = [
        "function queryExit(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] minAmountsOut, bytes userData, bool toInternalBalance) request) view returns (uint256 bptIn, uint256[] amountsOut)"
    ];
    
    const wrappedLSTABI = [
        "function getUnwrappedAmount(uint256) view returns (uint256)",
        "function getGCKLAYByWGCKLAY(uint256) view returns (uint256)"
    ];
    
    const rateProviderABI = [
        "function getRate() view returns (uint256)"
    ];
    
    // Get LP balance
    const lpContract = new ethers.Contract(lpToken, erc20ABI, signer);
    let lpBalance;
    
    if (lpAmountInput === "0" || lpAmountInput === "") {
        // Use VaultCore balance
        lpBalance = await lpContract.balanceOf(vaultCoreAddress);
        console.log(`\n📊 Using VaultCore LP Balance: ${ethers.formatEther(lpBalance)} BPT`);
    } else {
        // Use custom amount
        lpBalance = ethers.parseEther(lpAmountInput);
        console.log(`\n📊 Using Custom LP Amount: ${lpAmountInput} BPT`);
    }
    
    const lpBalanceEther = parseFloat(ethers.formatEther(lpBalance));
    
    if (lpBalanceEther === 0) {
        console.log("\n⚠️ No LP balance to query");
        return;
    }
    
    // Determine which tokens to query
    let tokensToQuery = [];
    if (exitTokenChoice.toLowerCase() === "all") {
        tokensToQuery = exitIndices;
    } else {
        const selected = exitIndices.find(e => e.name.toLowerCase() === exitTokenChoice.toLowerCase());
        if (selected) {
            tokensToQuery = [selected];
        } else {
            console.log(`\n⚠️ Invalid EXIT_TOKEN: ${exitTokenChoice}`);
            console.log(`   Valid options: ${exitIndices.map(e => e.name).join(", ")}, all`);
            return;
        }
    }
    
    console.log("\n" + "=".repeat(90));
    console.log("💱 LP Exit Query Results (EXACT_BPT_IN_FOR_ONE_TOKEN_OUT)");
    console.log("=".repeat(90));
    
    const queriesContract = new ethers.Contract(balancerQueries, balancerQueriesABI, signer);
    const results = [];
    
    for (const exit of tokensToQuery) {
        console.log(`\n📌 Exit to ${exit.name}:`);
        
        // Single asset exit: [exitKind, bptAmountIn, exitTokenIndex]
        const userData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "uint256"],
            [0, lpBalance, exit.index]  // Exit index after BPT exclusion
        );
        
        const minAmountsOut = new Array(assets.length).fill(0);
        
        const exitRequest = {
            assets: assets,
            minAmountsOut: minAmountsOut,
            userData: userData,
            toInternalBalance: false
        };
        
        try {
            const result = await queriesContract.queryExit.staticCall(
                poolId,
                vaultCoreAddress,
                vaultCoreAddress,
                exitRequest
            );
            
            const [bptIn, amountsOut] = result;
            const amount = amountsOut[exit.poolIndex];
            const amountEther = parseFloat(ethers.formatEther(amount));
            
            console.log(`   BPT to burn: ${ethers.formatEther(bptIn)} BPT`);
            console.log(`   ${exit.name} received: ${amountEther.toFixed(6)}`);
            
            // Calculate KAIA value
            let kaiaValue = amountEther;
            
            if (isMainnet) {
                // Apply unwrap/rate conversions for mainnet
                if (exit.name === "wstKLAY") {
                    try {
                        const wrappedContract = new ethers.Contract(assets[exit.poolIndex], wrappedLSTABI, signer);
                        const unwrapped = await wrappedContract.getUnwrappedAmount(amount);
                        kaiaValue = parseFloat(ethers.formatEther(unwrapped));
                        console.log(`   → Unwrapped: ${kaiaValue.toFixed(6)} KAIA`);
                    } catch {
                        console.log(`   → Unwrap failed, using 1:1`);
                    }
                } else if (exit.name === "stKAIA") {
                    const stKAIARateProvider = "0xefBDe60d5402a570DF7CA0d26Ddfedc413260146";
                    try {
                        const rateContract = new ethers.Contract(stKAIARateProvider, rateProviderABI, signer);
                        const rate = await rateContract.getRate();
                        const rateFloat = parseFloat(ethers.formatEther(rate));
                        kaiaValue = amountEther * rateFloat;
                        console.log(`   → With rate ${rateFloat.toFixed(4)}: ${kaiaValue.toFixed(6)} KAIA`);
                    } catch {
                        console.log(`   → Rate provider failed, using 1:1`);
                    }
                } else if (exit.name === "SKLAY") {
                    const sKLAYRateProvider = "0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93";
                    try {
                        const rateContract = new ethers.Contract(sKLAYRateProvider, rateProviderABI, signer);
                        const rate = await rateContract.getRate();
                        const rateFloat = parseFloat(ethers.formatEther(rate));
                        kaiaValue = amountEther * rateFloat;
                        console.log(`   → With rate ${rateFloat.toFixed(4)}: ${kaiaValue.toFixed(6)} KAIA`);
                    } catch {
                        kaiaValue = amountEther * 1.375;
                        console.log(`   → With rate 1.375 (fallback): ${kaiaValue.toFixed(6)} KAIA`);
                    }
                } else if (exit.name === "wGCKAIA") {
                    try {
                        const wrappedContract = new ethers.Contract(assets[exit.poolIndex], wrappedLSTABI, signer);
                        const unwrapped = await wrappedContract.getGCKLAYByWGCKLAY(amount);
                        kaiaValue = parseFloat(ethers.formatEther(unwrapped));
                        console.log(`   → Unwrapped: ${kaiaValue.toFixed(6)} KAIA`);
                    } catch {
                        console.log(`   → Unwrap failed, using 1:1`);
                    }
                } else if (exit.name === "wKoKAIA") {
                    try {
                        const wrappedContract = new ethers.Contract(assets[exit.poolIndex], wrappedLSTABI, signer);
                        const unwrapped = await wrappedContract.getUnwrappedAmount(amount);
                        kaiaValue = parseFloat(ethers.formatEther(unwrapped));
                        console.log(`   → Unwrapped: ${kaiaValue.toFixed(6)} KAIA`);
                    } catch {
                        console.log(`   → Unwrap failed, using 1:1`);
                    }
                }
            }
            
            results.push({
                token: exit.name,
                amount: amountEther,
                kaiaValue: kaiaValue
            });
            
        } catch (error) {
            console.log(`   ❌ Query failed: ${error.message.substring(0, 100)}`);
        }
    }
    
    // Summary
    if (results.length > 0) {
        console.log("\n" + "=".repeat(90));
        console.log("📊 Summary");
        console.log("=".repeat(90));
        
        console.log(`\nLP Amount: ${lpBalanceEther.toFixed(6)} BPT`);
        console.log("\nExit Values (KAIA):");
        
        let totalValue = 0;
        for (const result of results) {
            console.log(`  ${result.token}: ${result.kaiaValue.toFixed(6)} KAIA`);
            totalValue += result.kaiaValue;
        }
        
        if (results.length > 1) {
            const avgValue = totalValue / results.length;
            console.log(`\nAverage KAIA value: ${avgValue.toFixed(6)} KAIA`);
            
            // Calculate per BPT value
            const perBptValue = avgValue / lpBalanceEther;
            console.log(`Value per BPT: ${perBptValue.toFixed(6)} KAIA/BPT`);
        }
    }
    
    console.log("\n" + "=".repeat(90));
}

// Execute
queryLPExit().catch(console.error);