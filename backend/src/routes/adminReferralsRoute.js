import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

/**
 * GET /api/admin/referrals
 *
 * Read-only admin view of Verdict's existing referral system.
 * Only authenticated Verdict admins may access this endpoint.
 *
 * No organisation or referral route is created, edited, verified,
 * activated, or deleted here.
 */
router.get("/referrals", requireAdmin, async (req, res) => {
  try {
    const [organisationsResult, routesResult, topicsResult] =
      await Promise.all([
        supabaseAdmin
          .from("referral_organisations")
          .select(
            "id, name, organisation_type, description, website_url, phone, email, coverage_area, province, services, eligibility_notes, status, is_verified, last_verified_at, created_at, updated_at"
          )
          .order("name", { ascending: true }),

        supabaseAdmin
          .from("referral_routes")
          .select(
            "id, topic_id, organisation_id, route_type, title, instructions, eligibility_notes, urgency_note, official_url, status, sort_order, created_at, updated_at"
          )
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true }),

        supabaseAdmin
          .from("legal_topics")
          .select(
            "id, issue_type_id, slug, name, category, summary, status"
          )
          .order("name", { ascending: true }),
      ]);

    if (organisationsResult.error) {
      console.error(
        "Unable to load Verdict referral organisations:",
        organisationsResult.error
      );

      return res.status(500).json({
        error: "Unable to load referral organisations.",
      });
    }

    if (routesResult.error) {
      console.error(
        "Unable to load Verdict referral routes:",
        routesResult.error
      );

      return res.status(500).json({
        error: "Unable to load referral routes.",
      });
    }

    if (topicsResult.error) {
      console.error(
        "Unable to load Verdict referral legal topics:",
        topicsResult.error
      );

      return res.status(500).json({
        error: "Unable to load referral legal topics.",
      });
    }

    const organisations = organisationsResult.data || [];
    const routes = routesResult.data || [];
    const topics = topicsResult.data || [];

    const organisationMap = new Map(
      organisations.map((organisation) => [
        organisation.id,
        organisation,
      ])
    );

    const topicMap = new Map(
      topics.map((topic) => [topic.id, topic])
    );

    const enrichedRoutes = routes.map((route) => ({
      ...route,
      organisation:
        organisationMap.get(route.organisation_id) || null,
      topic: topicMap.get(route.topic_id) || null,
      userFacingReady:
        route.status === "active" &&
        organisationMap.get(route.organisation_id)?.status ===
          "active" &&
        organisationMap.get(route.organisation_id)?.is_verified ===
          true,
    }));

    const routesByOrganisation = new Map();

    for (const route of enrichedRoutes) {
      if (!routesByOrganisation.has(route.organisation_id)) {
        routesByOrganisation.set(route.organisation_id, []);
      }

      routesByOrganisation
        .get(route.organisation_id)
        .push(route);
    }

    const enrichedOrganisations = organisations.map(
      (organisation) => {
        const organisationRoutes =
          routesByOrganisation.get(organisation.id) || [];

        return {
          ...organisation,
          routes: organisationRoutes,
          counts: {
            routes: organisationRoutes.length,
            activeRoutes: organisationRoutes.filter(
              (route) => route.status === "active"
            ).length,
            userFacingReadyRoutes: organisationRoutes.filter(
              (route) => route.userFacingReady
            ).length,
          },
          userFacingEligible:
            organisation.status === "active" &&
            organisation.is_verified === true,
        };
      }
    );

    const summary = {
      organisations: organisations.length,

      activeOrganisations: organisations.filter(
        (organisation) => organisation.status === "active"
      ).length,

      verifiedOrganisations: organisations.filter(
        (organisation) => organisation.is_verified === true
      ).length,

      userFacingEligibleOrganisations:
        enrichedOrganisations.filter(
          (organisation) => organisation.userFacingEligible
        ).length,

      routes: routes.length,

      activeRoutes: routes.filter(
        (route) => route.status === "active"
      ).length,

      userFacingReadyRoutes: enrichedRoutes.filter(
        (route) => route.userFacingReady
      ).length,

      routesNeedingAttention: enrichedRoutes.filter(
        (route) => !route.userFacingReady
      ).length,
    };

    return res.json({
      success: true,
      summary,
      organisations: enrichedOrganisations,
      routes: enrichedRoutes,
    });
  } catch (error) {
    console.error("Verdict admin referrals route failed:", error);

    return res.status(500).json({
      error: "Unable to load Verdict referrals.",
    });
  }
});

export default router;
