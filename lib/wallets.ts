export const GLOBAL_WALLET_ID = "global"
export const GLOBAL_WALLET_LABEL = "Global"

export function isGlobalWallet(walletId?: string | null) {
  return walletId === GLOBAL_WALLET_ID
}
