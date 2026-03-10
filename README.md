# Solana Transaction Simulator

A transaction simulation engine that predicts state changes, token transfers, and potential security risks before signing. Similar to what Phantom/Blowfish use to protect users from malicious transactions.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-black?style=flat&logo=solana&logoColor=14F195)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

This library simulates Solana transactions before they're signed, providing:
- Predicted balance changes (SOL and tokens)
- NFT transfer detection
- Authority/approval changes
- Scam/phishing detection
- Human-readable transaction summaries

## Why This Matters

Before this simulation layer, users had to blindly trust dApps. Now you can show users exactly what a transaction will do before they approve it:

```
⚠️ WARNING: This transaction will:
  • Transfer 50,000 USDC from your wallet
  • Grant unlimited approval to unknown contract
  • Risk Level: HIGH
```

## Features

### State Change Detection
- SOL balance changes
- SPL token transfers
- NFT transfers (Metaplex, Compressed)
- Account creation/closure
- Token account authority changes

### Security Analysis
- Known scam address detection
- Unlimited approval warnings
- Suspicious program detection
- Drain attack patterns
- Honeypot token detection

### Protocol Decoding
- Jupiter swaps
- Raydium trades
- Orca Whirlpools
- Marinade staking
- Magic Eden trades
- Tensor listings
- pump.fun transactions

## Installation

```bash
npm install @sugusdaddy/solana-tx-simulator
```

## Quick Start

```typescript
import { TransactionSimulator } from '@sugusdaddy/solana-tx-simulator';
import { Connection, VersionedTransaction } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const simulator = new TransactionSimulator(connection);

// Simulate a transaction
const result = await simulator.simulate(transaction, userWallet);

console.log(result);
// {
//   success: true,
//   balanceChanges: [
//     { token: 'SOL', before: 5.5, after: 4.3, change: -1.2, usdValue: -180 },
//     { token: 'USDC', before: 0, after: 1000, change: +1000, usdValue: +1000 },
//   ],
//   warnings: [],
//   riskLevel: 'LOW',
//   summary: 'Swap 1.2 SOL for 1,000 USDC via Jupiter',
//   decodedActions: [
//     { type: 'SWAP', protocol: 'Jupiter', ... }
//   ]
// }
```

## API Reference

### TransactionSimulator

```typescript
class TransactionSimulator {
  constructor(connection: Connection, options?: SimulatorOptions);
  
  // Main simulation method
  simulate(
    transaction: VersionedTransaction | Transaction,
    userWallet: PublicKey,
  ): Promise<SimulationResult>;
  
  // Simulate with additional context
  simulateWithContext(
    transaction: VersionedTransaction,
    context: SimulationContext,
  ): Promise<SimulationResult>;
  
  // Quick risk assessment
  assessRisk(
    transaction: VersionedTransaction,
    userWallet: PublicKey,
  ): Promise<RiskAssessment>;
}

interface SimulatorOptions {
  // RPC endpoints for simulation
  simulationEndpoint?: string;
  
  // Enable scam database lookup
  enableScamDetection?: boolean;
  
  // Custom token price provider
  priceProvider?: PriceProvider;
  
  // Known malicious addresses
  blacklist?: string[];
}
```

### SimulationResult

```typescript
interface SimulationResult {
  success: boolean;
  error?: string;
  
  // Balance changes
  balanceChanges: BalanceChange[];
  
  // Detected warnings
  warnings: Warning[];
  
  // Overall risk level
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Human-readable summary
  summary: string;
  
  // Decoded protocol actions
  decodedActions: DecodedAction[];
  
  // State changes
  stateChanges: StateChange[];
  
  // Simulation metadata
  computeUnits: number;
  fee: number;
  logs: string[];
}

interface BalanceChange {
  type: 'SOL' | 'SPL' | 'NFT';
  token: string;
  mint?: string;
  before: number;
  after: number;
  change: number;
  usdValue?: number;
  logoUri?: string;
}

interface Warning {
  severity: 'INFO' | 'WARNING' | 'DANGER';
  code: WarningCode;
  message: string;
  details?: any;
}

type WarningCode =
  | 'UNLIMITED_APPROVAL'
  | 'KNOWN_SCAM'
  | 'SUSPICIOUS_PROGRAM'
  | 'LARGE_TRANSFER'
  | 'AUTHORITY_CHANGE'
  | 'ACCOUNT_DRAIN'
  | 'HONEYPOT_TOKEN'
  | 'UNVERIFIED_TOKEN';
```

