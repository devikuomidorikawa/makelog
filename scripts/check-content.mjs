import { publicContent } from '../src/content-model.mjs';
import {readContentSource} from './content-store.mjs';

// Fixed source, read-only: use the same allowlisted model as the GUI and build.
const source = readContentSource();
const published = publicContent(source);
console.log(`Content verified: ${source.articles.length} source articles, ${published.articles.length} public articles, ${source.articles.length - published.articles.length} drafts.`);
