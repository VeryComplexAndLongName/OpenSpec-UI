import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
    deserializeCheckpoint,
    type SerializedWorkbenchCheckpoint,
} from "./checkpoint.js";
import type { WorkbenchProcess } from "./process-scheduler.js";

export const WORKBENCH_RUN_JOURNAL_VERSION = 1;

export interface PersistedCheckpointSession {
    processId: string;
    changeName?: string;
    checkpoint: SerializedWorkbenchCheckpoint;
}

export interface WorkbenchRunJournalData {
    processes: WorkbenchProcess[];
    checkpointSessions: PersistedCheckpointSession[];
}

interface WorkbenchRunJournalDocument extends WorkbenchRunJournalData {
    version: typeof WORKBENCH_RUN_JOURNAL_VERSION;
}

export interface WorkbenchRunJournalOptions {
    maxProcesses?: number;
}

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

function emptyJournal(): WorkbenchRunJournalData {
    return { processes: [], checkpointSessions: [] };
}

function isMissingFile(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export class WorkbenchRunJournal {
    readonly filePath: string;
    private readonly maxProcesses: number;
    private writeQueue = Promise.resolve();

    constructor(private readonly root: string, options: WorkbenchRunJournalOptions = {}) {
        this.filePath = path.join(path.resolve(root), ".openspec-ui", "workbench-runs.json");
        this.maxProcesses = options.maxProcesses ?? 100;
    }

    async load(): Promise<WorkbenchRunJournalData> {
        let source: string;
        try {
            source = await readFile(this.filePath, "utf8");
        } catch (error) {
            if (isMissingFile(error)) return emptyJournal();
            throw error;
        }

        let document: WorkbenchRunJournalDocument;
        try {
            document = JSON.parse(source) as WorkbenchRunJournalDocument;
        } catch (error) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal is not valid JSON. Inspect or restore ${this.filePath}.`,
                { code: "invalid-json", journalPath: this.filePath, cause: error },
            );
        }
        if (document.version !== WORKBENCH_RUN_JOURNAL_VERSION) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal version ${String(document.version)} is not supported by this OpenSpec UI version. Upgrade OpenSpec UI to recover runs.`,
                {
                    code: "unsupported-journal-version",
                    journalPath: this.filePath,
                    foundVersion: document.version,
                    supportedVersion: WORKBENCH_RUN_JOURNAL_VERSION,
                },
            );
        }
        if (!Array.isArray(document.processes) || !Array.isArray(document.checkpointSessions)) {
            throw new WorkbenchJournalLoadError(
                `Workbench run journal has an invalid shape. Inspect or restore ${this.filePath}.`,
                { code: "invalid-shape", journalPath: this.filePath },
            );
        }

        const resolvedRoot = path.resolve(this.root);
        for (const session of document.checkpointSessions) {
            if (!session || typeof session !== "object" || !session.checkpoint || typeof session.checkpoint !== "object") {
                throw new WorkbenchJournalLoadError(
                    `Workbench run journal contains an invalid checkpoint session. Inspect or restore ${this.filePath}.`,
                    { code: "invalid-shape", journalPath: this.filePath },
                );
            }
            if (session.checkpoint.version !== 1) {
                throw new WorkbenchJournalLoadError(
                    `Workbench checkpoint version ${String(session.checkpoint.version)} is not supported by this OpenSpec UI version. Upgrade OpenSpec UI to recover runs.`,
                    {
                        code: "unsupported-checkpoint-version",
                        journalPath: this.filePath,
                        foundVersion: session.checkpoint.version,
                        supportedVersion: 1,
                    },
                );
            }
            let checkpoint;
            try {
                checkpoint = deserializeCheckpoint(session.checkpoint);
            } catch (error) {
                throw new WorkbenchJournalLoadError(
                    `Workbench run journal contains an invalid checkpoint. Inspect or restore ${this.filePath}.`,
                    { code: "invalid-checkpoint", journalPath: this.filePath, cause: error },
                );
            }
            if (checkpoint.root !== resolvedRoot) {
                throw new WorkbenchJournalLoadError(
                    `Checkpoint root ${checkpoint.root} does not match journal workspace ${resolvedRoot}. Open the journal from its original workspace.`,
                    { code: "workspace-mismatch", journalPath: this.filePath },
                );
            }
        }
        return {
            processes: document.processes.map((process) => ({ ...process })),
            checkpointSessions: document.checkpointSessions.map((session) => ({
                ...session,
                checkpoint: structuredClone(session.checkpoint),
            })),
        };
    }

    save(data: WorkbenchRunJournalData): Promise<void> {
        const operation = this.writeQueue.catch(() => undefined).then(() => this.write(data));
        this.writeQueue = operation;
        return operation;
    }

    private async write(data: WorkbenchRunJournalData): Promise<void> {
        const processes = [...data.processes]
            .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
            .slice(0, this.maxProcesses);
        const retainedIds = new Set(processes.map((process) => process.id));
        const document: WorkbenchRunJournalDocument = {
            version: WORKBENCH_RUN_JOURNAL_VERSION,
            processes,
            checkpointSessions: data.checkpointSessions
                .filter((session) => retainedIds.has(session.processId))
                .map((session) => ({ ...session, checkpoint: structuredClone(session.checkpoint) })),
        };
        const directory = path.dirname(this.filePath);
        const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
        await mkdir(directory, { recursive: true });
        try {
            await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
            try {
                await rename(temporaryPath, this.filePath);
            } catch (error) {
                const code = error instanceof Error && "code" in error ? error.code : undefined;
                if (code !== "EEXIST" && code !== "EPERM") throw error;
                await rm(this.filePath, { force: true });
                await rename(temporaryPath, this.filePath);
            }
        } finally {
            await rm(temporaryPath, { force: true });
        }
    }
}
