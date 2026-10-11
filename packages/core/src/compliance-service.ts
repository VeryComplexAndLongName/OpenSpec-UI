import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
    ComplianceCache, ComplianceReader, effectiveComplianceSetting, type ComplianceObservation,
    type CompliancePolicy, type ComplianceRule, type CachedComplianceObservation
} from "./compliance.js";
import { ComplianceStore, complianceRepositoryIdentity, validateCompliancePolicy } from "./compliance-store.js";
import type { ProcessSnapshot } from "./process-ledger.js";
import { readWorkspaceLeaseHolder } from "./workspace-lease.js";
import type { WorktreeSurvey } from "./worktree-survey-facts.js";
import type { WorkspaceSweep } from "./workspace-sweep.js";

export const COMPLIANCE_RULES: readonly ComplianceRule[] = Object.freeze([
    { id: "worktree-inventory", topic: "workspace", title: "Registered working directories", source: "ADR-0026", severity: "info", conservativeMs: 50 },
    { id: "runtime-ignore", topic: "runtime", title: "Workbench state is ignored by Git", source: "ADR-0049", severity: "warning", conservativeMs: 500, repair: "append-runtime-ignore" },
    { id: "runtime-placement", topic: "runtime", title: "Runtime artifact roots and provenance", source: "ADR-0049", severity: "info", conservativeMs: 100 },
    { id: "change-integrity", topic: "changes", title: "Active and archived change identities", source: "ADR-0049", severity: "warning", conservativeMs: 100 },
    { id: "change-index", topic: "changes", title: "Declared README change index", source: "ADR-0049", severity: "info", conservativeMs: 100 },
    { id: "change-shadow", topic: "changes", title: "Untracked main copies beside owning worktrees", source: "ADR-0049", severity: "warning", conservativeMs: 500 },
    { id: "worktree-state", topic: "workspace", title: "Observed working directory state", source: "ADR-0026", severity: "info", conservativeMs: 50 },
    { id: "change-copies", topic: "changes", title: "Logical changes and physical copies", source: "ADR-0026 / ADR-0049", severity: "info", conservativeMs: 50 },
    { id: "sweep-result", topic: "sweep", title: "Workspace maintenance", source: "ADR-0034 / ADR-0035", severity: "warning", conservativeMs: 100 },
    { id: "process-overdue", topic: "process", title: "Overdue spawned processes", source: "ADR-0050", severity: "warning", conservativeMs: 50 },
    { id: "process-orphan", topic: "process", title: "Orphaned spawned processes", source: "ADR-0050", severity: "warning", conservativeMs: 50 },
]);

const STALE_MS = 30 * 60_000;
const execute = promisify(execFile);

