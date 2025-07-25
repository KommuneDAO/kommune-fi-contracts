require("dotenv").config();

const ChainId = {
  KAIA: 8217,
  KAIROS: 1001,
};

const RPC_URLS = {
  [ChainId.KAIA]: "https://public-en.node.kaia.io",
  [ChainId.KAIROS]: "https://public-en-kairos.node.kaia.io",
};

module.exports = { ChainId, RPC_URLSr };
