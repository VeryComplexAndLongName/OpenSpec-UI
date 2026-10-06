## ADDED Requirements

### Requirement: Agent detection in the editor looks for the local LLM where its settings say

Every agent detection the extension runs - the Agentic Harness setup, the
AI panel and the repository-setup facts - SHALL look for the local LLM at
`openspec-ui.localLlm.baseUrl` where it is set, with the API key from the
editor's secret storage where one is stored, and past the system proxy
where `openspec-ui.agents.ignoreSystemProxy` is on, read when the detection
runs. What is not set SHALL fall back as core does, to the environment.

#### Scenario: A local LLM on the LAN, named in the settings

- **WHEN** `openspec-ui.localLlm.baseUrl` names a server that answers and
  the environment names none
- **THEN** detection reports `local-llm` and `local-llm-acp` as present

### Requirement: The Agentic Harness setup offers the local coding agent

**Set Up Agentic Harness** SHALL offer `local-llm-acp` for the control and
the apply agent whether or not its server answers, and SHALL mark it where
its server does not answer now. It SHALL offer a CLI agent only where
detection found it. It SHALL NOT offer an agent that edits no file, such as
`local-llm`, since both roles cover stages whose work is files, and SHALL
say in the list that such an agent can be set on review in Harness
Settings.

#### Scenario: No CLI found and the model server not running

- **WHEN** no CLI agent is detected and the local LLM does not answer
- **THEN** the setup still asks for the control agent, offering
  `local-llm-acp` marked as not answering now, and saying where `local-llm`
  fits

#### Scenario: The model server answers

- **WHEN** the local LLM answers and `claude-cli` is detected
- **THEN** the setup offers `claude-cli` and `local-llm-acp`, neither of
  them marked
