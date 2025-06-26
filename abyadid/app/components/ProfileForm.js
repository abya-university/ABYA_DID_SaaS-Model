"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagonIcon,
  ArrowLeft,
  Clipboard,
  Loader,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useDid } from "../contexts/DidContext";
import { resolveDid } from "../services/didService";
import { storeDidDocument, storeStudentProfile } from "../services/ipfsService";
import { ethers } from "ethers";
import EthereumDIDRegistryArtifact from "../artifacts/contracts/did_contract.json";

const DidProfileForm = ({ setShowCreateProfileModal }) => {
  const navigate = useNavigate();
  const { ethrDid } = useDid();

  const [resolvedDid, setResolvedDid] = useState(null);
  const [owner, setOwner] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    secondName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    countryOfResidence: "",
    preferredLanguages: [""],
  });
  const [genderOptions] = useState(["Male", "Female", "Other"]);
  const [didCid, setDidCid] = useState("");
  const [profileCid, setProfileCid] = useState("");
  const [docTxHash, setDocTxHash] = useState("");
  const [profileTxHash, setProfileTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Resolve DID document
  useEffect(() => {
    if (!ethrDid) return;
    (async () => {
      try {
        const resolved = await resolveDid(
          ethrDid,
          process.env.NEXT_PUBLIC_RPC_URL,
          process.env.NEXT_PUBLIC_DID_REGISTRY_CONTRACT_ADDRESS
        );
        setResolvedDid(resolved);
      } catch (err) {
        console.error("Error resolving DID:", err);
      }
    })();
  }, [ethrDid]);

  // Provider & signer helpers
  const getProvider = () =>
    new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
  const getBrowserSigner = async () => {
    if (!window.ethereum) throw new Error("No Ethereum provider");
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    return browserProvider.getSigner();
  };

  // Fetch on-chain CIDs
  const fetchOnChainCIDs = async (identityAddress) => {
    const provider = getProvider();
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_DID_REGISTRY_CONTRACT_ADDRESS,
      EthereumDIDRegistryArtifact.abi,
      provider
    );
    const existingDocCid = await contract.getDIDDocumentCID(identityAddress);
    const existingProfileCid = await contract.getProfileCID(identityAddress);
    return { existingDocCid, existingProfileCid };
  };

  // Form handlers
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field, index, value) => {
    const arr = [...formData[field]];
    arr[index] = value;
    setFormData((prev) => ({ ...prev, [field]: arr }));
  };

  const addArrayItem = (field) => {
    setFormData((prev) => ({ ...prev, [field]: [...prev[field], ""] }));
  };

  const removeArrayItem = (field, index) => {
    const arr = formData[field].filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, [field]: arr }));
  };

  const handleCreateProfile = async () => {
    setError("");
    setSuccessMessage("");

    const {
      firstName,
      secondName,
      dateOfBirth,
      gender,
      email,
      countryOfResidence,
    } = formData;
    if (!ethrDid) return setError("Connect wallet first");
    if (
      !firstName ||
      !secondName ||
      !dateOfBirth ||
      !gender ||
      !email ||
      !countryOfResidence
    )
      return setError("All profile fields are required");

    setLoading(true);
    try {
      const identityAddress = ethrDid.split(":")[3];
      const provider = getProvider();
      const contractRead = new ethers.Contract(
        process.env.NEXT_PUBLIC_DID_REGISTRY_CONTRACT_ADDRESS,
        EthereumDIDRegistryArtifact.abi,
        provider
      );

      // Verify owner
      const ownerAddr = await contractRead.identityOwner(identityAddress);
      setOwner(ownerAddr);

      // Check existing on-chain
      const { existingDocCid, existingProfileCid } = await fetchOnChainCIDs(
        identityAddress
      );

      // IPFS store as needed
      const cidDoc =
        existingDocCid || (await storeDidDocument(ethrDid, resolvedDid));
      setDidCid(cidDoc);

      const cidProfile =
        existingProfileCid ||
        (await storeStudentProfile(ethrDid, {
          did: ethrDid,
          owner: ownerAddr,
          profile: { ...formData },
          didDocumentCid: cidDoc,
          timestamp: new Date().toISOString(),
        }));
      setProfileCid(cidProfile);

      // On-chain writes
      const signer = await getBrowserSigner();
      const contractWrite = new ethers.Contract(
        process.env.NEXT_PUBLIC_DID_REGISTRY_CONTRACT_ADDRESS,
        EthereumDIDRegistryArtifact.abi,
        signer
      );

      let created = false;
      if (!existingDocCid) {
        const tx1 = await contractWrite.setDIDDocumentCID(
          identityAddress,
          cidDoc
        );
        const receipt1 = await tx1.wait();
        setDocTxHash(receipt1.transactionHash);
        created = true;
      }
      if (!existingProfileCid) {
        const tx2 = await contractWrite.setProfileCID(
          identityAddress,
          cidProfile
        );
        const receipt2 = await tx2.wait();
        setProfileTxHash(receipt2.transactionHash);
        created = true;
      }

      // Messaging
      if (existingDocCid || existingProfileCid) {
        setSuccessMessage(
          created
            ? "New parts of profile stored; existing fields were skipped."
            : "A profile already exists; nothing was changed."
        );
      } else {
        setSuccessMessage("Profile successfully created on IPFS and on-chain!");
        setTimeout(() => {
          setShowCreateProfileModal(false);
        }, 2000);
      }
    } catch (err) {
      setError(err.message || "Error creating profile");
    } finally {
      setLoading(false);
    }
  };

  if (!ethrDid) {
    return (
      <p className="p-4 text-red-500 flex items-center">
        <AlertOctagonIcon size={24} className="mr-2" />
        Please connect your wallet first.
      </p>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Create DID Profile</h2>
          <button
            onClick={() => setShowCreateProfileModal(false)} className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-400 mb-2">
            <span className="px-2 py-1 bg-blue-600 rounded-md text-xs">DID</span>
            <span className="font-mono truncate">{ethrDid}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(ethrDid);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
              }}
              className="text-gray-500 hover:text-gray-300"
            >
              <Clipboard size={16} />
            </button>
            {copySuccess && <span className="text-green-500 text-xs">Copied!</span>}
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-2 dark:text-gray-200">
          DID Document
        </h2>
        <div className="w-full max-w-4xl mx-auto dark:bg-gray-700">
          {/* Toggle Header */}
          <div
            onClick={() => setIsVisible((prev) => !prev)}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-3 rounded-lg transition-colors group"
          >
            <div className="flex-shrink-0">
              {isVisible ? (
                <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
              DID Resolution Details
            </span>
            <div className="flex-1"></div>
            <span className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {isVisible ? "Click to hide" : "Click to expand"}
            </span>
          </div>

          {/* Resolved DID Section */}
          {isVisible && (
            <div className="mt-2 border-l-2 border-gray-200 dark:border-gray-600 ml-6 pl-4">
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-mono text-gray-600 dark:text-cyan-100">
                    Resolved DID Document
                  </span>
                </div>
                <pre className="p-4 m-4 text-xs font-mono text-gray-800 dark:text-cyan-50 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                  {JSON.stringify(resolvedDid, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Personal Information */}
        <section className="bg-gray-800 p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b border-gray-300 pb-2">
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Second Name
              </label>
              <input
                type="text"
                value={formData.secondName}
                onChange={(e) => handleInputChange("secondName", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleInputChange("gender", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:text-gray-700"
              >
                <option value="">Select Gender</option>
                {genderOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Country of Residence
              </label>
              <input
                type="text"
                value={formData.countryOfResidence}
                onChange={(e) =>
                  handleInputChange("countryOfResidence", e.target.value)
                }
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:text-gray-700"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
              Preferred Languages
            </label>
            {formData.preferredLanguages.map((lang, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={lang}
                  onChange={(e) =>
                    handleArrayChange("preferredLanguages", index, e.target.value)
                  }
                  className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:text-gray-700"
                  placeholder="Language"
                />
                <button
                  type="button"
                  onClick={() => removeArrayItem("preferredLanguages", index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addArrayItem("preferredLanguages")}
              className="flex items-center gap-1 text-yellow-600 hover:text-yellow-800"
            >
              <Plus size={16} /> Add Language
            </button>
          </div>
        </section>

        <div className="flex space-x-4 mt-6">
          <button
            onClick={() => setShowCreateProfileModal(false)} className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateProfile}
            disabled={loading}
            className={`flex-1 px-5 py-2.5 rounded-lg text-white flex items-center justify-center ${loading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all duration-300"
              }`}
          >
            {loading ? (
              <Loader className="animate-spin mr-2" size={18} />
            ) : (
              "Create Profile"
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-green-900/50 border border-green-700 text-green-200 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        {(didCid || profileCid) && (
          <div className="mt-4 text-sm space-y-1">
            {didCid && (
              <p>
                <strong>DID Doc CID:</strong> {didCid}
              </p>
            )}
            {profileCid && (
              <p>
                <strong>Profile CID:</strong> {profileCid}
              </p>
            )}
            {docTxHash && (
              <p>
                <strong>Doc TX:</strong> {docTxHash}
              </p>
            )}
            {profileTxHash && (
              <p>
                <strong>Profile TX:</strong> {profileTxHash}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DidProfileForm;
