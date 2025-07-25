const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

const networkName = hre.network.name;
console.log("!! start upgrade to : ", networkName);

async function upgradeTokenizedVault(TokenizedVault) {
  const V2Factory = await ethers.getContractFactory(
    "TokenizedVaultUpgradeableV2",
  );
  const v2Factory = await upgrades.upgradeProxy(TokenizedVault, V2Factory);
  console.log("TokenizedVault upgraded : ", await v2Factory.getAddress());
}

async function main() {
  const deployments = JSON.parse(fs.readFileSync(`deployments-${networkName}.json`,, "utf8"));

  await upgradeTokenizedVault(deployments.TokenizedVault);
}

main();
