## Context

`detectAvailableAgentsDetailed(config)` in core counts the local LLM's
agents as present where its server answers at all, at
`config.localLlmBaseUrl`, else `OPENSPEC_UI_LOCAL_LLM_BASE_URL`, else
`http://localhost:30000`; it reaches it past the system proxy where
`config.ignoreSystemProxy` says, else as the host's runners were built.
The extension built its runners from the settings but called detection
with no config in three places.

## Decisions

1. **One module reads the local LLM settings.** `local-llm-settings.ts`
   holds the secret's name, `readAgentSwitches`, `readLocalLlmSettings`
   (base URL, model, key) and `readAgentDetectionConfig`, plus
   `detectAgentsHere` and `detectAgentsHereDetailed`. Activation hands it
   the secret storage; `extension.ts` builds its runners from it.
   Settings are read at each question, so an address changed since the
   window opened counts without a reload.
2. **Every detection in the extension asks through it**: the Agentic
   Harness setup, the AI panel on each reveal, the repository-setup facts.
3. **The setup offers the local coding agent always.** A CLI agent is offered
   where it was found, since offering one that is not installed would
   write a configuration that fails at its first run. A local agent needs
   nothing installed, and its server not answering at setup time is not
   evidence it never will; it is offered, marked "its server does not
   answer now: openspec-ui.localLlm.baseUrl". Since the list is never empty,
   the branch that skipped the questions when nothing was found goes.
   - *Alternative: offer them only where detected.* Rejected by the owner:
     a person setting up before starting their model server would not see
     them.
4. **The control agent goes on the stages that check work** (found in the
   owner's check): `propose`, `review` and `verify`. The setup put it on
   `archive`, which is mechanical and refuses an agent, so the setup failed
   at its first answer once it was reached.
5. **An agent that edits no file is not a control or apply agent** (found
   in the same check: the setup put `local-llm`, which answers in text, on
   `propose` and `verify`, where it leaves nothing). The agent capabilities
   gain `editsFiles: false`, set on `local-llm`. The setup leaves such an
   agent out of both lists and says in the list that it can review, and
   the configuration findings, shown in Harness Settings and the run
   dialog, say where one is on a stage whose work is files.
   - *Alternative: offer it, with a description.* Rejected: a choice that
     makes two of three stages produce nothing is not one to offer.
6. **The standalone server is left as it is.** It detects at its own
   configured address and its AI panel lists every agent with its
   detection.

## Risks / Trade-offs

- **A person can choose a local agent whose server never comes.** The
  mark says so, and the first run fails with the local LLM's own error.
