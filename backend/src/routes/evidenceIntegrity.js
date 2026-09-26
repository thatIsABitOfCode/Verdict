import express from "express";

import {
  createSupabaseClient,
} from "../lib/supabase.js";

import {
  supabaseAdmin,
} from "../lib/supabaseAdmin.js";

import {
  protectEvidence,
  verifyEvidenceIntegrity,
} from "../services/evidenceIntegrity.js";

const router = express.Router();

const PUBLIC_KEY =
  process.env.VERDICT_EVIDENCE_MLDSA_PUBLIC_KEY;

const SECRET_KEY =
  process.env.VERDICT_EVIDENCE_MLDSA_SECRET_KEY;

if (!PUBLIC_KEY || !SECRET_KEY) {
  throw new Error(
    "Verdict evidence ML-DSA keys are missing from backend/.env"
  );
}

/*
 * ---------------------------------------------------------
 * AUTH
 * ---------------------------------------------------------
 */

function getBearerToken(req) {
  const authHeader =
    req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [scheme, token] =
    authHeader.split(" ");

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

async function authenticate(req) {
  const accessToken =
    getBearerToken(req);

  if (!accessToken) {
    return {
      error: "Authentication required.",
      status: 401,
    };
  }

  const supabase =
    createSupabaseClient(accessToken);

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser(
    accessToken
  );

  if (
    userError ||
    !userData?.user
  ) {
    return {
      error: "Invalid or expired session.",
      status: 401,
    };
  }

  return {
    supabase,
    user: userData.user,
    accessToken,
  };
}

/*
 * ---------------------------------------------------------
 * LOAD OWNED EVIDENCE
 * ---------------------------------------------------------
 *
 * This query uses the USER-SCOPED client.
 *
 * That means we do not trust evidenceId by itself.
 * Supabase RLS + the explicit user_id check must both
 * allow the evidence row to be retrieved.
 */

async function getOwnedEvidence({
  supabase,
  userId,
  evidenceId,
}) {
  const {
    data,
    error,
  } = await supabase
    .from("evidence")
    .select(`
      id,
      user_id,
      matter_id,
      file_name,
      storage_path,
      file_type,
      file_size,
      created_at
    `)
    .eq("id", evidenceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
  throw new Error(
    `Could not retrieve evidence: ${error.message}`
  );
}

if (!data) return null;

// The storage client has privileged access, so check the
// parent matter and file path before downloading the file.
const {
  data: matter,
  error: matterError,
} = await supabase
  .from("matters")
  .select("id")
  .eq("id", data.matter_id)
  .eq("user_id", userId)
  .maybeSingle();

if (matterError) throw matterError;

if (
  !matter ||
  typeof data.storage_path !== "string" ||
  !data.storage_path.startsWith(
    `${userId}/${data.matter_id}/`
  )
) {
  return null;
}

return data;
}

/*
 * ---------------------------------------------------------
 * DOWNLOAD EVIDENCE
 * ---------------------------------------------------------
 */

async function downloadEvidence(storagePath) {
  const {
    data,
    error,
  } = await supabaseAdmin.storage
    .from("evidence")
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `Could not download evidence: ${
        error?.message || "File unavailable."
      }`
    );
  }

  const arrayBuffer =
    await data.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

/*
 * ---------------------------------------------------------
 * PROTECT EVIDENCE
 * ---------------------------------------------------------
 *
 * POST /api/evidence-integrity/protect
 *
 * Body:
 * {
 *   "evidenceId": "..."
 * }
 *
 * IMPORTANT:
 * This endpoint is intentionally idempotent.
 *
 * If an integrity record already exists, we DO NOT
 * silently generate a new trusted fingerprint.
 */

