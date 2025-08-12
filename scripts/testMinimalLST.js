const { ethers } = require("hardhat");
const fs = require("fs");

async function testMinimalLST() {
  console.log("🔍 최소 LST swap 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  console.log(`현재 Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  
  // 아주 작은 양들로 테스트 - Vault WKAIA보다 살짝 많은 양
  const testAmounts = ["0.0101", "0.0102", "0.0105"];
  
  for (const amount of testAmounts) {
    const targetAmount = ethers.parseEther(amount);
    console.log(`\n💰 테스트: ${amount} WKAIA (매우 작은 LST swap 필요)`);
    
    try {
      // 먼저 gas estimation으로 사전 체크
      try {
        await vault.withdraw.estimateGas(targetAmount, signer.address, signer.address);
        console.log(`   ✅ Gas estimation 성공`);
      } catch (gasError) {
        console.log(`   ❌ Gas estimation 실패: ${gasError.message}`);
        continue;
      }
      
      const preBalance = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      
      // 성공한 경우 더 큰 양도 시도해보기
      const largerAmount = ethers.parseEther("0.015");
      console.log(`\n💪 더 큰 양 시도: ${ethers.formatEther(largerAmount)} WKAIA`);
      
      try {
        const preBalance2 = await wkaia.balanceOf(signer.address);
        const withdrawTx2 = await vault.withdraw(largerAmount, signer.address, signer.address);
        const receipt2 = await withdrawTx2.wait();
        
        const postBalance2 = await wkaia.balanceOf(signer.address);
        const received2 = postBalance2 - preBalance2;
        
        console.log(`   ✅ 더 큰 양도 성공! 받은 금액: ${ethers.formatEther(received2)} WKAIA`);
        console.log(`   Gas 사용: ${receipt2.gasUsed.toLocaleString()}`);
        
        break; // 성공하면 테스트 종료
        
      } catch (largerError) {
        console.log(`   ❌ 더 큰 양 실패: ${largerError.message}`);
      }
      
      break; // 첫 번째 성공하면 다음 테스트로
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      
      if (error.message.includes("BAL#")) {
        console.log(`   💡 Balancer 오류 - DEX pool 문제`);
      }
    }
  }
  
  // 최종 상태
  console.log(`\n📊 최종 상태:`);
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const totalAssets = await vault.totalAssets();
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
}

testMinimalLST()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });