import { createHash } from 'node:crypto';

export type PolicyChunk = Readonly<{ file: string; version: string; section: string; content: string; chunkIndex: number }>;
export const contentHash = (content: string): string => createHash('sha256').update(content).digest('hex');

export function parsePolicyDocument(file: string, markdown: string): PolicyChunk[] {
  const version = markdown.match(/^Version:\s*(.+)$/m)?.[1]?.trim() ?? '1.0';
  const parts = markdown.split(/^##\s+(.+)$/m);
  const chunks: PolicyChunk[] = [];
  for (let index = 1; index < parts.length; index += 2) {
    const section = parts[index].trim(); const body = parts[index + 1]?.trim() ?? '';
    if (body) chunks.push({ file, version, section, content: `## ${section}\n\n${body}`, chunkIndex: chunks.length });
  }
  return chunks;
}
