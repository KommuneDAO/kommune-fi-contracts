const { ethers } = require("hardhat");
const fs = require("fs");

async function checkVaultState() {
  console.log("🔍 현재 vault 상태 확인");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const userShares = await vault.balanceOf(signer.address);
  const totalSupply = await vault.totalSupply();
  const totalAssets = await vault.totalAssets();
  
  console.log(`\n📊 현재 상태:`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  console.log(`   Total supply: ${ethers.formatEther(totalSupply)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
  
  // Preview 테스트
  const testAmounts = ["0.001", "0.003", "0.005", "0.008", "0.01"];
  
  console.log(`\n📋 Preview 테스트:`);
  for (const amount of testAmounts) {
    const amt = ethers.parseEther(amount);
    try {
      const sharesNeeded = await vault.previewWithdraw(amt);
      const hasEnough = userShares >= sharesNeeded;
      console.log(`   ${amount} WKAIA → ${ethers.formatEther(sharesNeeded)} shares (${hasEnough ? "충분" : "부족"})`);
    } catch (error) {
      console.log(`   ${amount} WKAIA → Preview 실패: ${error.message}`);
    }
  }
  
  // LST 상태 확인
  console.log(`\n📊 LST 상태:`);
  for (let i = 0; i < 4; i++) {
    try {
      const tokenInfo = await vault.tokensInfo(i);
      const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
      const assetBalance = await assetContract.balanceOf(vaultAddress);
      
      if (assetBalance > ethers.parseEther("0.1")) {
        console.log(`   LST ${i}: ${ethers.formatEther(assetBalance)} asset`);
        
        if (i < 3) {
          const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
          const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
          console.log(`          ${ethers.formatEther(wrappedBalance)} wrapped`);
        }
      }
    } catch (e) {
      // Skip
    }
  }
}

checkVaultState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });