// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {DocumentRegistry} from "../src/DocumentRegistry.sol";

contract DocumentRegistryTest is Test {
    DocumentRegistry public registry;

    address internal signer = address(0x1234);
    bytes32 internal docHash = keccak256("test document content");
    bytes internal signature = abi.encodePacked(bytes32("fake_sig_r"), bytes32("fake_sig_s"), uint8(27));
    uint256 internal timestamp = 1700000000;

    function setUp() public {
        registry = new DocumentRegistry();
    }

    // --- storeDocumentHash ---

    function test_StoreDocument_Success() public {
        registry.storeDocumentHash(docHash, timestamp, signature, signer);

        assertTrue(registry.isDocumentStored(docHash));
    }

    function test_StoreDocument_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit DocumentRegistry.DocumentStored(docHash, signer, timestamp);

        registry.storeDocumentHash(docHash, timestamp, signature, signer);
    }

    function test_StoreDocument_RejectsDuplicate() public {
        registry.storeDocumentHash(docHash, timestamp, signature, signer);

        vm.expectRevert("Document already exists");
        registry.storeDocumentHash(docHash, timestamp, signature, signer);
    }

    function test_StoreDocument_RejectsZeroSigner() public {
        vm.expectRevert("Invalid signer address");
        registry.storeDocumentHash(docHash, timestamp, signature, address(0));
    }

    function test_StoreDocument_RejectsEmptySignature() public {
        vm.expectRevert("Signature cannot be empty");
        registry.storeDocumentHash(docHash, timestamp, bytes(""), signer);
    }

    // --- verifyDocument ---

    function test_VerifyDocument_ReturnsTrue_WhenValid() public {
        registry.storeDocumentHash(docHash, timestamp, signature, signer);

        bool valid = registry.verifyDocument(docHash, signer, signature);
        assertTrue(valid);
    }

    function test_VerifyDocument_ReturnsFalse_WrongSigner() public {
        registry.storeDocumentHash(docHash, timestamp, signature, signer);

        bool valid = registry.verifyDocument(docHash, address(0x9999), signature);
        assertFalse(valid);
    }

    function test_VerifyDocument_ReturnsFalse_WrongSignature() public {
        registry.storeDocumentHash(docHash, timestamp, signature, signer);

        bool valid = registry.verifyDocument(docHash, signer, bytes("wrong_signature"));
        assertFalse(valid);
    }

    function test_VerifyDocument_Reverts_WhenNotStored() public {
        bytes32 unknownHash = keccak256("does not exist");

        vm.expectRevert("Document does not exist");
        registry.verifyDocument(unknownHash, signer, signature);
    }

    // --- getDocumentInfo ---

    function test_GetDocumentInfo_ReturnsCorrectData() public {
        registry.storeDocumentHash(docHash, timestamp, signature, signer);

        DocumentRegistry.Document memory doc = registry.getDocumentInfo(docHash);

        assertEq(doc.hash, docHash);
        assertEq(doc.timestamp, timestamp);
        assertEq(doc.signer, signer);
        assertEq(keccak256(doc.signature), keccak256(signature));
    }

    function test_GetDocumentInfo_Reverts_WhenNotStored() public {
        bytes32 unknownHash = keccak256("missing");

        vm.expectRevert("Document does not exist");
        registry.getDocumentInfo(unknownHash);
    }

    // --- isDocumentStored ---

    function test_IsDocumentStored_ReturnsFalse_BeforeStore() public view {
        assertFalse(registry.isDocumentStored(docHash));
    }

    function test_IsDocumentStored_ReturnsTrue_AfterStore() public {
        registry.storeDocumentHash(docHash, timestamp, signature, signer);
        assertTrue(registry.isDocumentStored(docHash));
    }

    // --- getDocumentCount ---

    function test_GetDocumentCount_StartsAtZero() public view {
        assertEq(registry.getDocumentCount(), 0);
    }

    function test_GetDocumentCount_IncrementsOnStore() public {
        bytes32 hash1 = keccak256("doc1");
        bytes32 hash2 = keccak256("doc2");
        bytes32 hash3 = keccak256("doc3");

        registry.storeDocumentHash(hash1, timestamp, signature, signer);
        assertEq(registry.getDocumentCount(), 1);

        registry.storeDocumentHash(hash2, timestamp, signature, signer);
        assertEq(registry.getDocumentCount(), 2);

        registry.storeDocumentHash(hash3, timestamp, signature, signer);
        assertEq(registry.getDocumentCount(), 3);
    }

    // --- getDocumentHashByIndex ---

    function test_GetDocumentHashByIndex_ReturnsCorrectHash() public {
        bytes32 hash1 = keccak256("doc1");
        bytes32 hash2 = keccak256("doc2");

        registry.storeDocumentHash(hash1, timestamp, signature, signer);
        registry.storeDocumentHash(hash2, timestamp, signature, signer);

        assertEq(registry.getDocumentHashByIndex(0), hash1);
        assertEq(registry.getDocumentHashByIndex(1), hash2);
    }

    function test_GetDocumentHashByIndex_Reverts_OutOfBounds() public {
        vm.expectRevert("Index out of bounds");
        registry.getDocumentHashByIndex(0);
    }
}
