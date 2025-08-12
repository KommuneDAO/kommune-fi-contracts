const { ethers } = require("hardhat");
const fs = require("fs");

async function checkAssetOrder() {
  console.log("🔍 Asset 정렬 순서 확인");
  
  const networkName = hre.network.name;
  const deploymentFile = `deployments-${networkName}.json`;
  const deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const vaultAddress = deployments.KVaultV2;
  
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("KVaultV2", vaultAddress);
  
  for (let i = 0; i < 3; i++) {
    const tokenInfo = await vault.tokensInfo(i);
    console.log(`\nLST ${i} Asset 순서 분석:`);
    
    const assets = [
      { name: "tokenA", addr: tokenInfo.tokenA },
      { name: "tokenB", addr: tokenInfo.tokenB },
      { name: "tokenC", addr: tokenInfo.tokenC }
    ];
    
    console.log(`현재 순서:`);
    assets.forEach((asset, index) => {
      console.log(`   [${index}] ${asset.name}: ${asset.addr}`);
    });
    
    // 주소 순으로 정렬
    const sortedAssets = [...assets].sort((a, b) => 
      a.addr.toLowerCase().localeCompare(b.addr.toLowerCase())
    );
    
    console.log(`정렬된 순서:`);
    sortedAssets.forEach((asset, index) => {
      console.log(`   [${index}] ${asset.name}: ${asset.addr}`);
    });
    
    // 순서가 맞는지 확인
    const isCorrectOrder = assets.every((asset, index) => 
      asset.addr.toLowerCase() === sortedAssets[index].addr.toLowerCase()
    );
    
    if (isCorrectOrder) {
      console.log(`   ✅ 순서 올바름`);
    } else {
      console.log(`   ❌ 순서 잘못됨 - BAL#401의 원인일 가능성`);
      
      // 올바른 인덱스 매핑 제시
      console.log(`\n   올바른 매핑:`);
      assets.forEach((asset, currentIndex) => {
        const correctIndex = sortedAssets.findIndex(s => 
          s.addr.toLowerCase() === asset.addr.toLowerCase()
        );
        console.log(`   ${asset.name} (현재 [${currentIndex}]) → 정렬된 [${correctIndex}]`);
      });
    }
  }
  
  // SwapContract에서 사용하는 step 확인
  console.log(`\n🔍 Swap Step 분석 (LST 0 기준):`);
  const tokenInfo = await vault.tokensInfo(0);
  
  console.log(`현재 Step 설정:`);
  console.log(`   Step 1: assetInIndex: 0 (tokenA) → assetOutIndex: 1 (tokenB)`);
  console.log(`   Step 2: assetInIndex: 1 (tokenB) → assetOutIndex: 2 (tokenC)`);
  
  // 정렬 후 올바른 인덱스 계산
  const assets = [
    { name: "tokenA", addr: tokenInfo.tokenA },
    { name: "tokenB", addr: tokenInfo.tokenB },
    { name: "tokenC", addr: tokenInfo.tokenC }
  ];
  
  const sortedAssets = [...assets].sort((a, b) => 
    a.addr.toLowerCase().localeCompare(b.addr.toLowerCase())
  );
  
  const tokenAIndex = sortedAssets.findIndex(s => s.addr.toLowerCase() === tokenInfo.tokenA.toLowerCase());
  const tokenBIndex = sortedAssets.findIndex(s => s.addr.toLowerCase() === tokenInfo.tokenB.toLowerCase());  
  const tokenCIndex = sortedAssets.findIndex(s => s.addr.toLowerCase() === tokenInfo.tokenC.toLowerCase());
  
  console.log(`\n정렬 후 올바른 Step:`);
  console.log(`   Step 1: assetInIndex: ${tokenAIndex} (tokenA) → assetOutIndex: ${tokenBIndex} (tokenB)`);
  console.log(`   Step 2: assetInIndex: ${tokenBIndex} (tokenB) → assetOutIndex: ${tokenCIndex} (tokenC)`);
  
  if (tokenAIndex !== 0 || tokenBIndex !== 1 || tokenCIndex !== 2) {
    console.log(`   ❌ SwapContract의 하드코딩된 인덱스 (0→1→2)가 잘못됨!`);
    console.log(`   💡 이것이 BAL#401의 원인입니다.`);
  } else {
    console.log(`   ✅ 인덱스 순서 올바름`);
  }
}

checkAssetOrder()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });