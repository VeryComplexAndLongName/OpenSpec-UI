import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
    deserializeCheckpoint,
    type SerializedWorkbenchCheckpoint,
} from "./checkpoint.js";
import type { WorkbenchProcess } from "./process-scheduler.js";

export const WORKBENCH_RUN_JOURNAL_VERSION = 2;

export interface PersistedCheckpointSession {
    processId: string;
    changeName?: string;
    checkpoint: SerializedWorkbenchCheckpoint;
}

export interface WorkbenchRunJournalData {
    processes: WorkbenchProcess[];
    checkpointSessions: PersistedCheckpointSession[];
}

/** What `load()` returns for a checkpoint session: the reference the
 * journal actually stores, plus a way to read the payload when something
 * needs it. Deliberately not a `PersistedCheckpointSession` — a type that
 * carries the checkpoint is a type every caller can read without meaning
 * to, which is how activation came to read every file on disk. */
export interface RestoredCheckpointSession {
    processId: string;
    changeName?: string;
    loadCheckpoint(): Promise<PersistedCheckpointSession | undefined>;
}

export interface RestoredWorkbenchRunJournalData {
    processes: WorkbenchProcess[];
    checkpointSessions: RestoredCheckpointSession[];
}

interface PersistedCheckpointSessionReference {
    processId: string;
    changeName?: string;
}

interface WorkbenchRunJournalDocument {
    version: typeof WORKBENCH_RUN_JOURNAL_VERSION;
    processes: WorkbenchProcess[];
    checkpointSessions: PersistedCheckpointSessionReference[];
}

interface WorkbenchRunJournalDocumentV1 {
    version: 1;
    processes: WorkbenchProcess[];
    checkpointSessions: PersistedCheckpointSession[];
}

export interface WorkbenchRunJournalOptions {
    maxProcesses?: number;
    /** Separate from `maxProcesses` on purpose — see `write()`. */
    maxCheckpointSessions?: number;
}

/** Ten, measured rather than picked: this repository's own checkpoints
 * ran 12–24 MB each on 2026-09-03, so ten is roughly 150–200 MB of disk
 * and about half a day of its activity. A hundred — what sharing
 * `maxProcesses` implied — was 531 MB when the slow activation that
 * prompted this was investigated, and had no ceiling short of two
 * gigabytes. */
export const DEFAULT_MAX_CHECKPOINT_SESSIONS = 10;

export type WorkbenchJournalLoadErrorCode =
    | "invalid-json"
    | "invalid-shape"
    | "unsupported-journal-version"
    | "unsupported-checkpoint-version"
    | "invalid-checkpoint"
    | "workspace-mismatch";

export interface WorkbenchJournalLoadErrorDetails {
    code: WorkbenchJournalLoadErrorCode;
    journalPath: string;
    foundVersion?: unknown;
    supportedVersion?: number;
    cause?: unknown;
}

export class WorkbenchJournalLoadError extends Error {
    readonly code: WorkbenchJournalLoadErrorCode;
    readonly journalPath: string;
    readonly foundVersion?: unknown;
    readonly supportedVersion?: number;

    constructor(message: string, details: WorkbenchJournalLoadErrorDetails) {
        super(message, { cause: details.cause });
        this.name = "WorkbenchJournalLoadError";
        this.code = details.code;
        this.journalPath = details.journalPath;
        this.foundVersion = details.foundVersion;
        this.supportedVersion = details.supportedVersion;
    }
}

function emptyJournal(): RestoredWorkbenchRunJournalData {
    return { processes: [], checkpointSessions: [] };
}

