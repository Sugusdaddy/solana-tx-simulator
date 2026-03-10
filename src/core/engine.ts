import { 
  Connection, 
  PublicKey, 
  VersionedTransaction,
  SimulatedTransactionResponse,
  AccountInfo,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface SimulationConfig {
  connection: Connection;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  maxAccountsToTrack?: number;
  enableSecurityChecks?: boolean;
  customBlacklist?: string[];
}

export interface AccountState {
  address: string;
  owner: string;
  lamports: number;
  data: Buffer;
  executable: boolean;
}

export interface SimulationContext {
  preState: Map<string, AccountState>;
  postState: Map<string, AccountState>;
  logs: string[];
  unitsConsumed: number;
  returnData?: { programId: string; data: Buffer };
}

export class SimulationEngine {
  private connection: Connection;
  private config: SimulationConfig;
  private accountCache: Map<string, AccountInfo<Buffer>> = new Map();

  constructor(config: SimulationConfig) {
    this.connection = config.connection;
    this.config = {
      commitment: 'confirmed',
      maxAccountsToTrack: 50,
      enableSecurityChecks: true,
      ...config,
    };
  }

  async getPreSimulationState(
    transaction: VersionedTransaction
  ): Promise<Map<string, AccountState>> {
    const accounts = transaction.message.staticAccountKeys;
    const state = new Map<string, AccountState>();

    // Batch fetch account info
    const accountInfos = await this.connection.getMultipleAccountsInfo(
      accounts.slice(0, this.config.maxAccountsToTrack)
    );

    for (let i = 0; i < accountInfos.length; i++) {
      const info = accountInfos[i];
      if (info) {
        state.set(accounts[i].toBase58(), {
          address: accounts[i].toBase58(),
          owner: info.owner.toBase58(),
          lamports: info.lamports,
          data: info.data,
          executable: info.executable,
        });
      }
    }

    return state;
  }

  async simulate(
    transaction: VersionedTransaction
  ): Promise<{ response: SimulatedTransactionResponse; context: SimulationContext }> {
    // Get pre-state
    const preState = await this.getPreSimulationState(transaction);

    // Run simulation
    const result = await this.connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: this.config.commitment,
      accounts: {
        encoding: 'base64',
        addresses: Array.from(preState.keys()).slice(0, 10),
      },
    });

    // Parse post-state from simulation
    const postState = this.parsePostState(result.value, preState);

    return {
      response: result.value,
      context: {
        preState,
        postState,
        logs: result.value.logs || [],
        unitsConsumed: result.value.unitsConsumed || 0,
        returnData: result.value.returnData ? {
          programId: result.value.returnData.programId,
          data: Buffer.from(result.value.returnData.data[0], 'base64'),
        } : undefined,
      },
    };
  }

  private parsePostState(
    simulation: SimulatedTransactionResponse,
    preState: Map<string, AccountState>
  ): Map<string, AccountState> {
    const postState = new Map(preState);
    
    // Update with simulation results
    if (simulation.accounts) {
      simulation.accounts.forEach((account, index) => {
        if (account) {
          const address = Array.from(preState.keys())[index];
          if (address) {
            postState.set(address, {
              address,
              owner: account.owner,
              lamports: account.lamports,
              data: Buffer.from(account.data[0], 'base64'),
              executable: account.executable,
            });
          }
        }
      });
    }

    return postState;
  }

  async getTokenBalanceChanges(
    userWallet: PublicKey,
    context: SimulationContext
  ): Promise<Array<{ mint: string; before: number; after: number; change: number }>> {
    const changes: Array<{ mint: string; before: number; after: number; change: number }> = [];
    
    // Find token accounts owned by user
    for (const [address, preAccount] of context.preState) {
      if (preAccount.owner === TOKEN_PROGRAM_ID.toBase58()) {
        const postAccount = context.postState.get(address);
        if (postAccount) {
          // Parse token account data
          const preBal = this.parseTokenBalance(preAccount.data);
          const postBal = this.parseTokenBalance(postAccount.data);
          
          if (preBal !== postBal) {
            changes.push({
              mint: address,
              before: preBal,
              after: postBal,
              change: postBal - preBal,
            });
          }
        }
      }
    }

    return changes;
  }

  private parseTokenBalance(data: Buffer): number {
    if (data.length < 72) return 0;
    // Token account structure: mint (32) + owner (32) + amount (8)
    return Number(data.readBigUInt64LE(64));
  }
}
