import { BENCHMARK_CASES, BENCHMARK_HOST, validateBenchmarkConfig } from './feasibility-worker.mjs';

const CASE_SET = new Set(BENCHMARK_CASES);
const MAX_CALLS = 40;
const MAX_RESULT_BYTES = 32 * 1024;
const BLOCKED_LOG_KEY = /token|secret|header|subject|actor|payload/i;

function fail(message) {
  throw new TypeError(message);
}

function utcDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function validateRunnerConfig(env, scheduledTime, nowMs = Date.now()) {
  const benchmark = validateBenchmarkConfig(env, nowMs);
  if (!Number.isSafeInteger(scheduledTime) || scheduledTime < 0 || scheduledTime > benchmark.untilMs) {
    fail('Invalid scheduled time');
  }
  if (typeof env.BENCHMARK_SCHEDULE_DATE !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(env.BENCHMARK_SCHEDULE_DATE)
    || utcDate(scheduledTime) !== env.BENCHMARK_SCHEDULE_DATE) fail('Scheduled date is not allowlisted');
  const range = /^(\d{1,4})-(\d{1,4})$/.exec(env.BENCHMARK_MINUTE_RANGE ?? '');
  if (!range) fail('Invalid minute range');
  const startMinute = Number(range[1]);
  const endMinute = Number(range[2]);
  const scheduled = new Date(scheduledTime);
  const minute = scheduled.getUTCHours() * 60 + scheduled.getUTCMinutes();
  if (startMinute < 0 || endMinute > 1439 || startMinute > endMinute
    || minute < startMinute || minute > endMinute) fail('Scheduled minute is not allowlisted');

  let cases;
  try {
    cases = JSON.parse(env.BENCHMARK_CASES);
  } catch {
    fail('Invalid benchmark cases');
  }
  if (!Array.isArray(cases) || cases.length === 0 || new Set(cases).size !== cases.length
    || cases.some((caseName) => !CASE_SET.has(caseName))) fail('Invalid benchmark cases');
  if (typeof env.BENCHMARK_REPETITIONS !== 'string' || !/^[1-3]$/.test(env.BENCHMARK_REPETITIONS)) {
    fail('Invalid benchmark repetitions');
  }
  const repetitions = Number(env.BENCHMARK_REPETITIONS);
  const callCount = cases.length * repetitions;
  if (callCount > MAX_CALLS) fail('Benchmark suite exceeds call cap');
  if (env.BENCHMARK_SPREAD_MINUTES !== undefined && env.BENCHMARK_SPREAD_MINUTES !== 'true') {
    fail('Invalid spread mode');
  }
  const spreadMinutes = env.BENCHMARK_SPREAD_MINUTES === 'true';
  if (spreadMinutes && endMinute - startMinute + 1 !== callCount) fail('Spread range must match call count');
  if (!env.BENCHMARK_SERVICE || typeof env.BENCHMARK_SERVICE.fetch !== 'function') {
    fail('Missing benchmark service binding');
  }
  return { cases, repetitions, callCount, selectedSequence: spreadMinutes ? minute - startMinute : null };
}

function sanitize(value, depth = 0) {
  if (depth > 5) return '[truncated]';
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 256);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !BLOCKED_LOG_KEY.test(key))
    .slice(0, 30)
    .map(([key, item]) => [key, sanitize(item, depth + 1)]));
}

async function boundedServiceResult(response) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESULT_BYTES) throw new Error('Benchmark result is too large');
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESULT_BYTES) {
      await reader.cancel();
      throw new Error('Benchmark result is too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return sanitize(JSON.parse(new TextDecoder().decode(bytes)));
}

function unavailable() {
  return Response.json({ error: 'feasibility_runner_disabled' }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export default {
  async fetch() {
    return unavailable();
  },
  async scheduled(event, env = {}) {
    const config = validateRunnerConfig(env, event?.scheduledTime);
    let sequence = 0;
    for (let repetition = 1; repetition <= config.repetitions; repetition += 1) {
      for (const caseName of config.cases) {
        if (config.selectedSequence !== null && sequence !== config.selectedSequence) {
          sequence += 1;
          continue;
        }
        const response = await env.BENCHMARK_SERVICE.fetch(new Request(
          `https://${BENCHMARK_HOST}/v1/${caseName}`,
          { method: 'POST', headers: { 'X-Benchmark-Sequence': String(sequence) } },
        ));
        const result = await boundedServiceResult(response);
        console.log(JSON.stringify({
          workload: 'operations-feasibility', case: caseName, repetition, sequence,
          httpStatus: response.status, result,
        }));
        if (!response.ok) throw new Error(`Benchmark case failed: ${caseName}`);
        sequence += 1;
      }
    }
    console.log(JSON.stringify({
      workload: 'operations-feasibility-suite', scheduledTimeMs: event.scheduledTime,
      cases: config.cases, repetitions: config.repetitions,
      calls: config.selectedSequence === null ? sequence : 1,
    }));
  },
};
