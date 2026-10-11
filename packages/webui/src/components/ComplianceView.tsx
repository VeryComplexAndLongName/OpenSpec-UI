import { useEffect, useRef, useState } from "react";
import { effectiveComplianceSetting, type CompliancePolicy, type ComplianceReading, type ComplianceSetting } from "@openspec-ui/core/browser";
import { Icon } from "./Icon.js";
import { Shield } from "lucide-react";
import { useVirtualList } from "./use-virtual-list.js";

export type ComplianceApi = (request: Record<string, unknown>) => Promise<ComplianceReading>;

const css = `
.compliance{color:var(--openspec-text,#252525);background:var(--openspec-panel-background,#fff);padding:16px;min-width:0}
.compliance header,.compliance-tools,.compliance-tabs{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.compliance header{justify-content:space-between}.compliance h2{font-size:20px;margin:0}.compliance-tabs{border-bottom:1px solid #a9a9a9;margin:16px 0}
.compliance button{cursor:pointer;padding:6px 10px;border:1px solid #aaa;background:transparent;color:inherit;border-radius:4px}.compliance-tabs button{border:0;background:transparent;color:inherit;padding:10px 16px;border-bottom:3px solid transparent}
.compliance-tabs button[aria-selected=true]{border-bottom-color:#208f75}.compliance-tools{margin:12px 0}.compliance input,.compliance select{max-width:100%;padding:6px}
.compliance-row{display:grid;grid-template-columns:minmax(120px,1fr) 100px 190px;gap:12px;border-bottom:1px solid #ddd;padding:10px 4px;color:inherit;background:transparent;width:100%;text-align:left;border-top:0;border-left:0;border-right:0}
.compliance-tools input:not([type=checkbox]){width:220px;flex:0 1 220px}.compliance-tools select{width:170px;flex:0 1 170px}.compliance-row span{min-width:0;overflow-wrap:anywhere}.compliance-row small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.compliance h2 svg{vertical-align:middle}.compliance-policy select{width:100%}
.compliance-severity{border-left:3px solid #338b73;padding-left:8px}.compliance-severity.warning{border-color:#bc7900}.compliance-severity.critical{border-color:#bc304a}
.compliance-detail{padding:12px 0;overflow-wrap:anywhere;border-top:1px solid #bbb}.compliance-detail dt{font-weight:600}.compliance-detail dd{margin:0 0 8px}
.compliance-policy{display:grid;grid-template-columns:minmax(150px,1fr) minmax(100px,160px) minmax(130px,210px);gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #ddd}
.compliance-switch{appearance:none;width:38px;height:22px;border-radius:12px;background:#858585;position:relative;border:0;cursor:pointer}
.compliance-switch:after{content:'';display:block;position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:white}
.compliance-switch:checked{background:#208f75}.compliance-switch:checked:after{left:19px}.compliance-error{color:#b22844}
@media(max-width:600px){.compliance-row{grid-template-columns:1fr 90px}.compliance-row time{grid-column:1/-1}.compliance-policy{grid-template-columns:1fr}.compliance{padding:12px}}
`;

function displayTime(value: string): string { return new Date(value).toLocaleString(); }

