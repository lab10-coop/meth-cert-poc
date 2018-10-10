/*
 * click handler for the form submit button.
 * Triggers an Ethereum transaction, posts data to the backend and updates the list UI
 * TODO: currently, adding a request is not atomic, because posting to the backend may fail after writing to the Blockchain.
 * A production implementation should probably keep trying until it succeeds (and visualize the pending state).
 */
function onCertRequestClicked() {
    /*
     * This code is here because the time at which Metamask makes accounts available seems to be somewhat random.
     * This acts as a fallback. If at the time of the user requesting a transaction we don't have an Ethereum account,
     * we give up and show an error msg.
     */
    if(! web3.eth.defaultAccount) {
        if(web3.eth.accounts.length > 0) {
            web3.eth.defaultAccount = web3.eth.accounts[0]
        } else {
            alert('Bitte sicherstellen, dass ein entsperrter Ethereum-Account verfügbar ist.')
            return
        }
    } else {
        let data = getFormDataArray()

        if(! devMode) { // annoying while testing
            if (Number.isNaN(Number.parseInt(getValueFromArrayById(data, 'amount-kwh')))) {
                alert('Bitte Menge eingeben')
                return
            }

            // check if charge-id is set and unique
            let chargeId = getValueFromArrayById(data, 'charge-id')
            if(chargeId == '') {
                alert('Chargen-ID kann nicht leer sein')
                return
            }
            let chargeIds = Array.from(document.querySelectorAll('.myCertificate .col2'), s => s.innerHTML)
            if (chargeIds.indexOf(chargeId) != -1) {
                alert('Diese Chargen-ID ist bereits vergeben')
                return
            }
        }
        
        // returns a string of the hash in hex representation
        let hash = web3.sha3(serializeForHashing(data))

        // contract function execution (implicitly sends transaction)
        // note that web3.eth.defaultAccount needs to be set. If not, the sender needs to be explicited here
        methCertI.request(hash, (err, ret) => {
            console.log(`request tx - err: ${err}, ret(tx): ${ret}`)

            if (err) {
                alert('something went wrong!')
            }

            if (!err && ret) {
                // add the new request to the table
                let sendOrg = getValueFromArrayById(data, 'send-org')
                let chargeId = getValueFromArrayById(data, 'charge-id')
                let amountKwh = getValueFromArrayById(data, 'amount-kwh')
                addUnconfirmedCert(hash, sendOrg, chargeId, amountKwh, pdfUrl(hash))

                let apiData = {hash: hash, tx: ret, data: data}

                postToApi('certrequest', apiData, (res) => {
                    if(! res.ok) {
                        alert('Server-Anfrage für Signieren fehlgeschlagen!')
                    }
                })
            }
        })
    }
}

/*
 * Reads data from the input form into an array of maps (id, label, value).
 * An array of fields is used because we need reliable order for hashing.
 */
function getFormDataArray() {
    let arr = []
    let inputFields = document.querySelectorAll('#form1 .formItem')
    inputFields.forEach( (item) => {
        let label = item.querySelector('.formItemLabel label').innerHTML
        let id = item.querySelector('.formItemField input').id
        let value = item.querySelector('.formItemField input').value
        arr.push({ id: id, label: label, value: value })
    })
    return arr
}

// preset selection prefills the form with sample data and switches Ethereum account in devMode (Metamask exposes only one at a time).
function presetSelected(event) {
    let preset = presetData[event.target.value]
    if(devMode) {
        setEthAccount(event.target.value)
        updateTokenBalance()
    }

    // fill the form fields
    Object.entries(preset).forEach( ([key, value]) => {
        document.getElementById(key).value = value
    })
}

/*
 * Updates the MET-Token balance for the given account, using the ERC-20 interface of the contract.
 * If the balance has changed, the user gets a brief audio notification - similar to other wallets.
 */
function updateTokenBalance() {
    let oldBal = document.getElementById('token-balance').innerHTML
    if(web3.eth.defaultAccount) {
        methCertI.balanceOf(web3.eth.defaultAccount, (err, ret) => {
            if(err) { console.error('balanceOf failed') }
            if(ret) {
                let bal = web3.toDecimal(ret)
                document.getElementById('token-balance').innerHTML = bal
                if(! isNaN(oldBal) && oldBal !=  bal) {
                    playAudioFile("audio/coin-drop.mp3")
                }
            }
        })
    }
}

