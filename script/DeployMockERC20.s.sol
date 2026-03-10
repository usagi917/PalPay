// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MockERC20 } from "../contracts/MockERC20.sol";
import { ScriptBase } from "./ScriptBase.sol";

contract DeployMockERC20 is ScriptBase {
    function run() external returns (address tokenAddress) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory name = vm.envString("TOKEN_NAME");
        string memory symbol = vm.envString("TOKEN_SYMBOL");
        uint8 decimals = uint8(vm.envUint("TOKEN_DECIMALS"));

        vm.startBroadcast(deployerPrivateKey);
        tokenAddress = address(new MockERC20(name, symbol, decimals));
        vm.stopBroadcast();
    }
}
