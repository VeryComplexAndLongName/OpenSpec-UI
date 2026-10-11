import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ComplianceCache, type CachedComplianceObservation, type ComplianceObservation, type CompliancePolicy, type ComplianceSetting } from "./compliance.js";

export const DEFAULT_COMPLIANCE_POLICY: CompliancePolicy = {
    backgroundEnabled: false, global: {}, topics: {}, rules: {},
};

export interface ComplianceDocument {
    version: 1;
    generation: number;
    policy: CompliancePolicy;
    observations: CachedComplianceObservation[];
}

function object(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid Compliance state");
    return value as Record<string, unknown>;
}

function setting(value: unknown): ComplianceSetting {
    const data = object(value);
    if (Object.keys(data).some(key => key !== "enabled" && key !== "reaction")) throw new Error("Unknown Compliance setting");
    if (data.enabled !== undefined && typeof data.enabled !== "boolean") throw new Error("Invalid Compliance tracking setting");
    if (data.reaction !== undefined && !["none", "advice", "autorepair"].includes(String(data.reaction))) throw new Error("Invalid Compliance reaction");
    return {
        ...(data.enabled !== undefined ? { enabled: data.enabled as boolean } : {}),
        ...(data.reaction !== undefined ? { reaction: data.reaction as ComplianceSetting["reaction"] } : {})
    };
}

export function validateCompliancePolicy(value: unknown): CompliancePolicy {
    const data = object(value);
    if (typeof data.backgroundEnabled !== "boolean" || Object.keys(data).some(key => !["backgroundEnabled", "global", "topics", "rules"].includes(key))) {
        throw new Error("Invalid Compliance policy");
    }
    const parseEntries = (input: unknown): Record<string, ComplianceSetting> => {
        const entries = Object.entries(object(input));
        if (entries.length > 100 || entries.some(([key]) => !/^[a-z][a-z0-9-]{0,79}$/u.test(key))) throw new Error("Invalid Compliance rule/topic id");
        return Object.fromEntries(entries.map(([key, entry]) => [key, setting(entry)]));
    };
    return {
        backgroundEnabled: data.backgroundEnabled, global: setting(data.global),
        topics: parseEntries(data.topics), rules: parseEntries(data.rules)
    };
}

function observation(value: unknown): ComplianceObservation {
    const data = object(value);
    for (const key of ["ruleId", "subject", "producer", "repository", "revision", "evidence", "checkedAt"] as const) {
        if (typeof data[key] !== "string") throw new Error("Invalid Compliance observation");
    }
    if (!["compliance", "sweep"].includes(String(data.owner)) || !["pass", "finding", "unknown"].includes(String(data.outcome))) {
        throw new Error("Invalid Compliance observation outcome");
    }
    const optional: Partial<ComplianceObservation> = {};
    for (const key of ["worktree", "change", "branch", "path", "repairAdvice"] as const) {
        if (data[key] !== undefined) {
            if (typeof data[key] !== "string") throw new Error("Invalid Compliance observation path");
            optional[key] = data[key];
        }
    }
    return {
        ruleId: data.ruleId as string, subject: data.subject as string, producer: data.producer as string,
        repository: data.repository as string, revision: data.revision as string, evidence: data.evidence as string,
        checkedAt: data.checkedAt as string, owner: data.owner as ComplianceObservation["owner"],
        outcome: data.outcome as ComplianceObservation["outcome"], ...optional,
        ...(data.durationSamplesMs !== undefined ? { durationSamplesMs: data.durationSamplesMs as number[] } : {})
        , ...(data.continuation !== undefined ? { continuation: data.continuation as number } : {})
    };
}

function document(value: unknown): ComplianceDocument {
    const data = object(value);
    if (data.version !== 1 || !Number.isSafeInteger(data.generation) || (data.generation as number) < 0
        || !Array.isArray(data.observations) || data.observations.length > 1_000) throw new Error("Unsupported Compliance state");
    const cache = new ComplianceCache();
    cache.restore(data.observations.map(value => {
        const data = object(value);
        const latest = observation(data);
        if (typeof data.changedAt !== "string" || !Number.isFinite(Date.parse(data.changedAt))) throw new Error("Invalid Compliance change time");
        const finding = data.finding === undefined ? undefined : observation(data.finding);
        if (finding !== undefined && (finding.outcome !== "finding" || finding.ruleId !== latest.ruleId
            || finding.subject !== latest.subject || finding.repository !== latest.repository)) throw new Error("Invalid retained Compliance finding");
        return { ...latest, changedAt: data.changedAt, ...(finding !== undefined ? { finding } : {}) };
    }));
    return { version: 1, generation: data.generation as number, policy: validateCompliancePolicy(data.policy), observations: cache.snapshot() };
}

export async function complianceRepositoryIdentity(workspaceRoot: string): Promise<string> {
    const root = await realpath(workspaceRoot);
    const gitPath = path.join(root, ".git");
    let directory = gitPath;
    try {
        if (!(await stat(gitPath)).isDirectory()) {
            const declaration = (await readFile(gitPath, "utf8")).trim();
            if (!declaration.startsWith("gitdir: ")) throw new Error("Invalid Git directory declaration");
            directory = path.resolve(root, declaration.slice(8));
        }
        const common = await readFile(path.join(directory, "commondir"), "utf8").catch(error => {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return ".";
            throw error;
        });
        const canonical = await realpath(path.resolve(directory, common.trim()));
        return process.platform === "win32" ? canonical.toLowerCase() : canonical;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return root;
        throw error;
    }
}

export class ComplianceStore {
    readonly filePath: string;

    constructor(readonly identity: string, stateRoot = path.join(os.homedir(), ".openspec-ui", "compliance")) {
        const key = createHash("sha256").update(identity).digest("hex");
        this.filePath = path.join(stateRoot, `${key}.json`);
    }

    async read(): Promise<ComplianceDocument> {
        try {
            if ((await stat(this.filePath)).size > 16_000_000) throw new Error("Compliance state exceeds its limit");
            return document(JSON.parse(await readFile(this.filePath, "utf8")));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            return { version: 1, generation: 0, policy: structuredClone(DEFAULT_COMPLIANCE_POLICY), observations: [] };
        }
    }

    async update(observations: readonly CachedComplianceObservation[], policy?: CompliancePolicy, expectedGeneration?: number): Promise<ComplianceDocument> {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const lock = `${this.filePath}.lock`;
        const handle = await open(lock, "wx").catch(error => {
            if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Compliance state is being updated by another host; retry later");
            throw error;
        });
        const temporary = `${this.filePath}.${randomUUID()}.tmp`;
        try {
            const current = await this.read();
            if (policy !== undefined && expectedGeneration !== current.generation) throw new Error("Compliance settings changed in another host; reload before saving");
            const cache = new ComplianceCache();
            cache.restore(current.observations);
            cache.restore(observations);
            const next: ComplianceDocument = {
                version: 1, generation: current.generation + 1,
                policy: policy === undefined ? current.policy : validateCompliancePolicy(policy), observations: cache.snapshot()
            };
            const writer = await open(temporary, "wx");
            try { await writer.writeFile(`${JSON.stringify(next)}\n`, "utf8"); } finally { await writer.close(); }
            await rename(temporary, this.filePath);
            return next;
        } finally {
            await handle.close();
            await rm(lock, { force: true });
            await rm(temporary, { force: true });
        }
    }
}