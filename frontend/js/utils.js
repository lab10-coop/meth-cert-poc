function getValueFromArrayById(arr, id) {
    return arr.find(i => i.id == id).value
}

// used in devMode only
function setEthAccount(role) {
    if(role == 'admin')
        web3.eth.defaultAccount = web3.eth.accounts[0]
    else if(role == 'producer1')
        web3.eth.defaultAccount = web3.eth.accounts[1]
    else if(role == 'producer2')
        web3.eth.defaultAccount = web3.eth.accounts[2]
    else if(role == 'reviewer1')
        web3.eth.defaultAccount = web3.eth.accounts[3]
    else if(role == 'reviewer2')
        web3.eth.defaultAccount = web3.eth.accounts[4]
    else
        console.error(`unknown role ${role}`)
}

// Creates input string for the hash function: concatenate the values with _ character in between them
function serializeForHashing(dataArray) {
    return dataArray.reduce( (str, item) => { return str + '_' + item.value }, '' )
}

function playAudioFile(file) {
    let snd = new Audio(file); // buffers automatically when created
    snd.play();
}

// helper for posting data of new requests to the backend
function postToApi(endpoint, data, responseHandler = () => {} ) {
    fetch(`${apiBaseUrl}/${endpoint}`, {
        headers: new Headers({'Content-Type':'application/json'}),
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(data)
    }).then(responseHandler)
}

/*
 * Sample data. The keys in producers are mapped to id's of html form input elements.
 */
var presetData = {
    producer1: {
        'exchange-id': 'AGCS-2016-06-01',
        'send-reg': 'AT-AGCS',
        'target-reg': 'DE-dena',
        'date-application': '6/10/2016',
        'send-org': 'FantasyGas GmbH',
        'send-addr': 'Donau City Strasse 24 1220 Wien',
        'recv-org': 'BioHeidi GmbH',
        'recv-addr': 'Handelsstraße 23, 10001 Handelsstadt',
        'recv-id': 'BioHeidiBK15031',
        'location-handover': 'Verteilergebiet Österreich',

        'amount-kwh': '',
        'feed-start': '1/1/2016',
        'feed-end': '1/31/2016',
        'delivery-kind': 'MB',
        'charge-id': 'BMN--012345--Biogasanlage Bruck a.d. Leitha-00058',

        'country': 'AT',
        'plant-nr':'1',
        'plant-name': 'Biogasanlage Bruck a.d. Leitha',
        'plant-addr': 'Gibtsnichtweg 15 2460 Bruck an der Leitha',
        'prod-startdate': '3/1/2016',
        'count-point': 'AT9099990000000000000000000030060',
        'counter-nr': '30060'
    },
    producer2: {
        'exchange-id': 'AGCS-2016-06-02',
        'send-reg': 'AT-AGCS',
        'target-reg': 'DE-dena',
        'date-application': '6/10/2016',
        'send-org': 'XYZ Hitze GmbH',
        'send-addr': 'XYZ Platz 1 2344 Josef Enzersdorf',
        'recv-org': 'TestProd GmbH',
        'recv-addr': 'TProdStraße 5, 01234 TProdingen',
        'recv-id': 'testprodBK15004',
        'location-handover': 'Verteilergebiet Österreich',

        'amount-kwh': '',
        'feed-start': '2/1/2016',
        'feed-end': '2/28/2016',
        'delivery-kind': 'MB',
        'charge-id': 'BMN--011016--Biomethan Verband Wr.Altstadt-00020',

        'country': 'AT',
        'plant-nr':'5',
        'plant-name': 'Biomethan Verband Wr.Altstadt',
        'plant-addr': 'Nicestreet 3 2700 Wiener Altstadt',
        'prod-startdate': '6/5/2012',
        'count-point': 'AT9099990000000000000005000000559',
        'counter-nr': '559'
    },
    reviewer1: 'Herbert Schmidhammer | ZY Prüfung und Freigabe | Vorderstrasse 1337,1234 Wien',
    reviewer2: 'Dorothea Fenstermacher | ZY Prüfung und Freigabe | Hinterstrasse 0,1234 Wien'
}