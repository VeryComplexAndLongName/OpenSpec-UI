export type ComplianceReaction = "none" | "advice" | "autorepair";
export type ComplianceSeverity = "critical" | "warning" | "info";
export type ComplianceOutcome = "pass" | "finding" | "unknown";

export interface ComplianceRule {
    id: string;
    topic: string;
    title: string;
    source: string;
    severity: ComplianceSeverity;
    conservativeMs: number;
    repair?: string;
}

export interface ComplianceSetting {
    enabled?: boolean;
    reaction?: ComplianceReaction;
}

export interface CompliancePolicy {
    backgroundEnabled: boolean;
    global: ComplianceSetting;
    topics: Record<string, ComplianceSetting>;
    rules: Record<string, ComplianceSetting>;
}

export interface EffectiveComplianceSetting {
    enabled: boolean;
    reaction: ComplianceReaction;
    enabledFrom: "default" | "global" | "topic" | "rule";
    reactionFrom: "default" | "global" | "topic" | "rule";
    repair?: string;
}

export interface ComplianceObservation {
    ruleId: string;
    subject: string;
    producer: string;
    owner: "compliance" | "sweep";
    repository: string;
    worktree?: string;
    change?: string;
    branch?: string;
    path?: string;
    revision: string;
    outcome: ComplianceOutcome;
    evidence: string;
    checkedAt: string;
    durationSamplesMs?: number[];
    continuation?: number;
    repairAdvice?: string;
}

export interface CachedComplianceObservation extends ComplianceObservation {
    changedAt: string;
    finding?: ComplianceObservation;
}

export function effectiveComplianceSetting(
    policy: CompliancePolicy,
    rule: ComplianceRule,
    owner: ComplianceObservation["owner"] = "compliance",
): EffectiveComplianceSetting {
    const effective: EffectiveComplianceSetting = {
        enabled: true, reaction: "advice", enabledFrom: "default", reactionFrom: "default",
    };
    for (const level of ["global", "topic", "rule"] as const) {
        const setting = level === "global" ? policy.global
            : level === "topic" ? policy.topics[rule.topic] : policy.rules[rule.id];
        if (setting?.enabled !== undefined) {
            effective.enabled = setting.enabled;
            effective.enabledFrom = level;
        }
        if (setting?.reaction !== undefined) {
            effective.reaction = setting.reaction;
            effective.reactionFrom = level;
        }
    }
    if (owner === "sweep" || rule.repair === undefined) {
        if (effective.reaction === "autorepair") effective.reaction = "advice";
    } else {
        effective.repair = rule.repair;
    }
    return effective;
}

function observationKey(observation: Pick<ComplianceObservation, "repository" | "ruleId" | "subject">): string {
    return JSON.stringify([observation.repository, observation.ruleId, observation.subject]);
}

function sameResult(previous: ComplianceObservation, next: ComplianceObservation): boolean {
    return previous.outcome === next.outcome && previous.evidence === next.evidence
        && previous.producer === next.producer && previous.owner === next.owner
        && previous.worktree === next.worktree && previous.change === next.change
        && previous.branch === next.branch && previous.path === next.path
        && previous.repairAdvice === next.repairAdvice;
}

export class ComplianceCache {
    private readonly observations = new Map<string, CachedComplianceObservation>();
    private readonly listeners = new Set<() => void>();

    constructor(private readonly capacity = 1_000) {
        if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Invalid Compliance cache capacity");
    }