function isMissingFile(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

const CHECKPOINT_FILE_SUFFIX = ".json";

export class WorkbenchRunJournal {
    readonly filePath: string;
    private readonly checkpointsDirectory: string;
    private readonly maxProcesses: number;
    private readonly maxCheckpointSessions: number;
    private writeQueue = Promise.resolve();

    constructor(private readonly root: string, options: WorkbenchRunJournalOptions = {}) {
        const openspecDirectory = path.join(path.resolve(root), ".openspec-ui");
        this.filePath = path.join(openspecDirectory, "workbench-runs.json");
        this.checkpointsDirectory = path.join(openspecDirectory, "checkpoints");
        this.maxProcesses = options.maxProcesses ?? 100;
        this.maxCheckpointSessions = options.maxCheckpointSessions ?? DEFAULT_MAX_CHECKPOINT_SESSIONS;
    }

    async load(): Promise<RestoredWorkbenchRunJournalData> {
        let source: string;
        try {
            source = await readFile(this.filePath, "utf8");
        } catch (error) {
            if (isMissingFile(error)) return emptyJournal();
            throw error;
        }

        let raw: { version?: unknown; processes?: unknown; checkpointSessions?: unknown };
        try {
            raw = JSON.parse(source);
        } catch (error) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal is not valid JSON. Inspect or restore ${this.filePath}.`,
                { code: "invalid-json", journalPath: this.filePath, cause: error },
            );
        }

        const resolvedRoot = path.resolve(this.root);

        if (raw.version === 1) {
            return this.loadVersion1(raw as unknown as WorkbenchRunJournalDocumentV1, resolvedRoot);
        }

        if (raw.version !== WORKBENCH_RUN_JOURNAL_VERSION) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal version ${String(raw.version)} is not supported by this OpenSpec UI version. Upgrade OpenSpec UI to recover runs.`,
                {
                    code: "unsupported-journal-version",
                    journalPath: this.filePath,
                    foundVersion: raw.version,
                    supportedVersion: WORKBENCH_RUN_JOURNAL_VERSION,
                },
            );
        }

        const document = raw as unknown as WorkbenchRunJournalDocument;
        if (!Array.isArray(document.processes) || !Array.isArray(document.checkpointSessions)) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal has an invalid shape. Inspect or restore ${this.filePath}.`,
                { code: "invalid-shape", journalPath: this.filePath },
            );
        }

        // References only. Reading each payload here is what made
        // activation cost half a gigabyte on this repository — see
        // checkpoint-retention-and-lazy-load: the storage split moved the
        // bytes out of this file and then read them straight back in.
        // `loadCheckpoint` is how a caller asks for one, at the moment it
        // has something to do with it.
        const sessions: RestoredCheckpointSession[] = [];
        const retainedIds = new Set<string>();
        for (const reference of document.checkpointSessions) {
            if (!reference || typeof reference !== "object" || typeof reference.processId !== "string") {
                throw new WorkbenchJournalLoadError(
                    `Workbench run journal contains an invalid checkpoint session. Inspect or restore ${this.filePath}.`,
                    { code: "invalid-shape", journalPath: this.filePath },
                );
            }
            retainedIds.add(reference.processId);
            const { processId, changeName } = reference;
            sessions.push({
                processId,
                changeName,
                loadCheckpoint: () => this.resolveCheckpointSession({ processId, changeName }, resolvedRoot),
            });
        }
        // Kept on the load path deliberately: it lists directory entries
        // and deletes by name, never reading content, so it costs nothing
        // and it is what removes a file a crash orphaned.
        await this.pruneCheckpointFiles(retainedIds);

        return {
            processes: document.processes.map((process) => ({ ...process })),
            checkpointSessions: sessions,
        };
    }

    save(data: WorkbenchRunJournalData): Promise<void> {
        const operation = this.writeQueue.catch(() => undefined).then(() => this.write(data));
        this.writeQueue = operation;
        return operation;
    }

    /** Version-1 journals embedded full checkpoint content per session, so
     * every session here is already validated the same way `write()` used to
     * validate on load. Migration reuses that validation, then writes the
     * sessions out as files and rewrites the journal as version 2 through
     * the normal `save()` path, so the on-disk shape never regresses back to
     * version 1 once this has run. */
    private async loadVersion1(
        document: WorkbenchRunJournalDocumentV1,
        resolvedRoot: string,
    ): Promise<RestoredWorkbenchRunJournalData> {
        if (!Array.isArray(document.processes) || !Array.isArray(document.checkpointSessions)) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal has an invalid shape. Inspect or restore ${this.filePath}.`,
                { code: "invalid-shape", journalPath: this.filePath },
            );
        }
        const sessions: PersistedCheckpointSession[] = [];
        for (const session of document.checkpointSessions) {
            if (!session || typeof session !== "object" || !session.checkpoint || typeof session.checkpoint !== "object") {
                throw new WorkbenchJournalLoadError(
                    `Workbench run journal contains an invalid checkpoint session. Inspect or restore ${this.filePath}.`,
                    { code: "invalid-shape", journalPath: this.filePath },
                );
            }
            this.validateCheckpointSession(session.checkpoint, resolvedRoot);
            sessions.push({
                processId: session.processId,
                changeName: session.changeName,
                checkpoint: structuredClone(session.checkpoint),
            });
        }
        const data: WorkbenchRunJournalData = {
            processes: document.processes.map((process) => ({ ...process })),
            checkpointSessions: sessions,
        };
        await this.save(data);
        // Migration is the one place the payloads are already in memory,
        // so the restored shape hands them back directly rather than
        // re-reading the files `save()` has just written.
        return {
            processes: data.processes,
            checkpointSessions: sessions.map((session) => ({
                processId: session.processId,
                changeName: session.changeName,
                loadCheckpoint: async () => session,
            })),
        };
    }

    /** Reads and validates one referenced checkpoint session's file. A file
     * that cannot be read or parsed degrades to "no checkpoint" (returns
     * `undefined`) per the "missing checkpoint store does not fail recovery"
     * requirement. A file that *is* readable but fails semantic validation
     * (unsupported version, tampered content, wrong workspace root) still
     * throws — that is the existing, unchanged unsupported-checkpoint-version
     * / workspace-mismatch behavior, not a readability problem. */
    private async resolveCheckpointSession(
        reference: PersistedCheckpointSessionReference,
        resolvedRoot: string,
    ): Promise<PersistedCheckpointSession | undefined> {
        const filePath = this.checkpointFilePath(reference.processId);
        let raw: string;
        try {
            raw = await readFile(filePath, "utf8");
        } catch {
            return undefined;
        }
        let checkpoint: SerializedWorkbenchCheckpoint;
        try {
            checkpoint = JSON.parse(raw) as SerializedWorkbenchCheckpoint;
        } catch {
            return undefined;
        }
        this.validateCheckpointSession(checkpoint, resolvedRoot);
        return { processId: reference.processId, changeName: reference.changeName, checkpoint };
    }

    private validateCheckpointSession(checkpoint: SerializedWorkbenchCheckpoint, resolvedRoot: string): void {
        if (checkpoint.version !== 1) {
            throw new WorkbenchJournalLoadError(
                `Workbench checkpoint version ${String(checkpoint.version)} is not supported by this OpenSpec UI version. Upgrade OpenSpec UI to recover runs.`,
                {
                    code: "unsupported-checkpoint-version",
                    journalPath: this.filePath,
                    foundVersion: checkpoint.version,
                    supportedVersion: 1,
                },
            );
        }
        let deserialized: ReturnType<typeof deserializeCheckpoint>;
        try {
            deserialized = deserializeCheckpoint(checkpoint);
        } catch (error) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal contains an invalid checkpoint. Inspect or restore ${this.filePath}.`,
                { code: "invalid-checkpoint", journalPath: this.filePath, cause: error },
            );
        }
        if (deserialized.root !== resolvedRoot) {
            throw new WorkbenchJournalLoadError(
                `Checkpoint root ${deserialized.root} does not match journal workspace ${resolvedRoot}. Open the journal from its original workspace.`,
                { code: "workspace-mismatch", journalPath: this.filePath },
            );
        }
    }

    private checkpointFilePath(processId: string): string {
        return path.join(this.checkpointsDirectory, `${processId}${CHECKPOINT_FILE_SUFFIX}`);
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await stat(filePath);
            return true;
        } catch (error) {
            if (isMissingFile(error)) return false;
            throw error;
        }
    }

    /** Deletes checkpoint files under `checkpointsDirectory` that are not in
     * `retainedIds` — used both after a write (a process fell out of
     * retention) and after a load (a file was written but a crash landed
     * before the journal was updated to reference it). Only lists directory
     * entries and deletes by name; never reads a checkpoint file's content. */
    private async pruneCheckpointFiles(retainedIds: Set<string>): Promise<void> {
        let entries: string[];
        try {
            entries = await readdir(this.checkpointsDirectory);
        } catch (error) {
            if (isMissingFile(error)) return;
            throw error;
        }
        await Promise.all(entries.map(async (entry) => {
            if (!entry.endsWith(CHECKPOINT_FILE_SUFFIX)) return;
            const processId = entry.slice(0, -CHECKPOINT_FILE_SUFFIX.length);
            if (retainedIds.has(processId)) return;
            await rm(path.join(this.checkpointsDirectory, entry), { force: true });
        }));
    }

    private async atomicWriteFile(filePath: string, content: string): Promise<void> {
        const directory = path.dirname(filePath);
        const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
        await mkdir(directory, { recursive: true });
        try {
            await writeFile(temporaryPath, content, "utf8");
            try {
                await rename(temporaryPath, filePath);
            } catch (error) {
                const code = error instanceof Error && "code" in error ? error.code : undefined;
                if (code !== "EEXIST" && code !== "EPERM") throw error;
                await rm(filePath, { force: true });
                await rename(temporaryPath, filePath);
            }
        } finally {
            await rm(temporaryPath, { force: true });
        }
    }

    private async write(data: WorkbenchRunJournalData): Promise<void> {
        const processes = [...data.processes]
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .slice(0, this.maxProcesses);
        const retainedIds = new Set(processes.map((process) => process.id));
        // Two limits, because the two quantities differ by six orders of
        // magnitude: a process entry is tens of bytes, a checkpoint tens
        // of megabytes. Sharing `maxProcesses` between them meant a
        // hundred retained processes could mean two gigabytes of
        // checkpoints, read at every activation.
        //
        // By recency, never by state: `canRollback` covers "completed",
        // "failed" and "interrupted", so evicting terminal runs would
        // quietly withdraw a rollback the product offers.
        // Choose by recency, then write in the caller's original order.
        // Reordering the persisted list is not free: `rollbackChange`
        // reads the sessions back in stored order to find the earliest
        // state to restore to, so a newest-first list turns a rollback
        // into a conflict. Selection and ordering are separate concerns
        // and this keeps them separate.
        const orderById = new Map(processes.map((process, index) => [process.id, index]));
        const keptIds = new Set(
            data.checkpointSessions
                .filter((session) => retainedIds.has(session.processId))
                .map((session) => session.processId)
                .sort((left, right) => (orderById.get(left) ?? 0) - (orderById.get(right) ?? 0))
                .slice(0, this.maxCheckpointSessions),
        );
        const retainedSessions = data.checkpointSessions.filter((session) => keptIds.has(session.processId));

        // Session files are written before the journal that references
        // them, and only if they do not already exist: a finalized
        // checkpoint never changes, so an existing file is never
        // re-serialized on a process state change.
        for (const session of retainedSessions) {
            const filePath = this.checkpointFilePath(session.processId);
            if (await this.fileExists(filePath)) continue;
            await this.atomicWriteFile(filePath, JSON.stringify(session.checkpoint));
        }
        await this.pruneCheckpointFiles(new Set(retainedSessions.map((session) => session.processId)));

        const document: WorkbenchRunJournalDocument = {
            version: WORKBENCH_RUN_JOURNAL_VERSION,
            processes,
            checkpointSessions: retainedSessions.map((session) => ({
                processId: session.processId,
                changeName: session.changeName,
            })),
        };
        await this.atomicWriteFile(this.filePath, `${JSON.stringify(document, null, 2)}\n`);
    }
}
