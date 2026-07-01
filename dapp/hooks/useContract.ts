'use client'

/**
 * useContract.ts — Hook para interactuar con el contrato DocumentRegistry.
 *
 * Centraliza toda la comunicación con el smart contract: inicialización
 * del objeto Contract de ethers.js y mapeo de cada función del ABI a una
 * función TypeScript tipada.
 *
 * Distinción read vs write:
 *   - getReadContract()  → Contract conectado al provider (sin signer).
 *                          Para funciones `view`, no cuestan gas.
 *   - getWriteContract() → Contract conectado al signer (wallet activa).
 *                          Para funciones que modifican estado (transacciones).
 *
 * Variable de entorno requerida:
 *   NEXT_PUBLIC_CONTRACT_ADDRESS → Dirección del contrato desplegado en Anvil.
 */

import { useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '@/contexts/MetaMaskContext'
import { DOCUMENT_REGISTRY_ABI } from '@/lib/abi'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

/**
 * Datos completos de un documento recuperado del contrato.
 * El campo `cid` es la referencia IPFS del archivo original (vacío si no se usó IPFS).
 */
export interface DocumentInfo {
  hash: string       // bytes32 → hex string del hash keccak256 del archivo
  cid: string        // CID de IPFS para descargar el archivo original ("" si no se usó IPFS)
  timestamp: bigint  // Unix timestamp (uint256 en Solidity → bigint en JS)
  signer: string     // Dirección Ethereum del firmante
  signature: string  // Firma ECDSA en formato hex
}

export function useContract() {
  const { provider, getSigner } = useWallet()

  /** Contrato en modo lectura: llama funciones view sin gas ni signer. */
  const getReadContract = useCallback(() => {
    return new ethers.Contract(CONTRACT_ADDRESS, DOCUMENT_REGISTRY_ABI, provider)
  }, [provider])

  /** Contrato en modo escritura: requiere signer (wallet conectada). */
  const getWriteContract = useCallback(() => {
    const signer = getSigner()
    if (!signer) throw new Error('No wallet connected')
    return new ethers.Contract(CONTRACT_ADDRESS, DOCUMENT_REGISTRY_ABI, signer)
  }, [getSigner])

  /**
   * Almacena el hash + CID de IPFS + firma del documento en la blockchain.
   * @param hash          Hash keccak256 del archivo (hex string "0x...").
   * @param cid           CID de IPFS del archivo original. Pasar "" si no se usa IPFS.
   * @param timestamp     Marca de tiempo Unix (segundos).
   * @param signature     Firma ECDSA del hash (hex string).
   * @param signerAddress Dirección del firmante.
   * @returns Receipt de la transacción (incluye `receipt.hash` = tx hash).
   */
  const storeDocumentHash = useCallback(
    async (hash: string, cid: string, timestamp: number, signature: string, signerAddress: string) => {
      const contract = getWriteContract()
      const tx = await contract.storeDocumentHash(hash, cid, timestamp, signature, signerAddress)
      return tx.wait()
    },
    [getWriteContract]
  )

  /**
   * Verifica un documento on-chain y devuelve si es válido.
   * Lee el resultado del evento `DocumentVerified` porque las transacciones
   * no devuelven valores directamente en ethers.js v6.
   */
  const verifyDocument = useCallback(
    async (hash: string, signerAddress: string, signature: string): Promise<boolean> => {
      const contract = getWriteContract()
      const tx = await contract.verifyDocument(hash, signerAddress, signature)
      const receipt = await tx.wait()
      const iface = new ethers.Interface(DOCUMENT_REGISTRY_ABI)
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed?.name === 'DocumentVerified') {
            return parsed.args.valid as boolean
          }
        } catch {
          // Ignorar logs de otros contratos o no parseables
        }
      }
      return false
    },
    [getWriteContract]
  )

  /**
   * Obtiene todos los datos de un documento por su hash, incluido el CID de IPFS.
   * Función view — no requiere gas ni transacción.
   */
  const getDocumentInfo = useCallback(
    async (hash: string): Promise<DocumentInfo> => {
      const contract = getReadContract()
      const result = await contract.getDocumentInfo(hash)
      return {
        hash:      result.hash      as string,
        cid:       result.cid       as string,  // Nuevo: CID de IPFS
        timestamp: result.timestamp as bigint,
        signer:    result.signer    as string,
        signature: result.signature as string,
      }
    },
    [getReadContract]
  )

  /** Comprueba si un hash ya fue registrado en el contrato. */
  const isDocumentStored = useCallback(
    async (hash: string): Promise<boolean> => {
      const contract = getReadContract()
      return contract.isDocumentStored(hash) as Promise<boolean>
    },
    [getReadContract]
  )

  /** Devuelve el número total de documentos registrados (bigint). */
  const getDocumentCount = useCallback(async (): Promise<bigint> => {
    const contract = getReadContract()
    return contract.getDocumentCount() as Promise<bigint>
  }, [getReadContract])

  /** Devuelve el hash de un documento por su posición en el array del contrato. */
  const getDocumentHashByIndex = useCallback(
    async (index: number): Promise<string> => {
      const contract = getReadContract()
      return contract.getDocumentHashByIndex(index) as Promise<string>
    },
    [getReadContract]
  )

  return {
    storeDocumentHash,
    verifyDocument,
    getDocumentInfo,
    isDocumentStored,
    getDocumentCount,
    getDocumentHashByIndex,
  }
}
