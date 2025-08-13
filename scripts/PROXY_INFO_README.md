# 📋 Proxy Information Inspector

## Overview

The `getProxyInfo.js` script is a comprehensive tool for inspecting upgradeable proxy contracts in the KommuneFi ecosystem. It retrieves and displays detailed information about proxy contracts, their admin contracts, and ownership structure.

## Features

### 🎯 Core Capabilities
- **Proxy Information**: Retrieves proxy address, admin, and implementation
- **Ownership Chain**: Tracks admin contract ownership
- **Multi-Network Support**: Works with any configured Hardhat network
- **Rate Limit Handling**: Automatic retry logic for rate-limited RPCs
- **Enhanced Display**: Color-coded output with clear hierarchy
- **Error Recovery**: Multiple fallback methods for data retrieval

### 🔍 Information Retrieved
1. **Proxy Contract Address**
2. **Proxy Admin Contract Address**
3. **Implementation Contract Address**
4. **Admin Contract Owner (EOA)**
5. **Ownership Structure Summary**

## Usage

### Basic Usage
```bash
# Inspect contracts on Kairos testnet
npx hardhat run scripts/getProxyInfo.js --network kairos

# Inspect contracts on Kaia mainnet
npx hardhat run scripts/getProxyInfo.js --network kaia
```

### Prerequisites
1. Deployed contracts with `deployments-{network}.json` file
2. Configured network in `hardhat.config.js`
3. Valid RPC endpoint without strict rate limiting

## Output Format

### Contract Information
```
🔍 KVaultV2
   📍 Proxy: 0x7e50...746b
   👤 Admin: 0x2085...065F
   🔧 Implementation: 0x307C...E7d
   👑 Admin Owner: 0xdc92...5d36
```

### Summary Section
```
📊 Summary
📋 Proxy Admin Structure:
   1. Admin: 0x2085...065F
      ├─ Full: 0x2085F28BfC6B8C6D051E760A387706328620065F
      ├─ Manages: KVaultV2
      └─ Owner: 0xdc926e34e73292cd7c48c6fd7375af7d93435d36

🔑 Unified Control:
   All proxy admins controlled by: 0xdc926e34e73292cd7c48c6fd7375af7d93435d36
```

## Configuration

The script can be configured by modifying the `CONFIG` object:

```javascript
const CONFIG = {
  OWNER_SLOT: "0x0",           // Ownable storage slot
  RETRY_ATTEMPTS: 3,           // Number of retry attempts
  RETRY_DELAY: 2000,           // Delay between retries (ms)
  CONTRACT_NAMES: [            // Contracts to inspect
    "KVaultV2", 
    "SwapContract"
  ]
};
```

## Technical Details

### Storage Slot Reading
The script reads ERC1967 standard storage slots:
- **Admin Slot**: `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`
- **Implementation Slot**: `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`
- **Owner Slot**: `0x0` (Standard Ownable pattern)

### Fallback Methods
1. **Primary**: OpenZeppelin upgrades plugin (`upgrades.erc1967`)
2. **Secondary**: Direct storage slot reading
3. **Tertiary**: Contract function calls with minimal ABI

### Error Handling
- Automatic retry on rate limiting (up to 3 attempts)
- Graceful degradation when data unavailable
- Clear error reporting with context

## Advanced Features

### Exported Functions
The script exports functions for programmatic use:

```javascript
const { getProxyInfo, getAdminOwner, loadDeploymentData } = require('./getProxyInfo');

// Get proxy information
const info = await getProxyInfo('KVaultV2', '0x7e50...746b');

// Get admin owner
const owner = await getAdminOwner('0x2085...065F');

// Load deployment data
const deployments = loadDeploymentData('kairos');
```

### Color Coding
- 🔵 **Blue**: Admin addresses
- 🟢 **Green**: Implementation addresses
- 🟡 **Yellow**: Owner addresses
- 🔵 **Cyan**: Network and proxy addresses
- 🔴 **Red**: Errors and warnings

## Troubleshooting

### Common Issues

#### Rate Limiting
```
⏳ Rate limited, retrying in 2s... (2 attempts left)
```
**Solution**: The script automatically retries. Consider using a public RPC endpoint.

#### Missing Deployment File
```
❌ Error: deployments-kairos.json not found
```
**Solution**: Deploy contracts first using deployment scripts.

#### Unable to Determine Owner
```
ℹ️  Admin owner: Unable to determine
```
**Cause**: Admin contract may not implement Ownable pattern or uses non-standard storage.

## Security Considerations

### Ownership Structure
The script reveals the complete ownership chain:
1. **Proxy Contract** → controlled by → **Proxy Admin**
2. **Proxy Admin** → owned by → **EOA (External Account)**

### Critical Addresses
- The EOA that owns all Proxy Admins has ultimate control
- This address can upgrade all contracts
- Secure storage of this account's private key is essential

## Version History

### v2.0.0 (Current)
- Complete rewrite with improved structure
- Enhanced error handling and retry logic
- Color-coded output with ANSI escape codes
- Modular function design
- Export capabilities for testing
- Comprehensive documentation

### v1.0.0
- Basic proxy information retrieval
- Simple console output
- Manual contract configuration

## Related Scripts

- `deployAll.js` - Deploy all contracts
- `upgradeKVaultV2.js` - Upgrade KVaultV2
- `upgradeSwapContract.js` - Upgrade SwapContract
- `checkVaultState.js` - Check vault state

## Contributing

When modifying this script:
1. Maintain backward compatibility
2. Update the CONFIG object for new contracts
3. Test with both testnet and mainnet configurations
4. Ensure error messages are descriptive
5. Update this documentation

## License

Part of the KommuneFi project. See main project LICENSE file.