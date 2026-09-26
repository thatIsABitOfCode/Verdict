import express from 'express';

import { createSupabaseClient } from '../lib/supabase.js';
import { readAttachment } from '../services/attachmentReader.js';
import { answerVerdictProductQuestion } from '../services/productHelp.js';
import {
  classifyLegalTopics,
  identifyPreparationGaps,
  reasonOverVerifiedLegalKnowledge,
} from '../services/legalReasoner.js';

const router = express.Router();

function getBearerToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');

  if (
    scheme?.toLowerCase() !== 'bearer' ||
    !token
  ) {
    return null;
  }

  return token;
}

function normaliseText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchTerms(question) {
  const stopWords = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'been',
    'but',
    'by',
    'can',
    'could',
    'did',
    'do',
    'does',
    'for',
    'from',
    'had',
    'has',
    'have',
    'he',
    'her',
    'hers',
    'him',
    'his',
    'how',
    'i',
    'if',
    'in',
    'into',
    'is',
    'it',
    'its',
    'me',
    'my',
    'of',
    'on',
    'or',
    'our',
    'she',
    'should',
    'so',
    'that',
    'the',
    'their',
    'them',
    'they',
    'this',
    'to',
    'was',
    'we',
    'were',
    'what',
    'when',
    'where',
    'which',
    'who',
    'why',
    'will',
    'with',
    'would',
    'you',

    /*
     * Common narrative words that do not help
     * identify the legal topic.
     */
    'not',
    'still',
    'ago',
    'few',
    'back',
    'out',
    'your',
  ]);

  return normaliseText(question)
    .split(' ')
    .filter(
      (term) =>
        term.length >= 3 &&
        !stopWords.has(term)
    )
    .slice(0, 12);
}

/*
 * Match WHOLE words only.
 *
 * This prevents accidental substring matches such as:
 *
 * "out" matching "about"
 * "not" matching "notice"
 */
function scoreText(text, terms) {
  const words = new Set(
    normaliseText(text)
      .split(' ')
      .filter(Boolean)
  );

  return terms.reduce(
    (score, term) => {
      if (words.has(term)) {
        return score + 1;
      }

      return score;
    },
    0
  );
}

/*
 * ---------------------------------------------------------
 * HEALTH
 * ---------------------------------------------------------
 */

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Verdict Legal Retrieval',
  });
});

/*
 * ---------------------------------------------------------
 * GET LEGAL DOMAINS
 * ---------------------------------------------------------
 */

router.get('/domains', async (req, res) => {
  try {
    const accessToken =
      getBearerToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Authentication required.',
      });
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
      return res.status(401).json({
        error:
          'Invalid or expired session.',
      });
    }

    const {
      data,
      error,
    } = await supabase
      .from('legal_domains')
      .select(`
        id,
        slug,
        name,
        description,
        status,
        sort_order
      `)
      .eq('status', 'active')
      .order('sort_order', {
        ascending: true,
      });

    if (error) {
      console.error(
        'Legal domain retrieval failed:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to retrieve legal knowledge.',
      });
    }

    return res.json({
      success: true,
      count: data.length,
      domains: data,
    });
  } catch (error) {
    console.error(
      'Unexpected legal retrieval error:',
      error
    );

    return res.status(500).json({
      error:
        'An unexpected server error occurred.',
    });
  }
});

/*
 * ---------------------------------------------------------
 * SEARCH VERIFIED LEGAL KNOWLEDGE
 * ---------------------------------------------------------
 */

