import { MessageV1, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

import {
  serializeNoopMessageV1,
  serializeUnsignedV1Transaction,
  v1WireSize,
  V1_FIXED_OVERHEAD,
  V1_MAX_INSTRUCTION_DATA,
  V1_MAX_TX_BYTES,
  V1_PREFIX,
} from "../src/lib/solana-tx-v1";

const payer = PublicKey.unique();
const noop = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");
const blockhash = bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
const data = crypto.getRandomValues(new Uint8Array(3800));

const message = serializeNoopMessageV1({
  payer,
  noopProgram: noop,
  recentBlockhash: blockhash,
  instructionData: data,
});
const unsigned = serializeUnsignedV1Transaction(message);

const decoded = MessageV1.deserialize(message);
if (decoded.version !== 1) throw new Error("message version");
if (decoded.compiledInstructions[0]?.data.length !== data.length) {
  throw new Error("instruction data length");
}
if (!decoded.staticAccountKeys[0]?.equals(payer)) throw new Error("payer");
if (!decoded.staticAccountKeys[1]?.equals(noop)) throw new Error("noop");
if (decoded.transactionConfig.computeUnitLimit !== 50_000) throw new Error("cu");
if (decoded.transactionConfig.loadedAccountsDataSizeLimit !== 65_536) {
  throw new Error("loaded accounts");
}

const tx = VersionedTransaction.deserialize(unsigned);
if (tx.version !== 1) throw new Error("tx version");
if (unsigned[0] !== V1_PREFIX) throw new Error("prefix");
if (unsigned.length !== v1WireSize(data.length)) throw new Error("size helper");
if (unsigned.length > V1_MAX_TX_BYTES) throw new Error("over 4096");
if (V1_MAX_INSTRUCTION_DATA !== V1_MAX_TX_BYTES - V1_FIXED_OVERHEAD) {
  throw new Error("budget");
}

console.log(
  JSON.stringify(
    {
      messageBytes: message.length,
      txBytes: unsigned.length,
      instructionData: data.length,
      maxInstructionData: V1_MAX_INSTRUCTION_DATA,
      version: tx.version,
      cu: decoded.transactionConfig.computeUnitLimit,
      loaded: decoded.transactionConfig.loadedAccountsDataSizeLimit,
    },
    null,
    2,
  ),
);
