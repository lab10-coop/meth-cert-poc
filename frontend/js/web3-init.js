/*
 * Initializes the web3 environment. Supports injected or rpc based setup.
 */
function web3Init() {
    let cabi = contracts.MethCert.info.abiDefinition;
    let caddress = contracts.address;

    var Web3 = require('web3');

    if (typeof web3 !== 'undefined') {
        // Mist / Metamask
        console.log('web3 connects to provider')
        web3 = new Web3(web3.currentProvider);
    } else {
        // standalone
        //alert("This Dapp needs web3 injected (e.g. through the Metamask plugin.");
        console.log('web3 connects to rpc')
        web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))
        web3.eth.defaultAccount = web3.eth.accounts[0]
    }

    if(devMode) {
        let accounts = web3.eth.accounts;

        if (accounts.length < 5) {
            alert('Need min 5 accounts in devMode')
        }
    }

    // contract is the contract template based on our abi
    let methCertC = web3.eth.contract(cabi);
    methCertI = methCertC.at(caddress);

    console.log(`contract loaded at ${caddress} for defaultAccount ${web3.eth.defaultAccount}`)

    web3.eth.getBlockNumber((err, ret) => {
        console.log("Block: " + ret);
    });

    // callback on block advance
    web3.eth.filter('latest').watch((err, hash) => {
        // check if somebody is listening...
        if (typeof onNextBlock === 'function') {
            onNextBlock()
        }
    })

    methCertI.errLog().watch((err, ret) => {
        console.log(`MethCert contract error: ${ret}`)
    })
}
