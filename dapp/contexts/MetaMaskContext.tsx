'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { ethers } from 'ethers'

const ANVIL_MNEMONIC = process.env.NEXT_PUBLIC_MNEMONIC || ''
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'

export interface AnvilWallet {
  address: string
  privateKey: string
}

const ANVIL_WALLETS: AnvilWallet[] = Array.from({ length: 10 }, (_, i) => {
  const path = `m/44'/60'/0'/0/${i}`
  const wallet = ethers.HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, undefined, path)
  return { address: wallet.address, privateKey: wallet.privateKey }
})

interface WalletContextValue {
  wallets: AnvilWallet[]
  activeWallet: AnvilWallet | null
  isConnected: boolean
  provider: ethers.JsonRpcProvider
  connect: (walletIndex: number) => void
  disconnect: () => void
  switchWallet: (walletIndex: number) => void
  getSigner: () => ethers.Wallet | null
  signMessage: (message: string | Uint8Array) => Promise<string>
}

const WalletContext = createContext<WalletContextValue | null>(null)

const provider = new ethers.JsonRpcProvider(RPC_URL)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [activeWallet, setActiveWallet] = useState<AnvilWallet | null>(null)

  const connect = useCallback((walletIndex: number) => {
    setActiveWallet(ANVIL_WALLETS[walletIndex] ?? null)
  }, [])

  const disconnect = useCallback(() => {
    setActiveWallet(null)
  }, [])

  const switchWallet = useCallback((walletIndex: number) => {
    setActiveWallet(ANVIL_WALLETS[walletIndex] ?? null)
  }, [])

  const getSigner = useCallback((): ethers.Wallet | null => {
    if (!activeWallet) return null
    return new ethers.Wallet(activeWallet.privateKey, provider)
  }, [activeWallet])

  const signMessage = useCallback(async (message: string | Uint8Array): Promise<string> => {
    const signer = getSigner()
    if (!signer) throw new Error('No wallet connected')
    return signer.signMessage(message)
  }, [getSigner])

  return (
    <WalletContext.Provider
      value={{
        wallets: ANVIL_WALLETS,
        activeWallet,
        isConnected: activeWallet !== null,
        provider,
        connect,
        disconnect,
        switchWallet,
        getSigner,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}