export function ComplianceView({ api, onClose }: { api: ComplianceApi; onClose?: () => void }) {
  const [reading, setReading] = useState<ComplianceReading>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState("results");
  const [settingsShown, setSettingsShown] = useState(false);
  const [sort, setSort] = useState("topic");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [showHealthy, setShowHealthy] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);
  const alive = useRef(true);
  const sortingPaused = useRef(false);
  const [frozenOrder, setFrozenOrder] = useState<string[]>([]);
  const key = (item: ComplianceReading["observations"][number]) => JSON.stringify([item.ruleId, item.subject]);

  useEffect(() => {
    alive.current = true;
    cancelled.current = false;
    const load = () => { void api({ op: "read" }).then(value => {
      if (alive.current) { setReading(value); setError(""); }
    }, reason => { if (alive.current) setError(String(reason)); }); };
    load();
    const timer = setInterval(load, 5_000);
    return () => { alive.current = false; cancelled.current = true; clearInterval(timer); };
  }, [api]);

  const rows = (reading?.observations ?? []).filter(item => {
    const rule = reading?.rules.find(rule => rule.id === item.ruleId);
    return rule !== undefined && (showHidden || effectiveComplianceSetting(reading!.policy, rule, item.owner).reaction !== "none")
      && (showHealthy || item.finding !== undefined || item.outcome === "unknown")
      && `${rule.title} ${rule.topic} ${item.subject} ${item.evidence}`.toLowerCase().includes(query.toLowerCase());
  }).sort((first, second) => {
    if (sortingPaused.current && frozenOrder.length > 0) return frozenOrder.indexOf(key(first)) - frozenOrder.indexOf(key(second));
    if (sort === "checkedAt" || sort === "changedAt") return Date.parse(second[sort]) - Date.parse(first[sort]);
    const firstRule = reading!.rules.find(rule => rule.id === first.ruleId)!;
    const secondRule = reading!.rules.find(rule => rule.id === second.ruleId)!;
    if (sort === "severity") return ["critical", "warning", "info"].indexOf(firstRule.severity) - ["critical", "warning", "info"].indexOf(secondRule.severity);
    return (sort === "name" ? firstRule.title : firstRule.topic).localeCompare(sort === "name" ? secondRule.title : secondRule.topic);
  });
  const virtual = useVirtualList(rows, key, { itemHeight: 70 });
  const item = reading?.observations.find(item => key(item) === selected && (showHealthy || item.finding !== undefined || item.outcome === "unknown"));
  const itemRule = reading?.rules.find(rule => rule.id === item?.ruleId);
  useEffect(() => {
    if (tab !== "settings" || !itemRule) return;
    const row = settingsRef.current?.querySelector<HTMLElement>(`[data-rule-id="${itemRule.id}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
    row?.focus();
  }, [tab, itemRule?.id]);

  async function runRemaining() {
    cancelled.current = false; setBusy(true); setError("");
    try {
      let next = await api({ op: "read" });
      while (!cancelled.current && alive.current && next.pending > 0) {
        if (Date.now() < next.nextAllowedAtMs) {
          await new Promise<void>(resolve => { setTimeout(resolve, Math.min(1_000, next.nextAllowedAtMs - Date.now())); });
          continue;
        }
        next = await api({ op: "step" });
        if (alive.current) setReading(next);
        if (next.pending > 0 && next.nextAllowedAtMs <= Date.now()) {
          await new Promise<void>(resolve => { setTimeout(resolve, 5_000); });
        }
      }
    } catch (reason) { if (alive.current) setError(String(reason)); }
    finally { if (alive.current) setBusy(false); }
  }

  async function save(policy: CompliancePolicy) {
    if (reading === undefined) return;
    setSaving(true);
    try { setReading(await api({ op: "settings", policy, generation: reading.generation })); setError(""); }
    catch (reason) { setError(String(reason)); }
    finally { setSaving(false); }
  }

  function policyRow(label: string, level: "global" | "topics" | "rules", id?: string, severity?: string) {
    if (reading === undefined) return null;
    const setting = level === "global" ? reading.policy.global : reading.policy[level][id!] ?? {};
    const rule = reading.rules.find(rule => level === "rules" ? rule.id === id : rule.topic === id) ?? reading.rules[0]!;
    const inheritedPolicy = structuredClone(reading.policy);
    if (level === "global") { inheritedPolicy.global = {}; inheritedPolicy.topics = {}; inheritedPolicy.rules = {}; }
    if (level === "topics") { delete inheritedPolicy.topics[id!]; inheritedPolicy.rules = {}; }
    if (level === "rules") delete inheritedPolicy.rules[id!];
    const effective = effectiveComplianceSetting(inheritedPolicy, rule);
    const change = (value: ComplianceSetting) => {
      const policy = structuredClone(reading.policy);
      if (level === "global") policy.global = value;
      else policy[level][id!] = value;
      void save(policy);
    };
    return <div className="compliance-policy" key={`${level}:${id ?? "global"}`} tabIndex={-1} data-rule-id={level === "rules" ? id : undefined}>
      <span className={`compliance-severity ${severity ?? ""}`}>{label}{severity ? <small> · {severity}</small> : null}</span>
      <span><input type="checkbox" role="switch" className="compliance-switch" aria-label={`Track ${label}`} disabled={saving}
        checked={setting.enabled ?? effective.enabled} onChange={event => change({ ...setting, enabled: event.target.checked })} />
        {level !== "global" ? <button type="button" disabled={saving} title="Inherit tracking" onClick={() => { const value = { ...setting }; delete value.enabled; change(value); }}>Inherit</button> : null}
        <small> {setting.enabled === undefined ? `Inherited: ${effective.enabledFrom}` : "Override"}</small></span>
      <select aria-label={`Reaction for ${label}`} disabled={saving} value={setting.reaction ?? "inherit"} onChange={event => {
        const value = { ...setting }; if (event.target.value === "inherit") delete value.reaction;
        else value.reaction = event.target.value as ComplianceSetting["reaction"]; change(value);
      }}><option value="inherit">Inherit ({effective.reaction})</option><option value="none">Silent</option><option value="advice">Advice</option><option value="autorepair">Repair if safe</option></select>
    </div>;
  }

  return <section className="compliance" aria-label="Compliance">
    <style>{css}</style>
    <header><h2><Shield size={20} aria-hidden="true" /> Compliance</h2>{onClose ? <button type="button" title="Close Compliance" aria-label="Close Compliance" onClick={() => { cancelled.current = true; onClose(); }}>Close</button> : null}</header>
    <div className="compliance-tabs" role="tablist" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === "Home" ? "results" : event.key === "End" ? "settings" : tab === "results" ? "settings" : "results";
      setTab(target); if (target === "settings") setSettingsShown(true);
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[target === "results" ? 0 : 1]?.focus();
    }}>
      <button type="button" role="tab" aria-selected={tab === "results"} onClick={() => setTab("results")}><Icon meaning="task" /> Results</button>
      <button type="button" role="tab" aria-selected={tab === "settings"} onClick={() => { setTab("settings"); setSettingsShown(true); }}><Icon meaning="settings" /> Settings</button>
    </div>
    {error ? <p className="compliance-error" role="alert">{error}</p> : null}
    {!reading ? <p role="status">Loading cached observations...</p> : null}
    <div role="tabpanel" hidden={tab !== "results"}>
      <div className="compliance-tools"><input aria-label="Search Compliance" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Sort Compliance" value={sort} onChange={event => setSort(event.target.value)}>{["topic", "severity", "name", "checkedAt", "changedAt"].map(value => <option key={value} value={value}>{value === "checkedAt" ? "Last checked" : value === "changedAt" ? "Last changed" : value}</option>)}</select>
        <label><input type="checkbox" checked={showHidden} onChange={event => setShowHidden(event.target.checked)} />Hidden</label>
        <label><input type="checkbox" checked={showHealthy} onChange={event => setShowHealthy(event.target.checked)} />All observations</label>
        <button type="button" disabled={busy || !reading || reading.pending === 0} onClick={() => void runRemaining()}><Icon meaning="refresh" /> Read remaining{reading ? ` (${reading.pending})` : ""}</button>
        {busy ? <button type="button" onClick={() => { cancelled.current = true; }}><Icon meaning="stop" /> Cancel</button> : null}
      </div>
      <p role="status">{rows.length} {showHealthy ? "cached items" : "findings"} · {reading?.observations.length ?? 0} observations{busy ? ` · ${reading?.pending ?? 0} remaining` : ""}</p>
      <div ref={virtual.containerRef} style={virtual.containerStyle} onPointerEnter={() => { setFrozenOrder(rows.map(key)); sortingPaused.current = true; }} onPointerLeave={() => { sortingPaused.current = false; setFrozenOrder([]); }}>
        <div style={virtual.listStyle}>{virtual.rows.map(({ item, key, style }) => {
          const rule = reading!.rules.find(rule => rule.id === item.ruleId)!;
          return <button type="button" key={key} style={style} className="compliance-row" onClick={() => setSelected(key)}>
            <span>{rule.title}<small style={{ display: "block" }}>{item.repairAdvice ? "Repair skipped - Advice" : item.subject}</small></span><span className={`compliance-severity ${rule.severity}`}>{rule.severity}</span>
            <time dateTime={item.checkedAt}>{displayTime(item.checkedAt)}</time>
          </button>;
        })}</div>
      </div>
      {item && itemRule ? <div className="compliance-detail"><h3>{itemRule.title}</h3>
        {item.repairAdvice ? <p role="status"><strong>Repair skipped - Advice: </strong>{item.repairAdvice}</p> : null}
        <dl>{Object.entries({ Outcome: item.outcome, Owner: item.owner === "sweep" ? "Managed by Sweep" : "Compliance", Producer: item.producer, Repository: item.repository,
          Worktree: item.worktree, Change: item.change, Branch: item.branch, Path: item.path, Revision: item.revision,
          "Last checked": displayTime(item.checkedAt), "Last changed": displayTime(item.changedAt), Evidence: item.evidence,
          Source: itemRule.source, Severity: itemRule.severity, "Recent check duration (ms)": item.durationSamplesMs?.at(-1),
          "Known finding": item.outcome === "unknown" ? item.finding?.evidence : undefined,
          Tracking: effectiveComplianceSetting(reading!.policy, itemRule).enabled ? "Enabled" : "Disabled" }).filter(([, value]) => value !== undefined).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <button type="button" title="Copy finding details" onClick={() => void navigator.clipboard.writeText(JSON.stringify(item, null, 2))}>Copy details</button>
        <button type="button" onClick={() => { setTab("settings"); setSettingsShown(true); }}>Rule settings</button>
        {item.owner !== "sweep" && item.finding && effectiveComplianceSetting(reading!.policy, itemRule).repair && effectiveComplianceSetting(reading!.policy, itemRule).enabled
          && effectiveComplianceSetting(reading!.policy, itemRule).reaction !== "none" ? <button type="button" disabled={busy} onClick={() => {
            if (!confirm(`Apply ${itemRule.repair} to ${item.path ?? item.subject}?`)) return;
            setBusy(true); void api({ op: "repair", ruleId: item.ruleId, subject: item.subject }).then(setReading, reason => setError(String(reason))).finally(() => setBusy(false));
          }}><Icon meaning="ok" /> {item.repairAdvice ? "Retry safe repair" : "Repair"}</button> : null}
      </div> : null}
    </div>
    {settingsShown && reading ? <div role="tabpanel" hidden={tab !== "settings"}>
      <select aria-label="Sort Compliance settings" value={sort} onChange={event => setSort(event.target.value)}>
        <option value="topic">Topic</option><option value="severity">Severity</option><option value="name">Alphabetical</option>
      </select>
      <label><input className="compliance-switch" type="checkbox" role="switch" aria-label="Background monitoring" checked={reading.policy.backgroundEnabled} disabled={saving}
        onChange={event => void save({ ...reading.policy, backgroundEnabled: event.target.checked })} /> Background monitoring</label>
      {policyRow("All Compliance", "global")}
      {sort === "topic" ? [...new Set(reading.rules.map(rule => rule.topic))].sort().map(topic => <section key={topic}><h3>{topic}</h3>
        {topic === "sweep" ? <p>Managed independently by Sweep</p> : <>{policyRow(topic, "topics", topic)}
          {reading.rules.filter(rule => rule.topic === topic).map(rule => policyRow(rule.title, "rules", rule.id, rule.severity))}</>}
      </section>) : [...reading.rules].filter(rule => rule.topic !== "sweep").sort((first, second) => sort === "severity"
        ? ["critical", "warning", "info"].indexOf(first.severity) - ["critical", "warning", "info"].indexOf(second.severity)
        : first.title.localeCompare(second.title)).map(rule => policyRow(rule.title, "rules", rule.id, rule.severity))}
    </div> : null}
  </section>;
}