## Approach

Extract the revision selection and requirement comparison from Archive Preview as a shared read inside Core. The Pipeline action reuses that read and returns a report without invoking archive. Existing Archive Preview still uses its temporary directory to predict the specification patch.

The Pipeline and VS Code Changes tree route the action to the change's resolved working directory. The report uses committed delta specs and branch tips already present on the machine. It compares a capability and its exact requirement title, reports the local refs read, and bounds the number of branches and detail text. The report is advisory and a run can still start.
