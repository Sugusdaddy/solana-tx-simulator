import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export const RAYDIUM_AMM_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
export const RAYDIUM_CLMM = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');

export interface RaydiumSwapInfo {
  type: 'AMM' | 'CLMM';
  poolId: string;
  amountIn: bigint;
  minimumAmountOut: bigint;
}

export function decodeRaydiumSwap(instruction: TransactionInstruction): RaydiumSwapInfo | null {
  const isAMM = instruction.programId.equals(RAYDIUM_AMM_V4);
  const isCLMM = instruction.programId.equals(RAYDIUM_CLMM);
  
  if (!isAMM && !isCLMM) {
    return null;
  }

  try {
    const data = instruction.data;
    const poolId = instruction.keys[1]?.pubkey.toBase58() || 'unknown';

    // AMM swap instruction
    if (isAMM && data[0] === 9) {
      return {
        type: 'AMM',
        poolId,
        amountIn: data.readBigUInt64LE(1),
        minimumAmountOut: data.readBigUInt64LE(9),
      };
    }

    // CLMM swap instruction
    if (isCLMM) {
      return {
        type: 'CLMM',
        poolId,
        amountIn: data.readBigUInt64LE(8),
        minimumAmountOut: data.readBigUInt64LE(16),
      };
    }

    return null;
  } catch {
    return null;
  }
}
