// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {DocumentRegistry} from "../src/DocumentRegistry.sol";

/**
 * @title DeployDocumentRegistry
 * @notice Script de despliegue del contrato DocumentRegistry usando Foundry.
 *
 * Uso típico con Anvil (red local):
 *   forge script sc/script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
 *
 * La dirección del contrato desplegado se imprime en consola y debe copiarse
 * en la variable de entorno `NEXT_PUBLIC_CONTRACT_ADDRESS` del proyecto dapp.
 *
 * `vm.startBroadcast()` / `vm.stopBroadcast()` indican a Forge que las
 * transacciones dentro de ese bloque deben enviarse a la red real (o Anvil).
 */
contract DeployDocumentRegistry is Script {
    /**
     * @notice Punto de entrada del script. Foundry lo llama automáticamente.
     * @return registry Instancia del contrato recién desplegado.
     */
    function run() public returns (DocumentRegistry) {
        // Inicia la transmisión de transacciones a la red
        vm.startBroadcast();

        DocumentRegistry registry = new DocumentRegistry();

        // Detiene la transmisión; cualquier llamada posterior no se envía a la red
        vm.stopBroadcast();

        console.log("DocumentRegistry desplegado en:", address(registry));
        return registry;
    }
}
