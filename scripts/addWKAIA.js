const { ethers } = require("hardhat");
const fs = require("fs");

async function addWKAIA() {
  console.log("💰 Vault에 WKAIA 추가");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  console.log(`현재 상태:`);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const userWKAIA = await wkaia.balanceOf(signer.address);
  const userShares = await vault.balanceOf(signer.address);
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  console.log(`   User WKAIA: ${ethers.formatEther(userWKAIA)}`);
  console.log(`   User shares: ${ethers.formatEther(userShares)}`);
  
  // 0.1 WKAIA deposit
  const depositAmount = ethers.parseEther("0.1");
  console.log(`\n💰 ${ethers.formatEther(depositAmount)} WKAIA deposit 시도`);
  
  try {
    // Approve
    console.log(`   Approve...`);
    const approveTx = await wkaia.approve(vaultAddress, depositAmount);
    await approveTx.wait();
    
    // Deposit
    console.log(`   Deposit...`);
    const depositTx = await vault.deposit(depositAmount, signer.address);
    const receipt = await depositTx.wait();
    
    console.log(`   ✅ Deposit 성공! Gas: ${receipt.gasUsed.toLocaleString()}`);
    
    // 상태 확인
    const newVaultWKAIA = await wkaia.balanceOf(vaultAddress);
    const newUserShares = await vault.balanceOf(signer.address);
    const totalAssets = await vault.totalAssets();
    
    console.log(`\n📊 Deposit 후 상태:`);
    console.log(`   Vault WKAIA: ${ethers.formatEther(newVaultWKAIA)} (증가: ${ethers.formatEther(newVaultWKAIA - vaultWKAIA)})`);
    console.log(`   User shares: ${ethers.formatEther(newUserShares)} (증가: ${ethers.formatEther(newUserShares - userShares)})`);
    console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
    
  } catch (error) {
    console.log(`   ❌ Deposit 실패: ${error.message}`);
  }
  
  // 이제 LST swap 없이 withdrawal 테스트
  const testAmounts = ["0.05", "0.1"];
  
  for (const amount of testAmounts) {
    const targetAmount = ethers.parseEther(amount);
    const currentVaultWKAIA = await wkaia.balanceOf(vaultAddress);
    
    console.log(`\n🧪 ${amount} WKAIA withdrawal 테스트`);
    console.log(`   현재 Vault WKAIA: ${ethers.formatEther(currentVaultWKAIA)}`);
    console.log(`   LST swap 필요: ${targetAmount > currentVaultWKAIA ? "예" : "아니오"}`);
    
    try {
      const preBalance = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
    }
  }
}

addWKAIA()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });