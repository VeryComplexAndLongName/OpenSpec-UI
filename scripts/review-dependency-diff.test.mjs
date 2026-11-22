import assert from 'node:assert/strict';
import test from 'node:test';
import { review } from './review-dependency-diff.mjs';

const lock = (version) => ({ packages: { 'node_modules/a': { version, integrity: version } } });
const audit = (severity) => ({ metadata: { vulnerabilities: {} }, vulnerabilities: {
  a: { severity, nodes: ['node_modules/a'] },
} });
test('changed vulnerable direct or transitive nodes are findings', () => {
  for (const severity of ['high', 'critical']) assert.equal(review(lock('1'), lock('2'), audit(severity)).findings.length, 1);
});
test('unchanged vulnerable nodes and moderate advisories are not new review findings', () => {
  assert.deepEqual(review(lock('1'), lock('1'), audit('high')).findings, []);
  assert.deepEqual(review(lock('1'), lock('2'), audit('moderate')).findings, []);
});
test('newly introduced vulnerable node is reviewed', () => {
  assert.equal(review({ packages: {} }, lock('1'), audit('high')).findings.length, 1);
});
test('missing or failed advisory data is unknown rather than a clean result', () => {
  for (const report of [{}, { error: { code: 'E503' } }, { metadata: { vulnerabilities: {} } }]) {
    assert.equal(review(lock('1'), lock('2'), report).unknown, true);
  }
});
