const { ethers } = require("hardhat");
const fs = require("fs");

async function debugSwap() {
  console.log("🔍 Swap 디버깅 - 단계별 실행");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const tokenInfo = await vault.tokensInfo(0); // LST 0 사용
  const assetAddress = await vault.asset();
  const wkaia = await ethers.getContractAt("IERC20", assetAddress);
  const balancerVault = await vault.vault();
  
  console.log(`\n📊 현재 상태:`);
  const vaultWKAIA = await wkaia.balanceOf(vaultAddress);
  const assetContract = await ethers.getContractAt("IERC20", tokenInfo.asset);
  const assetBalance = await assetContract.balanceOf(vaultAddress);
  const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  const wrappedBalance = await wrappedContract.balanceOf(vaultAddress);
  
  console.log(`   Vault WKAIA: ${ethers.formatEther(vaultWKAIA)}`);
  console.log(`   LST 0 asset balance: ${ethers.formatEther(assetBalance)}`);
  console.log(`   LST 0 wrapped balance: ${ethers.formatEther(wrappedBalance)}`);
  
  if (assetBalance === 0n) {
    console.log(`❌ LST 0 asset 잔액이 없어서 wrap 불가능`);
    return;
  }
  
  console.log(`\n🔧 수동 wrap 시도 (0.05 asset):`);
  const wrapAmount = ethers.parseEther("0.05");
  
  try {
    // 1. Approve
    console.log(`   1. Asset approve...`);
    await assetContract.approve(tokenInfo.tokenA, wrapAmount);
    
    // 2. Wrap
    console.log(`   2. Wrap 실행...`);
    const wrapTx = await wrappedContract.wrap(wrapAmount);
    await wrapTx.wait();
    
    const newWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
    console.log(`   ✅ Wrap 성공! 새 wrapped balance: ${ethers.formatEther(newWrappedBalance)}`);
    
  } catch (wrapError) {
    console.log(`   ❌ Wrap 실패: ${wrapError.message}`);
    return;
  }
  
  console.log(`\n🔄 수동 SwapContract transfer 시도:`);
  const finalWrappedBalance = await wrappedContract.balanceOf(vaultAddress);
  const transferAmount = ethers.parseEther("0.03"); // 일부만 전송
  
  if (finalWrappedBalance < transferAmount) {
    console.log(`❌ Wrapped balance 부족`);
    return;
  }
  
  try {
    console.log(`   1. SwapContract로 ${ethers.formatEther(transferAmount)} 전송...`);
    await wrappedContract.transfer(swapContractAddress, transferAmount);
    
    const swapContractBalance = await wrappedContract.balanceOf(swapContractAddress);
    console.log(`   ✅ 전송 성공! SwapContract balance: ${ethers.formatEther(swapContractBalance)}`);
    
    console.log(`\n🧪 SwapContract에서 Balancer approve 시도:`);
    const swapContract = await ethers.getContractAt("SwapContract", swapContractAddress);
    
    // SwapContract의 소유자로 impersonate 필요
    await ethers.provider.send("hardhat_impersonateAccount", [vaultAddress]);
    const vaultSigner = await ethers.getSigner(vaultAddress);
    
    try {
      // TokenInfo 구조체 구성
      const tokenInfoStruct = {
        asset: tokenInfo.asset,
        tokenA: tokenInfo.tokenA,
        tokenB: tokenInfo.tokenB, 
        tokenC: tokenInfo.tokenC,
        pool1: tokenInfo.pool1,
        pool2: tokenInfo.pool2,
        handler: tokenInfo.handler
      };
      
      console.log(`   SwapContract.swap 호출 시도...`);
      const result = await swapContract.connect(vaultSigner).swap(
        tokenInfoStruct,
        balancerVault,
        transferAmount,
        0 // numWrap = 0
      );
      
      const receipt = await result.wait();
      console.log(`   ✅ Swap 성공! Gas: ${receipt.gasUsed.toLocaleString()}`);
      
      // 최종 상태 확인
      const finalVaultWKAIA = await wkaia.balanceOf(vaultAddress);
      console.log(`   최종 Vault WKAIA: ${ethers.formatEther(finalVaultWKAIA)} (증가: ${ethers.formatEther(finalVaultWKAIA - vaultWKAIA)})`);
      
    } catch (swapError) {
      console.log(`   ❌ Swap 실패: ${swapError.message}`);
      
      if (swapError.message.includes("BAL#")) {
        console.log(`   💡 여전히 Balancer 오류 발생`);
      }
    }
    
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [vaultAddress]);
    
  } catch (transferError) {
    console.log(`   ❌ 전송 실패: ${transferError.message}`);
  }
}

debugSwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });