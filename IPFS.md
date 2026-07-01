# Integración IPFS en DocAuth

Este documento describe el plan de integración, todos los cambios realizados en el código, los requisitos de instalación de Kubo y la configuración necesaria para que IPFS funcione en entorno local.

---

## Tabla de Contenidos

- [Objetivo](#objetivo)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Cambios realizados](#cambios-realizados)
  - [Smart Contract](#smart-contract)
  - [ABI](#abi)
  - [Hook useContract](#hook-usecontract)
  - [Utilidad IPFS](#utilidad-ipfs)
  - [API Route Pinata (proxy servidor)](#api-route-pinata-proxy-servidor)
  - [Componentes UI](#componentes-ui)
  - [Variables de entorno](#variables-de-entorno)
- [Instalación de Kubo (IPFS local)](#instalación-de-kubo-ipfs-local)
  - [Windows](#windows)
  - [macOS](#macos)
  - [Linux](#linux)
- [Configuración de Kubo](#configuración-de-kubo)
- [Configuración del proyecto para IPFS local](#configuración-del-proyecto-para-ipfs-local)
- [Configuración alternativa: Pinata](#configuración-alternativa-pinata)
- [Flujo completo con IPFS local](#flujo-completo-con-ipfs-local)
- [Problemas conocidos y soluciones](#problemas-conocidos-y-soluciones)

---

## Objetivo

El sistema original almacenaba solo el hash `keccak256` de un documento en la blockchain. El objetivo de esta integración es:

1. **Almacenar el archivo completo de forma descentralizada** en IPFS y obtener un CID.
2. **Registrar el CID junto al hash** en el contrato `DocumentRegistry.sol` para que cualquiera pueda descargar el archivo original.
3. **Mantener IPFS como opcional**: si el usuario no tiene un nodo IPFS, puede seguir firmando y almacenando documentos solo por hash (`cid = ""`).

---

## Decisiones de diseño

### Sin paquetes npm adicionales

La API HTTP de Kubo es REST pura. Se usa `fetch` nativo del navegador para subir al nodo local, y `fetch` en un API Route de Next.js para Pinata. Se evitó `ipfs-http-client` / `kubo-rpc-client` por incompatibilidades ESM/CJS con Next.js App Router.

### CID como campo adicional (no reemplaza el hash)

El `bytes32 hash` sigue siendo la clave del mapping (gas óptimo). Se añade `string cid` al struct. Esto permite:
- Verificar integridad sin IPFS (el hash keccak256 siempre está)
- Recuperar el archivo original si se subió a IPFS
- Pasar `cid = ""` cuando no se usó IPFS

### Pinata requiere proxy servidor

Las credenciales de Pinata **no deben tener prefijo `NEXT_PUBLIC_`** — se leen solo en el servidor. El API Route `/api/ipfs/upload/route.ts` actúa como proxy para que las claves nunca lleguen al navegador.

### Gateway local vs público

Con Kubo local, el contenido existe **solo en la máquina local**. Los gateways públicos (`ipfs.io`, etc.) no pueden encontrarlo porque el nodo local no está anunciado en la DHT global. Por eso, el gateway configurado por defecto es `http://localhost:8080/ipfs` (el gateway HTTP que expone Kubo).

---

## Cambios realizados

### Smart Contract

**Archivo:** `sc/src/DocumentRegistry.sol`

**Cambios:**

```solidity
// ANTES
struct Document {
    bytes32 hash;
    uint256 timestamp;
    address signer;
    bytes signature;
}

event DocumentStored(bytes32 indexed hash, address indexed signer, uint256 timestamp);

function storeDocumentHash(
    bytes32 _hash,
    uint256 _timestamp,
    bytes memory _signature,
    address _signer
) external documentNotExists(_hash)

// DESPUÉS
struct Document {
    bytes32 hash;
    string  cid;        // NUEVO: CID de IPFS ("" si no se usó IPFS)
    uint256 timestamp;
    address signer;
    bytes   signature;
}

event DocumentStored(
    bytes32 indexed hash,
    address indexed signer,
    uint256 timestamp,
    string cid          // NUEVO: no indexado (strings no se pueden indexar en Solidity)
);

function storeDocumentHash(
    bytes32 _hash,
    string calldata _cid,   // NUEVO: 2do parámetro, puede ser ""
    uint256 _timestamp,
    bytes memory _signature,
    address _signer
) external documentNotExists(_hash)
```

**Archivo:** `sc/test/DocumentRegistry.t.sol`

- Añadida variable `string internal cid = "QmTestCID1234567890abcdef"`
- Todas las llamadas a `storeDocumentHash` actualizadas para incluir el CID
- Nuevos tests:
  - `test_StoreDocument_WithEmptyCID()` — verifica que `cid=""` se acepta
  - `test_GetDocumentInfo_ReturnsCID()` — verifica que el CID se recupera correctamente
- `test_StoreDocument_EmitsEvent` actualizado para verificar el CID en el evento

---

### ABI

**Archivo:** `dapp/lib/abi.ts`

Tres cambios en el array ABI:

1. **`storeDocumentHash` inputs** — insertar segundo parámetro:
```typescript
{ name: "_cid", type: "string" }  // antes de _timestamp
```

2. **`getDocumentInfo` outputs components** — añadir campo CID:
```typescript
{ name: "cid", type: "string" }   // después de hash
```

3. **`DocumentStored` event inputs** — añadir campo CID:
```typescript
{ name: "cid", type: "string", indexed: false }
```

---

### Hook useContract

**Archivo:** `dapp/hooks/useContract.ts`

```typescript
// ANTES
export interface DocumentInfo {
  hash: string
  timestamp: bigint
  signer: string
  signature: string
}

const storeDocumentHash = useCallback(
  async (hash: string, timestamp: number, signature: string, signerAddress: string) => { ... }
)

// DESPUÉS
export interface DocumentInfo {
  hash: string
  cid: string        // NUEVO
  timestamp: bigint
  signer: string
  signature: string
}

const storeDocumentHash = useCallback(
  async (hash: string, cid: string, timestamp: number, signature: string, signerAddress: string) => {
    const tx = await contract.storeDocumentHash(hash, cid, timestamp, signature, signerAddress)
    return tx.wait()
  }
)

// getDocumentInfo ahora mapea cid:
return {
  hash: result.hash,
  cid: result.cid as string,   // NUEVO
  timestamp: result.timestamp,
  signer: result.signer,
  signature: result.signature,
}
```

---

### Utilidad IPFS

**Archivo:** `dapp/lib/ipfs.ts` *(archivo nuevo)*

```typescript
export type IPFSProvider = 'local' | 'pinata'

// Variables de entorno leídas en tiempo de compilación
const IPFS_PROVIDER = process.env.NEXT_PUBLIC_IPFS_PROVIDER ?? 'local'
const IPFS_API_URL  = process.env.NEXT_PUBLIC_IPFS_API_URL ?? 'http://localhost:5001'
const IPFS_GATEWAY  = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'http://localhost:8080/ipfs'

// Construye la URL del gateway para un CID
export function getCIDGatewayURL(cid: string): string

// Punto de entrada: delega según el proveedor configurado
export async function uploadToIPFS(file: File): Promise<string>

// Sube a Kubo local via POST /api/v0/add?pin=true
// Parsea respuesta JSON Lines de Kubo para extraer el Hash
async function uploadToLocalKubo(file: File): Promise<string>

// Sube a Pinata via el proxy servidor /api/ipfs/upload
async function uploadViaPinataProxy(file: File): Promise<string>
```

Manejo de errores mejorado: si Kubo no está corriendo, el error indica exactamente qué hacer:
```
"No se pudo conectar al nodo IPFS en http://localhost:5001.
Ejecuta "ipfs daemon" en una terminal e intenta de nuevo."
```

---

### API Route Pinata (proxy servidor)

**Archivo:** `dapp/app/api/ipfs/upload/route.ts` *(archivo nuevo)*

Proxy Next.js que lee `PINATA_API_KEY` y `PINATA_SECRET_KEY` del entorno **servidor** (sin `NEXT_PUBLIC_`) y reenvía el FormData a `api.pinata.cloud/pinning/pinFileToIPFS`. Devuelve `{ cid: string }`.

Las claves de Pinata **nunca llegan al navegador**.

---

### Componentes UI

#### `dapp/components/DocumentSigner.tsx`

Flujo actualizado de 2 pasos → 4 pasos:

| Paso | Acción |
|------|--------|
| 1. Upload | Selección de archivo; `FileUploader` calcula el hash keccak256 |
| 2. IPFS | (Opcional) Subida a IPFS → obtiene CID. Botón "Skip" para saltarlo |
| 3. Sign | Firma ECDSA del hash con la wallet activa |
| 4. Store | Envía `storeDocumentHash(hash, cid, timestamp, signature, signer)` |

Estado añadido:
```typescript
const [cid, setCid]           = useState<string | null>(null)
const [ipfsStep, setIpfsStep] = useState<'idle'|'uploading'|'done'|'skipped'>('idle')
```

#### `dapp/components/DocumentVerifier.tsx`

- `docInfo` ahora incluye `cid: string`
- Si `docInfo.cid` no está vacío: muestra botón "Download" con `getCIDGatewayURL(cid)`
- Si `docInfo.cid === ""`: muestra "Not pinned to IPFS"

#### `dapp/components/DocumentHistory.tsx`

- Tabla desktop: nueva columna "File" — link "IPFS ↗" o "—"
- Cards mobile: nueva sección "IPFS File" — link "Download from IPFS ↗" o "Not pinned to IPFS"
- Usa `getCIDGatewayURL(doc.cid)` cuando `doc.cid` no está vacío

---

### Variables de entorno

**Archivo:** `dapp/.env.local`

```env
# Blockchain (sin cambios)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_MNEMONIC="test test test test test test test test test test test junk"

# IPFS — añadidas estas variables
NEXT_PUBLIC_IPFS_PROVIDER=local               # 'local' | 'pinata'
NEXT_PUBLIC_IPFS_API_URL=http://localhost:5001 # API de Kubo (upload)
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080/ipfs  # Gateway local (download)

# Pinata — sin NEXT_PUBLIC_ (server-side únicamente)
PINATA_API_KEY=
PINATA_SECRET_KEY=
```

---

## Instalación de Kubo (IPFS local)

Kubo es la implementación de referencia de IPFS en Go. Expone:
- Puerto **5001** — API HTTP (subir archivos, administración)
- Puerto **8080** — Gateway HTTP (descargar archivos por CID)
- Puerto **4001** — Swarm P2P (conexión con otros nodos)

### Windows

**Opción A — Chocolatey (recomendado):**
```powershell
choco install kubo
```

**Opción B — Descarga manual:**
1. Ir a https://dist.ipfs.tech/#kubo y descargar la versión `windows-amd64`.
2. Descomprimir el archivo `.zip`.
3. Ejecutar `install.bat` como administrador (añade `ipfs.exe` al PATH).
4. Verificar: `ipfs --version`

### macOS

**Con Homebrew:**
```bash
brew install ipfs
```

**Verificar:**
```bash
ipfs --version
```

### Linux

```bash
# Descargar la versión más reciente (ajustar la versión según corresponda)
wget https://dist.ipfs.tech/kubo/v0.33.0/kubo_v0.33.0_linux-amd64.tar.gz
tar -xvzf kubo_v0.33.0_linux-amd64.tar.gz
cd kubo
sudo bash install.sh

# Verificar
ipfs --version
```

---

## Configuración de Kubo

### 1. Inicializar el repositorio IPFS (solo la primera vez)

```bash
ipfs init
```

Esto crea `~/.ipfs/` con la configuración y las claves del nodo.

### 2. Habilitar CORS para el navegador

El navegador bloqueará las peticiones a `localhost:5001` si Kubo no tiene CORS habilitado. Ejecutar estos comandos **antes de iniciar el daemon**:

```bash
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:3000", "http://127.0.0.1:3000"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization"]'
ipfs config --json API.HTTPHeaders.Access-Control-Expose-Headers '["Location"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
```

### 3. Iniciar el daemon

```bash
ipfs daemon
```

Salida esperada:
```
Initializing daemon...
Kubo version: 0.33.0
...
API server listening on /ip4/127.0.0.1/tcp/5001
WebUI: http://127.0.0.1:5001/webui
Gateway server listening on /ip4/127.0.0.1/tcp/8080
Daemon is ready
```

### 4. Verificar que funciona

```bash
# Verificar la API
curl http://localhost:5001/api/v0/version

# Verificar el gateway (debe devolver el README de IPFS)
curl http://localhost:8080/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme
```

### 5. WebUI (opcional)

Con el daemon corriendo, abrir http://localhost:5001/webui para una interfaz gráfica de administración del nodo.

---

## Configuración del proyecto para IPFS local

Con Kubo instalado y corriendo, el proyecto ya viene configurado correctamente en `dapp/.env.local`:

```env
NEXT_PUBLIC_IPFS_PROVIDER=local
NEXT_PUBLIC_IPFS_API_URL=http://localhost:5001
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080/ipfs
```

> **Importante:** El gateway `http://localhost:8080/ipfs` solo funciona mientras `ipfs daemon` esté corriendo. Los links de descarga no funcionarán si el daemon está parado.

### Orden de arranque para desarrollo

```
Terminal 1:  ipfs daemon
Terminal 2:  anvil
Terminal 3:  forge script sc/script/Deploy.s.sol ... --broadcast
Terminal 4:  cd dapp && npm run dev
```

---

## Configuración alternativa: Pinata

Pinata es un servicio de pinning IPFS en la nube. Los archivos subidos a Pinata están disponibles en la red pública de IPFS sin necesidad de tener un nodo propio expuesto.

### 1. Crear cuenta y API Key

1. Registrarse en https://www.pinata.cloud/
2. Ir a **API Keys** → **New Key**
3. Activar el permiso `pinFileToIPFS`
4. Copiar el **API Key** y el **API Secret**

### 2. Configurar `.env.local`

```env
NEXT_PUBLIC_IPFS_PROVIDER=pinata
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs   # gateway público, funciona con Pinata

# SIN prefijo NEXT_PUBLIC_ — solo se leen en el servidor
PINATA_API_KEY=tu_api_key_aquí
PINATA_SECRET_KEY=tu_api_secret_aquí
```

### 3. Reiniciar el servidor de desarrollo

```bash
# Ctrl+C para parar, luego:
cd dapp && npm run dev
```

Con Pinata, los links de descarga en el gateway público (`ipfs.io`) funcionan inmediatamente porque Pinata anuncia el contenido en la DHT global.

---

## Flujo completo con IPFS local

```
Usuario selecciona archivo
         │
         ▼
FileUploader calcula keccak256 del archivo
         │ hash (bytes32)
         ▼
[Step 2 — IPFS opcional]
  ┌──────────────────────────┐
  │ Click "Upload to IPFS"  │
  │                          │
  │ fetch POST               │
  │ localhost:5001/api/v0/add│
  │ ?pin=true                │
  │                          │
  │ Kubo responde:           │
  │ {"Hash":"Qm...","Name":} │
  │                          │
  │ CID extraído ───────────→│──→ cid = "QmXxx..."
  └──────────────────────────┘         │
         │                             │
         ▼                             │
[Step 3 — Sign]                        │
  wallet.signMessage(bytes(hash))      │
         │ signature (ECDSA)           │
         ▼                             ▼
[Step 4 — Store on Blockchain]
  storeDocumentHash(hash, cid, timestamp, signature, signer)
         │
         ▼
  DocumentRegistry.sol almacena:
    documents[hash] = Document {
      hash: 0x...,
      cid: "QmXxx...",   ← almacenado on-chain
      timestamp: 1234...,
      signer: 0x...,
      signature: 0x...
    }
         │
         ▼
[Verify / History]
  getDocumentInfo(hash) → devuelve cid
  Link: http://localhost:8080/ipfs/QmXxx...
         │
         ▼
  Browser → Kubo gateway (localhost:8080)
         │
         ▼
  Kubo busca CID en su store local → devuelve el archivo
```

---

## Problemas conocidos y soluciones

### "Failed to fetch" / "No se pudo conectar al nodo IPFS"

**Causa:** `ipfs daemon` no está corriendo.

**Solución:** Iniciar el daemon en una terminal:
```bash
ipfs daemon
```

### "502 Bad Gateway" en el gateway de descarga

**Causa:** El archivo está en el nodo local pero el gateway público (`ipfs.io`) no puede encontrarlo porque el nodo local no está expuesto a internet.

**Solución:** Usar el gateway local en `.env.local`:
```env
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080/ipfs
```
Reiniciar el servidor de Next.js (`Ctrl+C` + `npm run dev`).

### CORS error al subir (solo si la configuración de CORS no se aplicó)

**Causa:** Kubo no tiene CORS habilitado para `localhost:3000`.

**Solución:** Parar el daemon, ejecutar los comandos de configuración CORS (ver sección [Configuración de Kubo](#configuración-de-kubo)), y reiniciar:
```bash
# Parar el daemon (Ctrl+C)
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:3000"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'
ipfs daemon
```

### El link de descarga no funciona después de reiniciar el PC

**Causa:** `ipfs daemon` no arranca automáticamente al iniciar el sistema.

**Solución — Windows (Task Scheduler):**
```powershell
# Crear tarea programada para que inicie con el sistema
$action = New-ScheduledTaskAction -Execute "ipfs" -Argument "daemon"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "IPFS Daemon" -Action $action -Trigger $trigger
```

**Solución — Linux (systemd):**
```bash
# Crear servicio systemd
sudo tee /etc/systemd/system/ipfs.service <<EOF
[Unit]
Description=IPFS Daemon
After=network.target

[Service]
User=$USER
ExecStart=/usr/local/bin/ipfs daemon
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable ipfs
sudo systemctl start ipfs
```

### Contrato no responde tras redespliegue

La firma de `storeDocumentHash` cambió (se añadió el parámetro `string _cid`). Redesplegar y actualizar la dirección:

```bash
# Terminal 1
anvil

# Terminal 2
forge script sc/script/Deploy.s.sol:DeployDocumentRegistry \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

Copiar la dirección del output y actualizar en `dapp/.env.local`:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS=<nueva_dirección>
```
