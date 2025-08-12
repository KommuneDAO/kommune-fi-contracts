const { ethers } = require("hardhat");
const fs = require("fs");

async function testVaultContext() {
  console.log("🔍 Testing Vault context approve/wrap issues");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  
  // First, transfer some stKLAY to vault for testing
  console.log("📋 Setup: Transferring stKLAY to vault for testing");
  
  const stKLAYAddress = "0x524dCFf07BFF606225A4FA76AFA55D705B052004";
  const wstKLAYAddress = "0x474B49DF463E528223F244670e332fE82742e1aA";
  
  const stKLAY = await ethers.getContractAt("IERC20", stKLAYAddress);
  const wstKLAY = await ethers.getContractAt("IERC20", wstKLAYAddress);
  const wrapContract = await ethers.getContractAt("IWrapped", wstKLAYAddress);
  
  const testAmount = ethers.parseEther("1.0");
  
  // Transfer stKLAY to vault
  console.log(`   Transferring ${ethers.formatEther(testAmount)} stKLAY to vault...`);
  let tx = await stKLAY.transfer(vaultAddress, testAmount);
  await tx.wait();
  
  // Check vault balances
  const vaultStKLAYBalance = await stKLAY.balanceOf(vaultAddress);
  const vaultWstKLAYBalance = await wstKLAY.balanceOf(vaultAddress);
  
  console.log(`✅ Vault now has:`);
  console.log(`   stKLAY: ${ethers.formatEther(vaultStKLAYBalance)}`);
  console.log(`   wstKLAY: ${ethers.formatEther(vaultWstKLAYBalance)}`);
  
  // Now test the vault context issues
  console.log(`\n🧪 Testing Vault Context Issues:`);
  
  // Issue 1: Test if vault can approve tokens to wrap contract
  console.log(`\n1️⃣ Testing Vault Approve Capability:`);
  
  try {
    // We can't directly call from vault address, but we can use impersonation
    console.log(`   Impersonating vault address...`);
    
    // Use hardhat network features to impersonate vault
    await ethers.provider.send("hardhat_impersonateAccount", [vaultAddress]);
    await ethers.provider.send("hardhat_setBalance", [vaultAddress, "0x1000000000000000000"]);
    
    const vaultSigner = await ethers.getSigner(vaultAddress);
    const stKLAYAsVault = stKLAY.connect(vaultSigner);
    const wrapAsVault = wrapContract.connect(vaultSigner);
    
    // Test approve from vault
    console.log(`   Testing approve from vault context...`);
    try {
      tx = await stKLAYAsVault.approve(wstKLAYAddress, 0);
      await tx.wait();
      console.log(`   ✅ Vault reset approve successful`);
      
      tx = await stKLAYAsVault.approve(wstKLAYAddress, testAmount);
      await tx.wait();
      console.log(`   ✅ Vault approve successful`);
      
      // Check allowance
      const allowance = await stKLAY.allowance(vaultAddress, wstKLAYAddress);
      console.log(`   Allowance set: ${ethers.formatEther(allowance)}`);
      
      if (allowance >= testAmount) {
        // Test wrap from vault context
        console.log(`   Testing wrap from vault context...`);
        
        const initialVaultStKLAY = await stKLAY.balanceOf(vaultAddress);
        const initialVaultWstKLAY = await wstKLAY.balanceOf(vaultAddress);
        
        console.log(`   Before wrap - stKLAY: ${ethers.formatEther(initialVaultStKLAY)}, wstKLAY: ${ethers.formatEther(initialVaultWstKLAY)}`);
        
        tx = await wrapAsVault.wrap(testAmount);
        const receipt = await tx.wait();
        console.log(`   ✅ Vault wrap successful! Gas: ${receipt.gasUsed.toLocaleString()}`);
        
        const finalVaultStKLAY = await stKLAY.balanceOf(vaultAddress);
        const finalVaultWstKLAY = await wstKLAY.balanceOf(vaultAddress);
        
        console.log(`   After wrap - stKLAY: ${ethers.formatEther(finalVaultStKLAY)}, wstKLAY: ${ethers.formatEther(finalVaultWstKLAY)}`);
        
        const stKLAYUsed = initialVaultStKLAY - finalVaultStKLAY;
        const wstKLAYReceived = finalVaultWstKLAY - initialVaultWstKLAY;
        
        console.log(`   📊 Results:`);
        console.log(`     stKLAY used: ${ethers.formatEther(stKLAYUsed)}`);
        console.log(`     wstKLAY received: ${ethers.formatEther(wstKLAYReceived)}`);
        
        if (stKLAYUsed === testAmount && wstKLAYReceived === testAmount) {
          console.log(`   🎉 SUCCESS: Vault context wrap works perfectly!`);
          console.log(`   💡 The issue is NOT with vault context or msg.sender permissions`);
          console.log(`   💡 The issue must be in our contract's implementation`);
        } else if (stKLAYUsed === 0n && wstKLAYReceived === 0n) {
          console.log(`   ❌ PROBLEM: Wrap transaction succeeded but no tokens moved`);
          console.log(`   💡 This indicates a silent failure in wrap function`);
        } else {
          console.log(`   ⚠️ PARTIAL: Unexpected amounts - needs investigation`);
        }
        
      } else {
        console.log(`   ❌ Approve failed - allowance: ${ethers.formatEther(allowance)}`);
      }
      
    } catch (vaultError) {
      console.log(`   ❌ Vault context operation failed: ${vaultError.message}`);
      
      if (vaultError.message.includes("arithmetic")) {
        console.log(`   💡 Arithmetic error in vault context`);
      } else if (vaultError.message.includes("revert")) {
        console.log(`   💡 Transaction reverted - may be permission issue`);
      }
    }
    
    // Stop impersonation
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [vaultAddress]);
    
  } catch (impersonationError) {
    console.log(`   ❌ Impersonation failed: ${impersonationError.message}`);
    console.log(`   This test requires hardhat network features`);
  }
  
  console.log(`\n2️⃣ Analyzing Contract Implementation:`);
  console.log(`   If vault context works, the issue is likely in:`);
  console.log(`   a) SwapContract implementation`);
  console.log(`   b) Function call parameters`);
  console.log(`   c) Token transfer flow in _performSmartSwap`);
  console.log(`   d) Amount calculations or conversions`);
  
}

testVaultContext()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });