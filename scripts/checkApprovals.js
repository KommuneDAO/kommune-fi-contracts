const { ethers } = require("hardhat");
const fs = require("fs");

async function checkApprovals() {
  console.log("🔍 Balancer Vault에 대한 Approval 상태 확인");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  const swapContractAddress = deployments.SwapContract;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  const balancerVault = await vault.vault();
  
  console.log(`Vault address: ${vaultAddress}`);
  console.log(`SwapContract address: ${swapContractAddress}`);
  console.log(`Balancer Vault address: ${balancerVault}`);
  
  // LST 0의 토큰들 확인
  const tokenInfo = await vault.tokensInfo(0);
  console.log(`\n📊 LST 0 토큰 approve 상태:`);
  
  const tokens = [
    { name: "tokenA", addr: tokenInfo.tokenA },
    { name: "tokenB", addr: tokenInfo.tokenB }, 
    { name: "tokenC", addr: tokenInfo.tokenC }
  ];
  
  for (const token of tokens) {
    try {
      const tokenContract = await ethers.getContractAt("IERC20", token.addr);
      
      // KVaultV2 → SwapContract approve 확인
      const vaultToSwapAllowance = await tokenContract.allowance(vaultAddress, swapContractAddress);
      console.log(`\n${token.name} (${token.addr}):`);
      console.log(`   KVaultV2 → SwapContract: ${ethers.formatEther(vaultToSwapAllowance)}`);
      
      // SwapContract → Balancer Vault approve 확인
      const swapToBalancerAllowance = await tokenContract.allowance(swapContractAddress, balancerVault);
      console.log(`   SwapContract → Balancer: ${ethers.formatEther(swapToBalancerAllowance)}`);
      
      // 각 컨트랙트의 토큰 잔액 확인
      const vaultBalance = await tokenContract.balanceOf(vaultAddress);
      const swapBalance = await tokenContract.balanceOf(swapContractAddress);
      console.log(`   KVaultV2 balance: ${ethers.formatEther(vaultBalance)}`);
      console.log(`   SwapContract balance: ${ethers.formatEther(swapBalance)}`);
      
      // Approve 부족한지 확인
      if (swapBalance > 0n && swapToBalancerAllowance === 0n) {
        console.log(`   ⚠️ SwapContract에 잔액이 있지만 Balancer에 approve되지 않음!`);
      }
      
    } catch (error) {
      console.log(`   ${token.name} 확인 실패: ${error.message}`);
    }
  }
  
  // 실제 swap 시도 시뮬레이션
  console.log(`\n🧪 실제 swap 프로세스 시뮬레이션:`);
  console.log(`1. KVaultV2._performSmartSwap 호출`);
  console.log(`2. 필요한 양만큼 wrap 실행`);
  console.log(`3. SwapContract.swap 호출`);
  console.log(`4. SwapContract에서 추가 wrap (numWrap > 0인 경우)`);
  console.log(`5. SwapContract에서 tokenA → Balancer Vault approve`);
  console.log(`6. Balancer batchSwap 실행`);
  
  // 실제로 SwapContract에 wrapped token이 있는지 확인
  const wrappedBalance = await ethers.getContractAt("IERC20", tokenInfo.tokenA).then(contract => 
    contract.balanceOf(vaultAddress)
  );
  console.log(`\nKVaultV2의 wrapped token (tokenA) 잔액: ${ethers.formatEther(wrappedBalance)}`);
  
  if (wrappedBalance > 0n) {
    console.log(`✅ Wrapped token이 있어서 swap 가능`);
  } else {
    console.log(`❌ Wrapped token이 없어서 먼저 wrap 필요`);
  }
}

checkApprovals()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });