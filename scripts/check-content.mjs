import { readFile } from 'node:fs/promises';
import { MAX_CONTENT_BYTES, publicContent, validateContent } from '../src/content-model.mjs';

// Fixed source, read-only: use the same allowlisted model as the GUI and build.
const bytes = await readFile(new URL('../src/content/site.json', import.meta.url));
if (bytes.byteLength > MAX_CONTENT_BYTES) throw new Error('編集データは1MB以内にしてください。');
const source = validateContent(JSON.parse(bytes.toString('utf8')));
const published = publicContent(source);
console.log(`Content verified: ${source.articles.length} source articles, ${published.articles.length} public articles, ${source.articles.length - published.articles.length} drafts.`);
