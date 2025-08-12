const { ethers } = require("hardhat");
const fs = require("fs");

async function simpleSwapTest() {
  console.log("🔍 간단한 swap 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  // 현재 상태
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  console.log(`현재 Vault WKAIA: ${ethers.formatEther(vaultWKAIA)} WKAIA`);
  
  // 아주 작은 양으로 withdrawal 시도 (LST swap 불필요)
  const smallAmount = ethers.parseEther("0.005"); // Vault WKAIA의 절반
  
  if (smallAmount < vaultWKAIA) {
    console.log(`\n💰 LST swap 불필요한 작은 양 테스트: ${ethers.formatEther(smallAmount)} WKAIA`);
    
    try {
      const preBalance = await wkaia.balanceOf(signer.address);
      
      const withdrawTx = await vault.withdraw(smallAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      
      // 이제 LST swap이 필요한 양 시도
      const newVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      const largerAmount = newVaultWKAIA + ethers.parseEther("0.001"); // Vault WKAIA보다 살짝 많음
      
      console.log(`\n💪 LST swap 필요한 양 테스트: ${ethers.formatEther(largerAmount)} WKAIA`);
      console.log(`   현재 Vault WKAIA: ${ethers.formatEther(newVaultWKAIA)}`);
      console.log(`   LST에서 필요: ${ethers.formatEther(largerAmount - newVaultWKAIA)}`);
      
      try {
        const preBalance2 = await wkaia.balanceOf(signer.address);
        
        const withdrawTx2 = await vault.withdraw(largerAmount, signer.address, signer.address);
        const receipt2 = await withdrawTx2.wait();
        
        const postBalance2 = await wkaia.balanceOf(signer.address);
        const received2 = postBalance2 - preBalance2;
        
        console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received2)} WKAIA`);
        console.log(`   Gas 사용: ${receipt2.gasUsed.toLocaleString()}`);
        
        console.log(`\n🎉 LST swap 기능 정상 작동!`);
        
      } catch (error2) {
        console.log(`   ❌ 실패: ${error2.message}`);
        
        if (error2.message.includes("BAL#401")) {
          console.log(`   💡 BAL#401 오류 - Balancer 설정 문제 지속`);
        } else if (error2.data === "0x4e487b710000000000000000000000000000000000000000000000000000000000000011") {
          console.log(`   💡 Arithmetic underflow 오류`);
        }
      }
      
    } catch (error1) {
      console.log(`   ❌ 작은 양도 실패: ${error1.message}`);
    }
  } else {
    console.log(`❌ Vault WKAIA가 부족해서 LST swap 불필요한 테스트 불가능`);
  }
  
  // 최종 상태
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const totalAssets = await vault.totalAssets();
  console.log(`\n📊 최종 상태:`);
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   Total assets: ${ethers.formatEther(totalAssets)}`);
}

simpleSwapTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });