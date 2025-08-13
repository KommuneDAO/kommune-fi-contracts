/**
 * @title Proxy Information Inspector
 * @description Retrieves and displays comprehensive information about upgradeable proxy contracts
 * @author KommuneFi
 * @version 2.0.0
 */

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  OWNER_SLOT: "0x0", // Standard Ownable storage slot
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000000000000000000000000000",
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // milliseconds
  CONTRACT_NAMES: ["KVaultV2", "SwapContract"],
  COLORS: {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m"
  }
};

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatAddress = (address) => {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const isZeroAddress = (address) => {
  return !address || address === CONFIG.ZERO_ADDRESS || address === "0x" + "0".repeat(40);
};

/**
 * Retrieves proxy admin owner with multiple fallback methods
 * @param {string} adminAddress - The proxy admin contract address
 * @returns {Promise<string|null>} The owner address or null
 */
async function getAdminOwner(adminAddress) {
  if (!adminAddress || isZeroAddress(adminAddress)) {
    return null;
  }

  // Method 1: Read from storage slot
  try {
    const ownerData = await ethers.provider.getStorage(adminAddress, CONFIG.OWNER_SLOT);
    if (!isZeroAddress(ownerData)) {
      return "0x" + ownerData.slice(-40);
    }
  } catch (error) {
    console.log(`   ${CONFIG.COLORS.dim}Storage read failed: ${error.message.split('\n')[0]}${CONFIG.COLORS.reset}`);
  }

  // Method 2: Call owner() function
  try {
    const ownerABI = ["function owner() view returns (address)"];
    const adminContract = new ethers.Contract(adminAddress, ownerABI, ethers.provider);
    const owner = await adminContract.owner();
    if (!isZeroAddress(owner)) {
      return owner;
    }
  } catch (error) {
    // Silent fail - owner() might not exist
  }

  return null;
}

/**
 * Retrieves proxy information with retry logic
 * @param {string} contractName - The name of the contract
 * @param {string} proxyAddress - The proxy contract address
 * @returns {Promise<Object>} Contract information object
 */
async function getProxyInfo(contractName, proxyAddress) {
  const info = {
    name: contractName,
    proxy: proxyAddress,
    admin: null,
    implementation: null,
    adminOwner: null,
    error: null
  };

  let retries = CONFIG.RETRY_ATTEMPTS;
  
  while (retries > 0) {
    try {
      // Get admin and implementation addresses
      info.admin = await upgrades.erc1967.getAdminAddress(proxyAddress);
      info.implementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      
      // Get admin owner
      if (info.admin) {
        info.adminOwner = await getAdminOwner(info.admin);
      }
      
      return info;
    } catch (error) {
      retries--;
      
      if (error.message.includes("Too Many Requests") && retries > 0) {
        console.log(`   ${CONFIG.COLORS.yellow}⏳ Rate limited, retrying in ${CONFIG.RETRY_DELAY/1000}s... (${retries} attempts left)${CONFIG.COLORS.reset}`);
        await delay(CONFIG.RETRY_DELAY);
      } else {
        info.error = error.message;
        return info;
      }
    }
  }
  
  return info;
}

/**
 * Loads deployment data from file
 * @param {string} networkName - The network name
 * @returns {Object|null} Deployment data or null if not found
 */
function loadDeploymentData(networkName) {
  const deploymentsFile = path.join(process.cwd(), `deployments-${networkName}.json`);
  
  if (!fs.existsSync(deploymentsFile)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));
  } catch (error) {
    console.error(`${CONFIG.COLORS.red}Failed to parse deployment file: ${error.message}${CONFIG.COLORS.reset}`);
    return null;
  }
}

/**
 * Displays contract information
 * @param {Object} info - Contract information object
 */
function displayContractInfo(info) {
  console.log(`\n${CONFIG.COLORS.bright}🔍 ${info.name}${CONFIG.COLORS.reset}`);
  
  if (info.error) {
    console.log(`   ${CONFIG.COLORS.red}❌ Error: ${info.error}${CONFIG.COLORS.reset}`);
    return;
  }
  
  console.log(`   📍 Proxy: ${CONFIG.COLORS.cyan}${info.proxy}${CONFIG.COLORS.reset}`);
  
  if (info.admin) {
    console.log(`   👤 Admin: ${CONFIG.COLORS.blue}${info.admin}${CONFIG.COLORS.reset}`);
  }
  
  if (info.implementation) {
    console.log(`   🔧 Implementation: ${CONFIG.COLORS.green}${info.implementation}${CONFIG.COLORS.reset}`);
  }
  
  if (info.adminOwner) {
    console.log(`   👑 Admin Owner: ${CONFIG.COLORS.yellow}${info.adminOwner}${CONFIG.COLORS.reset}`);
  } else if (info.admin) {
    console.log(`   ${CONFIG.COLORS.dim}ℹ️  Admin owner: Unable to determine${CONFIG.COLORS.reset}`);
  }
}

/**
 * Displays summary of all contracts
 * @param {Object} results - Results object containing all contract information
 */
function displaySummary(results) {
  console.log("\n" + "=".repeat(70));
  console.log(`${CONFIG.COLORS.bright}📊 Summary${CONFIG.COLORS.reset}`);
  
  // Group by admin addresses
  const adminGroups = {};
  Object.entries(results).forEach(([name, info]) => {
    if (info.admin && !info.error) {
      if (!adminGroups[info.admin]) {
        adminGroups[info.admin] = {
          contracts: [],
          owner: info.adminOwner
        };
      }
      adminGroups[info.admin].contracts.push(name);
    }
  });
  
  const adminCount = Object.keys(adminGroups).length;
  if (adminCount > 0) {
    console.log(`\n${CONFIG.COLORS.bright}📋 Proxy Admin Structure:${CONFIG.COLORS.reset}`);
    console.log(`   Total unique admins: ${adminCount}`);
    
    Object.entries(adminGroups).forEach(([admin, data], index) => {
      console.log(`\n   ${index + 1}. Admin: ${CONFIG.COLORS.blue}${formatAddress(admin)}${CONFIG.COLORS.reset}`);
      console.log(`      ├─ Full: ${CONFIG.COLORS.dim}${admin}${CONFIG.COLORS.reset}`);
      console.log(`      ├─ Manages: ${data.contracts.join(", ")}`);
      if (data.owner) {
        console.log(`      └─ Owner: ${CONFIG.COLORS.yellow}${data.owner}${CONFIG.COLORS.reset}`);
      }
    });
  }
  
  // Check ownership consistency
  const uniqueOwners = [...new Set(
    Object.values(results)
      .map(r => r.adminOwner)
      .filter(o => o && !isZeroAddress(o))
  )];
  
  if (uniqueOwners.length === 1) {
    console.log(`\n${CONFIG.COLORS.green}🔑 Unified Control:${CONFIG.COLORS.reset}`);
    console.log(`   All proxy admins controlled by: ${CONFIG.COLORS.yellow}${uniqueOwners[0]}${CONFIG.COLORS.reset}`);
  } else if (uniqueOwners.length > 1) {
    console.log(`\n${CONFIG.COLORS.yellow}⚠️  Distributed Control:${CONFIG.COLORS.reset}`);
    uniqueOwners.forEach(owner => {
      const controlled = Object.entries(results)
        .filter(([_, r]) => r.adminOwner === owner)
        .map(([name, _]) => name);
      console.log(`   • ${owner}`);
      console.log(`     Controls: ${controlled.join(", ")}`);
    });
  }
  
  // Display any errors
  const errors = Object.entries(results).filter(([_, info]) => info.error);
  if (errors.length > 0) {
    console.log(`\n${CONFIG.COLORS.red}⚠️  Errors encountered:${CONFIG.COLORS.reset}`);
    errors.forEach(([name, info]) => {
      console.log(`   • ${name}: ${info.error}`);
    });
  }
}

/**
 * Main execution function
 */
async function main() {
  const networkName = hre.network.name;
  
  // Header
  console.log("\n" + "=".repeat(70));
  console.log(`${CONFIG.COLORS.bright}🏗️  UPGRADEABLE CONTRACT PROXY INFORMATION${CONFIG.COLORS.reset}`);
  console.log("=".repeat(70));
  console.log(`📡 Network: ${CONFIG.COLORS.cyan}${networkName}${CONFIG.COLORS.reset}`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  
  // Load deployment data
  const deployments = loadDeploymentData(networkName);
  if (!deployments) {
    console.error(`\n${CONFIG.COLORS.red}❌ Error: deployments-${networkName}.json not found${CONFIG.COLORS.reset}`);
    console.log("Please deploy contracts first using deployment scripts.");
    process.exit(1);
  }
  
  console.log(`📄 Deployment file: ${CONFIG.COLORS.green}deployments-${networkName}.json${CONFIG.COLORS.reset}`);
  
  // Process contracts
  const results = {};
  let processedCount = 0;
  
  for (const contractName of CONFIG.CONTRACT_NAMES) {
    const address = deployments[contractName];
    
    if (!address) {
      console.log(`\n${CONFIG.COLORS.yellow}⚠️  ${contractName} not found in deployment file${CONFIG.COLORS.reset}`);
      continue;
    }
    
    processedCount++;
    const info = await getProxyInfo(contractName, address);
    results[contractName] = info;
    displayContractInfo(info);
    
    // Add delay between contracts to avoid rate limiting
    if (processedCount < CONFIG.CONTRACT_NAMES.length) {
      await delay(1000);
    }
  }
  
  // Display summary
  if (Object.keys(results).length > 0) {
    displaySummary(results);
  }
  
  // Footer
  console.log("\n" + "=".repeat(70));
  console.log(`${CONFIG.COLORS.green}✅ Inspection complete!${CONFIG.COLORS.reset}`);
  console.log(`   Contracts inspected: ${processedCount}/${CONFIG.CONTRACT_NAMES.length}`);
  console.log(`   Network: ${networkName}`);
  console.log("=".repeat(70) + "\n");
}

// Execute with proper error handling
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`\n${CONFIG.COLORS.red}❌ Fatal Error:${CONFIG.COLORS.reset}`, error);
      process.exit(1);
    });
}

// Export for testing
module.exports = {
  getProxyInfo,
  getAdminOwner,
  loadDeploymentData
};