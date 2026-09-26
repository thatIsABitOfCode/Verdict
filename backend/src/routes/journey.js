import express from 'express';

import {
  createSupabaseClient,
} from '../lib/supabase.js';

const router = express.Router();

/*
 * ---------------------------------------------------------
 * AUTH HELPERS
 * ---------------------------------------------------------
 */

function getBearerToken(req) {
  const authHeader =
    req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [scheme, token] =
    authHeader.split(' ');

  if (
    scheme?.toLowerCase() !==
      'bearer' ||
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
      error:
        'Authentication required.',
      status: 401,
    };
  }

  const supabase =
    createSupabaseClient(
      accessToken
    );

  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser(
      accessToken
    );

  if (
    userError ||
    !userData?.user
  ) {
    return {
      error:
        'Invalid or expired session.',
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
 * JOURNEY ACTION KEY
 * ---------------------------------------------------------
 *
 * action_key is now stored in the database.
 *
 * It gives each generated action a stable identity
 * for one matter.
 *
 * Example:
 *
 * verified|verified_legal_topic|review verified guidance: rental deposit
 *
 * The database unique index then prevents two
 * concurrent sync requests from creating the same
 * generated action twice.
 */

function actionKey(action) {
  return [
    action.action_type,
    action.source_type,
    action.title,
  ]
    .map((value) =>
      String(value || '')
        .trim()
        .toLowerCase()
    )
    .join('|');
}

/*
 * PostgreSQL duplicate-key violation.
 *
 * We deliberately ignore this error when inserting
 * journey actions because it simply means another
 * sync request created the same action first.
 */

function isUniqueViolation(error) {
  return (
    error?.code === '23505' ||
    String(
      error?.message || ''
    )
      .toLowerCase()
      .includes(
        'duplicate key'
      )
  );
}

/*
 * ---------------------------------------------------------
 * GET /api/journey/health
 * ---------------------------------------------------------
 */

router.get(
  '/health',
  (req, res) => {
    res.json({
      ok: true,

      service:
        'Verdict Matter Journey Engine',
    });
  }
);

/*
 * ---------------------------------------------------------
 * POST /api/journey/sync
 * ---------------------------------------------------------
 *
 * Reads the current state of a matter and creates
 * appropriate journey actions.
 *
 * V1 creates:
 *
 * - safe preparation suggestions
 * - verified legal actions
 * - verified referral actions
 *
 * It does NOT calculate legal deadlines.
 */

router.post(
  '/sync',
  async (req, res) => {
    try {
      /*
       * Authenticate.
       */

      const auth =
        await authenticate(req);

      if (auth.error) {
        return res
          .status(auth.status)
          .json({
            error: auth.error,
          });
      }

      const {
        supabase,
        user,
        accessToken,
      } = auth;

      /*
       * Validate matter ID.
       */

      const matterId =
        typeof req.body
          ?.matterId ===
        'string'
          ? req.body.matterId
              .trim()
          : '';

      if (!matterId) {
        return res
          .status(400)
          .json({
            error:
              'A matter ID is required.',
          });
      }

      /*
       * -----------------------------------------------------
       * LOAD MATTER
       * -----------------------------------------------------
       */

      const {
        data: matter,
        error: matterError,
      } = await supabase
        .from('matters')
        .select(`
          id,
          user_id,
          title,
          story,
          incident_date,
          unsure_date,
          involved_type,
          involved_name,
          status,
          created_at,
          updated_at
        `)
        .eq(
          'id',
          matterId
        )
        .eq(
          'user_id',
          user.id
        )
        .single();

      if (
        matterError ||
        !matter
      ) {
        console.error(
          'Journey matter retrieval failed:',
          matterError
        );

        return res
          .status(404)
          .json({
            error:
              'Matter not found.',
          });
      }

      /*
       * -----------------------------------------------------
       * LOAD CURRENT MATTER STATE
       * -----------------------------------------------------
       */

      const [
        evidenceResult,
        timelineResult,
        calendarResult,
        actionsResult,
      ] = await Promise.all([
        /*
         * Evidence.
         */

        supabase
          .from('evidence')
          .select(
            `
              id,
              evidence_type,
              created_at
            `
          )
          .eq(
            'matter_id',
            matterId
          )
          .eq(
            'user_id',
            user.id
          ),

        /*
         * Timeline.
         */

        supabase
          .from(
            'timeline_events'
          )
          .select(
            `
              id,
              title,
              event_date,
              event_time,
              event_type,
              created_at
            `
          )
          .eq(
            'matter_id',
            matterId
          )
          .eq(
            'user_id',
            user.id
          ),

        /*
         * Calendar.
         */

        supabase
          .from(
            'calendar_events'
          )
          .select('*')
          .eq(
            'matter_id',
            matterId
          )
          .eq(
            'user_id',
            user.id
          ),

        /*
         * Existing journey actions.
         */

        supabase
          .from(
            'matter_actions'
          )
          .select('*')
          .eq(
            'matter_id',
            matterId
          )
          .eq(
            'user_id',
            user.id
          ),
      ]);

      if (
        evidenceResult.error
      ) {
        throw evidenceResult.error;
      }

      if (
        timelineResult.error
      ) {
        throw timelineResult.error;
      }

      if (
        calendarResult.error
      ) {
        throw calendarResult.error;
      }

      if (
        actionsResult.error
      ) {
        throw actionsResult.error;
      }

      const evidence =
        evidenceResult.data || [];

      const timeline =
        timelineResult.data || [];

      const calendarEvents =
        calendarResult.data || [];

      const existingActions =
        actionsResult.data || [];

      /*
       * -----------------------------------------------------
       * BACKFILL action_key ON EXISTING GENERATED ACTIONS
       * -----------------------------------------------------
       *
       * Some actions were created before the action_key
       * column existed.
       *
       * We safely populate their keys now.
       *
       * Completed and dismissed actions are included so
       * Verdict remembers them and does not recreate them.
       */

      for (
        const action of
        existingActions
      ) {
        if (
          action.action_key
        ) {
          continue;
        }

        const generatedKey =
          actionKey(action);

        if (!generatedKey) {
          continue;
        }

        const {
          error:
            backfillError,
        } = await supabase
          .from(
            'matter_actions'
          )
          .update({
            action_key:
              generatedKey,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            'id',
            action.id
          )
          .eq(
            'user_id',
            user.id
          );

        /*
         * If the unique index says this key already
         * exists, leave the old row alone.
         *
         * We do not want a harmless migration conflict
         * to break the user's journey.
         */

        if (
          backfillError &&
          !isUniqueViolation(
            backfillError
          )
        ) {
          throw backfillError;
        }

        if (
          !backfillError
        ) {
          action.action_key =
            generatedKey;
        }
      }

      /*
       * -----------------------------------------------------
       * BUILD JOURNEY CANDIDATES
       * -----------------------------------------------------
       */

      const candidates = [];

      /*
       * No evidence yet.
       */

      if (
        evidence.length === 0
      ) {
        candidates.push({
          title:
            'Add supporting evidence',

          description:
            'Add documents, screenshots, photographs, messages or other material that may help you keep a clear record of what happened.',

          action_type:
            'suggested',

          source_type:
            'matter_preparation',

          source_id: null,
        });
      }

      /*
       * No timeline yet.
       */

      if (
        timeline.length === 0
      ) {
        candidates.push({
          title:
            'Build your timeline',

          description:
            'Record important events, communications and dates in the order they happened.',

          action_type:
            'suggested',

          source_type:
            'matter_preparation',

          source_id: null,
        });
      }

      /*
       * Once evidence and a timeline both exist,
       * reviewing the case summary becomes useful.
       */

      if (
        evidence.length > 0 &&
        timeline.length > 0
      ) {
        candidates.push({
          title:
            'Review your case summary',

          description:
            'Review the information, timeline and evidence you have recorded so your matter is organised in one place.',

          action_type:
            'suggested',

          source_type:
            'case_preparation',

          source_id: null,
        });
      }

      /*
       * -----------------------------------------------------
       * VERIFIED LEGAL RETRIEVAL
       * -----------------------------------------------------
       *
       * Journey does not independently decide what legal
       * topic applies.
       *
       * It asks Verdict's existing verified legal
       * retrieval endpoint.
       */

      let legalResult = null;

      const story =
        matter.story?.trim();

      if (story) {
        try {
          const legalResponse =
            await fetch(
              'http://localhost:3001/api/legal/search',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',

                  Authorization:
                    `Bearer ${accessToken}`,
                },

                body:
                  JSON.stringify({
                    question:
                      story,
                  }),
              }
            );

          const rawText =
            await legalResponse
              .text();

          if (rawText) {
            try {
              legalResult =
                JSON.parse(
                  rawText
                );
            } catch {
              legalResult =
                null;
            }
          }

          if (
            !legalResponse.ok
          ) {
            console.error(
              'Journey legal retrieval failed:',
              legalResult
            );

            legalResult = null;
          }
        } catch (
          legalError
        ) {
          /*
           * Legal retrieval failure should not prevent
           * safe organisational actions from existing.
           */

          console.error(
            'Journey legal retrieval unavailable:',
            legalError
          );

          legalResult = null;
        }
      }

      /*
       * -----------------------------------------------------
       * VERIFIED LEGAL JOURNEY ACTIONS
       * -----------------------------------------------------
       *
       * These actions are created ONLY when the legal
       * retrieval service says coverage is verified.
       */

      if (
        legalResult?.coverage ===
          'verified' &&
        Array.isArray(
          legalResult.matches
        )
      ) {
        for (
          const match of
          legalResult.matches
        ) {
          const topicName =
            match?.topic?.name ||
            match?.issue?.name ||
            match?.domain?.name;

          if (!topicName) {
            continue;
          }

          /*
           * Verified guidance action.
           */

          candidates.push({
            title:
              `Review verified guidance: ${topicName}`,

            description:
              'Verdict has verified legal information relevant to this area. Review the guidance before deciding what to do next.',

            action_type:
              'verified',

            source_type:
              'verified_legal_topic',

            source_id:
              match?.topic?.id ||
              null,
          });

          /*
           * Verified referral/support action.
           */

          const referrals =
            Array.isArray(
              match?.referrals
            )
              ? match.referrals
              : [];

          if (
            referrals.length > 0
          ) {
            candidates.push({
              title:
                `Review support options for ${topicName}`,

              description:
                'Verdict has verified support or referral options associated with this legal area.',

              action_type:
                'verified',

              source_type:
                'verified_referral',

              source_id:
                match?.topic?.id ||
                null,
            });
          }
        }
      }

      /*
       * -----------------------------------------------------
       * DEDUPLICATE CANDIDATES INSIDE THIS SYNC
       * -----------------------------------------------------
       *
       * This prevents the candidate builder itself from
       * producing duplicate rows before we even check
       * the database.
       */

      const candidateMap =
        new Map();

      for (
        const candidate of
        candidates
      ) {
        const key =
          actionKey(candidate);

        if (
          !candidateMap.has(key)
        ) {
          candidateMap.set(
            key,
            {
              ...candidate,

              action_key: key,
            }
          );
        }
      }

      const uniqueCandidates =
        [
          ...candidateMap.values(),
        ];

      /*
       * -----------------------------------------------------
       * EXISTING KEYS
       * -----------------------------------------------------
       *
       * Prefer the stored database action_key.
       *
       * Fall back to calculating it for older rows.
       */

      const existingKeys =
        new Set(
          existingActions.map(
            (action) =>
              action.action_key ||
              actionKey(action)
          )
        );

      const newCandidates =
        uniqueCandidates.filter(
          (candidate) =>
            !existingKeys.has(
              candidate.action_key
            )
        );

      /*
       * -----------------------------------------------------
       * INSERT NEW ACTIONS
       * -----------------------------------------------------
       *
       * IMPORTANT:
       *
       * We insert actions individually.
       *
       * The database unique index protects:
       *
       * user_id + matter_id + action_key
       *
       * If two /sync requests run at the same moment,
       * one insert succeeds and the other receives
       * PostgreSQL error 23505.
       *
       * That duplicate error is expected and safely
       * ignored.
       */

      const createdActions = [];

      for (
        const candidate of
        newCandidates
      ) {
        const row = {
          user_id:
            user.id,

          matter_id:
            matterId,

          title:
            candidate.title,

          description:
            candidate.description,

          action_type:
            candidate.action_type,

          status:
            'pending',

          source_type:
            candidate.source_type,

          source_id:
            candidate.source_id ||
            null,

          action_key:
            candidate.action_key,
        };

        const {
          data,
          error,
        } = await supabase
          .from(
            'matter_actions'
          )
          .insert(row)
          .select('*')
          .single();

        if (error) {
          /*
           * Another concurrent sync already created
           * this exact action.
           *
           * The unique database index did its job.
           */

          if (
            isUniqueViolation(
              error
            )
          ) {
            continue;
          }

          throw error;
        }

        if (data) {
          createdActions.push(
            data
          );
        }
      }

      /*
       * -----------------------------------------------------
       * RETURN CURRENT JOURNEY
       * -----------------------------------------------------
       */

      const {
        data: currentActions,
        error:
          currentActionsError,
      } = await supabase
        .from(
          'matter_actions'
        )
        .select('*')
        .eq(
          'matter_id',
          matterId
        )
        .eq(
          'user_id',
          user.id
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

      if (
        currentActionsError
      ) {
        throw currentActionsError;
      }

      const actions =
        currentActions || [];

      const pendingActions =
        actions.filter(
          (action) =>
            action.status ===
            'pending'
        );

      return res.json({
        success: true,

        matter: {
          id: matter.id,

          title:
            matter.title,

          status:
            matter.status,
        },

        state: {
          evidenceCount:
            evidence.length,

          timelineCount:
            timeline.length,

          calendarEventCount:
            calendarEvents.length,
        },

        legalCoverage:
          legalResult?.coverage ||
          'unavailable',

        createdCount:
          createdActions.length,

        createdActions,

        actions,

        nextAction:
          pendingActions[0] ||
          null,

        safety: {
          legalDeadlinesCalculated:
            false,

          verifiedActionsRequireVerifiedCoverage:
            true,
        },
      });
    } catch (error) {
      console.error(
        'Journey sync failed:',
        error
      );

      return res
        .status(500)
        .json({
          error:
            'Unable to synchronise this matter journey.',
        });
    }
  }
);

/*
 * ---------------------------------------------------------
 * PATCH /api/journey/actions/:actionId
 * ---------------------------------------------------------
 *
 * Lets the user mark a journey action as:
 *
 * - completed
 * - dismissed
 *
 * Completed/dismissed actions remain stored.
 *
 * Their action_key also remains stored, meaning a future
 * sync cannot recreate an action the user already dealt
 * with.
 */

router.patch(
  '/actions/:actionId',
  async (req, res) => {
    try {
      /*
       * Authenticate.
       */

      const auth =
        await authenticate(req);

      if (auth.error) {
        return res
          .status(auth.status)
          .json({
            error: auth.error,
          });
      }

      const {
        supabase,
        user,
      } = auth;

      /*
       * Validate action ID.
       */

      const actionId =
        typeof req.params
          ?.actionId ===
        'string'
          ? req.params.actionId
              .trim()
          : '';

      if (!actionId) {
        return res
          .status(400)
          .json({
            error:
              'An action ID is required.',
          });
      }

      /*
       * Validate status.
       */

      const requestedStatus =
        typeof req.body
          ?.status ===
        'string'
          ? req.body.status
              .trim()
              .toLowerCase()
          : '';

      const allowedStatuses =
        new Set([
          'completed',
          'dismissed',
        ]);

      if (
        !allowedStatuses.has(
          requestedStatus
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'Status must be completed or dismissed.',
          });
      }

      /*
       * -----------------------------------------------------
       * LOAD ACTION
       * -----------------------------------------------------
       *
       * Scope it to the authenticated user.
       */

      const {
        data: existingAction,
        error:
          existingActionError,
      } = await supabase
        .from(
          'matter_actions'
        )
        .select('*')
        .eq(
          'id',
          actionId
        )
        .eq(
          'user_id',
          user.id
        )
        .single();

      if (
        existingActionError ||
        !existingAction
      ) {
        return res
          .status(404)
          .json({
            error:
              'Journey action not found.',
          });
      }

      let updatedAction =
        existingAction;

      /*
       * -----------------------------------------------------
       * IDEMPOTENT STATUS UPDATE
       * -----------------------------------------------------
       *
       * Repeated clicks do not create new timestamps
       * unnecessarily.
       */

      if (
        existingAction.status !==
        requestedStatus
      ) {
        const now =
          new Date()
            .toISOString();

        const updates = {
          status:
            requestedStatus,

          updated_at:
            now,
        };

        /*
         * Completed.
         */

        if (
          requestedStatus ===
          'completed'
        ) {
          updates.completed_at =
            now;

          updates.dismissed_at =
            null;
        }

        /*
         * Dismissed.
         */

        if (
          requestedStatus ===
          'dismissed'
        ) {
          updates.dismissed_at =
            now;

          updates.completed_at =
            null;
        }

        const {
          data,
          error,
        } = await supabase
          .from(
            'matter_actions'
          )
          .update(updates)
          .eq(
            'id',
            actionId
          )
          .eq(
            'user_id',
            user.id
          )
          .select('*')
          .single();

        if (error) {
          throw error;
        }

        updatedAction =
          data;
      }

      /*
       * -----------------------------------------------------
       * REFRESH JOURNEY
       * -----------------------------------------------------
       *
       * Return all actions so Matter Overview can
       * immediately advance to the next pending action.
       */

      const {
        data: currentActions,
        error:
          currentActionsError,
      } = await supabase
        .from(
          'matter_actions'
        )
        .select('*')
        .eq(
          'matter_id',
          updatedAction
            .matter_id
        )
        .eq(
          'user_id',
          user.id
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

      if (
        currentActionsError
      ) {
        throw currentActionsError;
      }

      const actions =
        currentActions || [];

      const nextAction =
        actions.find(
          (action) =>
            action.status ===
            'pending'
        ) || null;

      return res.json({
        success: true,

        action:
          updatedAction,

        actions,

        nextAction,

        matterId:
          updatedAction
            .matter_id,

        safety: {
          legalDeadlinesCalculated:
            false,

          verifiedActionsRequireVerifiedCoverage:
            true,
        },
      });
    } catch (error) {
      console.error(
        'Journey action update failed:',
        error
      );

      return res
        .status(500)
        .json({
          error:
            'Unable to update this journey action.',
        });
    }
  }
);

export default router;