    record(observation: ComplianceObservation): boolean {
        const timestamp = Date.parse(observation.checkedAt);
        if (!Number.isFinite(timestamp)) throw new Error("Invalid Compliance checkedAt");
        if (observation.evidence.length > 2_048) throw new Error("Compliance evidence exceeds its limit");
        if (observation.repairAdvice !== undefined && (typeof observation.repairAdvice !== "string" || observation.repairAdvice.length > 512)) {
            throw new Error("Invalid Compliance repair advice");
        }
        if (observation.continuation !== undefined && (!Number.isSafeInteger(observation.continuation) || observation.continuation < 0 || observation.continuation > 100)) {
            throw new Error("Invalid Compliance continuation");
        }
        if (observation.durationSamplesMs !== undefined && (!Array.isArray(observation.durationSamplesMs)
            || observation.durationSamplesMs.length > 20 || observation.durationSamplesMs.some(value => !Number.isFinite(value) || value < 0))) {
            throw new Error("Invalid Compliance duration history");
        }
        for (const value of [observation.ruleId, observation.subject, observation.producer,
        observation.repository, observation.revision, observation.worktree, observation.change,
        observation.branch, observation.path]) {
            if (value !== undefined && (value.length === 0 || value.length > 4_096)) {
                throw new Error("Invalid Compliance observation identity");
            }
        }
        const key = observationKey(observation);
        const previous = this.observations.get(key);
        if (previous !== undefined && Date.parse(previous.checkedAt) >= timestamp) return false;
        const next: CachedComplianceObservation = {
            ...observation,
            ...(observation.durationSamplesMs !== undefined ? { durationSamplesMs: [...observation.durationSamplesMs] } : {}),
            checkedAt: new Date(timestamp).toISOString(),
            changedAt: previous !== undefined && sameResult(previous, observation)
                ? previous.changedAt : new Date(timestamp).toISOString(),
        };
        if (observation.outcome === "finding") next.finding = { ...next };
        else if (observation.outcome === "unknown" && previous?.finding !== undefined) {
            next.finding = { ...previous.finding };
        }
        this.observations.delete(key);
        this.observations.set(key, next);
        while (this.observations.size > this.capacity) {
            const oldest = this.observations.keys().next().value;
            if (oldest !== undefined) this.observations.delete(oldest);
        }
        for (const listener of this.listeners) listener();
        return true;
    }

    snapshot(): CachedComplianceObservation[] {
        return [...this.observations.values()].map(observation => ({
            ...observation,
            ...(observation.durationSamplesMs !== undefined ? { durationSamplesMs: [...observation.durationSamplesMs] } : {}),
            ...(observation.finding !== undefined ? { finding: { ...observation.finding } } : {}),
        }));
    }

    restore(observations: readonly CachedComplianceObservation[]): void {
        for (const observation of [...observations].sort((first, second) => Date.parse(first.checkedAt) - Date.parse(second.checkedAt))) {
            if (!this.record(observation)) continue;
            const current = this.observations.get(observationKey(observation));
            if (current === undefined) continue;
            const changed = Date.parse(observation.changedAt);
            if (Number.isFinite(changed) && changed <= Date.parse(current.checkedAt)) current.changedAt = observation.changedAt;
            if (observation.outcome === "unknown" && observation.finding !== undefined) {
                current.finding = { ...observation.finding };
            }
        }
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
}

export interface ComplianceStep {
    rule: ComplianceRule;
    subject: string;
    dueAtMs: number;
    measuredP95Ms?: number;
    retryAfterMs?: number;
}

export interface ComplianceWorkWindow {
    explicit: boolean;
    idle: boolean;
    mutationActive: boolean;
    checkActive: boolean;
    cancelled: boolean;
    nowMs: number;
    remainingMs: number;
    nextAllowedAtMs: number;
}

export function nextComplianceStep<Step extends ComplianceStep>(
    steps: readonly Step[],
    policy: CompliancePolicy,
    window: ComplianceWorkWindow,
): Step | undefined {
    if (window.cancelled || window.checkActive || window.mutationActive
        || !Number.isFinite(window.remainingMs) || window.remainingMs <= 0
        || window.nowMs < window.nextAllowedAtMs
        || (!window.explicit && (!policy.backgroundEnabled || !window.idle))) return undefined;
    return steps.filter(step => {
        const estimate = Math.max(step.rule.conservativeMs, step.measuredP95Ms ?? 0);
        return effectiveComplianceSetting(policy, step.rule).enabled
            && step.dueAtMs <= window.nowMs && (step.retryAfterMs ?? 0) <= window.nowMs
            && Number.isFinite(estimate) && estimate > 0 && estimate <= window.remainingMs;
    }).sort((first, second) => first.dueAtMs - second.dueAtMs
        || Math.max(first.rule.conservativeMs, first.measuredP95Ms ?? 0)
        - Math.max(second.rule.conservativeMs, second.measuredP95Ms ?? 0)
        || first.rule.id.localeCompare(second.rule.id))[0];
}

export interface ComplianceCheckStep extends ComplianceStep {
    check: (signal?: AbortSignal) => Promise<ComplianceObservation>;
}

export type ComplianceStepResult =
    | { state: "deferred"; nextAllowedAtMs: number }
    | { state: "checked"; ruleId: string; subject: string; elapsedMs: number; nextAllowedAtMs: number }
    | { state: "failed"; ruleId: string; subject: string; nextAllowedAtMs: number };

export class ComplianceReader {
    private active = false;
    private nextAllowedAtMs = 0;
    private readonly history = new Map<string, number[]>();
    private readonly failures = new Map<string, { count: number; retryAtMs: number }>();

