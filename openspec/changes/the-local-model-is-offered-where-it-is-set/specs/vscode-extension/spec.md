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

### Requirement: The Agentic Harness setup offers the local agents

**Set Up Agentic Harness** SHALL offer `local-llm` and `local-llm-acp` for
the control and the apply agent whether or not their server answers, and
SHALL mark one whose server does not answer now. It SHALL offer a CLI agent
only where detection found it.

#### Scenario: No CLI found and the model server not running

- **WHEN** no CLI agent is detected and the local LLM does not answer
- **THEN** the setup still asks for the control agent, offering both local
  agents, each marked as not answering now

#### Scenario: The model server answers

- **WHEN** the local LLM answers and `claude-cli` is detected
- **THEN** the setup offers `claude-cli`, `local-llm` and `local-llm-acp`,
  none of them marked
