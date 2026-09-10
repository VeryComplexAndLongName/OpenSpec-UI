// Two charts over what a project finished, and the table of the same
// numbers underneath each one.
//
// Presentational and transport-agnostic, like its neighbour
// `MultiChangeTimelineView`: the host loads the timelines and passes
// them in.
//
// One series per chart, so there is no hue order to get wrong and no
// legend to carry — the title names the series. The bars wear
// `--primary`, the token both hosts define: the standalone shell fills
// it with its own green, VS Code with the button colour of whatever
// theme the person is running, which is how these get a dark mode that
// belongs to the host rather than an inverted guess.
//
// See charts-over-what-happened.

// The arithmetic comes from core, not from a module beside this one:
// what a chart computes is core's, so a host printing the same figure
// in another form draws it from the same function. See
// a-date-is-one-day-in-every-source.
import {
  archivedPerDay,
  describeBasis,
  describeWorkDurationNotCharted,
  leadTimes,
  type ChartBasis,
} from "@openspec-ui/core/browser";
import type { ChangeTimeline } from "../change-timeline-client.js";

export interface ChangeChartsViewProps {
  timelines: ChangeTimeline[];
}

interface Bar {
  /** What the axis shows. */
  label: string;
  /** What the hover and the table say. */
  description: string;
  value: number;
}

const CHART_HEIGHT = 120;
const BAR_WIDTH = 22;
const BAR_GAP = 8;
const LABEL_BAND = 26;
/** Above this many bars the labels stop fitting side by side, so only the
 * ends are named and the rest is read from the table below. Sized from
 * the real case: 19 archiving days in this repository. */
const LABEL_EVERY_BAR_UP_TO = 6;

/** A bar per value, with a `<title>` each.
 *
 * A native `<title>` is read by a screen reader and shown on hover by
 * every browser, with no positioning code and no state — and the same
 * numbers are in the table below, so nothing lives only in the hover. */
