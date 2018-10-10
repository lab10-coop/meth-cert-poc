function reviewerSelected(event) {
    if(devMode) {
        setEthAccount(event.target.value)
    }
}

function onCertCheckboxClicked(e) {
    if(e.checked) {
        e.parentElement.parentElement.classList.add('selected')
    } else {
        e.parentElement.parentElement.classList.remove('selected')
    }
}

// toggle all checkbox
function toggleUnsignedCertsCheckboxes() {
    let checkboxes = document.querySelectorAll('.unsignedCertificates .unsignedCertificate .col5 input')
    let newState = document.querySelector('.unsignedCertificates .selectAll').checked
    checkboxes.forEach( (item) => {
        item.checked = newState
        onCertCheckboxClicked(item)
    })
}

/*
 * Handler for the sign button.
 * Triggers signing of all selected (checkbox) list items (certificate requests).
 */
function signSelectedCerts() {
    if(! web3.eth.defaultAccount) {
        if(web3.eth.accounts.length > 0) {
            web3.eth.defaultAccount = web3.eth.accounts[0]
        } else {
            alert('Bitte sicherstellen, dass ein entsperrter Ethereum-Account verfügbar ist.')
            return
        }
    }
    if(document.getElementById('preset-selector').selectedIndex == 0) {
        alert('Bitte einen Gutachter wählen')
        return
    }

    let unsignedCerts = document.querySelectorAll('.unsignedCertificates .unsignedCertificate')
    unsignedCerts.forEach((item) => {
        let checkbox = item.querySelector('.col5 input')
        if (checkbox.checked) {
            signCert(item)
        }
    })
    document.querySelector('.unsignedCertificates .selectAll').checked = false // reset
}

/*
 * Signs (confirms) the certificate represented by the given html element.
 * Writes to the Blockchain and posts to the backend.
 */
function signCert(elem) {
    let claimedHash = elem.id
    let data = JSON.parse(elem.dataset.all)
    let reviewer = document.getElementById('preset-selector').value
    let hash = web3.sha3(serializeForHashing(JSON.parse(elem.dataset.all)))
    if(hash != claimedHash) {
        alert('Fehler: Hash kann nicht für die vorliegenden Daten verifiziert werden!')
        return
    }

    let amountKwh = getValueFromArrayById(data, 'amount-kwh')
    // contract function execution (implicitly sends transaction)
    // note that web3.eth.defaultAccount needs to be set. If not, the sender needs to be explicited here
    methCertI.confirmAndIssueTokens(hash, amountKwh, (err, ret) => {
        console.log(`confirm and issue tx: err: ${err}, ret: ${ret}`)
        if (err) { alert('something went wrong!') }
        if (!err && ret) {
            let apiData = {hash: hash, tx: ret, reviewer: presetData[reviewer]}
            postToApi('certconfirm', apiData, (res) => {
                if(! res.ok) {
                    alert('Server-Anfrage für Signieren fehlgeschlagen!')
                } else {
                    res.text().then(tryMarkCertAsSigned)
                }
            })
        }
    })
}

function insertUnsignedCert(hash, sendOrg, chargeId, amountKwh, pdfUrl, certData) {
    let certList = document.getElementById('unsigned-cert-list')

    // TODO ask: how to do this without going through this dummyParent / innerHTML hack?
    let dummyParent = document.createElement('div')
    dummyParent.innerHTML = `<div class="unsignedCertificate" id="${hash}">
        <div class="column col1">${sendOrg}</div>
        <div class="column col2">${chargeId}</div>
        <div class="column col3">${amountKwh}</div>
        <div class="column col4"><a href="${pdfUrl}" target="_blank">PDF</a></div>
        <div class="column col5"><input type="checkbox" qonclick="onCertCheckboxClicked(this)"></div>
        <div class="clear"></div>
    </div>
    `

    let newItem = dummyParent.firstElementChild
    newItem.dataset.all = JSON.stringify(certData)

    certList.insertBefore(newItem, certList.firstChild ? certList.firstChild : null)
}

/*
 * Idempotent function to place a certificate item in the list of signed certificates.
 * Returns true if an item was moved over from the list of unsigned certificates or if it's already in the signed certificates list.
 * Returns false if no item could be found in either list for the given hash.
 */
function tryMarkCertAsSigned(hash) {
    let elem = document.getElementById(hash)
    if(elem && elem.classList.contains('signedCertificate')) {
        return true; // already in list: do nothing
    }

    console.log(`cert ${hash} successfully confirmed`)

    // moving to 'signed' list
    let unsignedCertList = document.getElementById('unsigned-cert-list')
    let signedCertList = document.getElementById('signed-cert-list')
    if(elem) {
        elem.classList.remove("unsignedCertificate")
        elem.classList.add("signedCertificate")
        elem.querySelector(".col5").remove()

        unsignedCertList.removeChild(elem)
        signedCertList.insertBefore(elem, signedCertList.firstChild ? signedCertList.firstChild : null)
        return true
    } else {
        console.warn(`no cert with hash ${hash}) in list`)
        return false
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded')

    document.querySelector('#preset-selector').onchange = reviewerSelected

    document.querySelector('.unsignedCertificates .selectAll').onclick = toggleUnsignedCertsCheckboxes
    document.querySelector('#signCertsBtn').onclick = signSelectedCerts
})

/*
 * On first page load, past cert request and confirm events may trigger faster than the associated data can be fetched from the backend.
 * This set is for handling the case where the confirm event needs to be delayed because of the cert data not yet loaded.
 */
var pendingSignedCerts = new Set()

window.addEventListener('load', () => {
    console.log('all loaded')
    web3Init()

    // listen for cert request events
    methCertI.certRequestedEvent({}, {fromBlock: startBlock}).watch( (err, ret) => {
        console.log(`certRequestedEvent ${JSON.stringify(ret.args)}`)

        let hash = ret.args.datahash

        // get corresponding json data
        fetch(`${apiBaseUrl}/certdata?hash=${hash}`)
            .then( res => { return res.json() })
            .then( res => {
                console.log(`api response: ${JSON.stringify(res)}`)

                let sendOrg = getValueFromArrayById(res.data, 'send-org')
                let chargeId = getValueFromArrayById(res.data, 'charge-id')
                let amountKwh = getValueFromArrayById(res.data, 'amount-kwh')

                insertUnsignedCert(hash, sendOrg, chargeId, amountKwh, pdfUrl(hash), res.data)
                if(pendingSignedCerts.has(hash)) {
                    tryMarkCertAsSigned(hash)
                    pendingSignedCerts.delete(hash)
                }
            })
            .catch( e => alert('Server-Anfrage fehlgeschlagen!') )
    })

    // listen for cert request events
    methCertI.certConfirmedEvent({}, {fromBlock: startBlock}).watch( (err, ret) => {
        console.log(`certConfirmedEvent ${JSON.stringify(ret.args)}`)
        let hash = ret.args.datahash
        if(! tryMarkCertAsSigned(hash)) {
            pendingSignedCerts.add(hash)
        }
    })
})