## Security Checks

### Scam Detection

```typescript
// Built-in scam patterns
const SCAM_PATTERNS = {
  // Fake airdrops that drain wallets
  AIRDROP_DRAIN: /claim|airdrop|free.*token/i,
  
  // Fake NFT mints
  FAKE_MINT: /mint.*nft|free.*nft/i,
  
  // Approval exploits
  APPROVAL_EXPLOIT: patterns.unlimitedApproval,
};

// Known malicious programs (updated regularly)
const BLACKLISTED_PROGRAMS = [
  'ScamProgram111111111111111111111111111111',
  // ... more addresses
];
```

### Warning Examples

```typescript
// Unlimited token approval
{
  severity: 'DANGER',
  code: 'UNLIMITED_APPROVAL',
  message: 'This transaction grants unlimited spending approval for USDC',
  details: {
    token: 'USDC',
    spender: '...',
    amount: 'unlimited',
  }
}

// Large unexpected transfer
{
  severity: 'WARNING',
  code: 'LARGE_TRANSFER',
  message: 'This transaction transfers $50,000 worth of tokens',
  details: {
    usdValue: 50000,
    tokens: ['USDC', 'SOL'],
  }
}
```

## Protocol Support

### Decoding Matrix

| Protocol | Swaps | Stakes | NFT | Lending |
|----------|-------|--------|-----|---------|
| Jupiter | ✅ | - | - | - |
| Raydium | ✅ | - | - | - |
| Orca | ✅ | - | - | - |
| Marinade | - | ✅ | - | - |
| Magic Eden | - | - | ✅ | - |
| Tensor | - | - | ✅ | - |
| Marginfi | - | - | - | ✅ |
| Kamino | - | - | - | ✅ |

## Architecture

```
src/
├── simulation/
│   ├── simulator.ts      # Core simulation engine
│   ├── state-diff.ts     # State change detection
│   └── balance.ts        # Balance change tracking
├── decoders/
│   ├── jupiter.ts        # Jupiter instruction decoder
│   ├── raydium.ts        # Raydium decoder
│   ├── nft.ts            # NFT transfer decoder
│   └── index.ts          # Protocol registry
├── security/
│   ├── risk-engine.ts    # Risk assessment
│   ├── scam-db.ts        # Known scam database
│   └── patterns.ts       # Scam pattern matching
└── types/
    └── index.ts          # TypeScript definitions
```

## Performance

| Operation | Latency |
|-----------|---------|
| Simulation | 100-200ms |
| Risk Assessment | 50-100ms |
| Full Analysis | 200-400ms |

## Examples

### Wallet Integration

```typescript
// In a wallet's transaction approval flow
async function approveTransaction(tx: Transaction) {
  const simulation = await simulator.simulate(tx, wallet.publicKey);
  
  if (simulation.riskLevel === 'CRITICAL') {
    throw new Error('Transaction blocked: ' + simulation.warnings[0].message);
  }
  
  if (simulation.riskLevel === 'HIGH') {
    const confirmed = await showWarningModal(simulation.warnings);
    if (!confirmed) return;
  }
  
  // Show user what will happen
  await showSimulationModal(simulation);
  
  // Proceed with signing
  return wallet.signTransaction(tx);
}
```

### dApp Security

```typescript
// Validate transactions before sending to user
app.post('/transaction', async (req, res) => {
  const tx = Transaction.from(req.body.transaction);
  const simulation = await simulator.simulate(tx, req.body.wallet);
  
  res.json({
    transaction: tx.serialize(),
    simulation: {
      summary: simulation.summary,
      balanceChanges: simulation.balanceChanges,
      warnings: simulation.warnings,
      riskLevel: simulation.riskLevel,
    },
  });
});
```

## Contributing

Contributions welcome! Priority areas:
- New protocol decoders
- Scam pattern detection
- Performance optimization

## License

MIT License - see LICENSE for details.

---

Built by [@Sugusdaddy](https://github.com/Sugusdaddy)

*Inspired by Phantom's transaction preview and Blowfish's security infrastructure.*
