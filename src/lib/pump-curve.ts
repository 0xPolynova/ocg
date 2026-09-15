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