router.post('/search', async (req, res) => {
  try {
    /*
     * -----------------------------------------------------
     * AUTH
     * -----------------------------------------------------
     */

    const accessToken =
      getBearerToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Authentication required.',
      });
    }

    /*
     * -----------------------------------------------------
     * QUESTION + ATTACHMENT
     * -----------------------------------------------------
     */

    const originalQuestion =
      typeof req.body?.question ===
      'string'
        ? req.body.question.trim()
        : '';

    const attachment =
      req.body?.attachment &&
      typeof req.body.attachment ===
        'object'
        ? req.body.attachment
        : null;

    const matterState =
      req.body?.matterState &&
      typeof req.body.matterState ===
        'object'
        ? req.body.matterState
        : {};

    if (
      !originalQuestion &&
      !attachment
    ) {
      return res.status(400).json({
        error:
          'A legal question or attachment is required.',
      });
    }

    /*
     * Product help is intentionally routed before legal retrieval.
     * The AI router reasons over Verdict's structured product knowledge
     * instead of relying on a hard-coded phrase list or canned answers.
     */
    if (originalQuestion && !attachment) {
      const productHelp =
        await answerVerdictProductQuestion(
          originalQuestion
        );

      if (productHelp) {
        return res.json(productHelp);
      }
    }

    /*
     * -----------------------------------------------------
     * ATTACHMENT ANALYSIS
     * -----------------------------------------------------
     *
     * The attachment-reading model is used only to
     * extract factual context.
     *
     * It is NOT a legal source.
     */

    let attachmentAnalysis = null;

    if (attachment?.dataUrl) {
      try {
        attachmentAnalysis =
          await readAttachment(
            attachment
          );
      } catch (error) {
        console.error(
          'Attachment analysis failed:',
          error
        );

        return res.status(422).json({
          error:
            error?.message ||
            'Verdict could not analyse the attachment.',
        });
      }
    }

    /*
     * Convert the extracted attachment information into
     * searchable factual context for the existing legal
     * retrieval engine.
     */

    const attachmentContext =
      attachmentAnalysis
        ? [
            attachmentAnalysis
              .documentType,
            attachmentAnalysis
              .summary,
            attachmentAnalysis
              .extractedText,
            ...(
              attachmentAnalysis
                .observations || []
            ),
          ]
            .filter(Boolean)
            .join(' ')
        : '';

    /*
     * The user's question remains separate in the
     * response, but legal topic matching can use both
     * their question and extracted document facts.
     */

    const question = [
      originalQuestion,
      attachmentContext,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!question) {
      return res.status(400).json({
        error:
          'Verdict could not extract enough information from the question or attachment.',
      });
    }

    if (question.length > 12000) {
      return res.status(400).json({
        error:
          'The combined question and attachment content is too long.',
      });
    }

    /*
     * -----------------------------------------------------
     * VERIFY USER
     * -----------------------------------------------------
     */

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
      return res.status(401).json({
        error:
          'Invalid or expired session.',
      });
    }

    /*
     * -----------------------------------------------------
     * BUILD SEARCH TERMS
     * -----------------------------------------------------
     */

    const terms =
      getSearchTerms(question);

    /*
     * -----------------------------------------------------
     * GET ACTIVE LEGAL DOMAINS
     * -----------------------------------------------------
     */

    const {
      data: domains,
      error: domainsError,
    } = await supabase
      .from('legal_domains')
      .select(`
        id,
        slug,
        name,
        description,
        status,
        sort_order
      `)
      .eq('status', 'active');

    if (domainsError) {
      throw domainsError;
    }

    /*
     * -----------------------------------------------------
     * GET ACTIVE ISSUE TYPES
     * -----------------------------------------------------
     */

    const {
      data: issues,
      error: issuesError,
    } = await supabase
      .from('legal_issue_types')
      .select(`
        id,
        domain_id,
        slug,
        name,
        description,
        status,
        sort_order
      `)
      .eq('status', 'active');

    if (issuesError) {
      throw issuesError;
    }

    /*
     * -----------------------------------------------------
     * GET PUBLISHED LEGAL TOPICS
     * -----------------------------------------------------
     */

    const {
      data: topics,
      error: topicsError,
    } = await supabase
      .from('legal_topics')
      .select(`
        id,
        issue_type_id,
        slug,
        name,
        category,
        summary,
        status,
        sort_order
      `)
      .eq('status', 'published');

    if (topicsError) {
      throw topicsError;
    }

    const domainMap = new Map(
      domains.map((domain) => [
        domain.id,
        domain,
      ])
    );

    const issueMap = new Map(
      issues.map((issue) => [
        issue.id,
        issue,
      ])
    );

    /*
     * -----------------------------------------------------
     * RANK LEGAL TOPICS
     * -----------------------------------------------------
     *
     * Topic-specific wording is the strongest signal.
     * Issue wording is supporting context.
     * Domain wording is only a weak supporting signal.
     */

    const deterministicCandidates =
      topics
        .map((topic) => {
          const issue =
            issueMap.get(
              topic.issue_type_id
            );

          const domain = issue
            ? domainMap.get(
                issue.domain_id
              )
            : null;

          /*
           * Strongest signal:
           * topic name + summary.
           */

          const topicScore =
            scoreText(
              [
                topic.name,
                topic.summary,
              ]
                .filter(Boolean)
                .join(' '),
              terms
            );

          /*
           * Medium-strength signal:
           * issue type.
           */

          const issueScore =
            scoreText(
              [
                issue?.name,
                issue?.description,
              ]
                .filter(Boolean)
                .join(' '),
              terms
            );

          /*
           * Weak supporting signal:
           * broad legal domain.
           */

          const domainScore =
            scoreText(
              [
                domain?.name,
                domain?.description,
              ]
                .filter(Boolean)
                .join(' '),
              terms
            );

          /*
           * Weighted relevance.
           *
           * Topic = strongest
           * Issue = supporting
           * Domain = weak context
           */

          const score =
            topicScore * 5 +
            issueScore * 3 +
            domainScore;

          return {
            topic,
            issue,
            domain,
            score,
            topicScore,
            issueScore,
            domainScore,
          };
        })

        /*
         * A broad domain match alone is not enough.
         */

        .filter(
          (candidate) =>
            candidate.issue &&
            candidate.domain &&
            candidate.score > 0 &&
            (
              candidate.topicScore >
                0 ||
              candidate.issueScore >
                0
            )
        )
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .slice(0, 5);


    /*
     * -----------------------------------------------------
     * SEMANTIC TOPIC ROUTING
     * -----------------------------------------------------
     *
     * When Bedrock is available, Verdict interprets the meaning of
     * the complete description and may select only topic IDs from
     * the existing published catalogue.
     *
     * When Bedrock is quota-blocked/unavailable, the deterministic
     * matcher above remains the automatic fallback.
     */

    const semanticClassification =
      await classifyLegalTopics({
        question,
        domains,
        issues,
        topics,
      });

    const semanticTopicIds =
      semanticClassification?.mode ===
        'semantic_model'
        ? new Set(
            semanticClassification
              .selectedTopicIds || []
          )
        : new Set();

    const deterministicByTopicId =
      new Map(
        deterministicCandidates.map(
          (candidate) => [
            String(candidate.topic.id),
            candidate,
          ]
        )
      );

    const semanticCandidates = [
      ...semanticTopicIds,
    ]
      .map((topicId) => {
        const topic = topics.find(
          (item) =>
            String(item.id) ===
            String(topicId)
        );

        if (!topic) {
          return null;
        }

        const issue =
          issueMap.get(
            topic.issue_type_id
          );

        const domain = issue
          ? domainMap.get(
              issue.domain_id
            )
          : null;

        if (!issue || !domain) {
          return null;
        }

        const deterministic =
          deterministicByTopicId.get(
            String(topic.id)
          );

        return {
          topic,
          issue,
          domain,

          /*
           * Preserve deterministic scores when the same topic was
           * also found by keyword retrieval. Semantic-only topics
           * deliberately receive zero lexical scores.
           */
          score:
            deterministic?.score || 0,

          topicScore:
            deterministic?.topicScore ||
            0,

          issueScore:
            deterministic?.issueScore ||
            0,

          domainScore:
            deterministic?.domainScore ||
            0,

          semanticMatch: true,
        };
      })
      .filter(Boolean);

    const candidateMap = new Map();

    /*
     * Semantic selections go first because they represent whole-story
     * understanding. Deterministic candidates then supplement them.
     */
    for (
      const candidate of [
        ...semanticCandidates,
        ...deterministicCandidates,
      ]
    ) {
      const key =
        String(candidate.topic.id);

      if (!candidateMap.has(key)) {
        candidateMap.set(
          key,
          candidate
        );
      } else if (
        candidate.semanticMatch
      ) {
        candidateMap.set(
          key,
          {
            ...candidateMap.get(key),
            semanticMatch: true,
          }
        );
      }
    }

    const candidateTopics = [
      ...candidateMap.values(),
    ].slice(0, 5);

    /*
     * -----------------------------------------------------
     * NO MATCH
     * -----------------------------------------------------
     */

    if (
      candidateTopics.length === 0
    ) {
      return res.json({
        success: true,

        question:
          originalQuestion ||
          question,

        attachmentAnalysis,

        classification: semanticClassification,

        coverage: 'not_found',

        message:
          'Verdict does not yet have enough verified legal guidance matching this question.',

        matches: [],

        safety: {
          generatedLegalAdvice:
            false,

          verifiedKnowledgeOnly:
            true,

          attachmentUsedAsLegalSource:
            false,
        },
      });
    }

    const topicIds =
      candidateTopics.map(
        (candidate) =>
          candidate.topic.id
      );

    /*
     * -----------------------------------------------------
     * RETRIEVE VERIFIED LEGAL RULES
     * -----------------------------------------------------
     */

    const {
      data: rules,
      error: rulesError,
    } = await supabase
      .from('legal_rules')
      .select(`
        id,
        topic_id,
        source_id,
        rule_type,
        title,
        plain_language_text,
        section_reference,
        citation_label,
        verification_status,
        last_verified_at,
        sort_order
      `)
      .in('topic_id', topicIds)
      .eq(
        'verification_status',
        'verified'
      )
      .order('sort_order', {
        ascending: true,
      });

    if (rulesError) {
      throw rulesError;
    }

    /*
     * -----------------------------------------------------
     * RETRIEVE TOPIC/SOURCE RELATIONSHIPS
     * -----------------------------------------------------
     */

    const {
      data: topicSourceLinks,
      error: topicSourceError,
    } = await supabase
      .from(
        'legal_topic_sources'
      )
      .select(`
        topic_id,
        source_id,
        is_primary,
        relevance_note
      `)
      .in(
        'topic_id',
        topicIds
      );

    if (topicSourceError) {
      throw topicSourceError;
    }

    /*
     * -----------------------------------------------------
     * BUILD SOURCE ID LIST
     * -----------------------------------------------------
     */

    const sourceIds = [
      ...new Set([
        ...rules
          .map(
            (rule) =>
              rule.source_id
          )
          .filter(Boolean),

        ...topicSourceLinks
          .map(
            (link) =>
              link.source_id
          )
          .filter(Boolean),
      ]),
    ];

    let sources = [];

    /*
     * -----------------------------------------------------
     * RETRIEVE VERIFIED SOURCES
     * -----------------------------------------------------
     */

    if (sourceIds.length > 0) {
      const {
        data: sourceData,
        error: sourceError,
      } = await supabase
        .from('legal_sources')
        .select(`
          id,
          title,
          source_type,
          authority,
          official_url,
          jurisdiction,
          status,
          effective_date,
          version_note,
          is_verified,
          last_verified_at
        `)
        .in(
          'id',
          sourceIds
        )
        .eq(
          'is_verified',
          true
        )
        .eq(
          'status',
          'active'
        );

      if (sourceError) {
        throw sourceError;
      }

      sources =
        sourceData || [];
    }

    const sourceMap =
      new Map(
        sources.map(
          (source) => [
            source.id,
            source,
          ]
        )
      );

    /*
     * -----------------------------------------------------
     * RETRIEVE ACTIVE REFERRAL ROUTES
     * -----------------------------------------------------
     *
     * Eligibility and urgency remain excluded here so
     * the existing working retrieval contract remains
     * unchanged.
     */

    const {
      data: referralRoutes,
      error:
        referralRoutesError,
    } = await supabase
      .from('referral_routes')
      .select(`
        id,
        topic_id,
        organisation_id,
        route_type,
        title,
        instructions,
        official_url,
        status,
        sort_order
      `)
      .in(
        'topic_id',
        topicIds
      )
      .eq(
        'status',
        'active'
      );

    if (
      referralRoutesError
    ) {
      throw referralRoutesError;
    }

    const organisationIds = [
      ...new Set(
        (referralRoutes || [])
          .map(
            (route) =>
              route.organisation_id
          )
          .filter(Boolean)
      ),
    ];

    let organisations = [];

    /*
     * -----------------------------------------------------
     * RETRIEVE VERIFIED REFERRAL ORGANISATIONS
     * -----------------------------------------------------
     */

    if (
      organisationIds.length > 0
    ) {
      const {
        data:
          organisationData,
        error:
          organisationError,
      } = await supabase
        .from(
          'referral_organisations'
        )
        .select(`
          id,
          name,
          organisation_type,
          description,
          phone,
          email,
          province,
          services,
          eligibility_notes,
          status,
          is_verified,
          last_verified_at
        `)
        .in(
          'id',
          organisationIds
        )
        .eq(
          'status',
          'active'
        )
        .eq(
          'is_verified',
          true
        );

      if (
        organisationError
      ) {
        throw organisationError;
      }

      organisations =
        organisationData ||
        [];
    }

    const organisationMap =
      new Map(
        organisations.map(
          (organisation) => [
            organisation.id,
            organisation,
          ]
        )
      );

    /*
     * -----------------------------------------------------
     * ASSEMBLE VERIFIED RESULTS
     * -----------------------------------------------------
     */

    const matches =
      candidateTopics
        .map((candidate) => {
          const topicRules =
            (rules || [])
              .filter(
                (rule) =>
                  rule.topic_id ===
                  candidate.topic.id
              )
              .map((rule) => ({
                ...rule,

                source:
                  sourceMap.get(
                    rule.source_id
                  ) ?? null,
              }));

          const topicSources =
            (
              topicSourceLinks ||
              []
            )
              .filter(
                (link) =>
                  link.topic_id ===
                  candidate.topic.id
              )
              .map((link) => ({
                ...link,

                source:
                  sourceMap.get(
                    link.source_id
                  ) ?? null,
              }))
              .filter(
                (link) =>
                  link.source
              );

          const referrals =
            (
              referralRoutes ||
              []
            )
              .filter(
                (route) =>
                  route.topic_id ===
                  candidate.topic.id
              )
              .map((route) => ({
                ...route,

                organisation:
                  organisationMap.get(
                    route.organisation_id
                  ) ?? null,
              }))
              .filter(
                (route) =>
                  route.organisation
              );

          return {
            score:
              candidate.score,

            /*
             * Useful for debugging legal matching
             * and potentially explaining why a
             * topic was selected.
             */
            relevance: {
              topicScore:
                candidate.topicScore,

              issueScore:
                candidate.issueScore,

              domainScore:
                candidate.domainScore,

              semanticMatch:
                Boolean(
                  candidate.semanticMatch
                ),
            },

            domain: {
              id:
                candidate.domain.id,

              slug:
                candidate.domain.slug,

              name:
                candidate.domain.name,
            },

            issue: {
              id:
                candidate.issue.id,

              slug:
                candidate.issue.slug,

              name:
                candidate.issue.name,
            },

            topic:
              candidate.topic,

            rules:
              topicRules,

            sources:
              topicSources,

            referrals,
          };
        })

        /*
         * Only return a topic as verified guidance
         * if actual verified legal rules exist.
         */
        .filter(
          (match) =>
            match.rules.length > 0
        );

    /*
     * -----------------------------------------------------
     * RECOGNISED BUT UNVERIFIED
     * -----------------------------------------------------
     */

    if (
      matches.length === 0
    ) {
      return res.json({
        success: true,

        question:
          originalQuestion ||
          question,

        attachmentAnalysis,

        classification: semanticClassification,

        coverage:
          'recognised_but_unverified',

        message:
          'Verdict recognised the legal area, but verified guidance was not available for this question.',

        matches: [],

        safety: {
          generatedLegalAdvice:
            false,

          verifiedKnowledgeOnly:
            true,

          attachmentUsedAsLegalSource:
            false,
        },
      });
    }

    /*
     * -----------------------------------------------------
     * GROUNDED REASONING
     * -----------------------------------------------------
     *
     * The reasoning model may explain how the verified rules relate
     * to the complete user question, but it is not itself a legal
     * authority. If Bedrock is unavailable or quota-blocked, this
     * safely returns retrieval_fallback and the existing frontend can
     * continue using the verified matches exactly as before.
     */

    const reasoning =
      await reasonOverVerifiedLegalKnowledge({
        question:
          originalQuestion ||
          question,
        matches,
        attachmentAnalysis,
      });

    /*
     * -----------------------------------------------------
     * GROUNDED PREPARATION GAPS
     * -----------------------------------------------------
     *
     * This is preparation support only. The model may identify factual
     * or organisational gaps from the verified context, but it may not
     * score legal merits or invent legal requirements.
     */
    const preparationGaps =
      await identifyPreparationGaps({
        question:
          originalQuestion ||
          question,
        matches,
        matterState,
      });

    /*
     * -----------------------------------------------------
     * VERIFIED RESULT
     * -----------------------------------------------------
     */

    return res.json({
      success: true,

      /*
       * Do not return the entire extracted attachment
       * content as though the user typed it.
       */
      question:
        originalQuestion ||
        question,

      /*
       * Kept separate from verified legal knowledge.
       */
      attachmentAnalysis,

      classification: semanticClassification,

      coverage: 'verified',

      matchCount:
        matches.length,

      matches,

      /*
       * mode === 'grounded_model'
       *   -> reasoning.answer contains the model-grounded explanation.
       *
       * mode === 'retrieval_fallback'
       *   -> reasoning.answer is null and the frontend should keep its
       *      current deterministic verified-response behaviour.
       */
      reasoning,

      preparationGaps,

      safety: {
        generatedLegalAdvice:
          false,

        verifiedKnowledgeOnly:
          true,

        attachmentUsedAsLegalSource:
          false,
      },
    });
  } catch (error) {
    console.error(
      'Legal search failed:',
      error
    );

    return res.status(500).json({
      error:
        'Unable to retrieve verified legal guidance.',
    });
  }
});

export default router;