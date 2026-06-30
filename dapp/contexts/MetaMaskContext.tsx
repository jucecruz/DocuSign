'use client'

/**
 * MetaMaskContext.tsx — Contexto de wallet para la dapp DocAuth.
 *
 * En lugar de usar MetaMask real, esta dapp trabaja directamente con las
 * 10 wallets predeterminadas que Anvil (la blockchain local de Foundry) genera
 * a partir de un mnemónico HD determinístico.
 *
 * ¿Por qué así?
 *   - Permite desarrollo/testing sin extensión de navegador.
 *   - Las claves privadas de Anvil son públicas y conocidas; nunca usar en mainnet.
 *
 * Cómo se derivan las wallets:
 *   Se usa el path de derivación BIP44 estándar para Ethereum:
 *   m/44'/60'/0'/0/<índice>   (índice 0..9 → 10 wallets)
 *   ethers.HDNodeWallet.fromPhrase genera cada wallet a partir del mnemónico.
 *
 * Variables de entorno requeridas (en .env.local):
 *   NEXT_PUBLIC_MNEMONIC  → Mnemónico de Anvil (12 palabras, visible en `anvil` al arrancar).
 *   NEXT_PUBLIC_RPC_URL   → URL del nodo RPC (default: http://localhost:8545).
 *
 * Exports:
 *   - `WalletProvider`  → Componente proveedor que envuelve la app.
 *   - `useWallet()`     → Hook para consumir el contexto desde cualquier componente.
 *   - `AnvilWallet`     → Tipo con `address` y `privateKey`.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { ethers } from 'ethers'

// Lee el mnemónico y la URL RPC desde variables de entorno de Next.js
const ANVIL_MNEMONIC = process.env.NEXT_PUBLIC_MNEMONIC || ''
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'

/** Representación simplificada de una wallet de Anvil. */
export interface AnvilWallet {
  address: string
  privateKey: string
}

/**
 * Genera las 10 wallets de Anvil al cargar el módulo (una sola vez).
 * Usar `Array.from({ length: 10 }, ...)` para iterar sobre los índices 0..9.
 */
const ANVIL_WALLETS: AnvilWallet[] = Array.from({ length: 10 }, (_, i) => {
  const path = `m/44'/60'/0'/0/${i}` // Path BIP44 para el índice i
  const wallet = ethers.HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, undefined, path)
  return { address: wallet.address, privateKey: wallet.privateKey }
})

/** Forma del valor expuesto por el contexto de wallet. */
interface WalletContextValue {
  /** Lista de las 10 wallets disponibles de Anvil. */
  wallets: AnvilWallet[]
  /** Wallet actualmente seleccionada por el usuario, o null si no hay ninguna. */
  activeWallet: AnvilWallet | null
  /** true si hay una wallet activa seleccionada. */
  isConnected: boolean
  /** Proveedor JSON-RPC apuntando a Anvil (solo lectura, sin signer). */
  provider: ethers.JsonRpcProvider
  /** Selecciona la wallet del índice dado como activa. */
  connect: (walletIndex: number) => void
  /** Deselecciona la wallet activa. */
  disconnect: () => void
  /** Cambia la wallet activa a otro índice. */
  switchWallet: (walletIndex: number) => void
  /** Devuelve un ethers.Wallet (signer) listo para firmar transacciones. */
  getSigner: () => ethers.Wallet | null
  /** Firma un mensaje con la wallet activa. Lanza error si no hay wallet conectada. */
  signMessage: (message: string | Uint8Array) => Promise<string>
}

// Contexto interno; null solo antes de montar el Provider
const WalletContext = createContext<WalletContextValue | null>(null)

// Proveedor JSON-RPC compartido (singleton): apunta a Anvil local
const provider = new ethers.JsonRpcProvider(RPC_URL)

/**
 * Componente proveedor. Debe envolver toda la aplicación (en layout.tsx).
 * Gestiona el estado de la wallet activa y expone las acciones al árbol de componentes.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [activeWallet, setActiveWallet] = useState<AnvilWallet | null>(null)

  // Selecciona la wallet por índice; ignora índices fuera de rango (devuelve null)
  const connect = useCallback((walletIndex: number) => {
    setActiveWallet(ANVIL_WALLETS[walletIndex] ?? null)
  }, [])

  // Limpia la wallet activa
  const disconnect = useCallback(() => {
    setActiveWallet(null)
  }, [])

  // Equivalente a connect; existe para mayor claridad semántica en la UI
  const switchWallet = useCallback((walletIndex: number) => {
    setActiveWallet(ANVIL_WALLETS[walletIndex] ?? null)
  }, [])

  /**
   * Crea un ethers.Wallet vinculado al provider de Anvil.
   * Este signer puede enviar transacciones y firmar mensajes.
   */
  const getSigner = useCallback((): ethers.Wallet | null => {
    if (!activeWallet) return null
    return new ethers.Wallet(activeWallet.privateKey, provider)
  }, [activeWallet])

  /**
   * Firma un mensaje arbitrario con la clave privada de la wallet activa.
   * `message` puede ser un string o un Uint8Array (bytes crudos).
   * Para firmar hashes de documentos se pasan bytes crudos para evitar el prefijo EIP-191.
   */
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

/**
 * Hook para acceder al contexto de wallet desde cualquier componente.
 * Lanza un error descriptivo si se usa fuera de `WalletProvider`.
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}
