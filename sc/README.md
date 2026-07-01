# DocAuth — Smart Contracts

Contrato Solidity para el registro inmutable de documentos en blockchain Ethereum.

---

## Contrato Principal: `DocumentRegistry.sol`

### Struct `Document`

```solidity
struct Document {
    bytes32 hash;       // keccak256 del archivo (clave del mapping)
    string  cid;        // CID de IPFS ("" si no se usó IPFS)
    uint256 timestamp;  // Unix timestamp del momento de registro
    address signer;     // Dirección que registró el documento
    bytes   signature;  // Firma ECDSA del hash
}
```

> El campo `cid` es opcional por diseño. Pasando `""` el documento se registra solo por hash, sin vínculo a IPFS.

### Funciones

| Función | Tipo | Descripción |
|---|---|---|
| `storeDocumentHash(bytes32 _hash, string _cid, uint256 _timestamp, bytes _signature, address _signer)` | `external` | Registra un documento. Revierte si el hash ya existe, si `_signer` es `address(0)`, o si la firma está vacía. |
| `verifyDocument(bytes32 _hash, address _signer, bytes _signature)` | `external` | Verifica hash + firmante + firma. Emite `DocumentVerified`. Revierte si no existe. |
| `getDocumentInfo(bytes32 _hash)` | `view` | Retorna el struct `Document` completo. Revierte si no existe. |
| `isDocumentStored(bytes32 _hash)` | `view` | Retorna `true` si el hash está registrado. |
| `getDocumentCount()` | `view` | Total de documentos registrados. |
| `getDocumentHashByIndex(uint256 _index)` | `view` | Hash en la posición `_index` del array. Revierte si está fuera de rango. |

### Eventos

```solidity
// Emitido al almacenar un documento
event DocumentStored(
    bytes32 indexed hash,
    address indexed signer,
    uint256 timestamp,
    string  cid          // "" si no se usó IPFS
);

// Emitido al verificar un documento
event DocumentVerified(
    bytes32 indexed hash,
    address indexed signer,
    bool valid
);
```

### Modifiers

```solidity
modifier documentNotExists(bytes32 _hash)  // Revierte si el hash ya está registrado
modifier documentExists(bytes32 _hash)      // Revierte si el hash NO está registrado
```

---

## Comandos Foundry

### Compilar

```bash
# Desde la raíz del repositorio (eth-database-document/)
forge build
forge build --sizes   # muestra tamaño de contratos
```

### Tests

```bash
forge test            # todos los tests
forge test -vvv       # con trazas detalladas
forge test --gas-report  # con reporte de gas
```

### Formateo

```bash
forge fmt             # aplica formato automático
forge fmt --check     # solo verifica sin modificar (usado en CI)
```

### Despliegue local (Anvil)

```bash
# Terminal 1 — iniciar nodo local
anvil

# Terminal 2 — desplegar contrato
forge script sc/script/Deploy.s.sol:DeployDocumentRegistry \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

Tras el despliegue, actualizar `NEXT_PUBLIC_CONTRACT_ADDRESS` en `dapp/.env.local` con la nueva dirección.

### Despliegue en testnet

```bash
forge script sc/script/Deploy.s.sol:DeployDocumentRegistry \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

---

## Suite de Tests

| Test | Descripción |
|---|---|
| `test_StoreDocument_Success` | Almacena un documento con CID |
| `test_StoreDocument_WithEmptyCID` | Almacena un documento sin IPFS (`cid=""`) |
| `test_StoreDocument_EmitsEvent` | Verifica emisión del evento `DocumentStored` con CID |
| `test_StoreDocument_RejectsDuplicate` | Rechaza hash ya registrado |
| `test_StoreDocument_RejectsZeroSigner` | Rechaza `address(0)` como firmante |
| `test_StoreDocument_RejectsEmptySignature` | Rechaza firma vacía |
| `test_VerifyDocument_ReturnsTrue_WhenValid` | Verificación con datos correctos |
| `test_VerifyDocument_ReturnsFalse_WrongSigner` | Detecta firmante incorrecto |
| `test_VerifyDocument_ReturnsFalse_WrongSignature` | Detecta firma incorrecta |
| `test_VerifyDocument_Reverts_WhenNotStored` | Revierte si no existe |
| `test_GetDocumentInfo_ReturnsCorrectData` | Retorna datos exactos |
| `test_GetDocumentInfo_ReturnsCID` | Verifica que el CID se almacene correctamente |
| `test_GetDocumentInfo_Reverts_WhenNotStored` | Revierte para documento inexistente |
| `test_IsDocumentStored_ReturnsFalse_BeforeStore` | `false` antes de almacenar |
| `test_IsDocumentStored_ReturnsTrue_AfterStore` | `true` después de almacenar |
| `test_GetDocumentCount_StartsAtZero` | Contador inicial es 0 |
| `test_GetDocumentCount_IncrementsOnStore` | Contador incrementa con cada registro |
| `test_GetDocumentHashByIndex_ReturnsCorrectHash` | Iteración por índice |
| `test_GetDocumentHashByIndex_Reverts_OutOfBounds` | Revierte fuera de rango |

---

## Estructura

```
sc/
├── src/
│   └── DocumentRegistry.sol   # Contrato principal
├── test/
│   └── DocumentRegistry.t.sol # Suite de tests (19 tests)
└── script/
    └── Deploy.s.sol           # Script de despliegue Foundry
```
