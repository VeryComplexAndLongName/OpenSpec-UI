// Each change's word on the standalone Changes list, kept current while a
// run starts and ends — the-changes-views-see-a-run-start.
//
// The standings reading is slow on purpose: it lists refs and asks `gh`,
// and the list reads it on load and on Refresh only. Which runs are live is
// cheap to read and changes by the second, so while the list is shown the
// survey of working directories is read again on the Pipeline's survey
// interval, and its runs are laid over the standings held, as a Pipeline
// card lays them.

import { useEffect, useMemo, useState } from "react";
import {
  describeChangeState,
  withSurveyedRuns,
  type ChangeReadinessReport,
  type ChangeStandings,
  type DescribedChangeState,
  type WorktreeSurvey,
} from "@openspec-ui/core/browser";

/** A survey, and when it was asked for. */
interface HeldSurvey {
  survey: WorktreeSurvey;
  askedAt: number;
}

/** Each change's word, from `standings` with the runs of the latest survey
 * laid over them. While `isActive`, the survey is read at once and then
 * every `intervalMs`. A survey asked for before the standings were read is
 * not laid over them: their own runs are as fresh. A survey that fails
 * leaves the words as they were. */
export function useStandingStates(
  standings: ChangeStandings | null,
  isActive: boolean,
  loadSurvey: () => Promise<WorktreeSurvey>,
  intervalMs: number,
  /** What readiness says about each change, where it has been read. Without
   * it a change blocked by an active change reads Ready, which is what the
   * list did until DW reported it
   * (a-blocked-change-says-so-where-it-is-listed). */
  readiness?: ChangeReadinessReport | null,
): ReadonlyMap<string, DescribedChangeState> | undefined {
  const [held, setHeld] = useState<HeldSurvey | undefined>(undefined);
  const hasStandings = standings !== null;

  useEffect(() => {
    if (!isActive || !hasStandings) return;
    let alive = true;
    const read = () => {
      const askedAt = Date.now();
      loadSurvey().then(
        (survey) => { if (alive) setHeld({ survey, askedAt }); },
        () => undefined,
      );
    };
    read();
    const timer = setInterval(read, intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isActive, hasStandings, loadSurvey, intervalMs]);

  return useMemo(() => {
    if (standings === null) return undefined;
    const readAt = Date.parse(standings.readAt);
    const survey = held !== undefined && !(held.askedAt < readAt) ? held.survey : undefined;
    const readinessOf = new Map((readiness?.changes ?? []).map((change) => [change.changeName, change]));
    return new Map(standings.standings.map((standing) => {
      const read = readinessOf.get(standing.changeName);
      return [
        standing.changeName,
        describeChangeState({
          standing: withSurveyedRuns(standing, survey),
          ...(read ? { readiness: read.run.state, blockers: read.blockers } : {}),
        }),
      ];
    }));
  }, [standings, held, readiness]);
}
