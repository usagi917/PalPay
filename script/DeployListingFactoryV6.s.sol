// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ListingFactoryV6 } from "../contracts/ListingFactoryV6.sol";
import { ScriptBase } from "./ScriptBase.sol";

contract DeployListingFactoryV6 is ScriptBase {
    function run() external returns (address factoryAddress) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        string memory baseUri = vm.envString("BASE_URI");

        vm.startBroadcast(deployerPrivateKey);
        factoryAddress = address(new ListingFactoryV6(tokenAddress, baseUri));
        vm.stopBroadcast();
    }
}
