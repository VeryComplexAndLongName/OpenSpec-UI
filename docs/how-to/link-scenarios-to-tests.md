# Link a scenario to a test result

PR Review can show individual JUnit testcase results alongside a requirement and
scenario. A passing CI job alone does not establish that its scenarios were tested.

## Declare the association

Import a JUnit report as described below, then choose **Link scenario to
JUnit test** in PR Review. Select the scenario and search by the testcase name
or class. Check the proposed diff and select **Save Test Mapping**. Commit the
resulting `scenario-tests.json` beside the change's `proposal.md`.

A historical report can supply test names. Its outcomes remain historical.
The picker excludes duplicate testcase identities. If the report, checked-out
commit or mapping changes before saving, open a fresh preview.

The same mapping can be authored by hand:

```json
{
  "scenarios": [
    {
      "capability": "auth",
      "requirement": "Session expires",
      "scenario": "Expired session",
      "tests": [
        { "classname": "SessionTests", "name": "rejects an expired session" }
      ]
    }
  ]
}
```

Use the exact requirement and scenario headings from the change's added or
modified delta, and exact `classname`/`name` attributes from the JUnit testcase.
An absent classname is the empty string. The mapping is read from the reviewed
commit; an uncommitted mapping does not change the review. Existing
`scenario-checks.json` job associations remain separate and continue to work.

## Import the results

### From Gitea or GitLab CI

Choose **Import CI JUnit Report** in PR Review. Enter the number from the
Gitea Actions run page or the GitLab job page in the repository configured as
`origin`. Use `GITEA_TOKEN` or `GITLAB_TOKEN` with read access to the project
and its artifacts. Import reads CI evidence without starting a job.

The job writes `tested-commit.txt` using `git rev-parse HEAD` in the checkout it
tests and exports a JUnit report to `junit.xml`. In Gitea, upload those two files
at the root of an artifact named `openspec-junit`. In GitLab, add both files
to `artifacts:paths` at the job artifact root. A report listed only under
`artifacts:reports` may not be available at that file path.

Example GitLab artifact settings:

```yaml
artifacts:
  when: always
  paths:
    - junit.xml
    - tested-commit.txt
```

For a working Gitea example, see the **Export a revision-qualified JUnit
example** step in `.gitea/workflows/quality.yml`. Keep the report within 128 KiB
and the Gitea archive within 256 KiB. The GitLab download supports artifacts
served by the configured instance and the GitLab.com Google Cloud Storage
redirect. Configure self-hosted GitLab to proxy object-storage downloads
through GitLab if its artifact endpoint redirects elsewhere.

PR Review shows the source repo, execution and tested commit. The reported
checkout must agree with the provider's run or job metadata. This establishes
the report's provenance from the configured CI producer. A report for an older
locally known commit remains historical.

### From a local file

Export a relevant test suite to JUnit XML. A minimal report is:

```xml
<testsuite name="SessionTests">
  <testcase classname="SessionTests" name="rejects an expired session"/>
</testsuite>
```

1. Open **PR Review** for the change.
2. In the standalone app, use the upload icon (**Import JUnit XML**), choose
   the XML file, enter the full tested commit ID and select **Import Report**.
   In VS Code, choose **Import JUnit XML** from the review's actions and use
   the native file picker and tested-commit prompt.
3. Read **Scenario test results (JUnit)** or use **Copy PR summary** to include
   the same qualified evidence in the pull request.

The tested commit must exist in the local repository. Import never assumes
that the report tested your current HEAD. The revision is explicitly
**user-declared**, even when it matches the reviewed commit; Workbench does
not independently verify CI provenance. An older revision is shown as historical.

Reports can have a `testsuite` or `testsuites` root and nested suites. Each test
is passed, failed, error or skipped. A mapped testcase absent from the report
is missing; repeated identities are ambiguous, including parameterized tests
or retries that reuse the same name. Neither state counts as a pass. Suite
totals are ignored. Results are observations, not proof of semantic coverage.

The importer accepts UTF-8 XML up to 128 KiB, 64 nesting levels and 2,000 named
testcases. DTDs and malformed XML are refused. Export only the relevant suite
if the original report is larger. The latest normalized report per change
is kept in the repository's Git common directory and shared by linked
worktrees. Reopening a review reads it; no test is run. Raw XML, properties,
failure bodies and stdout/stderr are not retained or uploaded. Importing a
new valid report replaces the previous one; a rejected import leaves it intact.
