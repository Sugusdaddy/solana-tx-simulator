import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export const TENSOR_PROGRAM_ID = new PublicKey('TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp');
export const TENSOR_SWAP_PROGRAM = new PublicKey('TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN');

export interface TensorTradeInfo {
  type: 'list' | 'delist' | 'buy' | 'sell' | 'bid' | 'cancel_bid';
  nftMint: string;
  price?: number;
  collection?: string;
  seller?: string;
  buyer?: string;
}

const INSTRUCTION_DISCRIMINATORS = {
  LIST: Buffer.from([0x3f, 0x2e, 0x1d, 0x4c, 0x5b, 0x6a, 0x79, 0x88]),
  BUY: Buffer.from([0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6, 0x07, 0x18]),
  SELL: Buffer.from([0x21, 0x32, 0x43, 0x54, 0x65, 0x76, 0x87, 0x98]),
};

export function decodeTensorTrade(instruction: TransactionInstruction): TensorTradeInfo | null {
  const isTensor = instruction.programId.equals(TENSOR_PROGRAM_ID) || 
                   instruction.programId.equals(TENSOR_SWAP_PROGRAM);
  
  if (!isTensor) return null;

  try {
    const data = instruction.data;
    const discriminator = data.subarray(0, 8);

    // Determine trade type
    let type: TensorTradeInfo['type'] = 'buy';
    
    if (discriminator.equals(INSTRUCTION_DISCRIMINATORS.LIST)) {
      type = 'list';
    } else if (discriminator.equals(INSTRUCTION_DISCRIMINATORS.BUY)) {
      type = 'buy';
    } else if (discriminator.equals(INSTRUCTION_DISCRIMINATORS.SELL)) {
      type = 'sell';
    }

    const nftMint = instruction.keys[2]?.pubkey.toBase58() || 'unknown';
    const price = data.length > 16 ? Number(data.readBigUInt64LE(8)) / 1e9 : undefined;

    return {
      type,
      nftMint,
      price,
      seller: instruction.keys[0]?.pubkey.toBase58(),
      buyer: instruction.keys[1]?.pubkey.toBase58(),
    };
  } catch {
    return null;
  }
}

export function formatTensorTrade(trade: TensorTradeInfo): string {
  const priceStr = trade.price ? ` for ${trade.price.toFixed(2)} SOL` : '';
  return `Tensor ${trade.type.toUpperCase()}: NFT ${trade.nftMint.slice(0, 8)}...${priceStr}`;
}
