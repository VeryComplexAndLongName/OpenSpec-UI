# 0038: The Local Model Codes in the Product

Status: Accepted

Date: 2026-10-02

## Context

A person with a model on their own network (SGLang, vLLM, anything that
answers OpenAI's `/v1/chat/completions`) has two agents to choose from,
and neither does the job:

- **`local-llm`** sends the prompt once and streams the answer back. It
  has no tools: it can describe a change and cannot make one. HARNESS.md
  says so: "Chat only: it answers in text and edits no file".
- **`local-llm-acp`** starts an external process, `coding-agent`, and
  speaks the Agent Client Protocol to it. It made a change on 2026-10-01,
  against SGLang serving Qwen3.6, once `coding-agent` 0.3.0 learned the
  protocol (see `local-llm-acp`). But `coding-agent` is a separate Python
  package in a separate repository, published nowhere a user of this
  product would find it. It needs Python 3.12 and an installation by hand,
  and its version has to match ours. For everyone but its author the
  agent reads "not detected".

Three more facts came out of the same day:

- **The tools of an external agent are outside this product's security
  model.** ADR 0001 and the execution-core invariants require an
  allowlist, a working-directory sandbox and an audit for what agents run.
  For a CLI agent the product can only allowlist the command line it
  starts. What the process then does is the process's business:
  `coding-agent` writes files and runs commands without asking.
- **A model's tool calls do not always arrive as tool calls.** SGLang on
  the LAN runs `--tool-call-parser hermes`, and Qwen3.6 writes its calls
  in Qwen3-Coder's `<function=...><parameter=...>` form, which that parser
  does not recognise: 0 of 6 structured calls when measured. The calls
  arrive as text in `content`. An agent for local models has to read them
  there, whatever the server is configured with.
- **The system proxy is in the way of the LAN.** On the maintainer's
  machine every HTTP client that obeys `HTTP_PROXY`, and the VS Code
  extension host, which applies the editor's proxy to Node's networking,
  send requests for `192.168.137.0/24` to a proxy that resets them. A
  person has no way to tell an agent to go direct.

## Decision

1. **The local model's coding agent runs inside `packages/core`.** It is an
   Agent Client Protocol agent implemented in TypeScript and run in
   process. `AcpSessionDriver` already connects to an in-process `AgentApp`
   (its tests do), so the run reaches the same events, the same stop
   handling, the same permission prompts and the same audit as every ACP
   agent. Nothing is installed besides the extension or the standalone
   server.

2. **It keeps the id `local-llm-acp`.** A harness file that names it goes
   on working. The external `coding-agent` process, its allowlist entry
   and its executable setting are removed. `coding-agent` stays a
   separate tool for anyone who wants one, and this product no longer
   uses it.

3. **Its tools are the product's own, and they stay in the change's
   working directory.** Read, write, replace in a file, list, search, and
   run a command. A path is resolved and refused if its real location is
   outside the run's `cwd`, links included. A command runs in `cwd` with a
   time limit and an output cap. Every tool call is a `tool_call` update,
   so it is seen, logged and counted. Commands run without asking by
   default, as `copilot`, `claude` and `gemini` do under this product. A
   setting makes the agent ask before each command through the protocol's
   permission request, which the product already shows in both hosts.

4. **It reads a tool call wherever the model put it.** A structured
   `tool_calls` entry first. Where there is none, a call written in the
   text inside `<tool_call>`, in Qwen3-Coder's XML form or as Hermes'
   JSON, to a tool that was offered, is taken as a call.

5. **The model is named or found.** A stage may name a model for
   `local-llm` and `local-llm-acp`, as it may for CLIs that take
   `--model`. Without one, the local LLM settings name it. Without those,
   the agent asks the server's `/v1/models` and takes the model it serves
   when it serves one. Only then does the old default, `default`, apply.

6. **An agent can be told to ignore the system proxy.** One setting, off
   by default, in the editor's settings and as an environment variable for
   the standalone server and the CLI. When it is on:
   - the in-process agents (`local-llm`, `local-llm-acp`) and the local
     LLM's availability check connect directly, through their own
     connection pool rather than the process's global one;
   - a CLI agent is started with the proxy variables (`HTTP_PROXY`,
     `HTTPS_PROXY`, `ALL_PROXY`, either case) removed from its
     environment and `NO_PROXY=*`. That reaches only an agent that reads
     those variables, so each agent's capability row says whether it does.

## Alternatives Considered

- **Publish `coding-agent` and keep it external.** Rejected: users would
  still need Python, a second installation and matching versions. Its
  tools would stay outside the allowlist, the sandbox and the permission
  prompt.
- **Adopt an existing published agent (Qwen Code, opencode).** Rejected
  for the same reasons, and because none was verified against the
  protocol and the models this was written for. The decision does not
  rule out adding one later as one more CLI agent.
- **Give `local-llm` tools and drop `local-llm-acp`.** Rejected: a harness
  file that names `local-llm-acp` would break, and `local-llm` as a plain
  chat is still the right agent for a stage that should not touch files.
- **Ignore the proxy always for the local LLM.** Rejected: a person whose
  model is reached only through the proxy would lose it. The setting is
  off by default, and the person turns it on.
- **Change the server's tool-call parser.** That is the server's business:
  this product cannot assume it, and on the LAN the parser is kept for
  reasons of its own.

## Consequences

- `packages/core` starts files being written and commands being run by
  something other than an external CLI. The allowlist cannot cover that,
  so the sandbox check, the command time limit and the optional
  permission prompt are the agent's own and are tested as the security
  model is.
- The agent loop, its tools and the text-call reader are code this
  product maintains. They are ported from `coding-agent`, whose behaviour
  was verified live on 2026-10-01.
- The `local-llm-acp` change that fixed the external command line is
  superseded once this lands. Its `LOCAL_LLM_ACP_*` limits keep their
  names and now limit the in-process loop.
- A person behind a proxy that breaks the LAN can turn it off for agents
  in one place.
