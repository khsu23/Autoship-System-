import { Router, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { OpenAIProvider } from './openai.js';

const askSchema = z.object({ question: z.string().min(3).max(1000) }).strict();
type Hit = { source_file: string; section: string; content: string; similarity: number };
export function createPolicyRouter(pool: Pool, provider: OpenAIProvider): Router {
  const router = Router();
  router.post('/ask', async (request, response) => {
    try {
      const { question } = askSchema.parse(request.body); const [embedding] = await provider.embed([question]);
      const hits = await pool.query<Hit>('SELECT d.source_file, c.section, c.content, 1 - (c.embedding <=> $1::vector) AS similarity FROM policy_chunks c JOIN policy_documents d ON d.id = c.document_id ORDER BY c.embedding <=> $1::vector LIMIT 4', [`[${embedding.join(',')}]`]);
      const relevant = hits.rows.filter((hit) => hit.similarity >= 0.35);
      if (relevant.length === 0) { response.json({ answer: "I can't find that in the policy", citations: [] }); return; }
      const citations = relevant.map((hit) => ({ file: hit.source_file, section: hit.section }));
      const answer = await provider.answer(question, relevant.map((hit) => ({ file: hit.source_file, section: hit.section, content: hit.content })));
      response.json({ answer, citations });
    } catch (error) { sendError(response, error); }
  });
  return router;
}
function sendError(response: Response, error: unknown): void { const message = error instanceof Error ? error.message : 'Policy question failed.'; response.status(400).json({ message }); }
