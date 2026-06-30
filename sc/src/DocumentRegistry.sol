// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DocumentRegistry
 * @notice Registro inmutable de hashes de documentos en Ethereum.
 * Permite a cualquier cuenta almacenar el hash Keccak256 de un documento
 * junto con una firma digital, y luego verificar su autenticidad.
 *
 * Flujo principal:
 *   1. El cliente calcula keccak256(bytes del archivo) fuera de la cadena.
 *   2. El firmante firma ese hash con su clave privada.
 *   3. Se llama a `storeDocumentHash` para registrar hash + firma en el contrato.
 *   4. Cualquiera puede llamar a `verifyDocument` para comprobar que el hash
 *      y la firma coinciden con los datos registrados.
 */
contract DocumentRegistry {

    // -------------------------------------------------------------------------
    // Estructuras de datos
    // -------------------------------------------------------------------------

    /**
     * @notice Representa un documento registrado en la blockchain.
     * @param hash       Hash Keccak256 del contenido del archivo (32 bytes).
     * @param timestamp  Marca de tiempo Unix (segundos) proporcionada por el cliente al almacenar.
     * @param signer     Dirección Ethereum del firmante del documento.
     * @param signature  Firma ECDSA del hash, generada por `signer`.
     */
    struct Document {
        bytes32 hash;
        uint256 timestamp;
        address signer;
        bytes signature;
    }

    // -------------------------------------------------------------------------
    // Estado del contrato
    // -------------------------------------------------------------------------

    /// @dev Mapa de hash de documento → datos del documento. Privado para forzar el uso de getters.
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
     */
    event DocumentStored(bytes32 indexed hash, address indexed signer, uint256 timestamp);

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
     * Un documento existe cuando su `signer` no es la dirección cero.
     */
    modifier documentNotExists(bytes32 _hash) {
        require(documents[_hash].signer == address(0), "Document already exists");
        _;
    }

    /**
     * @dev Revierte si el documento NO existe todavía.
     * Usado para proteger funciones que leen datos de un documento previo.
     */
    modifier documentExists(bytes32 _hash) {
        require(documents[_hash].signer != address(0), "Document does not exist");
        _;
    }

    // -------------------------------------------------------------------------
    // Funciones de escritura
    // -------------------------------------------------------------------------

    /**
     * @notice Almacena el hash de un documento en la blockchain.
     * @dev El hash debe ser único; no se puede sobreescribir un registro existente.
     *      La validación criptográfica de la firma se realiza fuera de la cadena
     *      (en el cliente) antes de llamar a esta función.
     * @param _hash      Hash Keccak256 del archivo (calculado en el cliente).
     * @param _timestamp Marca de tiempo Unix en el momento del almacenamiento.
     * @param _signature Firma ECDSA del hash generada por `_signer`.
     * @param _signer    Dirección Ethereum que firmó el documento.
     */
    function storeDocumentHash(
        bytes32 _hash,
        uint256 _timestamp,
        bytes memory _signature,
        address _signer
    ) external documentNotExists(_hash) {
        require(_signer != address(0), "Invalid signer address");
        require(_signature.length > 0, "Signature cannot be empty");

        documents[_hash] = Document({
            hash: _hash,
            timestamp: _timestamp,
            signer: _signer,
            signature: _signature
        });
        documentHashes.push(_hash);

        emit DocumentStored(_hash, _signer, _timestamp);
    }

    /**
     * @notice Verifica si un documento es auténtico comparando el firmante y la firma
     *         con los datos almacenados en la blockchain.
     * @dev Esta función modifica el estado (emite un evento), por lo que no es `view`.
     *      Revierte si el documento no ha sido registrado previamente.
     * @param _hash      Hash Keccak256 del documento a verificar.
     * @param _signer    Dirección del firmante que se quiere comprobar.
     * @param _signature Firma que se quiere comprobar.
     * @return valid `true` si tanto el firmante como la firma coinciden con el registro.
     */
    function verifyDocument(
        bytes32 _hash,
        address _signer,
        bytes memory _signature
    ) external documentExists(_hash) returns (bool) {
        Document storage doc = documents[_hash];
        // Compara signer y el hash de la firma (más eficiente que comparar bytes en bruto)
        bool valid = doc.signer == _signer &&
            keccak256(doc.signature) == keccak256(_signature);

        emit DocumentVerified(_hash, _signer, valid);
        return valid;
    }

    // -------------------------------------------------------------------------
    // Funciones de lectura (view)
    // -------------------------------------------------------------------------

    /**
     * @notice Devuelve todos los datos almacenados de un documento.
     * @dev Revierte si el hash no está registrado.
     * @param _hash Hash Keccak256 del documento.
     * @return Struct `Document` con hash, timestamp, signer y signature.
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
        // Un signer distinto de address(0) indica que el documento fue almacenado
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
     * @dev Útil para iterar todos los documentos desde el frontend.
     *      Revierte si el índice está fuera de rango.
     * @param _index Índice basado en cero dentro del array `documentHashes`.
     * @return Hash Keccak256 del documento en esa posición.
     */
    function getDocumentHashByIndex(uint256 _index) external view returns (bytes32) {
        require(_index < documentHashes.length, "Index out of bounds");
        return documentHashes[_index];
    }
}
