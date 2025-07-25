const { upgrades } = require("hardhat");

async function getProxyInfo(contract) {
  const admin = await upgrades.erc1967.getAdminAddress(contract.address);
  console.log(`${contract.name} : ${admin}`);
}

const contracts = [
  {
    name: "TokenizedVault",
    address: "",
  },
];

console.log("[ Get Proxy Admin of Contracts ]");
contracts.forEach(async (contract) => await getProxyInfo(contract));
