pragma solidity ^0.4.4;

/*
 * This contract combines a basic signing facility with an ERC-20 token.
 * Producers can signal certificate requests by communicating a hash of the request data.
 * Reviewers can confirm such requests again based on the hash.
 * The contract allows only confirmations of hashes previously communicated by producers.
 *
 * Finally, reviewers can also issue MET tokens.
 * This is done by communicating a hash and the amount of tokens (representing kWh) to be issued to the producer.
 * The contract as is does not check or enforce the correct amount.
 * It does ensure that every issuance is associated to a request hash.
 * In case the raw data of the requests is made public (no matter by whom - its authenticity can be checked via the hash -
 * it's trivial to audit correct issuance of MET tokens.
 *
 * The token as is has only basic features. It e.g. doesn't support allowances / 3rd party withdrawal.
 */
contract MethCert {

    /*
     * By default, the contract creator has no special privileges.
     * In order to enable functions callable only by the contract creator,
     * we remember its address in the "owner" field.
     */
    address public owner;

    // contract constructor
    function MethCert() {
        // Documentation of the msg object: http://solidity.readthedocs.io/en/develop/units-and-global-variables.html#special-variables-and-functions
        owner = msg.sender;
    }

    // event for signalling errors (without, the tx creator gets only a generic error about JUMP failing)
    event errLog(string msg);

    /*
     * map storing the requested hashes
     * This is needed only in order to have that information available from within the contract.
     * For auditing and transparency, it's enough (and cheaper) to just log via event.
     *
     * In this implementation, the mapping is used to issue tokens to the address from which the signing request originated.
     * It does not keep track about the state of a request (signed or not, tokens issued or not).
     *
     * the bytes32 key is for the hash, the address value for the requesting address
     */
    mapping (bytes32 => address) public certRequests;
    event certRequestedEvent(address by, bytes32 datahash);

    /*
     * To be used by producers requesting a certificate.
     * This implementation has no restrictions about who can be a producer (permissionless access).
     */
    function request(bytes32 datahash) {
        certRequests[datahash] = msg.sender;
        certRequestedEvent(msg.sender, datahash);
    }

    event certConfirmedEvent(address by, bytes32 datahash);

    /*
     * With this function, a certificate (identified by its hash) is confirmed by a reviewer.
     */
    function confirm(bytes32 datahash) reviewersOnly {
        if(certRequests[datahash] == 0x0) {
            errLog("confirm_without_request");
            throw;
        }
        certConfirmedEvent(msg.sender, datahash);
    }

    /*
     * convenience function for confirming and issuing tokens in a single transaction
     */
    function confirmAndIssueTokens(bytes32 datahash, uint256 amount) {
        confirm(datahash);
        issueTokensFor(datahash, amount);
    }

    /*
     * Minimal example for a reviewer registration function - accessible only to the contract owner.
     * for convenient lookup, the reviewers are stored in a mapping (value: true only) instead of an array
     */
    mapping (address => bool) public reviewers;
    function addReviewer(address addr) ownerOnly {
        reviewers[addr] = true;
    }

    /*
     * Function modifiers are a convenient way to augment functions,
     * e.g. by adding preconditions and/or postconditions (in Solidity that's often used for access restrictions).
     * See http://solidity.readthedocs.io/en/develop/contracts.html#modifiers
     */
    modifier ownerOnly {
        if(msg.sender != owner) throw;
        _;
    }

    modifier reviewersOnly {
        /*
         * This code - if uncommented - would restrict access to functions with this modifier to registered reviewers.
         */
        /*
        if(! reviewers[msg.sender]) {
            errLog("unknown_reviewer");
            throw;
        }
        */
        _;
    }

    event certIssuedEvent(address by, bytes32 datahash);
    function issue(bytes32 datahash) ownerOnly {
        certIssuedEvent(msg.sender, datahash);
    }

    // ====== TOKEN FUNCTIONALITY=======

    string public name = "MethaneToken";
    string public symbol = "MET";
    uint8 public decimals = 0;
    uint256 public totalSupply = 0;

    mapping (address => uint256) public balanceOf;

    // unused - just for ERC20 compatibility (not sure if needed)
    mapping (address => mapping (address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);

    event tokensIssuedEvent(address receiver, uint256 amount);
    function issueTokensFor(bytes32 datahash, uint amount) reviewersOnly {
        if(certRequests[datahash] == 0x0) {
            errLog("unknown_datahash");
            throw;
        }
        var receiver = certRequests[datahash];
        balanceOf[receiver] += amount;
        totalSupply += amount;
        tokensIssuedEvent(receiver, amount);
    }

    function transfer(address _to, uint256 _value) {
        if (balanceOf[msg.sender] < _value) throw;           // Check if the sender has enough
        if (balanceOf[_to] + _value < balanceOf[_to]) throw; // Check for overflows
        balanceOf[msg.sender] -= _value;                     // Subtract from the sender
        balanceOf[_to] += _value;                            // Add the same to the recipient
        Transfer(msg.sender, _to, _value);                   // Notify anyone listening that this transfer took place
    }

    /* This unnamed function is called whenever someone tries to send ether to the contract */
    function () {
        errLog("ether_rejected");
        throw;     // Prevents accidental sending of ether
    }

    /*
     * Since the energy it reflects is a consumable,
     * this token would probably also need a burn/consume function which decreases totalSupply
     */
}