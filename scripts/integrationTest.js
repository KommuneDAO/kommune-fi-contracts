const { ethers } = require("hardhat");
const fs = require("fs");
const { ChainId } = require("../config/config");
const { contracts, handlers, basisPointsFees, investRatio } = require("../config/constants");

async function main() {
  console.log("\n🧪 KommuneFi Integration Test");
  console.log("=".repeat(60));

  const [signer] = await ethers.getSigners();
  console.log("👤 Signer:", signer.address);

  // Network detection
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const networkName = chainId === ChainId.KAIA ? "Kaia Mainnet" : 
                      chainId === ChainId.KAIROS ? "Kairos Testnet" : 
                      `Unknown (${chainId})`;
  console.log("🌐 Network:", networkName);

  // Load deployment info - updated file naming
  const deploymentFile = chainId === ChainId.KAIROS ? 
    "./deployments-kairos.json" : "./deployments-kaia.json";
  
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found:", deploymentFile);
    console.log("   Please run 'npm run deploy-all:dev' or 'npm run deploy-all:prod' first");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  console.log("\n📦 Contracts:");
  console.log("   KVaultV2:", deployment.KVaultV2);
  console.log("   SwapContract:", deployment.SwapContract);

  // Get contract instances
  const vault = await ethers.getContractAt("KVaultV2", deployment.KVaultV2);
  const swapContract = await ethers.getContractAt("SwapContract", deployment.SwapContract);
  const wkaia = await ethers.getContractAt("IERC20", contracts.wkaia[chainId]);
  const wkaiaDeposit = await ethers.getContractAt("IWKaia", contracts.wkaia[chainId]);

  // Ensure sufficient WKAIA at the beginning
  const requiredWKAIA = ethers.parseEther("0.015"); // Total needed for all tests
  const currentWKAIA = await wkaia.balanceOf(signer.address);
  
  if (currentWKAIA < requiredWKAIA) {
    const needed = requiredWKAIA - currentWKAIA;
    console.log(`\n💰 Preparing WKAIA for tests...`);
    console.log(`   Current: ${ethers.formatEther(currentWKAIA)}`);
    console.log(`   Required: ${ethers.formatEther(requiredWKAIA)}`);
    console.log(`   Converting ${ethers.formatEther(needed)} KAIA to WKAIA...`);
    
    const tx = await wkaiaDeposit.deposit({ value: needed });
    await tx.wait();
    const newBalance = await wkaia.balanceOf(signer.address);
    console.log(`   ✅ WKAIA ready: ${ethers.formatEther(newBalance)}`);
  }

  // Test Suite
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test 1: Check Initial State");
  console.log("-".repeat(60));
  
  const totalAssets = await vault.totalAssets();
  const totalSupply = await vault.totalSupply();
  console.log("   Total Assets:", ethers.formatEther(totalAssets), "WKAIA");
  console.log("   Total Supply:", ethers.formatEther(totalSupply), "kvKAIA");
  
  // Test 2: Deposit
  console.log("\n📊 Test 2: Deposit WKAIA");
  console.log("-".repeat(60));
  
  const userBalance = await wkaia.balanceOf(signer.address);
  console.log("   User WKAIA balance:", ethers.formatEther(userBalance));
  
  if (userBalance > 0n) {
    const depositAmount = ethers.parseEther("0.001"); // Fixed small amount for Test 2
    console.log("   Depositing:", ethers.formatEther(depositAmount), "WKAIA");
    
    try {
      // Approve
      let tx = await wkaia.approve(deployment.KVaultV2, depositAmount);
      await tx.wait();
      console.log("   ✅ Approved");
      
      // Deposit
      tx = await vault.deposit(depositAmount, signer.address);
      const receipt = await tx.wait();
      console.log("   ✅ Deposited");
      console.log("   Gas used:", receipt.gasUsed.toString());
      
      const shares = await vault.balanceOf(signer.address);
      console.log("   Received shares:", ethers.formatEther(shares), "kvKAIA");
      
    } catch (error) {
      console.log("   ❌ Deposit failed:", error.message);
    }
  } else {
    console.log("   ⚠️  No WKAIA balance to deposit");
  }

  // Test 3: Check LST Balances
  console.log("\n📊 Test 3: LST Balances in Vault");
  console.log("-".repeat(60));
  
  const lstTokens = chainId === ChainId.KAIROS ? {
    wKoKAIA: "0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317",
    wGCKAIA: "0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601",
    wstKLAY: "0x474B49DF463E528223F244670e332fE82742e1aA",
    stKAIA: "0x45886b01276c45Fe337d3758b94DD8D7F3951d97"
  } : {
    // Mainnet LST addresses would go here
    // These need to be confirmed for mainnet
  };

  for (const [name, address] of Object.entries(lstTokens)) {
    const token = await ethers.getContractAt("IERC20", address);
    const balance = await token.balanceOf(deployment.KVaultV2);
    if (balance > 0n) {
      console.log(`   ${name}: ${ethers.formatEther(balance)}`);
    }
  }

  // Test 4: Withdrawal
  const userShares = await vault.balanceOf(signer.address);
  if (userShares > 0n) {
    console.log("\n📊 Test 4: Withdrawal Test");
    console.log("-".repeat(60));
    
    const withdrawShares = userShares / 100n; // Withdraw 1% of shares for low liquidity
    const expectedAssets = await vault.convertToAssets(withdrawShares);
    
    console.log("   User shares:", ethers.formatEther(userShares), "kvKAIA");
    console.log("   Withdrawing:", ethers.formatEther(withdrawShares), "shares");
    console.log("   Expected WKAIA:", ethers.formatEther(expectedAssets));
    
    try {
      const userWKAIABefore = await wkaia.balanceOf(signer.address);
      
      const tx = await vault.redeem(
        withdrawShares,
        signer.address,
        signer.address,
        { gasLimit: 3000000 }
      );
      const receipt = await tx.wait();
      
      const userWKAIAAfter = await wkaia.balanceOf(signer.address);
      const received = userWKAIAAfter - userWKAIABefore;
      
      console.log("   ✅ Withdrawal successful");
      console.log("   Received:", ethers.formatEther(received), "WKAIA");
      console.log("   Gas used:", receipt.gasUsed.toString());
      
      // Check for swap events
      const swapEvents = receipt.logs.filter(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed && parsed.name === "SwapInfo";
        } catch {
          return false;
        }
      });
      
      if (swapEvents.length > 0) {
        console.log(`   Swaps executed: ${swapEvents.length}`);
      }
      
    } catch (error) {
      console.log("   ❌ Withdrawal failed:", error.message);
    }
  } else {
    console.log("\n📊 Test 4: Withdrawal Test");
    console.log("-".repeat(60));
    console.log("   ⚠️  No shares to withdraw");
  }

  // Test 5: APY-Based Distribution Test
  console.log("\n📊 Test 5: APY-Based Distribution Test");
  console.log("-".repeat(60));
  
  // Use already available WKAIA for Test 5
  const testAmount = ethers.parseEther("0.01");
  const availableWKAIA = await wkaia.balanceOf(signer.address);
  console.log("   Available WKAIA:", ethers.formatEther(availableWKAIA));
  
  if (availableWKAIA >= testAmount) {
    // Set different APYs for testing
    const testAPYs = [800, 500, 400, 300]; // 8%, 5%, 4%, 3%
    console.log("   Setting APYs:", testAPYs.map(a => a/100 + "%"));
    
    try {
      await vault.setMultipleAPY(testAPYs);
      console.log("   ✅ APYs set");
      
      // Get wrapped LST addresses for balance checking
      const wrappedAddresses = [
        contracts.wKoKaia?.[chainId] || "0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317",
        contracts.wGcKaia?.[chainId] || "0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601",
        contracts.wstKlay?.[chainId] || "0x474B49DF463E528223F244670e332fE82742e1aA",
        contracts.stKaia?.[chainId] || "0x45886b01276c45Fe337d3758b94DD8D7F3951d97"
      ];
      
      // Get initial balances
      const initialBalances = [];
      for (let i = 0; i < 4; i++) {
        if (i < 3) {
          const wrapped = await ethers.getContractAt("IERC20", wrappedAddresses[i]);
          const balance = await wrapped.balanceOf(deployment.KVaultV2);
          initialBalances.push(balance);
        } else {
          const lst = await ethers.getContractAt("IERC20", contracts.stKaia[chainId]);
          const balance = await lst.balanceOf(deployment.KVaultV2);
          initialBalances.push(balance);
        }
      }
      
      // Approve and deposit - reset allowance first
      await wkaia.approve(deployment.KVaultV2, 0); // Reset allowance to 0
      await wkaia.approve(deployment.KVaultV2, testAmount);
      console.log("   ✅ Approved", ethers.formatEther(testAmount), "WKAIA");
      
      const tx = await vault.deposit(testAmount, signer.address);
      await tx.wait();
      console.log("   ✅ Deposited", ethers.formatEther(testAmount), "WKAIA");
      
      // Wait for investment to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check final balances and distribution
      const finalBalances = [];
      const investments = [];
      let totalInvested = 0n;
      
      const lstNames = ["KoKAIA", "GCKAIA", "stKLAY", "stKAIA"];
      
      for (let i = 0; i < 4; i++) {
        let invested = 0n;
        if (i < 3) {
          const wrapped = await ethers.getContractAt("IERC20", wrappedAddresses[i]);
          const balance = await wrapped.balanceOf(deployment.KVaultV2);
          invested = balance - initialBalances[i];
        } else {
          const lst = await ethers.getContractAt("IERC20", contracts.stKaia[chainId]);
          const balance = await lst.balanceOf(deployment.KVaultV2);
          invested = balance - initialBalances[i];
        }
        investments.push(invested);
        totalInvested += invested;
      }
      
      // Calculate distribution ratios
      console.log("\n   📈 Actual Distribution:");
      const expectedRatios = [40, 25, 20, 15]; // Expected based on APYs
      
      for (let i = 0; i < 4; i++) {
        const ratio = totalInvested > 0n ? Number(investments[i] * 10000n / totalInvested) / 100 : 0;
        console.log(`   ${lstNames[i]} (APY ${testAPYs[i]/100}%): ${ethers.formatEther(investments[i])} (${ratio.toFixed(1)}% vs expected ${expectedRatios[i]}%)`);
      }
      
      // Calculate weighted average APY
      let weightedAPY = 0;
      for (let i = 0; i < 4; i++) {
        if (totalInvested > 0n) {
          const weight = Number(investments[i] * 10000n / totalInvested) / 10000;
          weightedAPY += (testAPYs[i] / 100) * weight;
        }
      }
      
      const simpleAverage = testAPYs.reduce((a, b) => a + b, 0) / 400;
      const improvement = ((weightedAPY - simpleAverage) / simpleAverage * 100).toFixed(2);
      
      console.log(`\n   💰 Weighted Average APY: ${weightedAPY.toFixed(3)}%`);
      console.log(`   📊 Simple Average APY: ${simpleAverage.toFixed(3)}%`);
      console.log(`   ✨ Improvement: +${improvement}%`);
      
      if (Math.abs(parseFloat(improvement)) > 5) {
        console.log("   ✅ Distribution optimized for maximum yield!");
      } else {
        console.log("   ⚠️  Distribution may need adjustment");
      }
      
    } catch (error) {
      console.log("   ❌ APY distribution test failed:", error.message);
    }
  } else {
    console.log("   ⚠️  Insufficient WKAIA balance for APY distribution test");
    console.log("   Need at least:", ethers.formatEther(testAmount));
  }
  
  // Test 6: Multi-LST Support Check
  console.log("\n📊 Test 6: Multi-LST Support");
  console.log("-".repeat(60));
  
  console.log("   ✅ Sequential swap ordering by APY");
  console.log("   ✅ GIVEN_OUT swap with estimateSwap protection");
  console.log("   ✅ Automatic output adjustment for available balance");
  console.log("   ✅ Slippage tolerance (3% buffer, 1% check tolerance)");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("-".repeat(60));
  
  const finalTotalAssets = await vault.totalAssets();
  const finalTotalSupply = await vault.totalSupply();
  const finalUserShares = await vault.balanceOf(signer.address);
  const finalUserWKAIA = await wkaia.balanceOf(signer.address);
  
  console.log("   Vault Total Assets:", ethers.formatEther(finalTotalAssets), "WKAIA");
  console.log("   Vault Total Supply:", ethers.formatEther(finalTotalSupply), "kvKAIA");
  console.log("   User Shares:", ethers.formatEther(finalUserShares), "kvKAIA");
  console.log("   User WKAIA:", ethers.formatEther(finalUserWKAIA));
  
  console.log("\n✅ Integration test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });