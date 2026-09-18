// What a view is narrowed by, and what it says about it
// (the-views-are-searched-and-landed-relations-fold).
//
// A tree view cannot hold a text box, so the filter is a command that asks
// for words and a provider that remembers them. This is the remembering
// half: the providers keep one of these, the commands set it, and the view
// reads the message off it. The predicate itself is core's, so a word that
// finds a change in the standalone lists finds it here.

import { matchesFilter } from "@openspec-ui/core";

export class ViewFilterState {
  private words = "";
  private shown = 0;
  private total = 0;
  /** Called whenever a view has finished counting its rows, so the host
   * can write the message onto the view handle. A plain callback rather
   * than an event: this file stays free of `vscode`, which is what lets
   * the providers' tests run without the editor. */
  onCounted: (() => void) | undefined;

  get text(): string {
    return this.words;
  }

  get active(): boolean {
    return this.words.trim().length > 0;
  }

  set(text: string): void {
    this.words = text;
  }

  clear(): void {
    this.words = "";
  }

  /** Whether a row survives, from whatever the row can be searched by. */
  matches(fields: ReadonlyArray<string | undefined>): boolean {
    return matchesFilter(this.words, fields);
  }

  /** Counted as a view builds its rows, so the message can say how much of
   * the view a reader is looking at. */
  counted(shown: number, total: number): void {
    this.shown = shown;
    this.total = total;
    this.onCounted?.();
  }

  /** What the view says above its rows, or nothing while it shows
   * everything. An emptied view says so with the words it was given: a
   * view that simply drew nothing would look like a workspace with
   * nothing in it. */
  get message(): string | undefined {
    if (!this.active) return undefined;
    if (this.shown === 0) return `Nothing matches "${this.words}"`;
    return `Filtered by "${this.words}" - showing ${this.shown} of ${this.total}`;
  }
}
