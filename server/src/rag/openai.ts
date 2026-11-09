import { z } from 'zod';

type RetrievedChunk = { file: string; section: string; content: string };
const embeddingResponseSchema = z.object({ data: z.array(z.object({ embedding: z.array(z.number()) })) });

export class OpenAIProvider {
  constructor(private readonly apiKey: string, private readonly embeddingModel: string, private readonly textModel: string) {}
  async embed(inputs: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.embeddingModel, input: inputs }) });
    if (!response.ok) throw new Error(`Embedding request failed (${response.status}).`);
    return embeddingResponseSchema.parse(await response.json()).data.map((item) => item.embedding);
  }
  async answer(question: string, chunks: RetrievedChunk[]): Promise<string> {
    const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.file} — ${chunk.section}\n${chunk.content}`).join('\n\n');
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.textModel, instructions: 'Answer only from the supplied Chewy Autoship policy context. Be concise. Do not invent policy. Do not add citations; the server attaches verified citations.', input: `Question: ${question}\n\nPolicy context:\n${context}` }) });
    if (!response.ok) throw new Error(`Answer request failed (${response.status}).`);
    const raw = await response.json() as { output_text?: unknown };
    if (typeof raw.output_text !== 'string' || !raw.output_text.trim()) throw new Error('The model returned no answer text.');
    return raw.output_text.trim();
  }
}
