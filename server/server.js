var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var phantom = require('phantom');
var fs = require('fs')

var config = {
    genDataDir: '../generated',
    pdfTemplateFile: 'cert_template.html',
    explorerBaseUrl: 'http://rinkeby.etherscan.io'
}

function jsonFileName(hash) { return `${config.genDataDir}/${hash}.json` }
function pdfFileName(hash) { return `${config.genDataDir}/${hash}.pdf` }
function replacedPdfFileName(hash) { return `${config.genDataDir}/${hash}_request.pdf` }

app.use(bodyParser.json());

app.get('/certdata', (req, res) => {
    const hash = req.query.hash
    console.log(`get certdata for ${hash}`)

    const buf = fs.readFileSync(jsonFileName(hash))
    res.json(JSON.parse(buf))
})

/*
 * Invoked by the producer when requesting a certificate.
 * Contains the data to be certified as json in the body.
 * This call triggers creation of a PDF in a predefined location with the filename "<hash>.pdf"
 */
app.post('/certrequest', (req, res) => {
    console.log(`cert request: ${JSON.stringify(req.body)}`)
    const hash = req.body.hash
    const tx = req.body.tx

    fs.writeFileSync(jsonFileName(hash), JSON.stringify(req.body))

    // create html (input the pdf renderer understands)
    const cryptoData = [
        { label: "Kryptographischer Fingerabdruck", value: hash },
        { label: "Zertifikat beantragt in Transaktion", value: tx, type: 'tx' },
        { label: "Zertifikat bestätigt in Transaktion", value: 'NOCH NICHT BESTÄTIGT'}
    ]
    const html = createCertHtml(config.pdfTemplateFile, req.body.data, cryptoData)
    const htmlFileName = `${config.genDataDir}/${hash}_request.html`
    fs.writeFileSync(htmlFileName, html)

    generatePdf(htmlFileName, pdfFileName(hash))
    res.end()
})

/*
 * Invoked by the certification authority (Gutachter) for confirming a previously requested certificate.
 * Reads the certified data corresponding to the input hash (in body as json) and updates (technically: re-writes)
 * the related PDF.
 */
app.post('/certconfirm', (req, res) => {
    console.log(`cert confirm: ${JSON.stringify(req.body)}`)
    const hash = req.body.hash

    const buf = fs.readFileSync(jsonFileName(hash))
    const persistedRequest = JSON.parse(buf)

    const cryptoData = [
        { label: "Kryptographischer Fingerabdruck", value: hash },
        { label: "Zertifikat beantragt in Transaktion", value: persistedRequest.tx, type: 'tx' },
        { label: "Zertifikat bestätigt in Transaktion", value: req.body.tx, type: 'tx'},
        { label: "Gutachter", value: req.body.reviewer}
    ]
    const html = createCertHtml(config.pdfTemplateFile, persistedRequest.data, cryptoData)
    const htmlFileName = `${config.genDataDir}/${hash}_confirm.html`
    fs.writeFileSync(htmlFileName, html)

    /*
     * UX hack: move the un-confirmed pdf to another path in order to avoid the signer seeing the old version
     * while the new one is still being rendered.
     */
    try {
        fs.renameSync(pdfFileName(hash), replacedPdfFileName(hash))
    } catch(e) {}
    generatePdf(htmlFileName, pdfFileName(hash))
    res.end(hash)
})

/*
 * allow cors (*'§"§/&'). As is it works with post requests, but not with get (not sure if server or client fault).
 * CORS issues can be avoided by having the server mapped to same hostname and port.
 */
app.all('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers")
  next()
});

app.listen(8000, function() {
    console.log('listening to port 8000.');
});

// returns html code (as string) for the given data
function createCertHtml(templateFile, certData, cryptoData) {
    const htmlTemplate = fs.readFileSync(templateFile).toString()

    const mainItemIds = ['send-org', 'charge-id' ,'amount-kwh']
    let htmlCertItems = ''
    certData.forEach( (item) => {
        if(item.value != '') { // skip empty fields
            if(mainItemIds.includes(item.id)) {
                htmlCertItems += `
                    <div class="certItem">
                      <div class="certItemLabel">${item.label}</div>
                      <div class="certItemValue">${item.value}</div>
                    </div>
                `
            } else {
                htmlCertItems += `
                    <div class="certSmallItem">
                      ${item.label}: ${item.value}
                    </div>
                `
            }
        }
    })

    let htmlCertCryptoItems = ''
    cryptoData.forEach( (item) => {
        let value = item.type == 'tx' ? `<a href="${config.explorerBaseUrl}/tx/${item.value}" target="_blank">${item.value}</a>` : item.value
        htmlCertCryptoItems += `
            <div class="certCryptoItem">
              <div class="certItemLabel">${item.label}</div>
              <div class="certItemValue">${value}</div>
            </div>
        `
    })

    return htmlTemplate.replace(/%%CERT_ITEMS%%/, htmlCertItems).replace(/%%CERT_CRYPTO_ITEMS%%/, htmlCertCryptoItems)
}

// http://stackoverflow.com/questions/17105873/how-to-generate-pdf-in-node-js (converted to ES6)
function generatePdf(inHtmlFile, outPdfFile) {
    phantom.create()
        .then( ph => ph.createPage()
            .then( page => page.open(inHtmlFile)
                .then( status => { return page.render(outPdfFile) })
                .then( () => {
                    console.log(`${inHtmlFile} rendered to ${outPdfFile}`)
                    ph.exit()
                })
            )
        )
}