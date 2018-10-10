// activates config for testrpc (multiple accounts available through web3, no contract address override)
var devMode = true

var apiBaseUrl =  devMode ? 'api' : 'api'
var generatedBaseUrl = 'generated'
var explorerBaseUrl = 'http://rinkeby.etherscan.io'
var startBlock = devMode ? 0 : 312201

function pdfUrl(hash) { return `${generatedBaseUrl}/${hash}.pdf` }

// Rinkeby: manual override
if(! devMode) {
    console.warn('overriding contract address in config')
    contracts.address = "0xc91413de88c73091052f1e08931f61fc4c411378"
}