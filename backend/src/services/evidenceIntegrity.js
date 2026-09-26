import { createHash } from "node:crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

/*
 * Verdict — Quantum-Safe Evidence Integrity
 *
 * SHA-256 creates the evidence fingerprint.
 * ML-DSA-65 signs that fingerprint using a NIST-standardized
 * post-quantum digital signature algorithm.
 *
 * IMPORTANT:
 * Secret keys must remain on the backend.
 */

const SIGNATURE_ALGORITHM = "ML-DSA-65";
const HASH_ALGORITHM = "SHA-256";

/**
 * Convert Uint8Array/Buffer into Base64.
 */
function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Convert Base64 into Uint8Array.
 */
function fromBase64(value) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

/**
 * Produce a SHA-256 fingerprint of evidence bytes.
 */
export function hashEvidence(fileBytes) {
  if (!fileBytes) {
    throw new Error("Evidence bytes are required.");
  }

  return createHash("sha256")
    .update(Buffer.from(fileBytes))
    .digest("hex");
}

/**
 * Convert our SHA-256 hexadecimal fingerprint into bytes.
 *
 * We sign the actual 32-byte digest rather than its printable
 * hexadecimal representation.
 */
function hashHexToBytes(hash) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("Invalid SHA-256 fingerprint.");
  }

  return new Uint8Array(Buffer.from(hash, "hex"));
}

/**
 * Generate an ML-DSA-65 signing key pair.
 *
 * The secret key MUST NOT be returned to the frontend or stored
 * in the public evidence_integrity table.
 */
export function generateIntegrityKeyPair() {
  const { publicKey, secretKey } = ml_dsa65.keygen();

  return {
    publicKey: toBase64(publicKey),
    secretKey: toBase64(secretKey),
  };
}

/**
 * Sign an evidence SHA-256 fingerprint using ML-DSA-65.
 */
export function signEvidenceHash(fileHash, secretKeyBase64) {
  if (!secretKeyBase64) {
    throw new Error("Evidence integrity signing key is unavailable.");
  }

  const message = hashHexToBytes(fileHash);
  const secretKey = fromBase64(secretKeyBase64);

  const signature = ml_dsa65.sign(message, secretKey);

  return toBase64(signature);
}

/**
 * Verify the ML-DSA-65 signature protecting an evidence fingerprint.
 */
export function verifyEvidenceSignature({
  fileHash,
  signatureBase64,
  publicKeyBase64,
}) {
  if (!fileHash || !signatureBase64 || !publicKeyBase64) {
    return false;
  }

  try {
    const message = hashHexToBytes(fileHash);
    const signature = fromBase64(signatureBase64);
    const publicKey = fromBase64(publicKeyBase64);

    return ml_dsa65.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/**
 * Protect evidence bytes.
 *
 * Returns the values that may be stored in evidence_integrity.
 * The secret key is deliberately NOT returned.
 */
export function protectEvidence(fileBytes, secretKeyBase64, publicKeyBase64) {
  const fileHash = hashEvidence(fileBytes);

  const signature = signEvidenceHash(
    fileHash,
    secretKeyBase64
  );

  return {
    fileHash,
    hashAlgorithm: HASH_ALGORITHM,
    signature,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    publicKey: publicKeyBase64,
    integrityStatus: "protected",
  };
}

/**
 * Verify evidence against its protected integrity record.
 *
 * Both conditions must pass:
 *
 * 1. Current file SHA-256 equals the protected fingerprint.
 * 2. The ML-DSA-65 signature over that fingerprint is valid.
 */
export function verifyEvidenceIntegrity({
  fileBytes,
  storedFileHash,
  signatureBase64,
  publicKeyBase64,
}) {
  const currentFileHash = hashEvidence(fileBytes);

  const hashMatches = currentFileHash === storedFileHash;

  const signatureValid = verifyEvidenceSignature({
    fileHash: storedFileHash,
    signatureBase64,
    publicKeyBase64,
  });

  return {
    verified: hashMatches && signatureValid,
    hashMatches,
    signatureValid,
    currentFileHash,
    storedFileHash,
    integrityStatus:
      hashMatches && signatureValid ? "verified" : "changed",
  };
}

export const evidenceIntegrityAlgorithms = {
  hash: HASH_ALGORITHM,
  signature: SIGNATURE_ALGORITHM,
};