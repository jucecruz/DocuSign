/**
 * abi.ts — ABI del contrato DocumentRegistry.
 *
 * El ABI (Application Binary Interface) describe la interfaz pública del
 * contrato: nombre y tipos de cada función y evento. ethers.js lo necesita
 * para codificar llamadas y decodificar respuestas.
 *
 * Este archivo debe mantenerse sincronizado con DocumentRegistry.sol.
 * Si se modifica el contrato, regenerar el ABI con:
 *   forge build
 * y copiar el campo "abi" de sc/out/DocumentRegistry.sol/DocumentRegistry.json
 *
 * Cambios respecto a la versión anterior:
 *   - storeDocumentHash: nuevo parámetro `_cid` (string) en posición 2.
 *   - getDocumentInfo: el tuple de salida incluye el campo `cid` (string).
 *   - DocumentStored: nuevo campo `cid` (string, no indexado) en el evento.
 */

export const DOCUMENT_REGISTRY_ABI = [
  // ------------------------------------------------------------------
  // FUNCIONES DE ESCRITURA (stateMutability: "nonpayable")
  // ------------------------------------------------------------------

  {
    type: "function",
    name: "storeDocumentHash",
    // Registra el hash + CID de IPFS opcional + firma + firmante del documento
    inputs: [
      { name: "_hash",      type: "bytes32" },  // Hash Keccak256 del archivo
      { name: "_cid",       type: "string"  },  // CID de IPFS (puede ser "" si no se usa IPFS)
      { name: "_timestamp", type: "uint256" },  // Marca de tiempo Unix
      { name: "_signature", type: "bytes"   },  // Firma ECDSA del hash
      { name: "_signer",    type: "address" },  // Dirección del firmante
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyDocument",
    // Verifica si hash + firmante + firma coinciden con el registro almacenado
    inputs: [
      { name: "_hash",      type: "bytes32" },
      { name: "_signer",    type: "address" },
      { name: "_signature", type: "bytes"   },
    ],
    outputs: [{ name: "", type: "bool" }],  // true = válido, false = inválido
    stateMutability: "nonpayable",          // Emite evento, por eso no es "view"
  },

  // ------------------------------------------------------------------
  // FUNCIONES DE LECTURA (stateMutability: "view")
  // ------------------------------------------------------------------

  {
    type: "function",
    name: "getDocumentInfo",
    // Devuelve todos los datos de un documento por su hash (incluido el CID de IPFS)
    inputs: [{ name: "_hash", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",   // Corresponde al struct Document de Solidity
        components: [
          { name: "hash",      type: "bytes32" },
          { name: "cid",       type: "string"  },  // CID de IPFS (nuevo campo)
          { name: "timestamp", type: "uint256" },
          { name: "signer",    type: "address" },
          { name: "signature", type: "bytes"   },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isDocumentStored",
    inputs: [{ name: "_hash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDocumentCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDocumentHashByIndex",
    inputs: [{ name: "_index", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },

  // ------------------------------------------------------------------
  // EVENTOS
  // ------------------------------------------------------------------

  {
    type: "event",
    name: "DocumentStored",
    // Emitido al registrar un nuevo documento exitosamente
    inputs: [
      { name: "hash",      type: "bytes32", indexed: true  },  // Filtrable por hash
      { name: "signer",    type: "address", indexed: true  },  // Filtrable por firmante
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "cid",       type: "string",  indexed: false },  // CID de IPFS (no indexable en Solidity)
    ],
  },
  {
    type: "event",
    name: "DocumentVerified",
    inputs: [
      { name: "hash",   type: "bytes32", indexed: true  },
      { name: "signer", type: "address", indexed: true  },
      { name: "valid",  type: "bool",    indexed: false },
    ],
  },
] as const;
