import 'dotenv/config';

import express from 'express';
import cors from 'cors';

import legalRoutes from './routes/legal.js';
import journeyRoutes from './routes/journey.js';
import evidenceIntegrityRoutes from './routes/evidenceIntegrity.js';
import adminUsersRoute from './routes/adminUsersRoute.js';
import adminLegalKnowledgeRoute from './routes/adminLegalKnowledgeRoute.js';
import adminReferralsRoute from './routes/adminReferralsRoute.js';
import adminActivityRoute from './routes/adminActivityRoute.js';
import adminAIHealthRoute from './routes/adminAIHealthRoute.js';

const app = express();

const PORT =
  process.env.PORT || 3001;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '20mb',
  })
);

app.get('/', (req, res) => {
  res.json({
    name: 'Verdict API',
    status: 'running',
  });
});

app.use(
  '/api/legal',
  legalRoutes
);

app.use(
  '/api/journey',
  journeyRoutes
);

app.use(
  '/api/evidence-integrity',
  evidenceIntegrityRoutes
);

app.use(
  '/api/admin',
  adminUsersRoute
);

app.use(
  '/api/admin',
  adminLegalKnowledgeRoute
);

/*
 * Verdict Admin — Referrals
 *
 * GET /api/admin/referrals
 */
app.use(
  '/api/admin',
  adminReferralsRoute
);

/*
 * Verdict Admin — System Activity
 *
 * GET /api/admin/activity
 */
app.use(
  '/api/admin',
  adminActivityRoute
);

/*
 * Verdict Admin — AI & Product Health
 *
 * GET /api/admin/ai-health
 */
app.use(
  '/api/admin',
  adminAIHealthRoute
);

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found.',
  });
});

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      'Unhandled server error:',
      error
    );

    if (
      error?.type ===
        'entity.too.large'
    ) {
      return res
        .status(413)
        .json({
          error:
            'The uploaded file is too large.',
        });
    }

    res.status(500).json({
      error:
        'Internal server error.',
    });
  }
);

app.listen(PORT, () => {
  console.log(
    `Verdict backend running on http://localhost:${PORT}`
  );
});