function Bars({ bars, testId }: { bars: Bar[]; testId: string }) {
  const highest = Math.max(...bars.map((bar) => bar.value), 1);
  const width = bars.length * (BAR_WIDTH + BAR_GAP);
  // Every bar named where they fit, the two ends where they do not. A
  // chart whose bars are only identified in the table below asks the
  // reader to count columns.
  const labelEvery = bars.length <= LABEL_EVERY_BAR_UP_TO;

  return (
    <svg
      className="openspec-chart"
      data-testid={testId}
      width={width}
      height={CHART_HEIGHT + LABEL_BAND}
      viewBox={`0 0 ${width} ${CHART_HEIGHT + LABEL_BAND}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={`${bars.length} bars, highest ${highest}`}
    >
      {bars.map((bar, index) => {
        // A zero keeps a visible foot rather than disappearing: the
        // difference between "nothing that day" and "no such day" is the
        // whole reason the empty days are here at all.
        const height = bar.value === 0 ? 1 : Math.max(2, (bar.value / highest) * CHART_HEIGHT);
        return (
          <g key={bar.label}>
            <rect
              x={index * (BAR_WIDTH + BAR_GAP)}
              y={CHART_HEIGHT - height}
              width={BAR_WIDTH}
              height={height}
              rx={2}
              fill="var(--primary)"
            >
              <title>{bar.description}</title>
            </rect>
            {labelEvery || index === 0 || index === bars.length - 1 ? (
              <text
                x={index * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2}
                y={CHART_HEIGHT + 14}
                textAnchor="middle"
                fontSize="9"
                fill="var(--muted)"
              >
                {shortLabel(bar.label)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Rows rather than columns, for a chart whose categories have names.
 *
 * "3-7 days" does not fit under a 22px column — the first attempt read
 * "3-7 daOver a wee" where two labels overlapped, which is what looking
 * at the rendered picture is for. Sideways, the label has the width of a
 * line of text and the bar has the rest. */
function Rows({ bars, testId }: { bars: Bar[]; testId: string }) {
  const highest = Math.max(...bars.map((bar) => bar.value), 1);
  const labelWidth = 82;
  const barSpace = 260;
  const rowHeight = 22;
  const height = bars.length * rowHeight;

  return (
    <svg
      className="openspec-chart"
      data-testid={testId}
      width={labelWidth + barSpace}
      height={height}
      viewBox={`0 0 ${labelWidth + barSpace} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={`${bars.length} bars, highest ${highest}`}
    >
      {bars.map((bar, index) => {
        const width = bar.value === 0 ? 1 : Math.max(2, (bar.value / highest) * (barSpace - 30));
        const y = index * rowHeight;
        return (
          <g key={bar.label}>
            <text x={labelWidth - 6} y={y + 14} textAnchor="end" fontSize="10" fill="var(--muted)">
              {bar.label}
            </text>
            <rect x={labelWidth} y={y + 4} width={width} height={rowHeight - 10} rx={2} fill="var(--primary)">
              <title>{bar.description}</title>
            </rect>
            <text x={labelWidth + width + 5} y={y + 14} fontSize="10" fill="var(--muted)">
              {bar.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** What fits under a 22px bar. A day is shown as its month and day — the
 * year is in the table and in the range above, and repeating it 19 times
 * under a chart buys nothing. */
function shortLabel(label: string): string {
  const asDay = /^\d{4}-(\d{2}-\d{2})$/.exec(label);
  return asDay ? (asDay[1] as string) : label;
}

function ChartBlock(
  { title, subtitle, bars, basis, valueHeading, testId, orientation }: {
    title: string;
    subtitle: string;
    bars: Bar[];
    basis: ChartBasis;
    valueHeading: string;
    testId: string;
    /** Columns for a run of days, rows for named categories. The choice
     * is the labels: a day fits under a column and "8 days or more"
     * does not. */
    orientation: "columns" | "rows";
  },
) {
  return (
    <section className="openspec-chart-block">
      <h4>{title}</h4>
      <p className="openspec-shell-note">{subtitle}</p>
      {bars.length === 0
        // No axes over an empty set: an empty frame looks like a chart
        // that found nothing, which is a different claim from having
        // nothing to look at.
        ? <p className="openspec-shell-note" data-testid={`${testId}-empty`}>Nothing to draw yet.</p>
        : orientation === "columns"
          ? <Bars bars={bars} testId={testId} />
          : <Rows bars={bars} testId={testId} />}
      {/* Always here, not behind a toggle: it is the accessible form and
          it is what someone copies into a message. */}
      {bars.length > 0 ? (
        <table className="openspec-chart-table" data-testid={`${testId}-table`}>
          <thead>
            <tr><th scope="col">{valueHeading}</th><th scope="col">Changes</th></tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.label}><td>{bar.label}</td><td>{bar.value}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {/* What the chart rests on, in the chart rather than in a caption
          someone has to remember to update. A date from a commit and a
          date read off a directory name plot identically. */}
      <p className="openspec-shell-note" data-testid={`${testId}-basis`}>{describeBasis(basis)}</p>
    </section>
  );
}

export function ChangeChartsView({ timelines }: ChangeChartsViewProps) {
  const perDay = archivedPerDay(timelines);
  const lead = leadTimes(timelines);

  const dayBars: Bar[] = perDay.days.map((day) => ({
    label: day.day,
    value: day.count,
    description: `${day.day}: ${day.count} ${day.count === 1 ? "change" : "changes"}`,
  }));
  const leadBars: Bar[] = lead.buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.count,
    description: `${bucket.label}: ${bucket.count} ${bucket.count === 1 ? "change" : "changes"}`,
  }));

  return (
    <div className="openspec-charts" data-testid="change-charts">
      <ChartBlock
        title="Changes archived per day"
        subtitle="Every day between the first and the last, so a quiet day is a gap rather than a missing column."
        bars={dayBars}
        basis={perDay.basis}
        valueHeading="Day"
        testId="chart-archived-per-day"
        orientation="columns"
      />
      <ChartBlock
        title="How long a change took"
        subtitle="From the commit that proposed it to the one that archived it."
        bars={leadBars}
        basis={lead.basis}
        valueHeading="Time taken"
        testId="chart-lead-times"
        orientation="rows"
      />
      {/* Said rather than left out silently: an absence that is not
          explained reads as an omission. Computed over the changes on
          screen, not stated as a fact about one repository to every
          user — it used to read "measured over this repository, 135 of
          185 changes…" wherever it was shown. */}
      <p className="openspec-shell-note" data-testid="chart-work-duration-note">
        {describeWorkDurationNotCharted(timelines)}
      </p>
    </div>
  );
}
