const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * Query BPT to WKAIA Swap Value using BalancerQueries
 * 
 * This is an alternative to proportional exit for Composable Stable Pools.
 * Instead of using EXACT_BPT_IN_FOR_TOKENS_OUT (which doesn't work),
 * we can swap BPT directly to WKAIA through the BPT-WKAIA pool.
 * 
 * Usage:
 *   npx hardhat run scripts/queryBPTSwap.js --network kaia
 *   
 * With custom BPT amount:
 *   BPT_AMOUNT=10 npx hardhat run scripts/queryBPTSwap.js --network kaia
 *   
 * With specific profile:
 *   PROFILE=stable BPT_AMOUNT=10 npx hardhat run scripts/queryBPTSwap.js --network kaia
 */

async function queryBPTSwap() {
    console.log("\n" + "=".repeat(90));
    console.log("📊 BPT → WKAIA Swap Query Tool");
    console.log("=".repeat(90));
    
    const [signer] = await ethers.getSigners();
    
    // Configuration from environment variables
    const bptAmountInput = process.env.BPT_AMOUNT || "0"; // 0 means use VaultCore balance
    const network = hre.network.name;
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
    
    // Contract addresses
    const balancerQueries = isMainnet ? 
        "0xF03Be4b9f68FA1206d00c1cA4fDB5BfB9A82184b" : 
        "0x8F018316Ec5DA6951C91229858beE06947cd4dd2"; // Kairos testnet
    
    const balancerVault = isMainnet ?
        "0xbF1f3C783C8f6f4582c0a0508f2790b4E2C2E581" :
        "0x1c9074AA147648567015287B0d4185Cb4E04F86d"; // Kairos testnet
    
    // Pool IDs
    const composableStablePoolId = isMainnet ?
        "0xa006e8df6a3cbc66d4d707c97a9fdaf026096487000000000000000000000000" :
        "0x0339d5eb6d195ba90b13ed1bceaa97ebd198b10600000000000000000000002e"; // Kairos testnet
    
    const bptWkaiaPoolId = isMainnet ?
        "0x17f3eda2bf1aa1e7983906e675ac9a2ab6bc57de000000000000000000000001" :
        null; // May not exist on testnet
    
    // Token addresses
    const bptToken = isMainnet ?
        "0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487" : // 5LST BPT
        "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198B106"; // Kairos testnet (same as WKAIA)
    
    const wkaiaToken = isMainnet ?
        "0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432" : // WKAIA mainnet
        "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198B106"; // WKAIA testnet
    
    console.log(`\n📍 Network: ${network} (${isMainnet ? 'Mainnet' : 'Testnet'})`);
    console.log(`📍 Profile: ${profile.toUpperCase()}`);
    console.log(`📍 VaultCore: ${vaultCoreAddress}`);
    
    // Contract ABIs
    const erc20ABI = [
        "function balanceOf(address) view returns (uint256)",
        "function symbol() view returns (string)"
    ];
    
    const balancerQueriesABI = [
        "function querySwap(tuple(bytes32 poolId, uint8 kind, address assetIn, address assetOut, uint256 amount, bytes userData) singleSwap, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds) view returns (uint256)"
    ];
    
    const balancerVaultABI = [
        "function getPoolTokens(bytes32) view returns (address[], uint256[], uint256)",
        "function getPool(bytes32) view returns (address, uint8)"
    ];
    
    // Get BPT balance
    const bptContract = new ethers.Contract(bptToken, erc20ABI, signer);
    let bptBalance;
    
    if (bptAmountInput === "0" || bptAmountInput === "") {
        // Use VaultCore balance
        bptBalance = await bptContract.balanceOf(vaultCoreAddress);
        console.log(`\n📊 Using VaultCore BPT Balance: ${ethers.formatEther(bptBalance)} BPT`);
    } else {
        // Use custom amount
        bptBalance = ethers.parseEther(bptAmountInput);
        console.log(`\n📊 Using Custom BPT Amount: ${bptAmountInput} BPT`);
    }
    
    const bptBalanceEther = parseFloat(ethers.formatEther(bptBalance));
    
    if (bptBalanceEther === 0) {
        console.log("\n⚠️ No BPT balance to query");
        return;
    }
    
    console.log("\n" + "=".repeat(90));
    console.log("💱 BPT → WKAIA Swap Query Results");
    console.log("=".repeat(90));
    
    const queriesContract = new ethers.Contract(balancerQueries, balancerQueriesABI, signer);
    const vaultContract = new ethers.Contract(balancerVault, balancerVaultABI, signer);
    
    // First try the dedicated BPT-WKAIA pool (mainnet only)
    if (isMainnet && bptWkaiaPoolId) {
        console.log("\n1️⃣ Checking BPT-WKAIA Pool:");
        console.log("─".repeat(90));
        
        try {
            const [poolAddress, ] = await vaultContract.getPool(bptWkaiaPoolId);
            console.log(`  Pool Address: ${poolAddress}`);
            
            const [poolTokens, balances, ] = await vaultContract.getPoolTokens(bptWkaiaPoolId);
            console.log("  Pool Tokens:");
            for (let i = 0; i < poolTokens.length; i++) {
                const tokenContract = new ethers.Contract(poolTokens[i], erc20ABI, signer);
                let symbol = "Unknown";
                try {
                    symbol = await tokenContract.symbol();
                } catch {}
                const balanceEther = parseFloat(ethers.formatEther(balances[i]));
                console.log(`    ${symbol}: ${balanceEther.toFixed(2)}`);
            }
            
            console.log("\n2️⃣ Query Swap through BPT-WKAIA Pool:");
            console.log("─".repeat(90));
            
            // Create SingleSwap struct
            const singleSwap = {
                poolId: bptWkaiaPoolId,
                kind: 0, // GIVEN_IN = 0
                assetIn: bptToken,
                assetOut: wkaiaToken,
                amount: bptBalance,
                userData: "0x" // empty user data
            };
            
            // Create FundManagement struct
            const funds = {
                sender: vaultCoreAddress,
                fromInternalBalance: false,
                recipient: vaultCoreAddress,
                toInternalBalance: false
            };
            
            try {
                const amountOut = await queriesContract.querySwap.staticCall(singleSwap, funds);
                const amountOutEther = parseFloat(ethers.formatEther(amountOut));
                
                console.log(`  ✅ Success!`);
                console.log(`  BPT in: ${bptBalanceEther.toFixed(6)} BPT`);
                console.log(`  WKAIA out: ${amountOutEther.toFixed(6)} WKAIA`);
                console.log(`  Exchange rate: ${(amountOutEther / bptBalanceEther).toFixed(6)} WKAIA/BPT`);
                
            } catch (error) {
                console.log(`  ❌ Query failed: ${error.message.substring(0, 100)}`);
            }
            
        } catch (error) {
            console.log(`  ❌ Pool not found: ${error.message.substring(0, 50)}`);
        }
    }
    
    // Try through the Composable Stable Pool (works on both mainnet and testnet)
    console.log("\n3️⃣ Query Swap through Composable Stable Pool:");
    console.log("─".repeat(90));
    
    // Check if WKAIA is in the pool
    try {
        const [poolTokens, , ] = await vaultContract.getPoolTokens(composableStablePoolId);
        const hasWKAIA = poolTokens.some(token => 
            token.toLowerCase() === wkaiaToken.toLowerCase()
        );
        
        if (!hasWKAIA) {
            console.log("  ⚠️ WKAIA not found in Composable Stable Pool");
            console.log("  Note: Direct BPT → WKAIA swap may not be possible");
        } else {
            const singleSwap = {
                poolId: composableStablePoolId,
                kind: 0, // GIVEN_IN
                assetIn: bptToken,
                assetOut: wkaiaToken,
                amount: bptBalance,
                userData: "0x"
            };
            
            const funds = {
                sender: vaultCoreAddress,
                fromInternalBalance: false,
                recipient: vaultCoreAddress,
                toInternalBalance: false
            };
            
            try {
                const amountOut = await queriesContract.querySwap.staticCall(singleSwap, funds);
                const amountOutEther = parseFloat(ethers.formatEther(amountOut));
                
                console.log(`  ✅ Success!`);
                console.log(`  BPT in: ${bptBalanceEther.toFixed(6)} BPT`);
                console.log(`  WKAIA out: ${amountOutEther.toFixed(6)} WKAIA`);
                console.log(`  Exchange rate: ${(amountOutEther / bptBalanceEther).toFixed(6)} WKAIA/BPT`);
                
            } catch (error) {
                console.log(`  ❌ Query failed: ${error.message.substring(0, 100)}`);
            }
        }
    } catch (error) {
        console.log(`  ❌ Error checking pool: ${error.message.substring(0, 50)}`);
    }
    
    console.log("\n" + "=".repeat(90));
    console.log("📊 Summary");
    console.log("=".repeat(90));
    
    console.log("\n💡 Note:");
    console.log("  This swap represents a proportional exit from the Composable Stable Pool.");
    console.log("  It's an alternative to EXACT_BPT_IN_FOR_TOKENS_OUT which doesn't work");
    console.log("  for Composable Stable Pools.");
    
    console.log("\n📈 For comparison:");
    console.log("  Use scripts/queryLPExit.js to see single-token exit values");
    console.log("  The swap rate should be close to the average of single-token exits");
    
    console.log("\n" + "=".repeat(90));
}

// Execute
queryBPTSwap().catch(console.error);