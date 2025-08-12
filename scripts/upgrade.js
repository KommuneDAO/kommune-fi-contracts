const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

const networkName = hre.network.name;
console.log("!! start upgrade to : ", networkName);

async function upgradeKVault(vaultAddress) {
  const KVaultV2Factory = await ethers.getContractFactory("KVaultV2");
  const upgraded = await upgrades.upgradeProxy(vaultAddress, KVaultV2Factory);
  console.log("KVaultV2 upgraded : ", await upgraded.getAddress());
}

async function upgradeSwapContract(swapAddress) {
  const SwapFactory = await ethers.getContractFactory("SwapContract");
  const upgraded = await upgrades.upgradeProxy(swapAddress, SwapFactory);
  console.log("SwapContract upgraded : ", await upgraded.getAddress());
}

async function main() {
  const deployments = JSON.parse(
    fs.readFileSync(`deployments-${networkName}.json`, "utf8"),
  );

  await upgradeKVault(deployments.KVaultV2);
  await upgradeSwapContract(deployments.SwapContract);
}

main();