router.post(
  "/protect",
  async (req, res) => {
    try {
      const auth =
        await authenticate(req);

      if (auth.error) {
        return res
          .status(auth.status)
          .json({
            error: auth.error,
          });
      }

      const evidenceId =
        String(
          req.body?.evidenceId || ""
        ).trim();

      if (!evidenceId) {
        return res.status(400).json({
          error:
            "evidenceId is required.",
        });
      }

      const evidence =
        await getOwnedEvidence({
          supabase: auth.supabase,
          userId: auth.user.id,
          evidenceId,
        });

      if (!evidence) {
        return res.status(404).json({
          error:
            "Evidence was not found.",
        });
      }

      /*
       * Check for an existing record using the
       * privileged backend client.
       */
      const {
        data: existing,
        error: existingError,
      } = await supabaseAdmin
        .from("evidence_integrity")
        .select(`
          id,
          evidence_id,
          file_hash,
          hash_algorithm,
          signature_algorithm,
          integrity_status,
          protected_at,
          last_verified_at
        `)
        .eq(
          "evidence_id",
          evidence.id
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Integrity lookup failed:",
          existingError
        );

        return res.status(500).json({
          error:
            "Could not check the evidence integrity record.",
        });
      }

      if (existing) {
        return res.json({
          protected: true,
          alreadyProtected: true,
          integrity: {
            evidenceId:
              existing.evidence_id,
            hashAlgorithm:
              existing.hash_algorithm,
            signatureAlgorithm:
              existing.signature_algorithm,
            status:
              existing.integrity_status,
            protectedAt:
              existing.protected_at,
            lastVerifiedAt:
              existing.last_verified_at,
          },
        });
      }

      const fileBytes =
        await downloadEvidence(
          evidence.storage_path
        );

      const protection =
        protectEvidence(
          fileBytes,
          SECRET_KEY,
          PUBLIC_KEY
        );

      const {
        data: integrityRecord,
        error: insertError,
      } = await supabaseAdmin
        .from("evidence_integrity")
        .insert({
          evidence_id:
            evidence.id,

          user_id:
            auth.user.id,

          matter_id:
            evidence.matter_id,

          file_hash:
            protection.fileHash,

          hash_algorithm:
            protection.hashAlgorithm,

          signature:
            protection.signature,

          signature_algorithm:
            protection.signatureAlgorithm,

          public_key:
            protection.publicKey,

          integrity_status:
            "protected",
        })
        .select(`
          id,
          evidence_id,
          hash_algorithm,
          signature_algorithm,
          integrity_status,
          protected_at,
          last_verified_at
        `)
        .single();

      if (insertError) {
        /*
         * Because evidence_id is UNIQUE, two protect
         * requests arriving at almost the same time
         * cannot create two integrity records.
         */
        if (
          insertError.code === "23505"
        ) {
          const {
            data: concurrentRecord,
          } = await supabaseAdmin
            .from(
              "evidence_integrity"
            )
            .select(`
              evidence_id,
              hash_algorithm,
              signature_algorithm,
              integrity_status,
              protected_at,
              last_verified_at
            `)
            .eq(
              "evidence_id",
              evidence.id
            )
            .maybeSingle();

          if (concurrentRecord) {
            return res.json({
              protected: true,
              alreadyProtected: true,
              integrity: {
                evidenceId:
                  concurrentRecord.evidence_id,
                hashAlgorithm:
                  concurrentRecord.hash_algorithm,
                signatureAlgorithm:
                  concurrentRecord.signature_algorithm,
                status:
                  concurrentRecord.integrity_status,
                protectedAt:
                  concurrentRecord.protected_at,
                lastVerifiedAt:
                  concurrentRecord.last_verified_at,
              },
            });
          }
        }

        console.error(
          "Integrity insert failed:",
          insertError
        );

        return res.status(500).json({
          error:
            "Could not create the evidence integrity record.",
        });
      }

      return res.status(201).json({
        protected: true,
        alreadyProtected: false,

        integrity: {
          evidenceId:
            integrityRecord.evidence_id,

          hashAlgorithm:
            integrityRecord.hash_algorithm,

          signatureAlgorithm:
            integrityRecord.signature_algorithm,

          status:
            integrityRecord.integrity_status,

          protectedAt:
            integrityRecord.protected_at,

          lastVerifiedAt:
            integrityRecord.last_verified_at,
        },
      });
    } catch (error) {
      console.error(
        "Evidence protection failed:",
        error
      );

      return res.status(500).json({
        error:
          "Evidence protection failed.",
      });
    }
  }
);

