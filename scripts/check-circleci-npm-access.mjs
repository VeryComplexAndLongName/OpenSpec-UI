import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const circleIdentity = Object.freeze({
  organization: '3d5db94d-4a2c-499e-82f5-af1f9fd28d49',
  project: '1bee6918-ef0a-424e-9775-cfd25745b0cd',
  pipeline: 'ff640ebf-283f-4f8a-b58d-5ab8acc9494e',
  origin: 'github.com/VeryComplexAndLongName/OpenSpec-UI',
  branch: 'refs/heads/circleci-project-setup',
  // Fill only after the exact restricted context has been created and reviewed.
  context: null,
});

export async function probeNpm({ token, mode = 'identity', env = process.env,
  expected = circleIdentity, request = fetch, report = console.log } = {}) {
  if (!['identity', 'exchange'].includes(mode) || env.CIRCLECI !== 'true') {
    throw new Error('Run this access probe only in the approved CircleCI job');
  }
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); }
  catch { throw new Error('No valid CircleCI ID token'); }
  // The receiving registry validates signatures. These checks additionally
  // reject accidental context/ref changes before sending a token anywhere.
  const claim = (name) => claims[`oidc.circleci.com/${name}`];
  if (claims.iss !== `https://oidc.circleci.com/org/${expected.organization}`
      || claims.aud !== 'npm:registry.npmjs.org'
      || claim('project-id') !== expected.project
      || claim('pipeline-definition-id') !== expected.pipeline
      || claim('vcs-origin') !== expected.origin || claim('config-source') !== expected.origin
      || claim('vcs-ref') !== expected.branch || claim('config-ref') !== expected.branch
      || claim('ssh-rerun') === true || claim('ssh-rerun') === 'true'
      || typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) {
    throw new Error('CircleCI token differs from the approved organization/project/pipeline/repository/ref');
  }
  const contexts = claim('context-ids');
  if (mode === 'exchange' && (!expected.context || !Array.isArray(contexts)
      || !contexts.includes(expected.context))) throw new Error('Exact approved publishing context is required before npm exchange');
  report(JSON.stringify({ organization: expected.organization, project: expected.project,
    pipeline: expected.pipeline, origin: expected.origin, configRef: claim('config-ref'),
    checkoutRef: claim('vcs-ref'), contexts: Array.isArray(contexts) ? contexts : [],
    mode, published: false }));
  if (mode === 'identity') return;
  let response;
  try {
    response = await request('https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@openspec-ui%2fcli', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new Error('npm exchange request failed (details withheld to protect credentials)'); }
  if (!response.ok) throw new Error(`npm exchange: HTTP ${response.status}`);
  let body;
  try { body = await response.json(); } catch { throw new Error('npm exchange returned invalid JSON'); }
  if (typeof body.token !== 'string' || !body.token) throw new Error('npm exchange returned no token');
  report(JSON.stringify({ package: '@openspec-ui/cli', exchange: 'accepted', published: false,
    firstLegitimatePublishRequired: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    if (process.env.CIRCLECI !== 'true') throw new Error('This access probe requires a real CircleCI job');
    let token;
    try { token = execFileSync('circleci', ['run', 'oidc', 'get', '--v2', '--aud', 'npm:registry.npmjs.org'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }).trim(); }
    catch { throw new Error('CircleCI could not issue the requested V2 npm-audience token (details withheld)'); }
    await probeNpm({ token, mode: process.argv[2] ?? 'identity' });
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
