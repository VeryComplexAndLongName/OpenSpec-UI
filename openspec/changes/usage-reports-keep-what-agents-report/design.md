## Context

All chain stages and repeated stage calls share runId. The runner writes a
start and terminal entry per invocation, but buildUsageReport groups by
runId and takes its first usage. Cost reporting requires active tasks.md
even though its source is historical audit. Codex ACP sets its model in a
session option, so argv cannot preserve the request.

## Decisions

The vendor extension and its attribution limitation were checked against
[Codex ACP 2.2.2's source](https://github.com/agentclientprotocol/codex-acp/blob/v2.2.2/src/CodexAcpServer.ts)
and the installed 2.2.2 bundle. Its buildQuotaMeta assigns all prompt tokens
to the current model; this is not an inferred exact split.

ADR 0053 adds an optional invocationId and requestedModel to audit entries.
The runner writes the same id on start and terminal entries, and a fresh
id on the next call, even for the same stage. Reports retain logical run
counts and separately count measured invocations. Legacy entries are
paired in recorded order by agent/stage/command/task; every terminal usage
is retained, including repeated stages. Messages and chain/checks facts
are excluded with the existing isRunEntry rule.

Keep input/output totals compatible, add optional cache/thought totals,
and leave costUsd absent until USD was reported. Cost coverage counts
reported invocations; true zero is retained. Other currencies stay in
their own units. The Harness consumes the corrected sums with optional
cost guards; its token ceilings still count input plus output only.

Read Codex ACP 2.2.2's _meta.quota.model_usage as provider-reported model
figures, without adding the breakdown back into the overall totals.
Record byModelAttribution as current-model: the vendor currently assigns
all prompt tokens to its current model, which is not an exact split when
models switch. Malformed metadata drops only malformed fields. The
requested model remains separate and is never used to fabricate usage.

Core owns readChangeUsageReport. Resolve active directories and archive
names across repository worktrees without requiring tasks.md. Match audit
paths by their logical change name, including a removed worktree's old
path in a retained log. Refuse unknown, invalid, or ambiguous reused change
names instead of guessing between archive generations. Never read a log
outside the repository's existing audit readers, restore deleted logs, or
change the active-task resolver used by executable commands.

show agents uses acceptsModel for both formats; effort remains in the
existing capabilities. show cost text explicitly names missing/partial
USD coverage and model-attribution limitations. JSON omits unknown USD
instead of inventing zero. This corrects the existing unknown-is-not-free
contract; patch changesets cover core and CLI.

Rejected: changing the public runId per stage, which would break chain
controls; grouping only by stage, which loses repeated calls; reconstructing
old models from current config; estimating prices; and summing cache or
thought into input/output, which can double-count vendor figures.

## Protocol Compatibility

No command or event kind changes. AgentUsage gains optional per-model token
fields and an optional attribution marker inside the existing usageReported
event. Old hosts and logs remain readable; host transports already pass
that payload whole. A focused server/webui contract test must confirm it.

Usage-report text and lookup refusals use the shared message register
(ADR 0046); no unregistered-message ceiling is relaxed. The first CI run
identified the missing formatter registration, covered by task 3.11.

## Non-Goals

No execution or permission-policy change, UI redesign, history event
extension, budget-setting change, local full suite, or manual archive.

## Risks / Trade-offs

Legacy records have no immutable invocation identity; pairing follows their
recorded sequence, without deduplicating distinct terminal invocations.
Unknown cost can make a partial sum a lower bound, so coverage is visible.
Codex's current-model figures remain limited by the vendor. Removed logs
cannot be recovered, and reused ambiguous change names are refused.

## Verification

Passed on 2026-10-24: server.test.ts's selected REST event and WebSocket
event contracts (two tests, real HTTP/WS), and the two selected
transport/contract.test.ts cases preserving the usageReported model payload
through FetchTransport and MessageBridgeTransport. See tasks 3.7 and 3.10
in [tasks.md](tasks.md). Remaining limits are the vendor's current-model
attribution and missing/deleted historical evidence; neither is inferred
away. No host adapter behavior or command/event kind changed.

Run named core/CLI regression files and selected Harness budget tests only.
Check affected TypeScript projects and changed source paths. Confirm JSON
and text with real CLI commands against a temporary archived audit fixture,
and validate this OpenSpec change strictly. Full suites run in CI only.