/*
 * ---------------------------------------------------------
 * VERIFY EVIDENCE
 * ---------------------------------------------------------
 *
 * POST /api/evidence-integrity/:evidenceId/verify
 */

router.post(
  "/:evidenceId/verify",
  async (req, res) => {
    try {
      const auth =
        await authenticate(req);

      if (auth.error) {
        return res
          .status(auth.status)
          .json({
            error: auth.error,
          });
      }

      const evidenceId =
        String(
          req.params.evidenceId || ""
        ).trim();

      if (!evidenceId) {
        return res.status(400).json({
          error:
            "Evidence ID is required.",
        });
      }

      /*
       * Ownership check happens BEFORE any privileged
       * integrity lookup or storage download.
       */
      const evidence =
        await getOwnedEvidence({
          supabase: auth.supabase,
          userId: auth.user.id,
          evidenceId,
        });

      if (!evidence) {
        return res.status(404).json({
          error:
            "Evidence was not found.",
        });
      }

      const {
        data: integrityRecord,
        error: integrityError,
      } = await supabaseAdmin
        .from("evidence_integrity")
        .select(`
          id,
          evidence_id,
          user_id,
          matter_id,
          file_hash,
          hash_algorithm,
          signature,
          signature_algorithm,
          public_key,
          integrity_status,
          protected_at,
          last_verified_at
        `)
        .eq(
          "evidence_id",
          evidence.id
        )
        .eq(
          "user_id",
          auth.user.id
        )
        .maybeSingle();

      if (integrityError) {
        console.error(
          "Integrity retrieval failed:",
          integrityError
        );

        return res.status(500).json({
          error:
            "Could not retrieve the integrity record.",
        });
      }

      if (!integrityRecord) {
        return res.status(404).json({
          error:
            "This evidence has not been integrity-protected yet.",
        });
      }

      const fileBytes =
        await downloadEvidence(
          evidence.storage_path
        );

      const result =
        verifyEvidenceIntegrity({
          fileBytes,

          storedFileHash:
            integrityRecord.file_hash,

          signatureBase64:
            integrityRecord.signature,

          publicKeyBase64:
            integrityRecord.public_key,
        });

      const verifiedAt =
        new Date().toISOString();

      /*
       * Only the trusted backend changes the status.
       */
      const {
        error: updateError,
      } = await supabaseAdmin
        .from("evidence_integrity")
        .update({
          integrity_status:
            result.integrityStatus,

          last_verified_at:
            verifiedAt,
        })
        .eq(
          "id",
          integrityRecord.id
        )
        .eq(
          "user_id",
          auth.user.id
        );

      if (updateError) {
        console.error(
          "Integrity status update failed:",
          updateError
        );

        return res.status(500).json({
          error:
            "The evidence was checked, but its verification status could not be saved.",
        });
      }

      return res.json({
        verified:
          result.verified,

        integrity: {
          evidenceId:
            evidence.id,

          status:
            result.integrityStatus,

          hashMatches:
            result.hashMatches,

          signatureValid:
            result.signatureValid,

          hashAlgorithm:
            integrityRecord.hash_algorithm,

          signatureAlgorithm:
            integrityRecord.signature_algorithm,

          protectedAt:
            integrityRecord.protected_at,

          lastVerifiedAt:
            verifiedAt,
        },

        message:
          result.verified
            ? "Evidence integrity verified. The current file matches its protected fingerprint and the ML-DSA-65 signature is valid."
            : "Evidence integrity could not be verified. The current file does not match its protected integrity record.",
      });
    } catch (error) {
      console.error(
        "Evidence verification failed:",
        error
      );

      return res.status(500).json({
        error:
          "Evidence verification failed.",
      });
    }
  }
);

export default router;