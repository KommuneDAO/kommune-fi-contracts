const { ethers } = require("hardhat");
const fs = require("fs");

async function testApprove() {
  console.log("🔍 Approve 흐름 상세 테스트");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const tokenInfo = await vault.tokensInfo(0);
  const balancerVault = await vault.vault();
  
  console.log(`KVaultV2: ${vaultAddress}`);
  console.log(`SwapContract: ${swapContractAddress}`);
  console.log(`Balancer Vault: ${balancerVault}`);
  console.log(`TokenA (wrapped): ${tokenInfo.tokenA}`);
  
  const wrappedContract = await ethers.getContractAt("IERC20", tokenInfo.tokenA);
  
  console.log(`\n📊 현재 approve 상태:`);
  
  // 각 단계별 approve 확인
  const kvaultToSwapAllowance = await wrappedContract.allowance(vaultAddress, swapContractAddress);
  const swapToBalancerAllowance = await wrappedContract.allowance(swapContractAddress, balancerVault);
  
  console.log(`   KVaultV2 → SwapContract: ${ethers.formatEther(kvaultToSwapAllowance)}`);
  console.log(`   SwapContract → Balancer: ${ethers.formatEther(swapToBalancerAllowance)}`);
  
  // 잔액 확인  
  const kvaultBalance = await wrappedContract.balanceOf(vaultAddress);
  const swapBalance = await wrappedContract.balanceOf(swapContractAddress);
  
  console.log(`\n💰 현재 잔액:`);
  console.log(`   KVaultV2 balance: ${ethers.formatEther(kvaultBalance)}`);
  console.log(`   SwapContract balance: ${ethers.formatEther(swapBalance)}`);
  
  if (kvaultBalance === 0n) {
    console.log(`\n❌ KVaultV2에 wrapped token이 없어서 테스트 불가능`);
    console.log(`먼저 LST를 wrap해야 함`);
    return;
  }
  
  console.log(`\n🔧 수동으로 올바른 approve 흐름 테스트:`);
  
  try {
    // Step 1: KVaultV2에서 SwapContract로 토큰 전송 (이미 _performSmartSwap에서 수행됨)
    const transferAmount = ethers.parseEther("0.01");
    if (transferAmount > kvaultBalance) {
      console.log(`❌ 전송할 양이 부족`);
      return;
    }
    
    console.log(`   1. KVaultV2 → SwapContract 전송 (${ethers.formatEther(transferAmount)})...`);
    await wrappedContract.transfer(swapContractAddress, transferAmount);
    
    const newSwapBalance = await wrappedContract.balanceOf(swapContractAddress);
    console.log(`   ✅ 전송 성공! SwapContract 새 잔액: ${ethers.formatEther(newSwapBalance)}`);
    
    // Step 2: SwapContract에서 Balancer Vault로 approve
    // SwapContract가 직접 approve해야 하므로 impersonate 필요
    console.log(`   2. SwapContract → Balancer Vault approve...`);
    
    await ethers.provider.send("hardhat_impersonateAccount", [swapContractAddress]);
    const swapSigner = await ethers.getSigner(swapContractAddress);
    
    // Safe approve pattern
    await wrappedContract.connect(swapSigner).approve(balancerVault, 0);
    await wrappedContract.connect(swapSigner).approve(balancerVault, transferAmount);
    
    const newApproval = await wrappedContract.allowance(swapContractAddress, balancerVault);
    console.log(`   ✅ Approve 성공! 새 allowance: ${ethers.formatEther(newApproval)}`);
    
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [swapContractAddress]);
    
    // Step 3: 이제 실제 swap 시도
    console.log(`   3. 실제 batchSwap 시도...`);
    
    // KVaultV2로 impersonate해서 swap 호출
    await ethers.provider.send("hardhat_impersonateAccount", [vaultAddress]);
    const vaultSigner = await ethers.getSigner(vaultAddress);
    
    const swapContract = await ethers.getContractAt("SwapContract", swapContractAddress);
    
    const tokenInfoStruct = {
      asset: tokenInfo.asset,
      tokenA: tokenInfo.tokenA,
      tokenB: tokenInfo.tokenB,
      tokenC: tokenInfo.tokenC,
      pool1: tokenInfo.pool1,
      pool2: tokenInfo.pool2,
      handler: tokenInfo.handler
    };
    
    try {
      const swapResult = await swapContract.connect(vaultSigner).swap(
        tokenInfoStruct,
        balancerVault,
        transferAmount,
        0
      );
      
      const receipt = await swapResult.wait();
      console.log(`   ✅ Swap 성공! Gas: ${receipt.gasUsed.toLocaleString()}`);
      
    } catch (swapError) {
      console.log(`   ❌ Swap 실패: ${swapError.message}`);
      
      if (swapError.message.includes("BAL#401")) {
        console.log(`   💡 여전히 BAL#401 - approve는 정상이지만 다른 문제 존재`);
      }
    }
    
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [vaultAddress]);
    
  } catch (error) {
    console.log(`❌ 테스트 실패: ${error.message}`);
  }
}

testApprove()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });