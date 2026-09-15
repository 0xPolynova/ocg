import { NATIVE_MINT } from "@solana/spl-token";
import {
  getBuySolAmountFromTokenAmount,
  getBuyTokenAmountFromSolAmount,
} from "@pump-fun/pump-sdk";
import type { Global } from "@pump-fun/pump-sdk";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/** Pump.fun UI supply. On-chain amount is this × 10^6. */
export const PUMP_UI_SUPPLY = 1_000_000_000;
/** Real reserves are ~793.1M of 1B, so a create-buy cannot exceed this. */
export const PUMP_MAX_CURVE_PCT = 79;
export const PUMP_MAX_SOL_BUY = 10;
/** Create-only Token-2022 mint, curve, metadata, fees. */
export const PUMP_CREATE_OVERHEAD_SOL = 0.035;
/**
 * First buy also inits creator-vault / volume-accumulator ATAs.
 * Empirically ~0.08–0.10 SOL disappears before the Buy transfer.
 */
export const PUMP_CREATE_AND_BUY_OVERHEAD_SOL = 0.085;
/** Leave a little SOL in the wallet after create+buy. */
export const PUMP_WALLET_DUST_SOL = 0.002;
const LAMPORTS_PER_SOL = 1_000_000_000;

const ZERO = PublicKey.default;

/** Published Pump.fun global curve constants (SOL quote). */
function defaultGlobal(): Global {
  return {
    initialized: true,
    authority: ZERO,
    feeRecipient: ZERO,
    initialVirtualTokenReserves: new BN("1073000000000000"),
    initialVirtualSolReserves: new BN("30000000000"),
    initialRealTokenReserves: new BN("793100000000000"),
    tokenTotalSupply: new BN("1000000000000000"),
    feeBasisPoints: new BN(100),
    withdrawAuthority: ZERO,
    enableMigrate: true,
    poolMigrationFee: new BN(0),
    creatorFeeBasisPoints: new BN(0),
    feeRecipients: [],
    setCreatorAuthority: ZERO,
    adminSetCreatorAuthority: ZERO,
    createV2Enabled: true,
    whitelistPda: ZERO,
    reservedFeeRecipient: ZERO,
    mayhemModeEnabled: false,
    reservedFeeRecipients: [],
    isCashbackEnabled: false,
    buybackFeeRecipients: [],
    buybackBasisPoints: new BN(0),
    initialVirtualQuoteReserves: new BN("30000000000"),
    whitelistedQuoteMints: [],
    creatorFeeConfigurable: false,
    maxConfigurableCreatorFeeBps: new BN(0),
    holderRewardClaimAuthority: ZERO,
    isHolderRewardEnabled: false,
  };
}

const GLOBAL = defaultGlobal();

function lamportsFromSol(sol: number): BN {
  if (!Number.isFinite(sol) || sol <= 0) return new BN(0);
  return new BN(Math.round(sol * 1_000_000_000));
}

function solFromLamports(lamports: BN): number {
  return lamports.toNumber() / 1_000_000_000;
}

export function solForSupplyPct(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  const capped = Math.min(pct, PUMP_MAX_CURVE_PCT);
  const tokens = GLOBAL.tokenTotalSupply.muln(Math.round(capped * 100)).divn(10_000);
  const lamports = getBuySolAmountFromTokenAmount({
    global: GLOBAL,
    feeConfig: null,
    mintSupply: null,
    bondingCurve: null,
    amount: tokens,
    quoteMint: NATIVE_MINT,
  });
  return Number(solFromLamports(lamports).toFixed(4));
}

export function supplyPctForSol(sol: number): number {
  if (!Number.isFinite(sol) || sol <= 0) return 0;
  const tokens = getBuyTokenAmountFromSolAmount({
    global: GLOBAL,
    feeConfig: null,
    mintSupply: null,
    bondingCurve: null,
    amount: lamportsFromSol(sol),
    quoteMint: NATIVE_MINT,
  });
  const pct = tokens.muln(10_000).div(GLOBAL.tokenTotalSupply).toNumber() / 100;
  return Math.min(PUMP_MAX_CURVE_PCT, Number(pct.toFixed(2)));
}

export function formatTokenAmount(sol: number): string {
  const tokens = getBuyTokenAmountFromSolAmount({
    global: GLOBAL,
    feeConfig: null,
    mintSupply: null,
    bondingCurve: null,
    amount: lamportsFromSol(sol),
    quoteMint: NATIVE_MINT,
  });
  const ui = tokens.toNumber() / 1_000_000;
  if (ui >= 1_000_000) return `${(ui / 1_000_000).toFixed(2)}M`;
  if (ui >= 1_000) return `${(ui / 1_000).toFixed(1)}K`;
  return ui.toFixed(0);
}

export function pumpLaunchBudget(solBuy: number): { buySol: number; overheadSol: number; totalSol: number } {
  const buySol = Math.max(0, Number.isFinite(solBuy) ? solBuy : 0);
  const overheadSol =
    (buySol > 0 ? PUMP_CREATE_AND_BUY_OVERHEAD_SOL : PUMP_CREATE_OVERHEAD_SOL) + PUMP_WALLET_DUST_SOL;
  return { buySol, overheadSol, totalSol: buySol + overheadSol };
}

export function maxPumpBuySol(balanceLamports: number): number {
  const spendable =
    balanceLamports / LAMPORTS_PER_SOL - PUMP_CREATE_AND_BUY_OVERHEAD_SOL - PUMP_WALLET_DUST_SOL;
  return Math.max(0, Number(spendable.toFixed(3)));
}

export function describePumpFundsError(log: string, walletSol?: number): string | null {
  const match = log.match(/insufficient lamports (\d+), need (\d+)/i);
  if (!match) return null;
  const have = Number(match[1]) / LAMPORTS_PER_SOL;
  const need = Number(match[2]) / LAMPORTS_PER_SOL;
  const maxBuy = Math.max(0, have - PUMP_WALLET_DUST_SOL);
  const wallet =
    walletSol != null ? ` Connected wallet currently has ${walletSol.toFixed(3)} SOL on-chain.` : "";
  return `The Pump.fun first buy needs ${need.toFixed(3)} SOL after create rent, but only ${have.toFixed(3)} SOL was left in that instruction.${wallet} Lower the dev buy to ${maxBuy.toFixed(3)} SOL or less (or 0).`;
}
