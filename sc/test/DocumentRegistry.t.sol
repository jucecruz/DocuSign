// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {DocumentRegistry} from "../src/DocumentRegistry.sol";

/**
 * @title DocumentRegistryTest
 * @notice Suite de tests para el contrato DocumentRegistry usando Foundry.
 *
 * Cada función de test sigue la convención `test_<Función>_<Escenario>`.
 * Los tests están agrupados por la función del contrato que ejercitan.
 *
 * Para ejecutar: `forge test` desde la raíz del proyecto.
 * Para ver logs:  `forge test -vv`
 */
contract DocumentRegistryTest is Test {
    DocumentRegistry public registry;

    // -------------------------------------------------------------------------
    // Datos de prueba compartidos por todos los tests
    // -------------------------------------------------------------------------

    /// @dev Dirección de firmante simulada
    address internal signer = address(0x1234);

    /// @dev Hash del "contenido" del documento simulado
    bytes32 internal docHash = keccak256("test document content");

    /// @dev Firma ECDSA simulada: concatenación de r (32 bytes), s (32 bytes) y v (1 byte)
    bytes internal signature = abi.encodePacked(bytes32("fake_sig_r"), bytes32("fake_sig_s"), uint8(27));

    /// @dev Timestamp Unix fijo para pruebas reproducibles
    uint256 internal timestamp = 1700000000;

    /// @dev CID de IPFS simulado (formato CIDv0 típico)
    string internal cid = "QmTestCID1234567890abcdef";

    // -------------------------------------------------------------------------
    // Configuración inicial (se ejecuta antes de cada test)
    // -------------------------------------------------------------------------

    function setUp() public {
        registry = new DocumentRegistry();
    }

    // =========================================================================
    // storeDocumentHash — almacenar un documento
    // =========================================================================

    /// @notice Verifica que almacenar un documento válido (con CID) funciona correctamente
    function test_StoreDocument_Success() public {
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);

        assertTrue(registry.isDocumentStored(docHash));
    }

    /// @notice Verifica que se puede almacenar un documento sin CID (CID vacío = IPFS no usado)
    function test_StoreDocument_WithEmptyCID() public {
        registry.storeDocumentHash(docHash, "", timestamp, signature, signer);

        assertTrue(registry.isDocumentStored(docHash));
        DocumentRegistry.Document memory doc = registry.getDocumentInfo(docHash);
        assertEq(doc.cid, "");
    }

    /// @notice Verifica que se emite el evento DocumentStored con el CID correcto
    function test_StoreDocument_EmitsEvent() public {
        // vm.expectEmit: (checkTopic1, checkTopic2, checkTopic3, checkData)
        // Los dos primeros topics son los parámetros indexados (hash, signer)
        // checkData=true valida también los campos no-indexados (timestamp, cid)
        vm.expectEmit(true, true, false, true);
        emit DocumentRegistry.DocumentStored(docHash, signer, timestamp, cid);

        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);
    }

    /// @notice Verifica que no se puede registrar el mismo hash dos veces
    function test_StoreDocument_RejectsDuplicate() public {
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);

        vm.expectRevert("Document already exists");
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);
    }

    /// @notice Verifica que se rechaza address(0) como firmante
    function test_StoreDocument_RejectsZeroSigner() public {
        vm.expectRevert("Invalid signer address");
        registry.storeDocumentHash(docHash, cid, timestamp, signature, address(0));
    }

    /// @notice Verifica que se rechaza una firma vacía
    function test_StoreDocument_RejectsEmptySignature() public {
        vm.expectRevert("Signature cannot be empty");
        registry.storeDocumentHash(docHash, cid, timestamp, bytes(""), signer);
    }

    // =========================================================================
    // verifyDocument — verificar un documento
    // =========================================================================

    /// @notice La verificación devuelve `true` cuando el firmante y la firma son correctos
    function test_VerifyDocument_ReturnsTrue_WhenValid() public {
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);

        bool valid = registry.verifyDocument(docHash, signer, signature);
        assertTrue(valid);
    }

    /// @notice La verificación devuelve `false` si se proporciona un firmante diferente
    function test_VerifyDocument_ReturnsFalse_WrongSigner() public {
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);

        bool valid = registry.verifyDocument(docHash, address(0x9999), signature);
        assertFalse(valid);
    }

    /// @notice La verificación devuelve `false` si la firma no coincide con la almacenada
    function test_VerifyDocument_ReturnsFalse_WrongSignature() public {
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);

        bool valid = registry.verifyDocument(docHash, signer, bytes("wrong_signature"));
        assertFalse(valid);
    }

    /// @notice Verificar un hash que no existe debe revertir
    function test_VerifyDocument_Reverts_WhenNotStored() public {
        bytes32 unknownHash = keccak256("does not exist");

        vm.expectRevert("Document does not exist");
        registry.verifyDocument(unknownHash, signer, signature);
    }

    // =========================================================================
    // getDocumentInfo — obtener datos de un documento
    // =========================================================================

    /// @notice Comprueba que los datos devueltos coinciden con los almacenados (incluyendo CID)
    function test_GetDocumentInfo_ReturnsCorrectData() public {
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);

        DocumentRegistry.Document memory doc = registry.getDocumentInfo(docHash);

        assertEq(doc.hash, docHash);
        assertEq(doc.cid, cid);
        assertEq(doc.timestamp, timestamp);
        assertEq(doc.signer, signer);
        assertEq(keccak256(doc.signature), keccak256(signature));
    }

    /// @notice Verifica que el CID almacenado se recupera correctamente
    function test_GetDocumentInfo_ReturnsCID() public {
        string memory customCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
        registry.storeDocumentHash(docHash, customCID, timestamp, signature, signer);

        DocumentRegistry.Document memory doc = registry.getDocumentInfo(docHash);
        assertEq(doc.cid, customCID);
    }

    /// @notice Obtener info de un hash inexistente debe revertir
    function test_GetDocumentInfo_Reverts_WhenNotStored() public {
        bytes32 unknownHash = keccak256("missing");

        vm.expectRevert("Document does not exist");
        registry.getDocumentInfo(unknownHash);
    }

    // =========================================================================
    // isDocumentStored — comprobar existencia
    // =========================================================================

    /// @notice Antes de almacenar, `isDocumentStored` debe devolver `false`
    function test_IsDocumentStored_ReturnsFalse_BeforeStore() public view {
        assertFalse(registry.isDocumentStored(docHash));
    }

    /// @notice Después de almacenar, `isDocumentStored` debe devolver `true`
    function test_IsDocumentStored_ReturnsTrue_AfterStore() public {
        registry.storeDocumentHash(docHash, cid, timestamp, signature, signer);
        assertTrue(registry.isDocumentStored(docHash));
    }

    // =========================================================================
    // getDocumentCount — contar documentos
    // =========================================================================

    /// @notice El contrato inicia con cero documentos
    function test_GetDocumentCount_StartsAtZero() public view {
        assertEq(registry.getDocumentCount(), 0);
    }

    /// @notice El contador se incrementa con cada documento almacenado
    function test_GetDocumentCount_IncrementsOnStore() public {
        bytes32 hash1 = keccak256("doc1");
        bytes32 hash2 = keccak256("doc2");
        bytes32 hash3 = keccak256("doc3");

        registry.storeDocumentHash(hash1, "cid1", timestamp, signature, signer);
        assertEq(registry.getDocumentCount(), 1);

        registry.storeDocumentHash(hash2, "cid2", timestamp, signature, signer);
        assertEq(registry.getDocumentCount(), 2);

        registry.storeDocumentHash(hash3, "", timestamp, signature, signer);
        assertEq(registry.getDocumentCount(), 3);
    }

    // =========================================================================
    // getDocumentHashByIndex — acceder por índice
    // =========================================================================

    /// @notice Los hashes se devuelven en el mismo orden en que fueron almacenados
    function test_GetDocumentHashByIndex_ReturnsCorrectHash() public {
        bytes32 hash1 = keccak256("doc1");
        bytes32 hash2 = keccak256("doc2");

        registry.storeDocumentHash(hash1, cid, timestamp, signature, signer);
        registry.storeDocumentHash(hash2, cid, timestamp, signature, signer);

        assertEq(registry.getDocumentHashByIndex(0), hash1);
        assertEq(registry.getDocumentHashByIndex(1), hash2);
    }

    /// @notice Acceder con un índice mayor al número de documentos debe revertir
    function test_GetDocumentHashByIndex_Reverts_OutOfBounds() public {
        vm.expectRevert("Index out of bounds");
        registry.getDocumentHashByIndex(0);
    }
}
