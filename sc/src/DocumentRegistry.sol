// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DocumentRegistry
 * @notice Registro inmutable de documentos en Ethereum con soporte opcional de IPFS.
 *
 * Cada documento se identifica por su hash Keccak256 (clave del mapping) y puede
 * incluir un CID de IPFS para recuperar el archivo original desde la red descentralizada.
 *
 * Flujo principal:
 *   1. El cliente calcula keccak256(bytes del archivo) fuera de la cadena.
 *   2. (Opcional) El archivo se sube a IPFS; se obtiene su CID.
 *   3. El firmante firma el hash con su clave privada.
 *   4. Se llama a `storeDocumentHash` con hash + CID (puede ser "") + firma.
 *   5. Cualquiera puede llamar a `verifyDocument` para comprobar autenticidad.
 *   6. Si el documento tiene CID, se puede recuperar el archivo via el gateway de IPFS.
 */
contract DocumentRegistry {
    // -------------------------------------------------------------------------
    // Estructuras de datos
    // -------------------------------------------------------------------------

    /**
     * @notice Representa un documento registrado en la blockchain.
     * @param hash      Hash Keccak256 del contenido del archivo (32 bytes, clave del mapping).
     * @param cid       CID de IPFS para recuperar el archivo original. Vacío ("") si no se usó IPFS.
     * @param timestamp Marca de tiempo Unix (segundos) proporcionada por el cliente al almacenar.
     * @param signer    Dirección Ethereum del firmante del documento.
     * @param signature Firma ECDSA del hash, generada por `signer`.
     */
    struct Document {
        bytes32 hash;
        string cid;
        uint256 timestamp;
        address signer;
        bytes signature;
    }

    // -------------------------------------------------------------------------
    // Estado del contrato
    // -------------------------------------------------------------------------

    /// @dev Mapa de hash de documento → datos del documento.
    mapping(bytes32 => Document) private documents;

    /// @dev Array de todos los hashes registrados, para poder iterar por índice.
    bytes32[] private documentHashes;

    // -------------------------------------------------------------------------
    // Eventos
    // -------------------------------------------------------------------------

    /**
     * @notice Emitido cada vez que se almacena un nuevo documento.
     * @param hash      Hash del documento (indexado para búsqueda eficiente).
     * @param signer    Dirección del firmante (indexada).
     * @param timestamp Marca de tiempo registrada.
     * @param cid       CID de IPFS del archivo original ("" si no se usó IPFS).
     */
    event DocumentStored(bytes32 indexed hash, address indexed signer, uint256 timestamp, string cid);

    /**
     * @notice Emitido cada vez que se ejecuta una verificación.
     * @param hash   Hash del documento verificado (indexado).
     * @param signer Dirección contra la que se verificó (indexada).
     * @param valid  `true` si hash + firma coinciden con el registro; `false` en caso contrario.
     */
    event DocumentVerified(bytes32 indexed hash, address indexed signer, bool valid);

    // -------------------------------------------------------------------------
    // Modificadores
    // -------------------------------------------------------------------------

    /**
     * @dev Revierte si el documento YA existe. Evita sobrescribir registros.
     */
    modifier documentNotExists(bytes32 _hash) {
        require(documents[_hash].signer == address(0), "Document already exists");
        _;
    }

    /**
     * @dev Revierte si el documento NO existe todavía.
     */
    modifier documentExists(bytes32 _hash) {
        require(documents[_hash].signer != address(0), "Document does not exist");
        _;
    }

    // -------------------------------------------------------------------------
    // Funciones de escritura
    // -------------------------------------------------------------------------

    /**
     * @notice Almacena el hash de un documento en la blockchain, junto con su CID de IPFS opcional.
     * @dev El hash debe ser único; no se puede sobrescribir un registro existente.
     *      El CID puede ser una cadena vacía ("") si no se usa IPFS.
     * @param _hash      Hash Keccak256 del archivo (calculado en el cliente).
     * @param _cid       CID de IPFS del archivo original. Pasar "" si no se usa IPFS.
     * @param _timestamp Marca de tiempo Unix en el momento del almacenamiento.
     * @param _signature Firma ECDSA del hash generada por `_signer`.
     * @param _signer    Dirección Ethereum que firmó el documento.
     */
    function storeDocumentHash(
        bytes32 _hash,
        string calldata _cid,
        uint256 _timestamp,
        bytes memory _signature,
        address _signer
    ) external documentNotExists(_hash) {
        require(_signer != address(0), "Invalid signer address");
        require(_signature.length > 0, "Signature cannot be empty");

        documents[_hash] =
            Document({hash: _hash, cid: _cid, timestamp: _timestamp, signer: _signer, signature: _signature});
        documentHashes.push(_hash);

        emit DocumentStored(_hash, _signer, _timestamp, _cid);
    }

    /**
     * @notice Verifica si un documento es auténtico comparando el firmante y la firma
     *         con los datos almacenados en la blockchain.
     * @dev Esta función modifica el estado (emite un evento), por eso no es `view`.
     * @param _hash      Hash Keccak256 del documento a verificar.
     * @param _signer    Dirección del firmante que se quiere comprobar.
     * @param _signature Firma que se quiere comprobar.
     * @return valid `true` si tanto el firmante como la firma coinciden con el registro.
     */
    function verifyDocument(bytes32 _hash, address _signer, bytes memory _signature)
        external
        documentExists(_hash)
        returns (bool)
    {
        Document storage doc = documents[_hash];
        bool valid = doc.signer == _signer && keccak256(doc.signature) == keccak256(_signature);

        emit DocumentVerified(_hash, _signer, valid);
        return valid;
    }

    // -------------------------------------------------------------------------
    // Funciones de lectura (view)
    // -------------------------------------------------------------------------

    /**
     * @notice Devuelve todos los datos almacenados de un documento, incluido el CID de IPFS.
     * @param _hash Hash Keccak256 del documento.
     * @return Struct `Document` con hash, cid, timestamp, signer y signature.
     */
    function getDocumentInfo(bytes32 _hash) external view documentExists(_hash) returns (Document memory) {
        return documents[_hash];
    }

    /**
     * @notice Indica si un documento ya ha sido registrado en el contrato.
     * @param _hash Hash Keccak256 del documento.
     * @return `true` si el documento existe, `false` en caso contrario.
     */
    function isDocumentStored(bytes32 _hash) external view returns (bool) {
        return documents[_hash].signer != address(0);
    }

    /**
     * @notice Devuelve el número total de documentos registrados.
     * @return Longitud del array interno `documentHashes`.
     */
    function getDocumentCount() external view returns (uint256) {
        return documentHashes.length;
    }

    /**
     * @notice Devuelve el hash de un documento por su posición en el array de registro.
     * @param _index Índice basado en cero dentro del array `documentHashes`.
     * @return Hash Keccak256 del documento en esa posición.
     */
    function getDocumentHashByIndex(uint256 _index) external view returns (bytes32) {
        require(_index < documentHashes.length, "Index out of bounds");
        return documentHashes[_index];
    }
}