    constructor(
        private readonly cache: ComplianceCache,
        private readonly now: () => number = Date.now,
        private readonly minimumGapMs = 5_000,
    ) {
        if (!Number.isFinite(minimumGapMs) || minimumGapMs < 1_000) {
            throw new Error("Compliance steps require a minimum gap of at least one second");
        }
    }

    async readOne(
        steps: readonly ComplianceCheckStep[],
        policy: CompliancePolicy,
        window: Pick<ComplianceWorkWindow, "explicit" | "idle" | "mutationActive" | "remainingMs">,
        signal?: AbortSignal,
    ): Promise<ComplianceStepResult> {
        const candidates = steps.map(step => {
            const key = JSON.stringify([step.rule.id, step.subject]);
            const durations = [...(this.history.get(key) ?? [])].sort((first, second) => first - second);
            return {
                ...step,
                measuredP95Ms: durations.length === 0 ? step.measuredP95Ms
                    : Math.max(step.measuredP95Ms ?? 0, durations[Math.ceil(durations.length * 0.95) - 1] ?? 0),
                retryAfterMs: Math.max(step.retryAfterMs ?? 0, this.failures.get(key)?.retryAtMs ?? 0),
            };
        });
        const step = nextComplianceStep(candidates, policy, {
            ...window, checkActive: this.active, cancelled: signal?.aborted === true,
            nowMs: this.now(), nextAllowedAtMs: this.nextAllowedAtMs,
        });
        if (step === undefined) return { state: "deferred", nextAllowedAtMs: this.nextAllowedAtMs };
        this.active = true;
        const startedAtMs = this.now();
        const key = JSON.stringify([step.rule.id, step.subject]);
        try {
            const observation = await step.check(signal);
            if (observation.ruleId !== step.rule.id || observation.subject !== step.subject
                || observation.owner !== "compliance") throw new Error("Compliance check returned a different subject");
            const elapsedMs = Math.max(0, this.now() - startedAtMs);
            const previous = this.cache.snapshot().find(item => item.ruleId === observation.ruleId && item.subject === observation.subject);
            const durations = this.history.get(key) ?? previous?.durationSamplesMs ?? [];
            const samples = [...durations, elapsedMs].slice(-20);
            this.cache.record({ ...observation, durationSamplesMs: samples });
            this.failures.delete(key);
            this.history.set(key, samples);
            this.nextAllowedAtMs = this.now() + Math.max(this.minimumGapMs, elapsedMs * 10);
            return {
                state: "checked", ruleId: step.rule.id, subject: step.subject,
                elapsedMs, nextAllowedAtMs: this.nextAllowedAtMs
            };
        } catch {
            const count = Math.min((this.failures.get(key)?.count ?? 0) + 1, 10);
            const retryAtMs = this.now() + Math.min(3_600_000, this.minimumGapMs * 2 ** count);
            this.failures.set(key, { count, retryAtMs });
            this.nextAllowedAtMs = this.now() + this.minimumGapMs;
            return {
                state: "failed", ruleId: step.rule.id, subject: step.subject,
                nextAllowedAtMs: retryAtMs
            };
        } finally {
            this.active = false;
        }
    }
}