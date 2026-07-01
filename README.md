# DocAuth — Autenticación de Documentos en Ethereum

Sistema descentralizado para almacenar y verificar la autenticidad de documentos usando blockchain Ethereum. Los documentos nunca se suben a la cadena; solo su hash criptográfico, firma digital y timestamp quedan registrados de forma inmutable.

---

## Tabla de Contenidos

- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Especificaciones Técnicas](#especificaciones-técnicas)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Configuración](#instalación-y-configuración)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Uso del Sistema](#uso-del-sistema)
- [Smart Contract — Referencia](#smart-contract--referencia)
- [Seguridad](#seguridad)
- [Testing](#testing)
- [Despliegue](#despliegue)
- [CI/CD](#cicd)
- [Gas y Costos](#gas-y-costos)
- [Solución de Problemas](#solución-de-problemas)

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        Usuario / Navegador                       │
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │ FileUploader │  │DocumentSigner│  │  DocumentVerifier    │ │
│   │              │  │              │  │  DocumentHistory     │ │
│   └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│          │                 │                       │             │
│   ┌──────▼─────────────────▼───────────────────────▼───────────┐│
│   │              useContract hook                               ││
│   │         (ethers.js v6 — Contract bindings)                 ││
│   └──────────────────────────┬──────────────────────────────────┘│
│                               │                                  │
│   ┌───────────────────────────▼──────────────────────────────┐  │
│   │              WalletProvider (Context API)                 │  │
│   │     HDNodeWallet · JsonRpcProvider · signMessage          │  │
│   └───────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │ JSON-RPC (http://localhost:8545)
                ┌───────────────▼───────────────┐
                │        Anvil (nodo local)      │
                │       Chain ID: 31337          │
                └───────────────┬───────────────┘
                                │
                ┌───────────────▼───────────────┐
                │     DocumentRegistry.sol       │
                │                               │
                │  storeDocumentHash()          │
                │  verifyDocument()             │
                │  getDocumentInfo()            │
                │  isDocumentStored()           │
                │  getDocumentCount()           │
                │  getDocumentHashByIndex()     │
                └───────────────────────────────┘
```

### Flujo de autenticación (con IPFS opcional)

```
Archivo local
     │
     ├──→ keccak256(bytes)  ──────────────────────────────→  hash (bytes32)
     │                                                             │
     │    (Opcional)                                               │
     └──→ uploadToIPFS(file)  ──→  CID de IPFS                   │
               │                       │                          │
               │ (Kubo local           │                          │
               │  o Pinata)            │                          │
               ▼                       ▼                          │
          ipfs daemon          "QmXxx..." / ""                    │
                                       │                          │
                                       ▼                          ▼
                              wallet.signMessage(hash)  ──→  signature (ECDSA)
                                                                   │
                                                                   ▼
                              storeDocumentHash(hash, cid, timestamp, signature, signer)
                                                                   │
                                                                   ▼
                                                    Blockchain  ──→  inmutable · trazable
```

---

## Especificaciones Técnicas

### Smart Contracts

| Componente | Versión |
|---|---|
| Solidity | `^0.8.19` |
| Foundry / Forge | latest |
| Anvil (nodo local) | latest |
| OpenZeppelin Contracts | via `lib/` (forge install) |
| forge-std | via `lib/` (forge install) |

### Frontend

| Componente | Versión |
|---|---|
| Next.js | 16.2.9 (App Router) |
| React | 19.2.4 |
| TypeScript | ^5 |
| ethers.js | ^6.17.0 |
| Tailwind CSS | ^4 |
| lucide-react | ^1.21.0 |

### Red local

| Parámetro | Valor |
|---|---|
| Chain ID | `31337` |
| RPC URL | `http://localhost:8545` |
| Mnemonic (Anvil) | `test test test test test test test test test test test junk` |
| Contrato desplegado | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |

---

## Requisitos Previos

- [Foundry](https://book.getfoundry.sh/getting-started/installation) — `curl -L https://foundry.paradigm.xyz | bash`
- [Node.js](https://nodejs.org/) `>= 18`
- [Git](https://git-scm.com/)
- **Para IPFS local (opcional):** [Kubo](https://docs.ipfs.tech/install/command-line/) — nodo IPFS de referencia

Verificar instalaciones:

```bash
forge --version
anvil --version
node --version
ipfs version   # solo si se usa IPFS local
```

---

## Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd eth-database-document
```

### 2. Instalar dependencias de Foundry

```bash
forge install
```

### 3. Instalar dependencias del frontend

```bash
cd dapp
npm install
```

### 4. Configurar variables de entorno

El archivo `dapp/.env.local` ya contiene la configuración para desarrollo local:

```env
# Blockchain
NEXT_PUBLIC_CONTRACT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_MNEMONIC="test test test test test test test test test test test junk"

# IPFS (opcional) — cambiar PROVIDER a 'pinata' si no se tiene Kubo
NEXT_PUBLIC_IPFS_PROVIDER=local
NEXT_PUBLIC_IPFS_API_URL=http://localhost:5001
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs

# Solo si IPFS_PROVIDER=pinata (SIN prefijo NEXT_PUBLIC_ — server-side)
PINATA_API_KEY=
PINATA_SECRET_KEY=
```

> **Nota:** El mnemonic de Anvil es público y conocido. Nunca usar en mainnet ni con fondos reales.

### 5. (Opcional) Iniciar Kubo para IPFS local (terminal 1)

Si quieres almacenar los archivos completos en IPFS además del hash:

```bash
ipfs daemon
```

Verificar: `curl http://localhost:5001/api/v0/version`

Si no tienes Kubo, puedes saltar el paso IPFS en la UI o configurar Pinata en `.env.local`.

### 6. Iniciar Anvil (terminal 1 o 2)

```bash
anvil
```

Anvil arranca con 10 cuentas pre-financiadas con 10.000 ETH cada una, derivadas del mnemonic estándar.

### 7. Desplegar el contrato (terminal 2 o 3)

```bash
forge script sc/script/Deploy.s.sol:DeployDocumentRegistry \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

El contrato se desplegará en `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` (determinístico con Anvil).

### 8. Iniciar el frontend (terminal 3 o 4)

```bash
cd dapp
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## Estructura del Proyecto

```
eth-database-document/
│
├── foundry.toml                    # Configuración de Foundry
├── foundry.lock                    # Lock de dependencias
│
├── lib/                            # Dependencias de Solidity (git submodules)
│   ├── forge-std/                  # Librería de testing de Foundry
│   └── openzeppelin-contracts/     # Contratos de OpenZeppelin
│
├── sc/                             # Smart contracts del proyecto
│   ├── src/
│   │   └── DocumentRegistry.sol   # Contrato principal
│   ├── test/
│   │   └── DocumentRegistry.t.sol # Suite de tests (17 tests)
│   ├── script/
│   │   └── Deploy.s.sol           # Script de despliegue
│   └── out/                       # Artefactos compilados (generado)
│
├── broadcast/                      # Historial de transacciones desplegadas
│   └── Deploy.s.sol/31337/
│       └── run-latest.json
│
├── .github/
│   └── workflows/
│       └── test.yml               # Pipeline CI (fmt + build + test)
│
└── dapp/                           # Frontend Next.js
    ├── .env.local                  # Variables de entorno (no commitear)
    ├── app/
    │   ├── layout.tsx              # Root layout + WalletProvider
    │   ├── page.tsx                # Página principal (tabs + wallet selector)
    │   └── globals.css             # Estilos globales (Tailwind v4)
    ├── components/
    │   ├── FileUploader.tsx        # Drag & drop + hash keccak256
    │   ├── DocumentSigner.tsx      # Firmar documento + enviar a blockchain
    │   ├── DocumentVerifier.tsx    # Verificar autenticidad on-chain
    │   └── DocumentHistory.tsx     # Historial de documentos registrados
    ├── contexts/
    │   └── MetaMaskContext.tsx     # WalletProvider + hook useWallet
    ├── hooks/
    │   └── useContract.ts          # Bindings al contrato con ethers.js
    └── lib/
        └── abi.ts                  # ABI del contrato DocumentRegistry
```

---

## Uso del Sistema

### Upload & Sign (Subir y Firmar)

1. Abrir la pestaña **Upload & Sign**.
2. Seleccionar una wallet del dropdown (10 cuentas Anvil disponibles) y hacer clic en **Connect Wallet**.
3. Arrastrar un archivo al área de carga o hacer clic para seleccionarlo — se calcula el hash `keccak256` automáticamente.
4. **Paso IPFS (opcional):**
   - Hacer clic en **Upload to IPFS** para subir el archivo a IPFS y obtener un CID.
   - O hacer clic en **Skip (hash only)** para registrar solo el hash sin IPFS.
5. Hacer clic en **Sign Document** — confirmación con el hash que se firmará con ECDSA.
6. Hacer clic en **Store on Blockchain** — envía `storeDocumentHash(hash, cid, timestamp, signature, signer)`.
7. Tras el receipt: confirmación con el hash de transacción y link de descarga IPFS (si se subió).

### Verify (Verificar)

1. Abrir la pestaña **Verify**.
2. Subir el archivo a verificar — se calcula su hash.
3. (Opcional) Ingresar la dirección del firmante esperado.
4. Hacer clic en **Verify Document**.
5. La app consulta `isDocumentStored()` y luego `getDocumentInfo()`.
6. Si el documento existe, compara el firmante registrado con el ingresado.
7. Resultado: ✅ Auténtico / ❌ Firmante incorrecto / 🔍 No registrado.

### History (Historial)

1. Abrir la pestaña **History**.
2. Hacer clic en **Refresh**.
3. La app llama a `getDocumentCount()` e itera con `getDocumentHashByIndex(i)` y `getDocumentInfo(hash)`.
4. Se muestra una tabla con: hash, firmante, fecha/hora y primeros/últimos caracteres de la firma.

### Cambio de Wallet

- El dropdown en el header lista las 10 wallets de Anvil con sus direcciones.
- Se puede cambiar de wallet sin desconectar: hacer clic en el wallet activo y seleccionar otro.
- **Disconnect** desconecta la sesión sin afectar al nodo.

---

## Smart Contract — Referencia

### Struct `Document`

```solidity
struct Document {
    bytes32 hash;       // keccak256 del archivo (clave del mapping)
    string  cid;        // CID de IPFS ("" si no se usó IPFS)
    uint256 timestamp;  // Unix timestamp del registro
    address signer;     // Firmante que registró el documento
    bytes   signature;  // Firma ECDSA del hash
}
```

> **Optimización de gas:** No existe campo `bool exists` — la existencia se verifica con `documents[hash].signer != address(0)`, ahorrando ~39% en slots de storage.

### Funciones

| Función | Tipo | Descripción |
|---|---|---|
| `storeDocumentHash(bytes32, string, uint256, bytes, address)` | `external` | Almacena un documento con CID opcional. Revierte si ya existe. |
| `verifyDocument(bytes32, address, bytes)` | `external` | Verifica hash + firmante + firma. Emite evento. |
| `getDocumentInfo(bytes32)` | `view` | Retorna el struct Document completo (incluido CID). |
| `isDocumentStored(bytes32)` | `view` | Verifica existencia sin leer datos. |
| `getDocumentCount()` | `view` | Total de documentos registrados. |
| `getDocumentHashByIndex(uint256)` | `view` | Hash por posición en el array. |

### Eventos

```solidity
event DocumentStored(bytes32 indexed hash, address indexed signer, uint256 timestamp, string cid);
event DocumentVerified(bytes32 indexed hash, address indexed signer, bool valid);
```

### Modifiers

```solidity
modifier documentNotExists(bytes32 _hash)  // Revierte si el documento ya existe
modifier documentExists(bytes32 _hash)      // Revierte si el documento no existe
```

---

## Seguridad

### Propiedades garantizadas por el contrato

| Propiedad | Mecanismo |
|---|---|
| **Inmutabilidad** | Un hash solo puede almacenarse una vez (`documentNotExists` modifier) |
| **Trazabilidad** | Cada documento registra signer + timestamp en blockchain |
| **Integridad** | `verifyDocument` compara hash de firma y dirección del firmante |
| **No repudio** | La firma ECDSA vincula criptográficamente al firmante con el documento |

### Consideraciones importantes

- **El contrato no verifica la firma ECDSA on-chain** — confía en la firma que se le pasa. La verificación criptográfica ocurre en el frontend con ethers.js. Para mayor seguridad on-chain, integrar `ECDSA.recover` de OpenZeppelin.
- **Sin control de acceso (`Ownable`)** — cualquier dirección puede registrar documentos. Adecuado para sistemas abiertos; para uso empresarial, considerar un whitelist de signers.
- **Sin borrado** — una vez almacenado, el registro es permanente. No existe función de eliminación por diseño.
- **El mnemonic de Anvil es público** — solo usar en entorno local de desarrollo. En producción, usar wallets reales y gestión de claves segura.
- **`dapp/.env.local` no debe commitearse** — incluido en `.gitignore` del frontend.

### Superficie de ataque evaluada

- **Replay attacks:** Cada hash es único en el mapping; registrar el mismo hash dos veces revierte.
- **Front-running:** Solo afectaría al orden de registro, no a la autenticidad del documento.
- **Integer overflow:** Solidity `^0.8.x` tiene overflow/underflow checks nativos.
- **Reentrancy:** No aplica — ninguna función transfiere ETH ni llama a contratos externos.

---

## Testing

### Ejecutar tests

```bash
# Desde la raíz del repositorio
forge test

# Con output detallado
forge test -vvv

# Con reporte de gas
forge test --gas-report
```

### Suite de tests (19 tests — 100% passing)

| Test | Descripción |
|---|---|
| `test_StoreDocument_Success` | Almacena correctamente un documento con CID |
| `test_StoreDocument_WithEmptyCID` | Almacena un documento sin IPFS (`cid=""`) |
| `test_StoreDocument_EmitsEvent` | Verifica emisión del evento `DocumentStored` con CID |
| `test_GetDocumentInfo_ReturnsCID` | Verifica que el CID se almacene y retorne correctamente |
| `test_StoreDocument_RejectsDuplicate` | Rechaza hash ya registrado |
| `test_StoreDocument_RejectsZeroSigner` | Rechaza `address(0)` como firmante |
| `test_StoreDocument_RejectsEmptySignature` | Rechaza firma vacía |
| `test_VerifyDocument_ReturnsTrue_WhenValid` | Verifica documento con datos correctos |
| `test_VerifyDocument_ReturnsFalse_WrongSigner` | Detecta firmante incorrecto |
| `test_VerifyDocument_ReturnsFalse_WrongSignature` | Detecta firma incorrecta |
| `test_VerifyDocument_Reverts_WhenNotStored` | Revierte si el documento no existe |
| `test_GetDocumentInfo_ReturnsCorrectData` | Retorna datos exactos del documento |
| `test_GetDocumentInfo_Reverts_WhenNotStored` | Revierte al consultar documento inexistente |
| `test_IsDocumentStored_ReturnsFalse_BeforeStore` | `false` antes de almacenar |
| `test_IsDocumentStored_ReturnsTrue_AfterStore` | `true` después de almacenar |
| `test_GetDocumentCount_StartsAtZero` | Contador empieza en 0 |
| `test_GetDocumentCount_IncrementsOnStore` | Contador incrementa con cada documento |
| `test_GetDocumentHashByIndex_ReturnsCorrectHash` | Iteración por índice correcta |
| `test_GetDocumentHashByIndex_Reverts_OutOfBounds` | Revierte con índice fuera de rango |

### Formateo y calidad

```bash
# Verificar formato Solidity
forge fmt --check

# Aplicar formato automático
forge fmt

# Ver tamaños de contratos
forge build --sizes
```

---

## Despliegue

### Despliegue local (Anvil)

```bash
# Terminal 1 — Iniciar nodo local
anvil

# Terminal 2 — Desplegar contrato
forge script sc/script/Deploy.s.sol:DeployDocumentRegistry \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

La primera cuenta de Anvil (`#0`) es siempre `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` con la clave privada mostrada arriba.

### Despliegue en testnet (ej. Sepolia)

```bash
# Configurar variables de entorno
export PRIVATE_KEY="tu_clave_privada"
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"

# Desplegar
forge script sc/script/Deploy.s.sol:DeployDocumentRegistry \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Tras el despliegue, actualizar `NEXT_PUBLIC_CONTRACT_ADDRESS` en `dapp/.env.local` con la nueva dirección y `NEXT_PUBLIC_CHAIN_ID` con el chain ID correspondiente.

### Frontend — Build de producción

```bash
cd dapp
npm run build
npm start
```

---

## CI/CD

El repositorio incluye un pipeline en `.github/workflows/test.yml` que se ejecuta en cada `push` y `pull request`:

```
1. Checkout del repositorio (con submodules)
2. Instalar Foundry toolchain
3. forge fmt --check    → Verificar formato Solidity
4. forge build --sizes  → Compilar y mostrar tamaños
5. forge test -vvv      → Ejecutar suite de tests completa
```

---

## Gas y Costos

Reporte de gas con la suite de tests actual:

| Función | Min | Avg | Max |
|---|---|---|---|
| `storeDocumentHash` | 26,271 | 186,105 | 226,844 |
| `verifyDocument` | 26,589 | 32,746 | 38,006 |
| `getDocumentInfo` | 3,036 | 10,186 | 17,337 |
| `getDocumentHashByIndex` | 2,882 | 4,339 | 5,068 |
| `getDocumentCount` | 2,440 | 2,440 | 2,440 |
| `isDocumentStored` | 2,857 | 2,857 | 2,857 |
| **Deployment** | — | **1,110,945** | — |

> El costo de `storeDocumentHash` varía principalmente según el tamaño de la firma (`bytes` dinámico).

---

## Solución de Problemas

### `Error: could not detect network`

Anvil no está corriendo. Iniciar con `anvil` en una terminal separada.

### `Document already exists`

El hash de ese archivo ya fue registrado en la blockchain local. Cada hash solo puede almacenarse una vez.

### El contrato no responde / dirección incorrecta

Anvil fue reiniciado y el contrato se desplegó en una nueva dirección. Re-desplegar con el script y actualizar `NEXT_PUBLIC_CONTRACT_ADDRESS` en `.env.local`.

### `Index out of bounds` en el historial

Se intentó leer más documentos de los que existen. Refrescar la página o hacer clic en **Refresh** nuevamente.

### `No wallet connected`

Seleccionar una wallet del dropdown en el header antes de firmar o almacenar.

### TypeError en TypeScript

```bash
cd dapp
npx tsc --noEmit
```

---

## Herramientas útiles

```bash
# Ver logs de Anvil en tiempo real
anvil --block-time 1

# Consultar información del contrato con Cast
cast call <CONTRACT_ADDRESS> "getDocumentCount()" --rpc-url http://localhost:8545

# Ver balance de una cuenta
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8545

# Decodificar un hash de transacción
cast tx <TX_HASH> --rpc-url http://localhost:8545
```

---

## Referencias

- [Foundry Book](https://book.getfoundry.sh/)
- [ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [EIP-191: Signed Data Standard](https://eips.ethereum.org/EIPS/eip-191)