// adds a certificate in unsigned (unconfirmed) state to the list UI
function addUnconfirmedCert(hash, sendOrg, chargeId, amountKwh, pdfUrl) {
    let certList = document.getElementById('cert-list')

    let dummyParent = document.createElement('div')
    dummyParent.innerHTML = `
        <div class="myCertificate warning" id="${hash}">
        <div class="column col1">${sendOrg}</div>
        <div class="column col2">${chargeId}</div>
        <div class="column col3">${amountKwh}</div>
        <div class="column col4"><a href="${pdfUrl}" target="_blank">PDF</a></div>
        <div class="column col5">nicht signiert</div>
        <div class="column col6">-</div>
        <div class="clear"></div>
    </div>
    `
    let newItem = dummyParent.firstElementChild

    certList.insertBefore(newItem, certList.firstChild ? certList.firstChild : null)
}

// increments the confirmation counter of the certificate list items
function onNextBlock() {
    console.log("next block")

    // increment the confirmation counters
    let confirmationCells = document.querySelectorAll('#cert-list .column.col6')
    confirmationCells.forEach( (cell) => {
        curVal = parseInt(cell.innerHTML)
        if(! isNaN(curVal)) {
            cell.innerHTML = ++curVal
        }
    })
}

/*
 * Invoked for confirm events from the Blockchain.
 * Updates the list item UI to visualize the certificate as confirmed / signed.
 * Returns true if the requested cert was found in list, false otherwise.
 */
function tryMarkCertAsConfirmed(hash, reviewer, txHash, confirmations = 1) {
    // mark as signed
    let elem = document.getElementById(hash)
    if(elem) {
        elem.classList.remove("warning")
        elem.classList.add("success")
        elem.querySelector(".col5").innerHTML = `<a href="${explorerBaseUrl}/tx/${txHash}" target="_blank">signiert</a>`
        elem.querySelector(".col6").innerHTML = confirmations
        return true
    } else {
        console.warn(`confirmed cert not in list: ${hash}`)
        return false
    }
}

// Inserts a confirmed certificate which wasn't in the list as unconfirmed
function addConfirmedCert(hash, certData, txData) {
    let sendOrg = getValueFromArrayById(certData, 'send-org')
    let chargeId = getValueFromArrayById(certData, 'charge-id')
    let amountKwh = getValueFromArrayById(certData, 'amount-kwh')

    web3.eth.getBlockNumber( (err, curBlockNr) => {
        let confirmations = curBlockNr - txData.blockNumber + 1

        // uses existing mechanism of first adding as unconfirmed and then switching to confirmed
        addUnconfirmedCert(hash, sendOrg, chargeId, amountKwh, pdfUrl(hash))
        tryMarkCertAsConfirmed(hash, txData.args.by, txData.transactionHash, confirmations)
    })
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded')

    document.querySelector('#preset-selector').onchange = presetSelected

    // TODO: port to vanilla JS in order to drop jQuery
    $( ".newCertificateMoreFieldsTrigger .show" ) .click(function() {
        $(this).hide().parent().find('.hide').show();
        $(".newCertificateMoreFields").slideDown(500);
    });

    $( ".newCertificateMoreFieldsTrigger .hide" ) .click(function() {
        $(this).hide().parent().find('.show').show();
        $(".newCertificateMoreFields").slideUp(500);
    });
})

// inits web3 and installs event watchers
window.addEventListener('load', () => {
    console.log('all loaded')

    web3Init()

    // listen for request events
    methCertI.certRequestedEvent().watch( (err, ret) => {
        console.log(`certRequestedEvent ${JSON.stringify(ret.args)}`)
    })

    // listen for confirm events
    // TODO: If multiple past events are triggered on first page load, they may currently not be added in the correct order due to the asynchronous data fetching.
    methCertI.certConfirmedEvent({}, {fromBlock: startBlock}).watch( (err, ret) => {
        console.log(`certConfirmedEvent ${JSON.stringify(ret.args)}`)
        let hash = ret.args.datahash
        if (!tryMarkCertAsConfirmed(ret.args.datahash, ret.args.by, ret.transactionHash)) {
            // cert not yet in list => get corresponding json data and add it
            fetch(`${apiBaseUrl}/certdata?hash=${hash}`)
                .then((res) => { return res.json() })
                .then((res) => {
                    console.log(`api response: ${JSON.stringify(res)}`)
                    addConfirmedCert(hash, res.data, ret)
                })
                .catch((e) => {
                    alert('Server-Anfrage fehlgeschlagen!')
                })
        }
    })

    // listen for issued token events (TODO: filter issuances to myself / selected account)
    methCertI.tokensIssuedEvent().watch( (err, ret) => {
        console.log(`tokensIssuedEvent ${JSON.stringify(ret.args)}`)
        updateTokenBalance()
    })
})