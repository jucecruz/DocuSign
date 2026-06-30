// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DocumentRegistry {
    struct Document {
        bytes32 hash;
        uint256 timestamp;
        address signer;
        bytes signature;
    }

    mapping(bytes32 => Document) private documents;
    bytes32[] private documentHashes;

    event DocumentStored(bytes32 indexed hash, address indexed signer, uint256 timestamp);
    event DocumentVerified(bytes32 indexed hash, address indexed signer, bool valid);

    modifier documentNotExists(bytes32 _hash) {
        require(documents[_hash].signer == address(0), "Document already exists");
        _;
    }

    modifier documentExists(bytes32 _hash) {
        require(documents[_hash].signer != address(0), "Document does not exist");
        _;
    }

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

    function verifyDocument(
        bytes32 _hash,
        address _signer,
        bytes memory _signature
    ) external documentExists(_hash) returns (bool) {
        Document storage doc = documents[_hash];
        bool valid = doc.signer == _signer &&
            keccak256(doc.signature) == keccak256(_signature);

        emit DocumentVerified(_hash, _signer, valid);
        return valid;
    }

    function getDocumentInfo(bytes32 _hash) external view documentExists(_hash) returns (Document memory) {
        return documents[_hash];
    }

    function isDocumentStored(bytes32 _hash) external view returns (bool) {
        return documents[_hash].signer != address(0);
    }

    function getDocumentCount() external view returns (uint256) {
        return documentHashes.length;
    }

    function getDocumentHashByIndex(uint256 _index) external view returns (bytes32) {
        require(_index < documentHashes.length, "Index out of bounds");
        return documentHashes[_index];
    }
}
