const { ethers } = require("hardhat");
const fs = require("fs");

async function simpleWithdraw() {
  console.log("🔍 간단한 withdrawal 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  console.log(`Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  
  // Vault WKAIA보다 적은 양 (0.01 WKAIA)으로 테스트
  const smallAmount = ethers.parseEther("0.01");
  console.log(`테스트 금액: ${ethers.formatEther(smallAmount)} WKAIA (Vault WKAIA보다 적음)`);
  
  try {
    const preBalance = await wkaia.balanceOf(signer.address);
    console.log(`실행 전 사용자 WKAIA: ${ethers.formatEther(preBalance)}`);
    
    const withdrawTx = await vault.withdraw(smallAmount, signer.address, signer.address);
    const receipt = await withdrawTx.wait();
    
    const postBalance = await wkaia.balanceOf(signer.address);
    const received = postBalance - preBalance;
    
    console.log(`✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
    console.log(`Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
    
  } catch (error) {
    console.log(`❌ 실패: ${error.message}`);
    
    if (error.data) {
      console.log(`Error data: ${error.data}`);
    }
  }
  
  // 이번에는 더 작은 양 (0.005 WKAIA)
  const verySmallAmount = ethers.parseEther("0.005");
  console.log(`\n더 작은 테스트 금액: ${ethers.formatEther(verySmallAmount)} WKAIA`);
  
  try {
    const preBalance = await wkaia.balanceOf(signer.address);
    
    const withdrawTx = await vault.withdraw(verySmallAmount, signer.address, signer.address);
    const receipt = await withdrawTx.wait();
    
    const postBalance = await wkaia.balanceOf(signer.address);
    const received = postBalance - preBalance;
    
    console.log(`✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
    console.log(`Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
    
  } catch (error) {
    console.log(`❌ 실패: ${error.message}`);
    
    if (error.data) {
      console.log(`Error data: ${error.data}`);
    }
  }
}

simpleWithdraw()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });