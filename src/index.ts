import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SimulatedTransactionResponse,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

// Types
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type WarningSeverity = 'INFO' | 'WARNING' | 'DANGER';

export type WarningCode =
  | 'UNLIMITED_APPROVAL'
  | 'KNOWN_SCAM'
  | 'SUSPICIOUS_PROGRAM'
  | 'LARGE_TRANSFER'
  | 'AUTHORITY_CHANGE'
  | 'ACCOUNT_DRAIN'
  | 'HONEYPOT_TOKEN'
  | 'UNVERIFIED_TOKEN'
  | 'PROGRAM_OWNERSHIP_CHANGE'
  | 'CLOSE_ACCOUNT';

export interface BalanceChange {
  type: 'SOL' | 'SPL' | 'NFT';
  token: string;
  symbol?: string;
  mint?: string;
  before: number;
  after: number;
  change: number;
  usdValue?: number;
  logoUri?: string;
}

export interface Warning {
  severity: WarningSeverity;
  code: WarningCode;
  message: string;
  details?: any;
}

export interface DecodedAction {
  type: 'SWAP' | 'TRANSFER' | 'STAKE' | 'UNSTAKE' | 'NFT_TRANSFER' | 'APPROVAL' | 'UNKNOWN';
  protocol: string;
  description: string;
  data: Record<string, any>;
}

export interface StateChange {
  account: string;
  type: 'CREATED' | 'MODIFIED' | 'CLOSED';
  owner?: string;
  lamports?: number;
  data?: string;
}

export interface SimulationResult {
  success: boolean;
  error?: string;
  balanceChanges: BalanceChange[];
  warnings: Warning[];
  riskLevel: RiskLevel;
  summary: string;
  decodedActions: DecodedAction[];
  stateChanges: StateChange[];
  computeUnits: number;
  fee: number;
  logs: string[];
}

export interface SimulatorOptions {
  simulationEndpoint?: string;
  enableScamDetection?: boolean;
  priceProvider?: (mint: string) => Promise<number>;
  blacklist?: string[];
}

// Known malicious programs and addresses
const KNOWN_SCAMS = new Set([
  // Add known scam addresses here
  'ScamProgram111111111111111111111111111111',
]);

// Suspicious patterns in transaction logs
const SUSPICIOUS_PATTERNS = [
  /setAuthority/i,
  /approve.*unlimited/i,
  /delegate.*all/i,
];

// Token registry for common tokens
const TOKEN_REGISTRY: Record<string, { symbol: string; decimals: number; logoUri?: string }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', decimals: 5 },
};

// Program IDs
const PROGRAMS = {
  SYSTEM: '11111111111111111111111111111111',
  TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TOKEN_2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  MAGIC_EDEN: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K',
};

export class TransactionSimulator {
  private connection: Connection;
  private options: SimulatorOptions;

  constructor(connection: Connection, options: SimulatorOptions = {}) {
    this.connection = connection;
    this.options = {
      enableScamDetection: true,
      blacklist: [],
      ...options,
    };
  }

  async simulate(
    transaction: VersionedTransaction | Transaction,
    userWallet: PublicKey
  ): Promise<SimulationResult> {
    const warnings: Warning[] = [];
    const balanceChanges: BalanceChange[] = [];
    const decodedActions: DecodedAction[] = [];
    const stateChanges: StateChange[] = [];

    try {
      // Get pre-simulation state
      const preBalances = await this.getAccountBalances(userWallet);

      // Simulate the transaction
      let simulationResponse: SimulatedTransactionResponse;
      
      if (transaction instanceof VersionedTransaction) {
        const result = await this.connection.simulateTransaction(transaction, {
          sigVerify: false,
          replaceRecentBlockhash: true,
        });
        simulationResponse = result.value;
      } else {
        const result = await this.connection.simulateTransaction(transaction);
        simulationResponse = result.value;
      }

      // Check for simulation errors
      if (simulationResponse.err) {
        return {
          success: false,
          error: JSON.stringify(simulationResponse.err),
          balanceChanges: [],
          warnings: [{
            severity: 'DANGER',
            code: 'UNKNOWN',
            message: 'Transaction simulation failed',
            details: simulationResponse.err,
          } as Warning],
          riskLevel: 'HIGH',
          summary: 'Transaction would fail',
          decodedActions: [],
          stateChanges: [],
          computeUnits: simulationResponse.unitsConsumed || 0,
          fee: 0,
          logs: simulationResponse.logs || [],
        };
      }

      // Analyze logs for patterns
      const logs = simulationResponse.logs || [];
      this.analyzeLogs(logs, warnings);

      // Analyze accounts for balance changes
      await this.analyzeBalanceChanges(
        userWallet,
        simulationResponse,
        balanceChanges,
        preBalances
      );

      // Check for scam addresses
      if (this.options.enableScamDetection) {
        await this.checkScamAddresses(transaction, warnings);
      }

      // Decode transaction actions
      this.decodeActions(transaction, decodedActions, logs);

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(warnings, balanceChanges);

      // Generate human-readable summary
      const summary = this.generateSummary(decodedActions, balanceChanges);

      return {
        success: true,
        balanceChanges,
        warnings,
        riskLevel,
        summary,
        decodedActions,
        stateChanges,
        computeUnits: simulationResponse.unitsConsumed || 0,
        fee: 5000 / LAMPORTS_PER_SOL, // Base fee
        logs,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        balanceChanges: [],
        warnings: [],
        riskLevel: 'HIGH',
        summary: 'Failed to simulate transaction',
        decodedActions: [],
        stateChanges: [],
        computeUnits: 0,
        fee: 0,
        logs: [],
      };
    }
  }

  private async getAccountBalances(wallet: PublicKey): Promise<Map<string, number>> {
    const balances = new Map<string, number>();
    
    // Get SOL balance
    const solBalance = await this.connection.getBalance(wallet);
    balances.set('SOL', solBalance / LAMPORTS_PER_SOL);

    // Get token balances
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(wallet, {
      programId: new PublicKey(PROGRAMS.TOKEN),
    });

    for (const account of tokenAccounts.value) {
      const mint = account.account.data.parsed.info.mint;
      const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
      balances.set(mint, amount);
    }

    return balances;
  }

