import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

/**
 * GET /api/admin/legal-knowledge
 *
 * Read-only admin overview of Verdict's existing legal knowledge system.
 * Nothing is created, edited, published, or verified by this endpoint.
 *
 * This deliberately preserves the current safety model:
 * - domains/issues are catalogued by status
 * - only published topics are used by the user-facing legal retrieval route
 * - only verified rules are used as verified legal guidance
 * - only active, verified sources are used as verified authorities
 */
router.get("/legal-knowledge", requireAdmin, async (req, res) => {
  try {
    const [
      domainsResult,
      issuesResult,
      topicsResult,
      rulesResult,
      sourcesResult,
      topicSourcesResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("legal_domains")
        .select(
          "id, slug, name, description, status, sort_order, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),

      supabaseAdmin
        .from("legal_issue_types")
        .select(
          "id, domain_id, slug, name, description, status, sort_order, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),

      supabaseAdmin
        .from("legal_topics")
        .select(
          "id, issue_type_id, slug, name, category, summary, status, sort_order, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),

      supabaseAdmin
        .from("legal_rules")
        .select(
          "id, topic_id, source_id, rule_type, title, plain_language_text, section_reference, citation_label, verification_status, effective_from, effective_to, last_verified_at, sort_order, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true }),

      supabaseAdmin
        .from("legal_sources")
        .select(
          "id, title, source_type, authority, official_url, jurisdiction, status, effective_date, version_note, is_verified, last_verified_at, created_at, updated_at"
        )
        .order("title", { ascending: true }),

      supabaseAdmin
        .from("legal_topic_sources")
        .select(
          "id, topic_id, source_id, is_primary, relevance_note, created_at"
        )
        .order("created_at", { ascending: true }),
    ]);

    const results = [
      ["legal domains", domainsResult],
      ["legal issue types", issuesResult],
      ["legal topics", topicsResult],
      ["legal rules", rulesResult],
      ["legal sources", sourcesResult],
      ["legal topic/source links", topicSourcesResult],
    ];

    for (const [label, result] of results) {
      if (result.error) {
        console.error(`Unable to load Verdict ${label}:`, result.error);

        return res.status(500).json({
          error: `Unable to load ${label}.`,
        });
      }
    }

    const domains = domainsResult.data || [];
    const issues = issuesResult.data || [];
    const topics = topicsResult.data || [];
    const rules = rulesResult.data || [];
    const sources = sourcesResult.data || [];
    const topicSources = topicSourcesResult.data || [];

    const domainMap = new Map(
      domains.map((domain) => [domain.id, domain])
    );

    const issueMap = new Map(
      issues.map((issue) => [issue.id, issue])
    );

    const sourceMap = new Map(
      sources.map((source) => [source.id, source])
    );

    const rulesByTopic = new Map();
    for (const rule of rules) {
      if (!rulesByTopic.has(rule.topic_id)) {
        rulesByTopic.set(rule.topic_id, []);
      }

      rulesByTopic.get(rule.topic_id).push({
        ...rule,
        source: sourceMap.get(rule.source_id) || null,
      });
    }

    const sourceLinksByTopic = new Map();
    for (const link of topicSources) {
      if (!sourceLinksByTopic.has(link.topic_id)) {
        sourceLinksByTopic.set(link.topic_id, []);
      }

      sourceLinksByTopic.get(link.topic_id).push({
        ...link,
        source: sourceMap.get(link.source_id) || null,
      });
    }

    const enrichedTopics = topics.map((topic) => {
      const issue = topic.issue_type_id
        ? issueMap.get(topic.issue_type_id) || null
        : null;

      const domain = issue
        ? domainMap.get(issue.domain_id) || null
        : null;

      const topicRules = rulesByTopic.get(topic.id) || [];
      const sourceLinks = sourceLinksByTopic.get(topic.id) || [];

      const verifiedRules = topicRules.filter(
        (rule) => rule.verification_status === "verified"
      );

      const verifiedActiveSources = sourceLinks.filter(
        (link) =>
          link.source?.is_verified === true &&
          link.source?.status === "active"
      );

      return {
        ...topic,
        issue,
        domain,
        rules: topicRules,
        sourceLinks,
        counts: {
          rules: topicRules.length,
          verifiedRules: verifiedRules.length,
          linkedSources: sourceLinks.length,
          verifiedActiveSources: verifiedActiveSources.length,
        },
        retrievalReady:
          topic.status === "published" &&
          verifiedRules.length > 0,
      };
    });

    const summary = {
      domains: domains.length,
      activeDomains: domains.filter(
        (domain) => domain.status === "active"
      ).length,

      issueTypes: issues.length,
      activeIssueTypes: issues.filter(
        (issue) => issue.status === "active"
      ).length,

      topics: topics.length,
      publishedTopics: topics.filter(
        (topic) => topic.status === "published"
      ).length,

      rules: rules.length,
      verifiedRules: rules.filter(
        (rule) => rule.verification_status === "verified"
      ).length,
      rulesNeedingReview: rules.filter(
        (rule) => rule.verification_status !== "verified"
      ).length,

      sources: sources.length,
      verifiedSources: sources.filter(
        (source) => source.is_verified === true
      ).length,
      verifiedActiveSources: sources.filter(
        (source) =>
          source.is_verified === true &&
          source.status === "active"
      ).length,

      retrievalReadyTopics: enrichedTopics.filter(
        (topic) => topic.retrievalReady
      ).length,
    };

    return res.json({
      success: true,
      summary,
      domains,
      issueTypes: issues,
      topics: enrichedTopics,
      sources,
      topicSources,
    });
  } catch (error) {
    console.error("Verdict admin legal knowledge route failed:", error);

    return res.status(500).json({
      error: "Unable to load Verdict legal knowledge.",
    });
  }
});

export default router;
