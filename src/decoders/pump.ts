import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

export interface PumpFunTradeInfo {
  side: 'buy' | 'sell';
  mint: string;
  bondingCurve: string;
  solAmount: bigint;
  tokenAmount: bigint;
  maxSolCost?: bigint;
  minSolOutput?: bigint;
}

// Instruction discriminators
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

export function decodePumpFunTrade(instruction: TransactionInstruction): PumpFunTradeInfo | null {
  if (!instruction.programId.equals(PUMP_FUN_PROGRAM)) {
    return null;
  }

  try {
    const data = instruction.data;
    const discriminator = data.subarray(0, 8);

    const isBuy = discriminator.equals(BUY_DISCRIMINATOR);
    const isSell = discriminator.equals(SELL_DISCRIMINATOR);

    if (!isBuy && !isSell) {
      return null;
    }

    const mint = instruction.keys[2]?.pubkey.toBase58() || 'unknown';
    const bondingCurve = instruction.keys[3]?.pubkey.toBase58() || 'unknown';

    if (isBuy) {
      return {
        side: 'buy',
        mint,
        bondingCurve,
        tokenAmount: data.readBigUInt64LE(8),
        maxSolCost: data.readBigUInt64LE(16),
        solAmount: BigInt(0),
      };
    }

    return {
      side: 'sell',
      mint,
      bondingCurve,
      tokenAmount: data.readBigUInt64LE(8),
      minSolOutput: data.readBigUInt64LE(16),
      solAmount: BigInt(0),
    };
  } catch {
    return null;
  }
}

export function formatPumpFunTrade(trade: PumpFunTradeInfo): string {
  if (trade.side === 'buy') {
    return `pump.fun BUY: ${trade.tokenAmount} tokens (max ${trade.maxSolCost} SOL)`;
  }
  return `pump.fun SELL: ${trade.tokenAmount} tokens (min ${trade.minSolOutput} SOL)`;
}
