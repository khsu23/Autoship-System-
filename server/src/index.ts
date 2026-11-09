import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { createPromotionRouter, PostgresRedemptionRepository } from './promotion/redeem.js';
import { createLifecycleRouter } from './lifecycle/router.js';
import { InMemoryAutoshipStore } from './lifecycle/service.js';
import { createPolicyRouter } from './rag/router.js';
import { OpenAIProvider } from './rag/openai.js';
import { AutoshipAssistant, InMemoryAgentAudit } from './agent/assistant.js';
import { createAssistantRouter } from './agent/router.js';

const port = z.coerce.number().int().positive().default(3001).parse(process.env.PORT);
const databaseUrl = z.string().url().default('postgres://chewy:chewy_local_only@localhost:5432/chewy_autoship').parse(process.env.DATABASE_URL);
const app = express();
const pool = new Pool({ connectionString: databaseUrl });

app.use(express.json());
app.use('/api/promotions', createPromotionRouter(new PostgresRedemptionRepository(pool)));
app.use('/api', createLifecycleRouter(new InMemoryAutoshipStore()));
app.use('/api/assistant', createAssistantRouter(new AutoshipAssistant(new InMemoryAgentAudit())));
if (process.env.OPENAI_API_KEY) {
  app.use('/api/policy', createPolicyRouter(pool, new OpenAIProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small', process.env.OPENAI_TEXT_MODEL ?? 'gpt-4.1-mini')));
} else {
  app.post('/api/policy/ask', (_request, response) => response.status(503).json({ message: 'Policy search is not configured. Add OPENAI_API_KEY to .env.' }));
}
app.get('/health', (_request, response) => {
  response.status(200).json({ service: 'chewy-autoship-api', status: 'ok' });
});

app.listen(port, () => {
  console.log(`Chewy Autoship API listening on port ${port}`);
});
