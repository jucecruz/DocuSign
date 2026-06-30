'use client'

/**
 * useContract.ts — Hook para interactuar con el contrato DocumentRegistry.
 *
 * Centraliza toda la comunicacion con el smart contract: inicializacion
 * del objeto Contract de ethers.js y mapeo de cada funcion del ABI a una
 * funcion TypeScript tipada.
 *
 * Distincion read vs write:
 *   - getReadContract()  → Contract conectado al provider (sin signer).
 *                          Usado para funciones `view` que no modifican estado
 *                          y no cuestan gas. No requiere wallet conectada.
 *   - getWriteContract() → Contract conectado al signer (wallet activa).
 *                          Usado para funciones que modifican estado (transacciones).
 *                          Lanza error si no hay wallet conectada.
 *
 * Variable de entorno requerida:
 *   NEXT_PUBLIC_CONTRACT_ADDRESS → Direccion del contrato desplegado en Anvil.
 *                                  Se obtiene al ejecutar el script Deploy.s.sol.
 */

import { useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '@/contexts/MetaMaskContext'
import { DOCUMENT_REGISTRY_ABI } from '@/lib/abi'

// Direccion del contrato desplegado; debe coincidir con la red usada (Anvil local)
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

/** Tipo que representa los datos de un documento recuperado del contrato. */
export interface DocumentInfo {
  hash: string       // bytes32 del hash Keccak256 del archivo
  timestamp: bigint  // Unix timestamp (uint256 en Solidity → bigint en JS)
  signer: string     // Direccion Ethereum del firmante
  signature: string  // Firma ECDSA en formato hex
}

export function useContract() {
  const { provider, getSigner } = useWallet()

  /**
   * Instancia el contrato en modo lectura (sin signer).
   * Permite llamar funciones `view` sin necesidad de wallet conectada.
   */
  const getReadContract = useCallback(() => {
    return new ethers.Contract(CONTRACT_ADDRESS, DOCUMENT_REGISTRY_ABI, provider)
  }, [provider])

  /**
   * Instancia el contrato en modo escritura (con signer).
   * Lanza un error explicito si se intenta usar sin wallet conectada,
   * para evitar errores crípticos de ethers.js mas adelante.
   */
  const getWriteContract = useCallback(() => {
    const signer = getSigner()
    if (!signer) throw new Error('No wallet connected')
    return new ethers.Contract(CONTRACT_ADDRESS, DOCUMENT_REGISTRY_ABI, signer)
  }, [getSigner])

  /**
   * Almacena el hash de un documento en la blockchain.
   * Envia una transaccion y espera su confirmacion (1 bloque).
   * @returns Receipt de la transaccion (incluye `receipt.hash` = tx hash).
   */
  const storeDocumentHash = useCallback(
    async (hash: string, timestamp: number, signature: string, signerAddress: string) => {
      const contract = getWriteContract()
      const tx = await contract.storeDocumentHash(hash, timestamp, signature, signerAddress)
      return tx.wait() // Espera la inclusion en un bloque
    },
    [getWriteContract]
  )

  /**
   * Verifica un documento on-chain y devuelve si es valido.
   * Esta funcion envia una transaccion (emite evento DocumentVerified),
   * por eso no es una simple lectura. El resultado se lee del evento
   * porque las transacciones no devuelven valores en ethers.js v6.
   */
  const verifyDocument = useCallback(
    async (hash: string, signerAddress: string, signature: string): Promise<boolean> => {
      const contract = getWriteContract()
      const tx = await contract.verifyDocument(hash, signerAddress, signature)
      const receipt = await tx.wait()

      // El contrato devuelve el resultado a traves del evento DocumentVerified
      // (las funciones que modifican estado no pueden devolver valores via tx)
      const iface = new ethers.Interface(DOCUMENT_REGISTRY_ABI)
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed?.name === 'DocumentVerified') {
            return parsed.args.valid as boolean
          }
        } catch {
          // Ignorar logs de otros contratos o eventos no parseables
        }
      }
      return false
    },
    [getWriteContract]
  )

  /**
   * Obtiene todos los datos de un documento por su hash.
   * Funcion view → no requiere gas ni transaccion.
   */
  const getDocumentInfo = useCallback(
    async (hash: string): Promise<DocumentInfo> => {
      const contract = getReadContract()
      const result = await contract.getDocumentInfo(hash)
      // ethers.js devuelve un objeto indexado por nombre de campo; se mapea a la interfaz
      return {
        hash: result.hash as string,
        timestamp: result.timestamp as bigint,
        signer: result.signer as string,
        signature: result.signature as string,
      }
    },
    [getReadContract]
  )

  /**
   * Comprueba si un hash ya fue registrado en el contrato.
   * Funcion view → no requiere gas ni transaccion.
   */
  const isDocumentStored = useCallback(
    async (hash: string): Promise<boolean> => {
      const contract = getReadContract()
      return contract.isDocumentStored(hash) as Promise<boolean>
    },
    [getReadContract]
  )

  /**
   * Devuelve el numero total de documentos registrados.
   * Retorna bigint porque el contrato usa uint256.
   */
  const getDocumentCount = useCallback(async (): Promise<bigint> => {
    const contract = getReadContract()
    return contract.getDocumentCount() as Promise<bigint>
  }, [getReadContract])

  /**
   * Devuelve el hash de un documento por su posicion en el array del contrato.
   * Usado para iterar todos los documentos en DocumentHistory.
   */
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
