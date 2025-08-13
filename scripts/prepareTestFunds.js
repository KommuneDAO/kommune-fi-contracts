const { ethers } = require("hardhat");

/**
 * KAIA를 WKAIA로 래핑하여 테스트 자금 준비
 */
async function prepareTestFunds() {
  console.log("💰 테스트 자금 준비 시작");
  console.log("=" .repeat(50));
  
  const [signer] = await ethers.getSigners();
  const wkaiaAddress = "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106";
  const wkaia = await ethers.getContractAt("IERC20", wkaiaAddress);
  
  console.log(`👤 테스터 주소: ${signer.address}`);
  console.log(`🪙 WKAIA 주소: ${wkaiaAddress}`);
  
  // 현재 잔액 확인
  const kaiaBalance = await ethers.provider.getBalance(signer.address);
  const wkaiaBalance = await wkaia.balanceOf(signer.address);
  
  console.log(`💰 현재 KAIA 잔액: ${ethers.formatEther(kaiaBalance)} KAIA`);
  console.log(`💰 현재 WKAIA 잔액: ${ethers.formatEther(wkaiaBalance)} WKAIA`);
  
  // 필요한 WKAIA 양 (테스트용으로 10 WKAIA)
  const requiredWKAIA = ethers.parseEther("10.0");
  const needToWrap = requiredWKAIA > wkaiaBalance ? requiredWKAIA - wkaiaBalance : 0n;
  
  if (needToWrap > 0) {
    console.log(`🔄 ${ethers.formatEther(needToWrap)} KAIA를 WKAIA로 래핑 필요`);
    
    if (kaiaBalance < needToWrap) {
      console.log("❌ KAIA 잔액 부족");
      return false;
    }
    
    try {
      // WKAIA는 WETH와 동일한 인터페이스를 사용
      const wkaiaContract = await ethers.getContractAt([
        "function deposit() external payable",
        "function balanceOf(address) external view returns (uint256)"
      ], wkaiaAddress);
      
      console.log(`🔄 ${ethers.formatEther(needToWrap)} KAIA를 WKAIA로 래핑 중...`);
      
      const tx = await wkaiaContract.deposit({ value: needToWrap });
      await tx.wait();
      
      const newWkaiaBalance = await wkaia.balanceOf(signer.address);
      console.log(`✅ 래핑 완료! 새 WKAIA 잔액: ${ethers.formatEther(newWkaiaBalance)} WKAIA`);
      
      return true;
    } catch (error) {
      console.log(`❌ 래핑 실패: ${error.message}`);
      return false;
    }
  } else {
    console.log("✅ 충분한 WKAIA 보유");
    return true;
  }
}

if (require.main === module) {
  prepareTestFunds()
    .then((success) => {
      if (success) {
        console.log("🎉 테스트 자금 준비 완료!");
      } else {
        console.log("❌ 테스트 자금 준비 실패");
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { prepareTestFunds };