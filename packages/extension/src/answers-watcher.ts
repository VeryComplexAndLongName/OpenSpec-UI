// What a run said back, brought to the person who asked
// (the-operator-can-say-something-to-a-run).
//
// A run writes an answer into the same signed directory a note arrives
// through, addressed to the key id of whoever asked. Nothing reads that
// side of the channel for a person, so without this an answer would sit in
// a directory nobody opens.
//
// It polls rather than watching the directory: the status records beside it
// are already read on a timer, the file is written by another process on
// another working directory, and a watcher on a shared directory is one
// more handle on a path the sweep wants to remove.

import type { ConversationMessage, Roster } from "@openspec-ui/core";

/** How often a person's side of the channel is read. Slower than a run's
 * own renewal: an answer arrives when a stage ends, which is minutes
 * apart, and a person reading it a few seconds later has lost nothing. */
export const ANSWER_POLL_INTERVAL_MS = 10_000;

export interface AnswerWatcherDeps {
  /** This machine's key id, or `undefined` where there is none: then
   * nothing is addressed to this person and nothing is read. */
  myKeyId: () => Promise<string | undefined>;
  /** Where the messages are, resolved when first needed. */
  messageDirectory: () => Promise<string>;
  roster: () => Promise<Roster>;
  readMessages: (options: {
    directory: string;
    to: string;
    roster: Roster;
    now: Date;
    seen: ReadonlySet<string>;
    allowFromRun?: boolean;
  }) => Promise<Array<{ state: "act" | "refused"; message: ConversationMessage }>>;
  /** Removes an answer once it has been shown: it is delivered, and the
   * person has it. */
  forget: (directory: string, messageId: string) => Promise<void>;
  /** Tells the person. */
  show: (answer: ConversationMessage) => void;
  now?: () => Date;
  intervalMs?: number;
}

/** Reads the person's side of the signed channel on a timer. */
export class AnswerWatcher {
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly seen = new Set<string>();
  private reading = false;

  constructor(private readonly deps: AnswerWatcherDeps) { }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.readOnce(); }, this.deps.intervalMs ?? ANSWER_POLL_INTERVAL_MS);
    void this.readOnce();
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One reading. Never rejects: a channel that cannot be read this time
   * is read again in ten seconds, and an editor must not raise for it. */
  async readOnce(): Promise<void> {
    if (this.reading) return;
    this.reading = true;
    try {
      const keyId = await this.deps.myKeyId();
      if (keyId === undefined) return;
      const directory = await this.deps.messageDirectory();
      const readings = await this.deps.readMessages({
        directory,
        to: keyId,
        roster: await this.deps.roster(),
        now: (this.deps.now ?? (() => new Date()))(),
        seen: this.seen,
        // A run's own answer is the only thing this reads, and it is
        // written by a run: refusing it here would refuse everything.
        allowFromRun: true,
      });
      for (const reading of readings) {
        if (reading.state !== "act" || reading.message.kind !== "answer") continue;
        if (this.seen.has(reading.message.messageId)) continue;
        this.seen.add(reading.message.messageId);
        this.deps.show(reading.message);
        await this.deps.forget(directory, reading.message.messageId).catch(() => undefined);
      }
    } catch {
      // Read again next time.
    } finally {
      this.reading = false;
    }
  }
}

/** What the person is told an answer says, in one line.
 *
 * The stage and the run are named because the words are the stage's own
 * closing summary: a person who wants more goes to that run's output, and
 * has to know which one it was. */
export function describeAnswer(answer: ConversationMessage): string {
  const where = [answer.stage, answer.runId].filter((part): part is string => typeof part === "string" && part.length > 0);
  const from = where.length > 0 ? ` (${where.join(", run ")})` : "";
  return `OpenSpec UI: a run answered${from}: ${answer.words}`;
}