async function names(directory: string): Promise<string[]> {
    try { return (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

async function ignored(root: string): Promise<boolean> {
    try {
        await execute("git", ["check-ignore", "--quiet", "--no-index", "--", ".openspec-ui/"], {
            cwd: root, windowsHide: true, timeout: 1_500, maxBuffer: 4_096,
            env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
        });
        return true;
    } catch (error) {
        if ((error as { code?: unknown }).code === 1) return false;
        throw new Error("Git could not verify the runtime ignore rule");
    }
}

export interface ComplianceReading {
    generation: number;
    policy: CompliancePolicy;
    rules: readonly ComplianceRule[];
    observations: CachedComplianceObservation[];
    pending: number;
    nextAllowedAtMs: number;
}

export class ComplianceService {
    private readonly cache = new ComplianceCache();
    private readonly reader = new ComplianceReader(this.cache);
    private nextAllowedAtMs = 0;

    constructor(readonly root: string, readonly store: ComplianceStore, private readonly checkIgnored = ignored) { }

    private roots(observations: readonly CachedComplianceObservation[]): string[] {
        const roots = new Map<string, string>();
        for (const root of [this.root, ...observations.filter(item => item.ruleId === "worktree-state")
            .flatMap(item => item.worktree === undefined ? [] : [item.worktree])]) {
            const normalized = path.resolve(root);
            const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
            if (!roots.has(key)) roots.set(key, root);
        }
        return [...roots.values()].slice(0, 100);
    }

    async read(): Promise<ComplianceReading> {
        const document = await this.store.read();
        this.cache.restore(document.observations);
        const observations = this.cache.snapshot();
        for (const observation of observations) if (observation.producer === "compliance-check" && observation.durationSamplesMs !== undefined) {
            const latest = observation.durationSamplesMs.at(-1) ?? 0;
            this.nextAllowedAtMs = Math.max(this.nextAllowedAtMs, Date.parse(observation.checkedAt) + Math.max(5_000, latest * 10));
        }
        const roots = this.roots(observations);
        const pending = this.steps(roots, document.policy, observations).length;
        return {
            generation: document.generation, policy: document.policy, rules: COMPLIANCE_RULES,
            observations, pending, nextAllowedAtMs: this.nextAllowedAtMs
        };
    }

    async savePolicy(value: unknown, generation: number): Promise<ComplianceReading> {
        const policy = validateCompliancePolicy(value);
        if (Object.keys(policy.rules).some(id => !COMPLIANCE_RULES.some(rule => rule.id === id))
            || Object.keys(policy.topics).some(topic => !COMPLIANCE_RULES.some(rule => rule.topic === topic))) {
            throw new Error("Unsupported Compliance rule or topic");
        }
        await this.store.update([], policy, generation);
        return this.read();
    }

    async initialize(): Promise<void> {
        const rule = COMPLIANCE_RULES.find(rule => rule.id === "runtime-ignore")!;
        const observation = await this.check(rule, this.root);
        await this.observe([observation]);
        if (observation.outcome !== "finding") return;
        try { await this.repair(rule.id, this.root); }
        catch { await this.observe([{ ...observation, outcome: "unknown", evidence: "Initialization could not safely repair the ignore file; review the known finding", checkedAt: new Date(Date.now() + 1).toISOString() }]); }
    }

    async observe(observations: readonly ComplianceObservation[]): Promise<void> {
        const document = await this.store.read();
        this.cache.restore(document.observations);
        for (const item of observations) this.cache.record({ ...item, repository: this.store.identity });
        await this.store.update(this.cache.snapshot());
    }

    private steps(roots: string[], policy: CompliancePolicy, observations: CachedComplianceObservation[]) {
        return roots.flatMap(root => COMPLIANCE_RULES.filter(rule => ["worktree-inventory", "runtime-ignore", "runtime-placement", "change-integrity", "change-index", "change-shadow"].includes(rule.id)
            && (!["worktree-inventory", "change-shadow"].includes(rule.id) || root === this.root)
            && effectiveComplianceSetting(policy, rule).enabled).flatMap(rule => {
                const previous = observations.find(item => item.ruleId === rule.id && item.subject === root);
                const dueAtMs = previous === undefined || (previous.continuation ?? 0) > 0 ? 0 : Date.parse(previous.checkedAt) + STALE_MS;
                if (dueAtMs > Date.now()) return [];
                const samples = [...(previous?.durationSamplesMs ?? [])].sort((first, second) => first - second);
                return [{ rule, subject: root, dueAtMs, measuredP95Ms: samples[Math.ceil(samples.length * 0.95) - 1], check: () => this.check(rule, root) }];
            }));
    }

    private async check(rule: ComplianceRule, root: string): Promise<ComplianceObservation> {
        let outcome: ComplianceObservation["outcome"] = "pass";
        let evidence = "Verified";
        let observedPath = root;
        try {
            if (await complianceRepositoryIdentity(root) !== this.store.identity) throw new Error("Working directory identity changed");
            if (rule.id === "worktree-inventory") {
                const directories = (await names(path.join(this.store.identity, "worktrees"))).sort();
                const revision = createHash("sha256").update(JSON.stringify(directories)).digest("hex");
                const previous = this.cache.snapshot().find(item => item.ruleId === rule.id && item.subject === root);
                const cursor = previous?.revision === revision ? previous.continuation ?? 0 : 0;
                const directory = directories[cursor];
                if (directory !== undefined && cursor < 100) {
                    const gitdir = (await readFile(path.join(this.store.identity, "worktrees", directory, "gitdir"), "utf8")).trim();
                    const worktree = path.dirname(gitdir);
                    if (await complianceRepositoryIdentity(worktree) !== this.store.identity) throw new Error("Registered worktree identity changed");
                    const head = (await readFile(path.join(this.store.identity, "worktrees", directory, "HEAD"), "utf8").catch(() => "")).trim();
                    const branch = head.startsWith("ref: refs/heads/") ? head.slice(16) : undefined;
                    const ownChange = branch !== undefined && await lstat(path.join(worktree, "openspec", "changes", branch)).then(info => info.isDirectory(), () => false) ? branch : undefined;
                    this.cache.record({ ...this.observation("worktree-state", worktree, "pass", "Registered with Git", worktree),
                        ...(branch === undefined ? {} : { branch }), ...(ownChange === undefined ? {} : { change: ownChange }) });
                }
                const completed = directory === undefined ? 0 : cursor + 1;
                const continuation = completed < Math.min(directories.length, 100) ? completed : 0;
                evidence = `${completed} of ${directories.length} registered sibling working directories observed; one directory per step`;
                return { ...this.observation(rule.id, root, directories.length > 100 ? "unknown" : "pass", evidence, root), revision, continuation };
            } else if (rule.id === "runtime-ignore") {
                observedPath = path.join(root, ".gitignore");
                const isIgnored = await this.checkIgnored(root);
                outcome = isIgnored ? "pass" : "finding";
                evidence = isIgnored ? "Git ignores .openspec-ui/" : "Git does not ignore .openspec-ui/; journals, audit/run logs and leases remain untouched";
            } else if (rule.id === "runtime-placement") {
                observedPath = path.join(root, ".openspec-ui");
                const entries = await readdir(observedPath).catch(error => {
                    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
                    throw error;
                });
                if (entries.length === 0) evidence = "No local runtime artifacts to inspect";
                else {
                    outcome = "unknown";
                    evidence = `Observed paths: ${entries.slice(0, 10).map(name => path.join(observedPath, name)).join(", ")}. Workspace journal and lease belong to the host-selected root; audit/run files follow their writer-selected root; machine identity and status use shared locations. Location alone does not establish wrong cwd. Review producer evidence; no logs are read or moved.`;
                }
            } else if (rule.id === "change-integrity") {
                observedPath = path.join(root, "openspec", "changes");
                const active = (await names(observedPath)).filter(name => name !== "archive");
                const archived = await names(path.join(this.root, "openspec", "changes", "archive"));
                const duplicates = active.filter(id => archived.some(name => name.replace(/^\d{4}-\d{2}-\d{2}-/u, "") === id));
                outcome = duplicates.length === 0 ? "pass" : "finding";
                evidence = duplicates.length === 0 ? "No active/archive identity collision" : `Active here and archived in main: ${duplicates.join(", ")}. Review both paths; do not delete uncommitted work.`;
            } else if (rule.id === "change-index") {
                observedPath = path.join(root, "openspec", "README.md");
                const text = await readFile(observedPath, "utf8");
                if (!/^#{1,6}\s+.*(?:active changes|change index)/imu.test(text)) {
                    outcome = "unknown"; evidence = "No declared active-change README index; an index is not assumed mandatory";
                } else {
                    const active = (await names(path.join(root, "openspec", "changes"))).filter(name => name !== "archive");
                    const missing = active.filter(id => !text.includes(`changes/${id}/`));
                    outcome = missing.length === 0 ? "pass" : "finding";
                    evidence = missing.length === 0 ? "Declared index covers active changes" : `Suggested links: ${missing.map(id => `changes/${id}/proposal.md`).join(", ")}`;
                }
            } else if (rule.id === "change-shadow") {
                observedPath = path.join(root, "openspec", "changes");
                const owned = this.cache.snapshot().filter(item => item.ruleId === "worktree-state" && item.change !== undefined && item.worktree !== root);
                if (owned.length === 0) evidence = "No observed change-owning sibling worktree";
                else {
                    const { stdout } = await execute("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", "openspec/changes"],
                        { cwd: root, windowsHide: true, timeout: 1_500, maxBuffer: 65_536, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
                    const files = stdout.split("\0").filter(Boolean).filter(file => owned.some(item => file.startsWith(`openspec/changes/${item.change}/`)));
                    outcome = files.length === 0 ? "pass" : "finding";
                    evidence = files.length === 0 ? "No untracked main shadow copies" : `Untracked main paths: ${files.slice(0, 10).join(", ")}; owning worktrees: ${owned.map(item => item.worktree).join(", ")}. Preserve all content.`;
                }
            }
        } catch {
            outcome = "unknown"; evidence = "This subject could not be checked safely; previous findings are retained";
        }
        return this.observation(rule.id, root, outcome, evidence.slice(0, 2_048), observedPath);
    }

    private observation(ruleId: string, root: string, outcome: ComplianceObservation["outcome"], evidence: string, observedPath: string): ComplianceObservation {
        return {
            ruleId, subject: root, producer: "compliance-check", owner: "compliance", repository: this.store.identity,
            worktree: root, path: observedPath, outcome, evidence,
            revision: createHash("sha256").update(evidence).digest("hex"), checkedAt: new Date().toISOString()
        };
    }

    async readRemainingStep(explicit: boolean, idle: boolean, signal?: AbortSignal): Promise<ComplianceReading> {
        const reading = await this.read();
        const roots = this.roots(reading.observations);
        const mutationActive = (await Promise.all(roots.map(root => readWorkspaceLeaseHolder(root)))).some(Boolean);
        if (mutationActive || signal?.aborted || Date.now() < this.nextAllowedAtMs || (!explicit && (!idle || !reading.policy.backgroundEnabled))) return reading;
        await mkdir(path.dirname(this.store.filePath), { recursive: true });
        await open(`${this.store.filePath}.checks`, "wx").then(async handle => {
            try {
                const result = await this.reader.readOne(this.steps(roots, reading.policy, reading.observations), reading.policy,
                    { explicit, idle, mutationActive, remainingMs: explicit ? 2_000 : 750 }, signal);
                this.nextAllowedAtMs = result.nextAllowedAtMs;
                if (result.state === "checked") {
                    await this.store.update(this.cache.snapshot());
                    const rule = COMPLIANCE_RULES.find(rule => rule.id === result.ruleId);
                    const observation = this.cache.snapshot().find(item => item.ruleId === result.ruleId && item.subject === result.subject);
                    if (!explicit && rule !== undefined && observation?.outcome === "finding"
                        && effectiveComplianceSetting(reading.policy, rule).reaction === "autorepair") {
                        await this.repair(result.ruleId, result.subject);
                    }
                }
            } finally { await handle.close(); await rm(`${this.store.filePath}.checks`, { force: true }); }
        }).catch(error => {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        });
        return this.read();
    }

    async repair(ruleId: string, subject: string): Promise<ComplianceReading> {
        try { return await this.attemptRepair(ruleId, subject); }
        catch (error) {
            if (!(error instanceof UnsafeComplianceRepair)) throw error;
            const reading = await this.read();
            const item = reading.observations.find(item => item.ruleId === ruleId && item.subject === subject);
            if (item?.owner !== "compliance" || item.finding === undefined) throw error;
            await this.observe([{ ...item, repairAdvice: error.message,
                checkedAt: new Date(Math.max(Date.now(), Date.parse(item.checkedAt) + 1)).toISOString() }]);
            return this.read();
        }
    }

    private async attemptRepair(ruleId: string, subject: string): Promise<ComplianceReading> {
        await mkdir(path.dirname(this.store.filePath), { recursive: true });
        const lockPath = `${this.store.filePath}.repair`;
        const lock = await open(lockPath, "wx").catch(error => {
            if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new UnsafeComplianceRepair("Another host is repairing this repository. Wait for it to finish before retrying.");
            throw error;
        });
        try { return await this.repairLocked(ruleId, subject); }
        finally { await lock.close(); await rm(lockPath, { force: true }); }
    }

    private async repairLocked(ruleId: string, subject: string): Promise<ComplianceReading> {
        const reading = await this.read();
        const rule = COMPLIANCE_RULES.find(item => item.id === ruleId);
        const item = reading.observations.find(item => item.ruleId === ruleId && item.subject === subject);
        if (rule === undefined || item === undefined || item.owner === "sweep"
            || rule.repair !== "append-runtime-ignore" || item.finding === undefined
            || effectiveComplianceSetting(reading.policy, rule, item.owner).reaction === "none"
            || !effectiveComplianceSetting(reading.policy, rule).enabled) throw new Error("No permitted safe repair for this finding");
        if (await complianceRepositoryIdentity(subject) !== this.store.identity || await readWorkspaceLeaseHolder(subject)) {
            throw new UnsafeComplianceRepair("Repair is blocked while the workspace is changing. Wait for the active operation to finish and check again.");
        }
        let gitDirectory = path.join(subject, ".git");
        if ((await lstat(gitDirectory)).isFile()) {
            const declaration = (await readFile(gitDirectory, "utf8")).trim();
            if (!declaration.startsWith("gitdir: ")) throw new UnsafeComplianceRepair("Git directory cannot be verified. Review repository metadata before retrying.");
            gitDirectory = path.resolve(subject, declaration.slice(8));
        }
        for (const marker of ["index.lock", "MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD"]) {
            if (await lstat(path.join(gitDirectory, marker)).then(() => true, error => {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
                throw error;
            })) throw new UnsafeComplianceRepair("Repair is blocked by an active Git operation. Complete or abort that operation before retrying.");
        }
        let isIgnored: boolean;
        try { isIgnored = await this.checkIgnored(subject); }
        catch { throw new UnsafeComplianceRepair("Git could not verify ignore safety. Restore Git access and check again; no repair was attempted."); }
        if (!isIgnored) {
            const file = path.join(subject, ".gitignore");
            const metadata = await lstat(file).catch(error => {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
                refuseIgnoreAccess(error);
                throw error;
            });
            if (metadata !== undefined && (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 1_000_000)) throw new UnsafeComplianceRepair("Ignore file cannot be changed safely. Review its type, link target and size manually.");
            const before = await readFile(file, "utf8").catch(error => {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
                refuseIgnoreAccess(error);
                throw error;
            });
            if (before.includes("\0") || before.includes("\uFFFD")) throw new UnsafeComplianceRepair("Ignore file encoding is not safe to change. Review the encoding and add the ignore rule manually.");
            const ending = before.includes("\r\n") ? "\r\n" : "\n";
            const handle = await open(file, metadata === undefined ? "wx+" : "r+").catch(error => {
                refuseIgnoreAccess(error);
                if ((error as NodeJS.ErrnoException).code === "EEXIST") {
                    throw new UnsafeComplianceRepair("Ignore file appeared during repair. Review its contents and check again.");
                }
                throw error;
            });
            try {
                if ((await handle.readFile("utf8")) !== before) throw new UnsafeComplianceRepair("Ignore file changed. Check the latest contents before retrying.");
                const append = `${before.length > 0 && !before.endsWith("\n") ? ending : ""}/.openspec-ui/${ending}`;
                await handle.write(append, Buffer.byteLength(before), "utf8");
            } finally { await handle.close(); }
            if (!await this.checkIgnored(subject)) throw new Error("Ignore rule was appended but Git still does not ignore the path; review negations");
        }
        await this.observe([await this.check(rule, subject)]);
        return this.read();
    }
}

class UnsafeComplianceRepair extends Error {}

function refuseIgnoreAccess(error: unknown): void {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM" || code === "EBUSY") {
        throw new UnsafeComplianceRepair("Ignore file access is denied or busy. Review permissions or close the file owner before retrying; do not bypass protection.");
    }
}

const services = new Map<string, Promise<ComplianceService>>();
export function complianceFor(root: string): Promise<ComplianceService> {
    const key = path.resolve(root);
    let service = services.get(key);
    if (service === undefined) {
        service = complianceRepositoryIdentity(key).then(identity => new ComplianceService(
            path.basename(identity) === ".git" ? path.dirname(identity) : key, new ComplianceStore(identity)));
        services.set(key, service);
        void service.catch(() => { services.delete(key); });
    }
    return service;
}

export async function dispatchCompliance(root: string, value: unknown): Promise<ComplianceReading> {
    if (typeof value !== "object" || value === null) throw new Error("Invalid Compliance request");
    const request = value as Record<string, unknown>;
    const service = await complianceFor(root);
    if (request.op === "read") return service.read();
    if (request.op === "step") return service.readRemainingStep(true, false);
    if (request.op === "background" && typeof request.idle === "boolean") return service.readRemainingStep(false, request.idle);
    if (request.op === "settings" && Number.isSafeInteger(request.generation)) return service.savePolicy(request.policy, request.generation as number);
    if (request.op === "repair" && typeof request.ruleId === "string" && typeof request.subject === "string") return service.repair(request.ruleId, request.subject);
    throw new Error("Unsupported Compliance operation");
}

export async function recordComplianceSurvey(root: string, survey: WorktreeSurvey): Promise<void> {
    const service = await complianceFor(root);
    await service.observe(complianceSurveyObservations(service.store.identity, survey));
}

/** A conservative expected duration for a spawned executable. Known tool
 * subprocesses get a short default; anything else has no known limit and is
 * reported rather than presumed safe. */
export function processExpectedDurationMs(executable: string): { known: boolean; ms: number } {
    const name = path.basename(executable).toLowerCase();
    if (name === "git" || name === "openspec" || name === "openspec-ui-cli" || name === "node" || name === "npm") {
        return { known: true, ms: 5 * 60_000 };
    }
    return { known: false, ms: Number.POSITIVE_INFINITY };
}

/** Turns ledger snapshots into read-only Compliance observations. A process
 * started before this host instance began is orphaned; a process past its
 * known duration is overdue; a process with no known limit is reported, not
 * presumed safe. Nothing here terminates a process. */
export function complianceProcessObservations(
    repository: string,
    snapshots: readonly ProcessSnapshot[],
    checkedAt = new Date().toISOString(),
    thisHostStartedAtMs = Date.now() - process.uptime() * 1000,
): ComplianceObservation[] {
    const observations: ComplianceObservation[] = [];
    for (const snapshot of snapshots) {
        if (snapshot.exitedAt !== undefined) continue;
        const ageMs = Date.now() - Date.parse(snapshot.spawnedAt);
        const orphan = Date.parse(snapshot.spawnedAt) < thisHostStartedAtMs - 1_000;
        const duration = processExpectedDurationMs(snapshot.executablePath);
        const overdue = duration.known && ageMs > duration.ms;
        const subject = `${snapshot.runId}:${snapshot.pid}`;
        const base = {
            subject, producer: "process-ledger", owner: "compliance" as const, repository,
            worktree: snapshot.cwd, path: snapshot.executablePath,
            ...(snapshot.changeName !== undefined ? { change: snapshot.changeName } : {}),
            revision: snapshot.commandLineHash, checkedAt,
        };
        if (orphan) {
            observations.push({ ...base, ruleId: "process-orphan", outcome: "finding",
                evidence: `Process ${snapshot.pid} (${path.basename(snapshot.executablePath)}) was started by a previous host instance and has not exited. Confirm its identity before terminating it from recovery.` });
        } else if (overdue) {
            observations.push({ ...base, ruleId: "process-overdue", outcome: "finding",
                evidence: `Process ${snapshot.pid} (${path.basename(snapshot.executablePath)}) has run ${Math.round(ageMs / 60_000)}m against an expected ${Math.round(duration.ms / 60_000)}m. Terminate it from recovery if it is ours.` });
        } else if (!duration.known) {
            observations.push({ ...base, ruleId: "process-overdue", outcome: "unknown",
                evidence: `Process ${snapshot.pid} (${path.basename(snapshot.executablePath)}) has no declared duration limit and is still running.` });
        } else {
            observations.push({ ...base, ruleId: "process-overdue", outcome: "pass",
                evidence: `Within its expected duration.` });
        }
    }
    return observations;
}

export async function recordComplianceProcesses(
    root: string,
    snapshots: readonly ProcessSnapshot[],
    thisHostStartedAtMs = Date.now() - process.uptime() * 1000,
): Promise<void> {
    const service = await complianceFor(root);
    await service.observe(complianceProcessObservations(service.store.identity, snapshots, new Date().toISOString(), thisHostStartedAtMs));
}

export function complianceSurveyObservations(repository: string, survey: WorktreeSurvey, checkedAt = new Date().toISOString()): ComplianceObservation[] {
    const observations: ComplianceObservation[] = survey.directories.slice(0, 100).map(directory => {
        const evidence = !directory.readable ? "Working directory could not be read"
            : directory.finishedWith !== undefined ? `Possibly stale: ${directory.finishedWith.reason}; Sweep owns cleanup`
            : `${directory.changes.length} active change copies; ${directory.runs.length} recorded runs${directory.notOnServer ? `; upstream: ${directory.notOnServer}` : ""}`;
        return { ruleId: "worktree-state", subject: directory.path, producer: "worktree-survey", owner: "compliance" as const,
            repository, worktree: directory.path, path: directory.path,
            ...(directory.branch !== undefined ? { branch: directory.branch } : {}),
            ...(directory.ownChange !== undefined ? { change: directory.ownChange } : {}),
            revision: createHash("sha256").update(evidence).digest("hex"), evidence, checkedAt,
            outcome: !directory.readable ? "unknown" as const : directory.finishedWith !== undefined || directory.notOnServer !== undefined ? "finding" as const : "pass" as const };
    });
    for (const change of groupComplianceChanges(survey)) observations.push({
        ruleId: "change-copies", subject: change.id, change: change.id, producer: "worktree-survey", owner: "compliance",
        repository, revision: createHash("sha256").update(JSON.stringify(change.paths)).digest("hex"),
        evidence: `One logical change; ${change.paths.length} physical copies: ${change.paths.join(", ")}`.slice(0, 2_048),
        checkedAt, outcome: "pass", path: change.paths[0],
    });
    return observations;
}

export function groupComplianceChanges(survey: WorktreeSurvey): Array<{ id: string; paths: string[] }> {
    const copies = new Map<string, Set<string>>();
    for (const directory of survey.directories) {
        if (!directory.readable) continue;
        for (const change of directory.changes) {
            const paths = copies.get(change.changeName) ?? new Set<string>();
            paths.add(path.join(directory.path, "openspec", "changes", change.changeName));
            copies.set(change.changeName, paths);
        }
    }
    return [...copies].map(([id, paths]) => ({ id, paths: [...paths] }));
}

export async function recordComplianceSweep(root: string, sweep: WorkspaceSweep): Promise<void> {
    const service = await complianceFor(root);
    const checkedAt = new Date().toISOString();
    const observations: ComplianceObservation[] = [];
    const add = (subject: string, outcome: ComplianceObservation["outcome"], evidence: string, location: string, branch?: string) => {
        observations.push({ ruleId: "sweep-result", subject, producer: "workspace-sweep", owner: "sweep",
            repository: service.store.identity, path: location, worktree: location,
            ...(branch === undefined ? {} : { branch }), revision: createHash("sha256").update(evidence).digest("hex"),
            evidence: evidence.slice(0, 2_048), checkedAt, outcome });
    };
    for (const branch of sweep.branches?.conflicted ?? []) add(`branch:${branch.branch}`, "finding",
        `Sweep aborted rebase onto ${branch.onto}; conflicts: ${branch.conflicts.join(", ")}. Manual resolution is required.`, branch.path, branch.branch);
    for (const branch of sweep.branches?.failed ?? []) add(`branch:${branch.branch}`, "unknown",
        "Sweep could not complete rebase/push; review its output for details", branch.path, branch.branch);
    for (const branch of sweep.branches?.rebased ?? []) add(`branch:${branch.branch}`, "pass",
        `Sweep rebased onto ${branch.onto} and pushed with a lease`, branch.path, branch.branch);
    for (const branch of sweep.branches?.skipped ?? []) if (branch.branch !== undefined) {
        add(`branch:${branch.branch}`, branch.reason === "up-to-date" ? "pass" : "unknown", `Sweep left this branch alone: ${branch.reason}`, branch.path, branch.branch);
    }
    for (const owing of sweep.archive?.owing ?? []) add(`change:${owing.changeName}`, "finding",
        `Sweep is waiting: ${owing.owes.length} required tasks remain open after landing`, root);
    add("workspace", "pass", `Sweep completed: ${sweep.directories.removed.length} directories removed; ${sweep.branches?.rebased.length ?? 0} branches rebased`, root);
    await service.observe(observations);
}