import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export const MAGIC_EDEN_V2 = new PublicKey('M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K');
export const MAGIC_EDEN_V3 = new PublicKey('M3mxk5W2tt27WGT7THox7PmgRDp4m6NEhL5xvxrBfS1');

export interface MagicEdenTradeInfo {
  type: 'buy' | 'sell' | 'list' | 'delist' | 'bid' | 'accept_bid';
  nftMint: string;
  price: number;
  marketplace: 'v2' | 'v3';
  seller?: string;
  buyer?: string;
  auctionHouse?: string;
}

export function decodeMagicEdenTrade(instruction: TransactionInstruction): MagicEdenTradeInfo | null {
  const isV2 = instruction.programId.equals(MAGIC_EDEN_V2);
  const isV3 = instruction.programId.equals(MAGIC_EDEN_V3);
  
  if (!isV2 && !isV3) return null;

  try {
    const data = instruction.data;
    
    // Parse instruction type from first byte
    const instructionType = data[0];
    let type: MagicEdenTradeInfo['type'] = 'buy';
    
    switch (instructionType) {
      case 0: type = 'list'; break;
      case 1: type = 'delist'; break;
      case 2: type = 'buy'; break;
      case 3: type = 'sell'; break;
      case 4: type = 'bid'; break;
      case 5: type = 'accept_bid'; break;
    }

    const nftMint = instruction.keys[4]?.pubkey.toBase58() || 'unknown';
    const price = data.length > 8 ? Number(data.readBigUInt64LE(1)) / 1e9 : 0;

    return {
      type,
      nftMint,
      price,
      marketplace: isV2 ? 'v2' : 'v3',
      seller: instruction.keys[0]?.pubkey.toBase58(),
      buyer: instruction.keys[1]?.pubkey.toBase58(),
      auctionHouse: instruction.keys[2]?.pubkey.toBase58(),
    };
  } catch {
    return null;
  }
}
