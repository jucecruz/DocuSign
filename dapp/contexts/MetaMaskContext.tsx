'use client'

/**
 * MetaMaskContext.tsx — Contexto de wallet para la dapp DocAuth.
 *
 * Conecta con la extensión de MetaMask real del usuario (window.ethereum, EIP-1193)
 * en vez de derivar wallets desde un mnemonic hardcodeado. Cada usuario firma con
 * su propia cuenta; las claves privadas nunca pasan por esta app.
 *
 * Variables de entorno requeridas (en .env.local):
 *   NEXT_PUBLIC_RPC_URL   → URL del nodo RPC usado para lecturas (sin necesidad de wallet).
 *   NEXT_PUBLIC_CHAIN_ID  → Chain ID esperado (ej. 11155111 para Sepolia). Si la wallet
 *                           está en otra red, se le pide cambiar via wallet_switchEthereumChain.
 *
 * Exports:
 *   - `WalletProvider`  → Componente proveedor que envuelve la app.
 *   - `useWallet()`     → Hook para consumir el contexto desde cualquier componente.
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { ethers } from 'ethers'

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'
const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111)

const SEPOLIA_CHAIN_PARAMS = {
  chainId: '0xaa36a7', // 11155111
  chainName: 'Sepolia',
  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
}

/** Wallet conectada actualmente (solo la dirección; la firma la maneja MetaMask). */
export interface ConnectedWallet {
  address: string
}

/** Forma del valor expuesto por el contexto de wallet. */
interface WalletContextValue {
  /** Wallet actualmente conectada, o null si no hay ninguna. */
  activeWallet: ConnectedWallet | null
  /** true si hay una wallet conectada via MetaMask. */
  isConnected: boolean
  /** Chain ID reportado por MetaMask, o null si no está conectado. */
  chainId: number | null
  /** true si la wallet conectada está en una red distinta a NEXT_PUBLIC_CHAIN_ID. */
  isWrongNetwork: boolean
  /** Proveedor JSON-RPC de solo lectura (no requiere wallet conectada). */
  provider: ethers.JsonRpcProvider
  /** Solicita conexión a MetaMask (eth_requestAccounts) y valida/pide cambiar de red. */
  connect: () => Promise<void>
  /** Limpia el estado de conexión local (MetaMask no soporta "desconectar" de verdad). */
  disconnect: () => void
  /** Pide a MetaMask cambiar a la red esperada (NEXT_PUBLIC_CHAIN_ID). */
  switchToExpectedChain: () => Promise<void>
  /** Devuelve el signer de MetaMask listo para firmar/enviar transacciones, o null. */
  getSigner: () => ethers.JsonRpcSigner | null
  /** Firma un mensaje (bytes o string) con la cuenta activa de MetaMask. */
  signMessage: (message: string | Uint8Array) => Promise<string>
}

const WalletContext = createContext<WalletContextValue | null>(null)

// Proveedor JSON-RPC compartido (singleton) para lecturas, independiente de MetaMask
const provider = new ethers.JsonRpcProvider(RPC_URL)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const browserProviderRef = useRef<ethers.BrowserProvider | null>(null)

  const refreshSigner = useCallback(async (browserProvider: ethers.BrowserProvider) => {
    const accounts = await browserProvider.listAccounts()
    if (accounts.length === 0) {
      setAddress(null)
      setSigner(null)
      return
    }
    const newSigner = await browserProvider.getSigner()
    setAddress(await newSigner.getAddress())
    setSigner(newSigner)
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask no está instalado. Instálalo desde metamask.io para continuar.')
    }
    const browserProvider = new ethers.BrowserProvider(window.ethereum)
    browserProviderRef.current = browserProvider

    await browserProvider.send('eth_requestAccounts', [])
    await refreshSigner(browserProvider)

    const network = await browserProvider.getNetwork()
    setChainId(Number(network.chainId))
  }, [refreshSigner])

  const disconnect = useCallback(() => {
    setAddress(null)
    setSigner(null)
    setChainId(null)
  }, [])

  const switchToExpectedChain = useCallback(async () => {
    if (!window.ethereum) return
    const hexChainId = `0x${EXPECTED_CHAIN_ID.toString(16)}`
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
    } catch (err) {
      const code = (err as { code?: number })?.code
      if (code === 4902 && EXPECTED_CHAIN_ID === 11155111) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_CHAIN_PARAMS],
        })
      } else {
        throw err
      }
    }
  }, [])

  const getSigner = useCallback((): ethers.JsonRpcSigner | null => signer, [signer])

  const signMessage = useCallback(async (message: string | Uint8Array): Promise<string> => {
    if (!signer) throw new Error('No wallet connected')
    return signer.signMessage(message)
  }, [signer])

  // Reacciona a cambios de cuenta/red hechos desde la propia extensión de MetaMask
  useEffect(() => {
    if (!window.ethereum?.on) return

    const handleAccountsChanged = () => {
      if (browserProviderRef.current) refreshSigner(browserProviderRef.current)
    }
    const handleChainChanged = (newChainId: unknown) => {
      setChainId(Number(newChainId as string))
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [refreshSigner])

  return (
    <WalletContext.Provider
      value={{
        activeWallet: address ? { address } : null,
        isConnected: address !== null,
        chainId,
        isWrongNetwork: chainId !== null && chainId !== EXPECTED_CHAIN_ID,
        provider,
        connect,
        disconnect,
        switchToExpectedChain,
        getSigner,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

/**
 * Hook para acceder al contexto de wallet desde cualquier componente.
 * Lanza un error descriptivo si se usa fuera de `WalletProvider`.
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}
