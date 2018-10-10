# About

This is a Proof of Concept for a methane certificate management tool.  

It consists of 2 web views for different roles: one for producers (`produce.html`) and one for reviewers (certify.html).  
Producers can apply for certificates based on methane they produced. This is done by filling out a form (2 fantasy sample data records are available via a dropdown box) and submitting it.
This sends the data to the backend, where it's rendered into a PDF (through a HTML page).  
A hash of the data is sent to the Blockchain.

The reviewer's web view listens for events emitted by the Blockchain when a certificate is requested by a producer.  
Based on the hash contained in the event, it fetches the associated data from the backend.  
After verifying the hash, the request is added to the list and can be confirmed by the reviewer (here again, sample data (reviewer identity) can be selected via dropdown).  
Confirmed requests are sent to the blockchain and to the backend. The PDF is re-rendered to include the confirmation transaction hash and the identity of the reviewer.

The producer web view listens for confirmation events and updates the status of the list item representing the confirmed certificate.

When initially opening the web views, past certificates are loaded by listening for Blockchain events (starting from a block configured in `config.js`) and fetching the associated data from the backend based on the hash.

# Requirements

This PoC was made with minimal dependencies.  
If devMode in `config.js` is set, the code expects multiple Ethereum accounts to be available. This requires Metamask to be disabled because Metamask exposes only 1 account at a time.  
Since Metamask is currently available for Chrome only and it's a PoC, only the latest version of Chrome was tested (but it should also run on a modern Firefox and other ES6 supporting browsers).  
For the backend, nodejs 6+ is required.

(hint: this is based on the state of May 2017. May not be compatible with later versions of Metamask)

In order to start the backend, do
```
cd server
npm install
node server.js
```
For a permanent deployment, the use of [forever](https://www.npmjs.com/package/forever) is recommended.

In order to avoid issues with the [same-origin policy](https://en.wikipedia.org/wiki/Same-origin_policy), the backend needs to be available on the same domain as the frontend.
(I got CORS only half working: post requests work cross domain, but get requests don't).  
For the Apache webserver, the node backend can be easily mapped to the same domain with this config (modules `proxy` and `proxy_http` need to be enabled):
```
        Alias /meth-certs /var/www/meth-certs-poc/frontend
        ProxyPass /meth-certs/api/ http://localhost:8000/
```
Contract compilation and deployment can be done with [browser solidity](https://remix.ethereum.org).  
For testrpc deployment, a homegrown nodejs script (adapted from [here](https://github.com/d10r/die-unendliche-wahl/tree/master/admin)) was used. Not added to the repo because it would add dependencies not needed for this project.

# Limitations

* Error handling is very basic, mostly reliant on alert popups
* Logging is done through console.[log|warn|error]. Needs to be disabled in production mode.
* Certificate requests may be half executed if the backend request fails after writing to the Blockchain.
* Possible Blockchain re-orgs resulting in an event to be invalidated aren't detected. 
* Browser support not clearly specified / checked on runtime.
* In the producer view, the list doesn't reflect the chosen preset / account while the MET-Token balance does. Account specific listing could be achieved by using the filter mechanism for Ethereum Events.
* For further development, a module and build system should be used for the frontend.