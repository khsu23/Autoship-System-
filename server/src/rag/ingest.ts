import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { OpenAIProvider } from './openai.js';
import { contentHash, parsePolicyDocument } from './policyParser.js';

const databaseUrl = process.env.DATABASE_URL; const apiKey = process.env.OPENAI_API_KEY;
if (!databaseUrl || !apiKey) throw new Error('DATABASE_URL and OPENAI_API_KEY must be set in .env before ingestion.');
const policyDirectory = join(process.cwd(), 'docs', 'policies');
const pool = new Pool({ connectionString: databaseUrl });
const provider = new OpenAIProvider(apiKey, process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small', process.env.OPENAI_TEXT_MODEL ?? 'gpt-4.1-mini');

async function ingest(): Promise<void> {
  const files = (await readdir(policyDirectory)).filter((file) => file.endsWith('.md')).sort();
  const known = await pool.query<{ source_file: string; content_hash: string }>('SELECT source_file, content_hash FROM policy_documents');
  const existing = new Map(known.rows.map((row) => [row.source_file, row.content_hash]));
  let updated = 0;
  for (const file of files) {
    const markdown = await readFile(join(policyDirectory, file), 'utf8'); const hash = contentHash(markdown);
    if (existing.get(file) === hash) { console.log(`unchanged ${file}`); continue; }
    const chunks = parsePolicyDocument(file, markdown); const embeddings = await provider.embed(chunks.map((chunk) => chunk.content));
    if (chunks.length !== embeddings.length) throw new Error(`Embedding count mismatch for ${file}.`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const document = await client.query<{ id: string }>('INSERT INTO policy_documents (source_file, version, content_hash) VALUES ($1, $2, $3) ON CONFLICT (source_file) DO UPDATE SET version = EXCLUDED.version, content_hash = EXCLUDED.content_hash, indexed_at = now() RETURNING id', [file, chunks[0]?.version ?? '1.0', hash]);
      await client.query('DELETE FROM policy_chunks WHERE document_id = $1', [document.rows[0].id]);
      for (const [index, chunk] of chunks.entries()) await client.query('INSERT INTO policy_chunks (document_id, section, content, embedding, chunk_index) VALUES ($1, $2, $3, $4::vector, $5)', [document.rows[0].id, chunk.section, chunk.content, `[${embeddings[index].join(',')}]`, chunk.chunkIndex]);
      await client.query('COMMIT'); updated += 1; console.log(`updated ${file} (${chunks.length} chunks)`);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  for (const [file] of existing) if (!files.includes(file)) { await pool.query('DELETE FROM policy_documents WHERE source_file = $1', [file]); console.log(`removed ${file}`); }
  console.log(`ingestion complete: ${updated} file(s) embedded`);
}
ingest().finally(() => pool.end());
