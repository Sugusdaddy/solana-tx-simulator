import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export const MARINADE_PROGRAM = new PublicKey('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD');

export interface MarinadeStakeInfo {
  type: 'deposit' | 'liquid_unstake' | 'delayed_unstake' | 'claim';
  amount: bigint;
  msolAmount?: bigint;
  ticketAccount?: string;
}

export function decodeMarinadeStake(instruction: TransactionInstruction): MarinadeStakeInfo | null {
  if (!instruction.programId.equals(MARINADE_PROGRAM)) {
    return null;
  }

  try {
    const data = instruction.data;
    const discriminator = data[0];

    let type: MarinadeStakeInfo['type'];
    
    switch (discriminator) {
      case 0: type = 'deposit'; break;
      case 1: type = 'liquid_unstake'; break;
      case 2: type = 'delayed_unstake'; break;
      case 3: type = 'claim'; break;
      default: return null;
    }

    const amount = data.readBigUInt64LE(1);

    return {
      type,
      amount,
      msolAmount: data.length > 16 ? data.readBigUInt64LE(9) : undefined,
    };
  } catch {
    return null;
  }
}

export function formatMarinadeStake(stake: MarinadeStakeInfo): string {
  const solAmount = Number(stake.amount) / 1e9;
  return `Marinade ${stake.type}: ${solAmount.toFixed(4)} SOL`;
}
