import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export const JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');

export interface JupiterSwapInfo {
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  minimumOutputAmount: bigint;
  slippageBps: number;
}

export function decodeJupiterSwap(instruction: TransactionInstruction): JupiterSwapInfo | null {
  if (!instruction.programId.equals(JUPITER_PROGRAM_ID)) {
    return null;
  }

  try {
    const data = instruction.data;
    
    // Jupiter Route instruction discriminator
    const ROUTE_DISCRIMINATOR = Buffer.from([229, 23, 203, 151, 122, 227, 173, 42]);
    
    if (!data.subarray(0, 8).equals(ROUTE_DISCRIMINATOR)) {
      return null;
    }

    // Parse swap parameters from instruction data
    const inputAmount = data.readBigUInt64LE(8);
    const minimumOutputAmount = data.readBigUInt64LE(16);
    const slippageBps = data.readUInt16LE(24);

    // Get mints from accounts
    const inputMint = instruction.keys[2]?.pubkey.toBase58() || 'unknown';
    const outputMint = instruction.keys[4]?.pubkey.toBase58() || 'unknown';

    return {
      inputMint,
      outputMint,
      inputAmount,
      minimumOutputAmount,
      slippageBps,
    };
  } catch {
    return null;
  }
}

export function formatJupiterSwap(swap: JupiterSwapInfo): string {
  return `Jupiter Swap: ${swap.inputAmount} → ${swap.minimumOutputAmount} (slippage: ${swap.slippageBps / 100}%)`;
}
