// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EthereumDIDRegistry is ERC20, Ownable {
    
    // =================== EXISTING DID STORAGE ===================
    // Store ownership of DIDs
    mapping(address => address) public owners;
    mapping(address => mapping(bytes32 => mapping(address => uint))) public delegates;
    mapping(address => uint) public changed;
    mapping(address => uint) public nonce;

    // Store CIDs for Profile and DID Document
    mapping(address => string) private profileCIDs;
    mapping(address => string) private didDocumentCIDs;

    // =================== NEW ORGANIZATION STORAGE ===================
    struct Organization {
        string name;
        address admin;
        uint256 totalCredits;
        uint256 usedCredits;
        bool isActive;
        uint256 createdAt;
        address[] members;
    }

    mapping(bytes32 => Organization) public organizations; // orgId => Organization
    mapping(address => bytes32) public userToOrganization; // user address => orgId
    mapping(address => bool) public hasDID; // track if user has created DID
    
    bytes32[] public organizationIds;
    
    uint256 public constant INITIAL_FREE_CREDITS = 100;
    uint256 public constant CREDITS_PER_TOKEN = 1; // 1 token = 1 credit = 1 DID

    // =================== EXISTING DID EVENTS ===================
    event DIDOwnerChanged(
        address indexed identity,
        address owner,
        uint previousChange
    );

    event DIDDelegateChanged(
        address indexed identity,
        bytes32 delegateType,
        address delegate,
        uint validTo,
        uint previousChange
    );

    event DIDAttributeChanged(
        address indexed identity,
        bytes32 name,
        bytes value,
        uint validTo,
        uint previousChange
    );

    event ProfileCIDUpdated(address indexed identity, string cid);
    event DIDDocumentCIDUpdated(address indexed identity, string cid);

    // =================== NEW ORGANIZATION EVENTS ===================
    event OrganizationCreated(
        bytes32 indexed orgId,
        string name,
        address indexed admin,
        uint256 initialCredits
    );

    event UserAddedToOrganization(
        bytes32 indexed orgId,
        address indexed user
    );

    event CreditsAdded(
        bytes32 indexed orgId,
        uint256 amount,
        address indexed admin
    );

    event DIDCreated(
        address indexed user,
        bytes32 indexed orgId,
        uint256 creditsRemaining
    );

    // =================== MODIFIERS ===================
    modifier onlyOwner(address identity, address actor) {
        require(actor == identityOwner(identity), "bad_actor");
        _;
    }

    modifier onlyOrgAdmin(bytes32 orgId) {
        require(organizations[orgId].admin == msg.sender, "only_org_admin");
        require(organizations[orgId].isActive, "org_not_active");
        _;
    }

    modifier orgExists(bytes32 orgId) {
        require(organizations[orgId].admin != address(0), "org_not_exists");
        _;
    }

    constructor() ERC20("ABYADIDToken", "ABYADID") Ownable(msg.sender) {
        // Initialize the contract with a name and symbol
    }

    // =================== ORGANIZATION MANAGEMENT FUNCTIONS ===================
    
    function createOrganization(
        string memory name,
        address admin
    ) external onlyOwner returns (bytes32) {
        bytes32 orgId = keccak256(abi.encodePacked(name, admin, block.timestamp));
        
        require(organizations[orgId].admin == address(0), "org_already_exists");
        
        organizations[orgId] = Organization({
            name: name,
            admin: admin,
            totalCredits: INITIAL_FREE_CREDITS,
            usedCredits: 0,
            isActive: true,
            createdAt: block.timestamp,
            members: new address[](0)
        });
        
        organizationIds.push(orgId);
        
        emit OrganizationCreated(orgId, name, admin, INITIAL_FREE_CREDITS);
        
        return orgId;
    }

    function addUserToOrganization(
        bytes32 orgId,
        address user
    ) external onlyOrgAdmin(orgId) {
        require(userToOrganization[user] == bytes32(0), "user_already_in_org");
        
        userToOrganization[user] = orgId;
        organizations[orgId].members.push(user);
        
        emit UserAddedToOrganization(orgId, user);
    }

    function removeUserFromOrganization(
        bytes32 orgId,
        address user
    ) external onlyOrgAdmin(orgId) {
        require(userToOrganization[user] == orgId, "user_not_in_org");
        
        userToOrganization[user] = bytes32(0);
        
        // Remove from members array
        address[] storage members = organizations[orgId].members;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == user) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
    }

    function purchaseCredits(bytes32 orgId, uint256 tokenAmount) external onlyOrgAdmin(orgId) {
        require(balanceOf(msg.sender) >= tokenAmount, "insufficient_tokens");
        
        // Burn tokens to purchase credits
        _burn(msg.sender, tokenAmount);
        
        uint256 creditsToAdd = tokenAmount * CREDITS_PER_TOKEN;
        organizations[orgId].totalCredits += creditsToAdd;
        
        emit CreditsAdded(orgId, creditsToAdd, msg.sender);
    }

    function mintTokensForOrganization(address admin, uint256 amount) external onlyOwner {
        _mint(admin, amount);
    }

    // =================== DID CREATION WITH CREDIT SYSTEM ===================
    
    function createDIDForUser(address user) external returns (bool) {
        bytes32 orgId = userToOrganization[user];
        require(orgId != bytes32(0), "user_not_in_organization");
        require(!hasDID[user], "user_already_has_did");
        
        Organization storage org = organizations[orgId];
        require(org.isActive, "organization_not_active");
        require(org.totalCredits > org.usedCredits, "insufficient_credits");
        
        // Use one credit
        org.usedCredits += 1;
        hasDID[user] = true;
        
        emit DIDCreated(user, orgId, org.totalCredits - org.usedCredits);
        
        return true;
    }

    // =================== VIEW FUNCTIONS ===================
    
    function getOrganizationInfo(bytes32 orgId) external view orgExists(orgId) returns (
        string memory name,
        address admin,
        uint256 totalCredits,
        uint256 usedCredits,
        uint256 remainingCredits,
        bool isActive,
        uint256 memberCount
    ) {
        Organization storage org = organizations[orgId];
        return (
            org.name,
            org.admin,
            org.totalCredits,
            org.usedCredits,
            org.totalCredits - org.usedCredits,
            org.isActive,
            org.members.length
        );
    }

    function getUserOrganization(address user) external view returns (bytes32) {
        return userToOrganization[user];
    }

    function canUserCreateDID(address user) external view returns (bool) {
        bytes32 orgId = userToOrganization[user];
        if (orgId == bytes32(0)) return false;
        if (hasDID[user]) return false;
        
        Organization storage org = organizations[orgId];
        return org.isActive && (org.totalCredits > org.usedCredits);
    }

    function getOrganizationMembers(bytes32 orgId) external view orgExists(orgId) returns (address[] memory) {
        return organizations[orgId].members;
    }

    function getTotalOrganizations() external view returns (uint256) {
        return organizationIds.length;
    }

    function getOrganizationByIndex(uint256 index) external view returns (bytes32) {
        require(index < organizationIds.length, "index_out_of_bounds");
        return organizationIds[index];
    }

    // =================== EXISTING DID FUNCTIONS (UNCHANGED) ===================
    
    function identityOwner(address identity) public view returns(address) {
        address owner = owners[identity];
        if (owner != address(0x00)) {
            return owner;
        }
        return identity;
    }

    function checkSignature(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 hash) internal returns(address) {
        address signer = ecrecover(hash, sigV, sigR, sigS);
        require(signer == identityOwner(identity), "bad_signature");
        nonce[signer]++;
        return signer;
    }

    function validDelegate(address identity, bytes32 delegateType, address delegate) public view returns(bool) {
        uint validity = delegates[identity][keccak256(abi.encode(delegateType))][delegate];
        return (validity > block.timestamp);
    }

    function changeOwner(address identity, address actor, address newOwner) internal onlyOwner(identity, actor) {
        owners[identity] = newOwner;
        emit DIDOwnerChanged(identity, newOwner, changed[identity]);
        changed[identity] = block.number;
    }

    function changeOwner(address identity, address newOwner) public {
        changeOwner(identity, msg.sender, newOwner);
    }

    function changeOwnerSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, address newOwner) public {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0x19), bytes1(0), this, nonce[identityOwner(identity)], identity, "changeOwner", newOwner));
        changeOwner(identity, checkSignature(identity, sigV, sigR, sigS, hash), newOwner);
    }

    function addDelegate(address identity, address actor, bytes32 delegateType, address delegate, uint validity) internal onlyOwner(identity, actor) {
        delegates[identity][keccak256(abi.encode(delegateType))][delegate] = block.timestamp + validity;
        emit DIDDelegateChanged(identity, delegateType, delegate, block.timestamp + validity, changed[identity]);
        changed[identity] = block.number;
    }

    function addDelegate(address identity, bytes32 delegateType, address delegate, uint validity) public {
        addDelegate(identity, msg.sender, delegateType, delegate, validity);
    }

    function addDelegateSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 delegateType, address delegate, uint validity) public {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0x19), bytes1(0), this, nonce[identityOwner(identity)], identity, "addDelegate", delegateType, delegate, validity));
        addDelegate(identity, checkSignature(identity, sigV, sigR, sigS, hash), delegateType, delegate, validity);
    }

    function revokeDelegate(address identity, address actor, bytes32 delegateType, address delegate) internal onlyOwner(identity, actor) {
        delegates[identity][keccak256(abi.encode(delegateType))][delegate] = block.timestamp;
        emit DIDDelegateChanged(identity, delegateType, delegate, block.timestamp, changed[identity]);
        changed[identity] = block.number;
    }

    function revokeDelegate(address identity, bytes32 delegateType, address delegate) public {
        revokeDelegate(identity, msg.sender, delegateType, delegate);
    }

    function revokeDelegateSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 delegateType, address delegate) public {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0x19), bytes1(0), this, nonce[identityOwner(identity)], identity, "revokeDelegate", delegateType, delegate));
        revokeDelegate(identity, checkSignature(identity, sigV, sigR, sigS, hash), delegateType, delegate);
    }

    function setAttribute(address identity, address actor, bytes32 name, bytes memory value, uint validity) internal onlyOwner(identity, actor) {
        emit DIDAttributeChanged(identity, name, value, block.timestamp + validity, changed[identity]);
        changed[identity] = block.number;
    }

    function setAttribute(address identity, bytes32 name, bytes memory value, uint validity) public {
        setAttribute(identity, msg.sender, name, value, validity);
    }

    function setAttributeSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 name, bytes memory value, uint validity) public {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0x19), bytes1(0), this, nonce[identityOwner(identity)], identity, "setAttribute", name, value, validity));
        setAttribute(identity, checkSignature(identity, sigV, sigR, sigS, hash), name, value, validity);
    }

    function revokeAttribute(address identity, address actor, bytes32 name, bytes memory value) internal onlyOwner(identity, actor) {
        emit DIDAttributeChanged(identity, name, value, 0, changed[identity]);
        changed[identity] = block.number;
    }

    function revokeAttribute(address identity, bytes32 name, bytes memory value) public {
        revokeAttribute(identity, msg.sender, name, value);
    }

    function revokeAttributeSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 name, bytes memory value) public {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0x19), bytes1(0), this, nonce[identityOwner(identity)], identity, "revokeAttribute", name, value));
        revokeAttribute(identity, checkSignature(identity, sigV, sigR, sigS, hash), name, value);
    }

    // =================== EXISTING PROFILE STORAGE FUNCTIONS ===================

    function setProfileCID(address identity, string memory cid) public onlyOwner(identity, msg.sender) {
        profileCIDs[identity] = cid;
        emit ProfileCIDUpdated(identity, cid);
    }

    function getProfileCID(address identity) public view returns (string memory) {
        return profileCIDs[identity];
    }

    function setDIDDocumentCID(address identity, string memory cid) public onlyOwner(identity, msg.sender) {
        didDocumentCIDs[identity] = cid;
        emit DIDDocumentCIDUpdated(identity, cid);
    }

    function getDIDDocumentCID(address identity) public view returns (string memory) {
        return didDocumentCIDs[identity];
    }
}