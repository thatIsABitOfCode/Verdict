import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = Router();

const toTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const makeEvent = ({
  id,
  type,
  category,
  title,
  description,
  occurredAt,
  userId = null,
  entityType,
  entityId,
  metadata = {},
}) => ({
  id,
  type,
  category,
  title,
  description,
  occurredAt,
  userId,
  entityType,
  entityId,
  metadata,
});

router.get("/activity", requireAdmin, async (_req, res) => {
  try {
    const [
      mattersResult,
      evidenceResult,
      integrityResult,
      ticketsResult,
      messagesResult,
      rulesResult,
      topicsResult,
      sourcesResult,
      referralRoutesResult,
      referralOrganisationsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("matters")
        .select("id, user_id, title, status, created_at, updated_at"),
      supabaseAdmin
        .from("evidence")
        .select("id, user_id, matter_id, file_name, evidence_type, created_at"),
      supabaseAdmin
        .from("evidence_integrity")
        .select(
          "id, evidence_id, user_id, matter_id, integrity_status, hash_algorithm, signature_algorithm, protected_at, last_verified_at"
        ),
      supabaseAdmin
        .from("support_tickets")
        .select(
          "id, ticket_number, user_id, subject, category, status, priority, created_at, updated_at"
        ),
      supabaseAdmin
        .from("support_ticket_messages")
        .select("id, ticket_id, user_id, sender_type, created_at"),
      supabaseAdmin
        .from("legal_rules")
        .select(
          "id, topic_id, source_id, title, rule_type, verification_status, last_verified_at, created_at, updated_at"
        ),
      supabaseAdmin
        .from("legal_topics")
        .select("id, name, category, status, created_at, updated_at"),
      supabaseAdmin
        .from("legal_sources")
        .select(
          "id, title, authority, status, is_verified, last_verified_at, created_at, updated_at"
        ),
      supabaseAdmin
        .from("referral_routes")
        .select(
          "id, topic_id, organisation_id, route_type, title, status, created_at, updated_at"
        ),
      supabaseAdmin
        .from("referral_organisations")
        .select(
          "id, name, organisation_type, status, is_verified, last_verified_at, created_at, updated_at"
        ),
    ]);

    const results = [
      ["matters", mattersResult],
      ["evidence", evidenceResult],
      ["evidence_integrity", integrityResult],
      ["support_tickets", ticketsResult],
      ["support_ticket_messages", messagesResult],
      ["legal_rules", rulesResult],
      ["legal_topics", topicsResult],
      ["legal_sources", sourcesResult],
      ["referral_routes", referralRoutesResult],
      ["referral_organisations", referralOrganisationsResult],
    ];

    const failed = results.find(([, result]) => result.error);

    if (failed) {
      const [table, result] = failed;
      console.error(`Admin activity query failed for ${table}:`, result.error);
      return res.status(500).json({
        error: "Unable to load system activity.",
        source: table,
      });
    }

    const activities = [];

    for (const matter of mattersResult.data || []) {
      activities.push(
        makeEvent({
          id: `matter-created-${matter.id}`,
          type: "matter_created",
          category: "matters",
          title: "Matter created",
          description: matter.title || "A new matter was created.",
          occurredAt: matter.created_at,
          userId: matter.user_id,
          entityType: "matter",
          entityId: matter.id,
          metadata: { status: matter.status },
        })
      );

      if (
        matter.updated_at &&
        toTime(matter.updated_at) > toTime(matter.created_at) + 1000
      ) {
        activities.push(
          makeEvent({
            id: `matter-updated-${matter.id}`,
            type: "matter_updated",
            category: "matters",
            title: "Matter record updated",
            description: matter.title || "A matter record was updated.",
            occurredAt: matter.updated_at,
            userId: matter.user_id,
            entityType: "matter",
            entityId: matter.id,
            metadata: { status: matter.status },
          })
        );
      }
    }

    for (const item of evidenceResult.data || []) {
      activities.push(
        makeEvent({
          id: `evidence-uploaded-${item.id}`,
          type: "evidence_uploaded",
          category: "evidence",
          title: "Evidence uploaded",
          description: item.file_name,
          occurredAt: item.created_at,
          userId: item.user_id,
          entityType: "evidence",
          entityId: item.id,
          metadata: {
            matterId: item.matter_id,
            evidenceType: item.evidence_type,
          },
        })
      );
    }

    for (const item of integrityResult.data || []) {
      activities.push(
        makeEvent({
          id: `integrity-protected-${item.id}`,
          type: "evidence_protected",
          category: "evidence_integrity",
          title: "Evidence integrity protection created",
          description: `Protected with ${item.hash_algorithm} and ${item.signature_algorithm}.`,
          occurredAt: item.protected_at,
          userId: item.user_id,
          entityType: "evidence_integrity",
          entityId: item.id,
          metadata: {
            evidenceId: item.evidence_id,
            matterId: item.matter_id,
            integrityStatus: item.integrity_status,
          },
        })
      );

      if (item.last_verified_at) {
        activities.push(
          makeEvent({
            id: `integrity-verified-${item.id}`,
            type: "evidence_integrity_verified",
            category: "evidence_integrity",
            title: "Evidence integrity verified",
            description:
              "The protected evidence record was checked against its stored integrity data.",
            occurredAt: item.last_verified_at,
            userId: item.user_id,
            entityType: "evidence_integrity",
            entityId: item.id,
            metadata: {
              evidenceId: item.evidence_id,
              matterId: item.matter_id,
              integrityStatus: item.integrity_status,
            },
          })
        );
      }
    }

    for (const ticket of ticketsResult.data || []) {
      activities.push(
        makeEvent({
          id: `ticket-created-${ticket.id}`,
          type: "support_ticket_created",
          category: "support",
          title: "Support ticket created",
          description: `${ticket.ticket_number}: ${ticket.subject}`,
          occurredAt: ticket.created_at,
          userId: ticket.user_id,
          entityType: "support_ticket",
          entityId: ticket.id,
          metadata: {
            ticketNumber: ticket.ticket_number,
            category: ticket.category,
            status: ticket.status,
            priority: ticket.priority,
          },
        })
      );

      if (
        ticket.updated_at &&
        toTime(ticket.updated_at) > toTime(ticket.created_at) + 1000
      ) {
        activities.push(
          makeEvent({
            id: `ticket-updated-${ticket.id}`,
            type: "support_ticket_updated",
            category: "support",
            title: "Support ticket updated",
            description: `${ticket.ticket_number}: ${ticket.subject}`,
            occurredAt: ticket.updated_at,
            userId: ticket.user_id,
            entityType: "support_ticket",
            entityId: ticket.id,
            metadata: {
              ticketNumber: ticket.ticket_number,
              category: ticket.category,
              status: ticket.status,
              priority: ticket.priority,
            },
          })
        );
      }
    }

    for (const message of messagesResult.data || []) {
      const sender =
        message.sender_type === "admin" ? "Admin reply" : "User message";

      activities.push(
        makeEvent({
          id: `support-message-${message.id}`,
          type:
            message.sender_type === "admin"
              ? "support_admin_message"
              : "support_user_message",
          category: "support",
          title: sender,
          description:
            message.sender_type === "admin"
              ? "An admin replied to a support ticket."
              : "A user added a message to a support ticket.",
          occurredAt: message.created_at,
          userId: message.user_id,
          entityType: "support_message",
          entityId: message.id,
          metadata: {
            ticketId: message.ticket_id,
            senderType: message.sender_type,
          },
        })
      );
    }

    for (const rule of rulesResult.data || []) {
      activities.push(
        makeEvent({
          id: `legal-rule-created-${rule.id}`,
          type: "legal_rule_created",
          category: "legal_knowledge",
          title: "Legal rule created",
          description: rule.title,
          occurredAt: rule.created_at,
          entityType: "legal_rule",
          entityId: rule.id,
          metadata: {
            topicId: rule.topic_id,
            sourceId: rule.source_id,
            ruleType: rule.rule_type,
            verificationStatus: rule.verification_status,
          },
        })
      );

      if (
        rule.updated_at &&
        toTime(rule.updated_at) > toTime(rule.created_at) + 1000
      ) {
        activities.push(
          makeEvent({
            id: `legal-rule-updated-${rule.id}`,
            type: "legal_rule_updated",
            category: "legal_knowledge",
            title: "Legal rule updated",
            description: rule.title,
            occurredAt: rule.updated_at,
            entityType: "legal_rule",
            entityId: rule.id,
            metadata: {
              verificationStatus: rule.verification_status,
            },
          })
        );
      }

      if (rule.last_verified_at) {
        activities.push(
          makeEvent({
            id: `legal-rule-verified-${rule.id}`,
            type: "legal_rule_verified",
            category: "legal_knowledge",
            title: "Legal rule verified",
            description: rule.title,
            occurredAt: rule.last_verified_at,
            entityType: "legal_rule",
            entityId: rule.id,
            metadata: {
              verificationStatus: rule.verification_status,
            },
          })
        );
      }
    }

    for (const topic of topicsResult.data || []) {
      activities.push(
        makeEvent({
          id: `legal-topic-created-${topic.id}`,
          type: "legal_topic_created",
          category: "legal_knowledge",
          title: "Legal topic created",
          description: topic.name,
          occurredAt: topic.created_at,
          entityType: "legal_topic",
          entityId: topic.id,
          metadata: {
            category: topic.category,
            status: topic.status,
          },
        })
      );

      if (
        topic.updated_at &&
        toTime(topic.updated_at) > toTime(topic.created_at) + 1000
      ) {
        activities.push(
          makeEvent({
            id: `legal-topic-updated-${topic.id}`,
            type: "legal_topic_updated",
            category: "legal_knowledge",
            title: "Legal topic updated",
            description: topic.name,
            occurredAt: topic.updated_at,
            entityType: "legal_topic",
            entityId: topic.id,
            metadata: { status: topic.status },
          })
        );
      }
    }

    for (const source of sourcesResult.data || []) {
      activities.push(
        makeEvent({
          id: `legal-source-created-${source.id}`,
          type: "legal_source_created",
          category: "legal_knowledge",
          title: "Legal source created",
          description: source.title,
          occurredAt: source.created_at,
          entityType: "legal_source",
          entityId: source.id,
          metadata: {
            authority: source.authority,
            status: source.status,
            isVerified: source.is_verified,
          },
        })
      );

      if (
        source.updated_at &&
        toTime(source.updated_at) > toTime(source.created_at) + 1000
      ) {
        activities.push(
          makeEvent({
            id: `legal-source-updated-${source.id}`,
            type: "legal_source_updated",
            category: "legal_knowledge",
            title: "Legal source updated",
            description: source.title,
            occurredAt: source.updated_at,
            entityType: "legal_source",
            entityId: source.id,
            metadata: {
              status: source.status,
              isVerified: source.is_verified,
            },
          })
        );
      }

      if (source.last_verified_at) {
        activities.push(
          makeEvent({
            id: `legal-source-verified-${source.id}`,
            type: "legal_source_verified",
            category: "legal_knowledge",
            title: "Legal source verified",
            description: source.title,
            occurredAt: source.last_verified_at,
            entityType: "legal_source",
            entityId: source.id,
            metadata: {
              authority: source.authority,
              isVerified: source.is_verified,
            },
          })
        );
      }
    }

    for (const route of referralRoutesResult.data || []) {
      activities.push(
        makeEvent({
          id: `referral-route-created-${route.id}`,
          type: "referral_route_created",
          category: "referrals",
          title: "Referral route created",
          description: route.title,
          occurredAt: route.created_at,
          entityType: "referral_route",
          entityId: route.id,
          metadata: {
            topicId: route.topic_id,
            organisationId: route.organisation_id,
            routeType: route.route_type,
            status: route.status,
          },
        })
      );

      if (
        route.updated_at &&
        toTime(route.updated_at) > toTime(route.created_at) + 1000
      ) {
        activities.push(
          makeEvent({
            id: `referral-route-updated-${route.id}`,
            type: "referral_route_updated",
            category: "referrals",
            title: "Referral route updated",
            description: route.title,
            occurredAt: route.updated_at,
            entityType: "referral_route",
            entityId: route.id,
            metadata: { status: route.status },
          })
        );
      }
    }

    for (const organisation of referralOrganisationsResult.data || []) {
      activities.push(
        makeEvent({
          id: `referral-org-created-${organisation.id}`,
          type: "referral_organisation_created",
          category: "referrals",
          title: "Referral organisation created",
          description: organisation.name,
          occurredAt: organisation.created_at,
          entityType: "referral_organisation",
          entityId: organisation.id,
          metadata: {
            organisationType: organisation.organisation_type,
            status: organisation.status,
            isVerified: organisation.is_verified,
          },
        })
      );

      if (
        organisation.updated_at &&
        toTime(organisation.updated_at) >
          toTime(organisation.created_at) + 1000
      ) {
        activities.push(
          makeEvent({
            id: `referral-org-updated-${organisation.id}`,
            type: "referral_organisation_updated",
            category: "referrals",
            title: "Referral organisation updated",
            description: organisation.name,
            occurredAt: organisation.updated_at,
            entityType: "referral_organisation",
            entityId: organisation.id,
            metadata: {
              status: organisation.status,
              isVerified: organisation.is_verified,
            },
          })
        );
      }

      if (organisation.last_verified_at) {
        activities.push(
          makeEvent({
            id: `referral-org-verified-${organisation.id}`,
            type: "referral_organisation_verified",
            category: "referrals",
            title: "Referral organisation verified",
            description: organisation.name,
            occurredAt: organisation.last_verified_at,
            entityType: "referral_organisation",
            entityId: organisation.id,
            metadata: {
              isVerified: organisation.is_verified,
            },
          })
        );
      }
    }

    activities.sort(
      (a, b) => toTime(b.occurredAt) - toTime(a.occurredAt)
    );

    const categoryCounts = activities.reduce((counts, event) => {
      counts[event.category] = (counts[event.category] || 0) + 1;
      return counts;
    }, {});

    const now = Date.now();
    const last24Hours = activities.filter(
      (event) => now - toTime(event.occurredAt) <= 24 * 60 * 60 * 1000
    ).length;

    const last7Days = activities.filter(
      (event) => now - toTime(event.occurredAt) <= 7 * 24 * 60 * 60 * 1000
    ).length;

    return res.json({
      summary: {
        total: activities.length,
        last24Hours,
        last7Days,
        categories: categoryCounts,
      },
      activities,
      generatedAt: new Date().toISOString(),
      note:
        "This feed is reconstructed from timestamped Verdict records. It is operational activity, not a complete audit log.",
    });
  } catch (error) {
    console.error("Admin activity route failed:", error);
    return res.status(500).json({
      error: "Unable to load system activity.",
    });
  }
});

export default router;
