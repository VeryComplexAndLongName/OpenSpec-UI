import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function review(base, head, audit) {
  if (!audit?.metadata?.vulnerabilities || audit.error || !audit.vulnerabilities) {
    return { unknown: true, findings: [] };
  }
  const changed = new Set(Object.entries(head.packages ?? {}).filter(([name, item]) => name
    && (base.packages?.[name]?.version !== item.version || base.packages?.[name]?.integrity !== item.integrity))
    .map(([name]) => name));
  const findings = Object.entries(audit.vulnerabilities).filter(([, item]) =>
    ['high', 'critical'].includes(item.severity) && item.nodes?.some((node) => changed.has(node)))
    .map(([name, item]) => ({ name, severity: item.severity }));
  return { unknown: false, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [basePath, headPath, reportPath] = process.argv.slice(2);
    const [base, head] = [basePath, headPath].map((file) => JSON.parse(readFileSync(file, 'utf8')));
    let report;
    try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch { report = {}; }
    const result = review(base, head, report);
    if (result.unknown) console.log('::warning::Dependency advisory review could not run; advisory data unavailable.');
    else {
      console.log(JSON.stringify(result));
      if (result.findings.length) process.exitCode = 1;
    }
  } catch (error) { console.error(`Dependency review failed: ${error.message}`); process.exitCode = 1; }
}