  private analyzeLogs(logs: string[], warnings: Warning[]): void {
    const fullLog = logs.join('\n');

    // Check for suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(fullLog)) {
        warnings.push({
          severity: 'WARNING',
          code: 'SUSPICIOUS_PROGRAM',
          message: 'Transaction contains suspicious operations',
          details: { pattern: pattern.source },
        });
      }
    }

    // Check for authority changes
    if (/SetAuthority|set_authority/i.test(fullLog)) {
      warnings.push({
        severity: 'DANGER',
        code: 'AUTHORITY_CHANGE',
        message: 'This transaction changes account authority',
      });
    }

    // Check for unlimited approvals
    if (/Approve.*amount.*18446744073709551615/i.test(fullLog)) {
      warnings.push({
        severity: 'DANGER',
        code: 'UNLIMITED_APPROVAL',
        message: 'This transaction grants unlimited token approval',
      });
    }
  }

  private async analyzeBalanceChanges(
    wallet: PublicKey,
    simulation: SimulatedTransactionResponse,
    balanceChanges: BalanceChange[],
    preBalances: Map<string, number>
  ): Promise<void> {
    // SOL balance change
    const preSol = preBalances.get('SOL') || 0;
    const postSol = (simulation.accounts?.[0]?.lamports || 0) / LAMPORTS_PER_SOL;
    
    if (Math.abs(postSol - preSol) > 0.000001) {
      balanceChanges.push({
        type: 'SOL',
        token: 'SOL',
        symbol: 'SOL',
        before: preSol,
        after: postSol,
        change: postSol - preSol,
      });
    }

    // Token balance changes would be extracted from simulation.accounts
    // This is simplified - real implementation would parse account data
  }

  private async checkScamAddresses(
    transaction: VersionedTransaction | Transaction,
    warnings: Warning[]
  ): Promise<void> {
    // Get all accounts involved in transaction
    let accounts: PublicKey[];
    
    if (transaction instanceof VersionedTransaction) {
      accounts = transaction.message.staticAccountKeys;
    } else {
      accounts = transaction.compileMessage().accountKeys;
    }

    // Check against blacklist
    for (const account of accounts) {
      const address = account.toBase58();
      
      if (KNOWN_SCAMS.has(address) || this.options.blacklist?.includes(address)) {
        warnings.push({
          severity: 'DANGER',
          code: 'KNOWN_SCAM',
          message: 'This transaction interacts with a known scam address',
          details: { address },
        });
      }
    }
  }

  private decodeActions(
    transaction: VersionedTransaction | Transaction,
    actions: DecodedAction[],
    logs: string[]
  ): void {
    const fullLog = logs.join('\n');

    // Detect Jupiter swap
    if (fullLog.includes('Program JUP') || fullLog.includes(PROGRAMS.JUPITER)) {
      actions.push({
        type: 'SWAP',
        protocol: 'Jupiter',
        description: 'Token swap via Jupiter aggregator',
        data: {},
      });
    }

    // Detect Raydium swap
    if (fullLog.includes(PROGRAMS.RAYDIUM)) {
      actions.push({
        type: 'SWAP',
        protocol: 'Raydium',
        description: 'Token swap via Raydium AMM',
        data: {},
      });
    }

    // Detect pump.fun
    if (fullLog.includes(PROGRAMS.PUMP_FUN)) {
      const isBuy = fullLog.includes('buy') || fullLog.includes('Buy');
      actions.push({
        type: 'SWAP',
        protocol: 'pump.fun',
        description: isBuy ? 'Buy token on pump.fun' : 'Sell token on pump.fun',
        data: { side: isBuy ? 'buy' : 'sell' },
      });
    }

    // Detect SOL transfer
    if (fullLog.includes('Transfer') && !actions.length) {
      actions.push({
        type: 'TRANSFER',
        protocol: 'System',
        description: 'SOL or token transfer',
        data: {},
      });
    }

    // Default unknown
    if (!actions.length) {
      actions.push({
        type: 'UNKNOWN',
        protocol: 'Unknown',
        description: 'Unrecognized transaction',
        data: {},
      });
    }
  }

  private calculateRiskLevel(warnings: Warning[], balanceChanges: BalanceChange[]): RiskLevel {
    // Critical if known scam
    if (warnings.some(w => w.code === 'KNOWN_SCAM')) {
      return 'CRITICAL';
    }

    // High if dangerous warnings
    if (warnings.some(w => w.severity === 'DANGER')) {
      return 'HIGH';
    }

    // High if large value transfer
    const totalValueChange = balanceChanges.reduce((sum, b) => {
      return sum + Math.abs(b.usdValue || 0);
    }, 0);
    
    if (totalValueChange > 10000) {
      return 'HIGH';
    }

    // Medium if any warnings
    if (warnings.length > 0) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private generateSummary(actions: DecodedAction[], balanceChanges: BalanceChange[]): string {
    if (actions.length === 0) {
      return 'Unknown transaction';
    }

    const mainAction = actions[0];

    if (mainAction.type === 'SWAP') {
      const inToken = balanceChanges.find(b => b.change < 0);
      const outToken = balanceChanges.find(b => b.change > 0);
      
      if (inToken && outToken) {
        return `Swap ${Math.abs(inToken.change).toFixed(4)} ${inToken.symbol} for ${outToken.change.toFixed(4)} ${outToken.symbol} via ${mainAction.protocol}`;
      }
      return `Token swap via ${mainAction.protocol}`;
    }

    if (mainAction.type === 'TRANSFER') {
      const outgoing = balanceChanges.find(b => b.change < 0);
      if (outgoing) {
        return `Transfer ${Math.abs(outgoing.change).toFixed(4)} ${outgoing.symbol}`;
      }
    }

    return mainAction.description;
  }

  // Quick risk assessment without full simulation
  async assessRisk(
    transaction: VersionedTransaction | Transaction,
    userWallet: PublicKey
  ): Promise<{ riskLevel: RiskLevel; warnings: Warning[] }> {
    const warnings: Warning[] = [];
    
    await this.checkScamAddresses(transaction, warnings);
    
    const riskLevel = warnings.some(w => w.code === 'KNOWN_SCAM') 
      ? 'CRITICAL' 
      : warnings.length > 0 
        ? 'MEDIUM' 
        : 'LOW';

    return { riskLevel, warnings };
  }
}

export default TransactionSimulator;
