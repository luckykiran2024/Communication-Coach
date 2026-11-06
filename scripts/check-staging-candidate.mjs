import { stagingCandidateConfigured } from './release-capabilities.mjs';
const base = process.env.STAGING_API_URL ?? '';
let api;
try { api = new URL(base); } catch { throw new Error('Set the dedicated HTTPS staging API URL.'); }
if (api.protocol !== 'https:' || api.username || api.password || api.port || api.search || api.hash
  || !/^communication-coach-staging-api(?:-[a-z0-9-]+)?\.vercel\.app$/.test(api.hostname)
  || api.pathname.replace(/\/$/, '') !== '/api') {
  throw new Error('The store sandbox requires the dedicated HTTPS staging API.');
}
const response = await fetch(base.replace(/\/$/, '') + '/ready', { signal: AbortSignal.timeout(10000), redirect: 'error' });
const ready = await response.json();
if (!response.ok || !stagingCandidateConfigured(ready, process.env.GITHUB_SHA)) {
  throw new Error('Deploy and migrate this exact commit to isolated staging with all release services enabled before building the store-sandbox AAB. The restricted test handler cannot pass this gate.');
}
console.log('Staging candidate and PostgreSQL schema are ready.');
