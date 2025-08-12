const { ethers } = require("hardhat");
const fs = require("fs");

async function testMultiLSTSwap() {
  console.log("🔍 다중 LST Swap 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  
  // 현재 Vault의 각 LST 잔액 확인
  console.log("\n📊 현재 LST 잔액:");
  for (let i = 0; i <= 3; i++) {
    const tokenInfo = await vault.tokensInfo(i);
    const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
    const balance = await assetContract.balanceOf(vaultAddress);
    console.log(`   LST ${i}: ${ethers.formatEther(balance)} ${i === 0 ? 'KoKAIA' : i === 1 ? 'GCKAIA' : i === 2 ? 'stKLAY' : 'stKAIA'}`);
  }
  
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  
  // 큰 금액 withdrawal 테스트 - 여러 LST를 사용해야 할 금액
  const testAmounts = ["0.8", "1.0", "1.2"];
  
  for (const amount of testAmounts) {
    const targetAmount = ethers.parseEther(amount);
    const currentVaultWKAIA = await wkaia.balanceOf(vaultAddress);
    
    console.log(`\n💰 테스트: ${amount} WKAIA withdrawal`);
    console.log(`   현재 Vault WKAIA: ${ethers.formatEther(currentVaultWKAIA)}`);
    
    if (targetAmount <= currentVaultWKAIA) {
      console.log(`   LST swap 불필요 (Vault에 충분)`);
      continue;
    }
    
    const needFromLST = targetAmount - currentVaultWKAIA;
    console.log(`   LST에서 필요: ${ethers.formatEther(needFromLST)} WKAIA`);
    
    try {
      // Preview
      const sharesNeeded = await vault.previewWithdraw(targetAmount);
      const userShares = await vault.balanceOf(signer.address);
      
      console.log(`   필요 shares: ${ethers.formatEther(sharesNeeded)}`);
      console.log(`   보유 shares: ${ethers.formatEther(userShares)}`);
      
      if (sharesNeeded > userShares) {
        console.log(`   ❌ Shares 부족`);
        continue;
      }
      
      // 큰 금액일 경우 여러 LST를 사용할 것으로 예상
      console.log(`\n   📋 Withdrawal 계획:`);
      console.log(`      큰 금액이므로 여러 LST 사용 예상`);
      
      // Gas estimation
      const gasEstimate = await vault.withdraw.estimateGas(
        targetAmount, 
        signer.address, 
        signer.address
      );
      console.log(`   예상 Gas: ${gasEstimate.toLocaleString()}`);
      
      // 실제 withdrawal
      const preBalance = await wkaia.balanceOf(signer.address);
      
      console.log(`\n   🔄 Withdrawal 실행 중...`);
      const withdrawTx = await vault.withdraw(targetAmount, signer.address, signer.address);
      const receipt = await withdrawTx.wait();
      
      const postBalance = await wkaia.balanceOf(signer.address);
      const received = postBalance - preBalance;
      
      console.log(`   ✅ 성공! 받은 금액: ${ethers.formatEther(received)} WKAIA`);
      console.log(`   Gas 사용: ${receipt.gasUsed.toLocaleString()}`);
      
      // 큰 금액이면 다중 LST 사용했을 가능성 높음
      if (needFromLST > ethers.parseEther("0.3")) {
        console.log(`   🎉 큰 금액 withdrawal 성공! (다중 LST swap 가능성)`);
      }
      
      // 성공 후 각 LST 잔액 변화 확인
      console.log(`\n   📊 Swap 후 LST 잔액 변화:`);
      for (let i = 0; i <= 3; i++) {
        const tokenInfo = await vault.tokensInfo(i);
        const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
        const newBalance = await assetContract.balanceOf(vaultAddress);
        console.log(`      LST ${i}: ${ethers.formatEther(newBalance)}`);
      }
      
      break; // 하나만 테스트
      
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      
      if (error.message.includes("BAL#401")) {
        console.log(`   💡 BAL#401 - Balancer 오류`);
      } else if (error.data === "0x4e487b710000000000000000000000000000000000000000000000000000000000000011") {
        console.log(`   💡 Arithmetic underflow/overflow`);
      }
    }
  }
  
  // 최종 상태
  console.log(`\n📊 최종 상태:`);
  const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const finalTotalAssets = await vault.totalAssets();
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)}`);
  console.log(`   Total assets: ${ethers.formatEther(finalTotalAssets)}`);
}

testMultiLSTSwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });