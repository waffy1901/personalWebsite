import { probeWorkload, signatureWorkload } from '../prototype/worker.mjs';
import { signatureFixture } from './prototype-fixtures.mjs';

const fixture = await signatureFixture();
const started = performance.now();
const primary = await probeWorkload({ fetchImpl: async () => new Response(null, { status: 200 }) });
await signatureWorkload(fixture);
console.log(JSON.stringify({
  evidence: 'local synthetic smoke only', outboundRequests: 0,
  primary, elapsedMs: performance.now() - started,
  cloudflareCpuMs: null, d1RowsRead: null, d1RowsWritten: null,
  stagingGate: 'pending authorized Cloudflare measurements',
}, null, 2));
