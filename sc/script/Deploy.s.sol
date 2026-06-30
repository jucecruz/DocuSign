// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {DocumentRegistry} from "../src/DocumentRegistry.sol";

contract DeployDocumentRegistry is Script {
    function run() public returns (DocumentRegistry) {
        vm.startBroadcast();
        DocumentRegistry registry = new DocumentRegistry();
        vm.stopBroadcast();

        console.log("DocumentRegistry desplegado en:", address(registry));
        return registry;
    }
}
