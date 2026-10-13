# Engine notes

How some runtimes start a clean, different-family evaluator. The harness `adapters/` own the mapping.

## Claude Code

- A subagent runs in its own context. agentic-template's `reviewer` (findings only, read and gate
  scripts) and `test-runner` (failures only) subagents are the evaluator's hands there. Their
  `model: inherit` gives the writer's model; set the model explicitly, and prefer dispatching the
  evaluator through another engine's CLI when one is installed.
- Structured return: `--json-schema` with the return schema; read `.structured_output`.
- A forge workflow on every PR push (agentic-template's `agent-reviewer.yml`) is the other entry: it
  has comment-only credentials, which fits an evaluator that must not push.

## Codex, Gemini CLI

- Either can be the different family for a Claude writer and vice versa, started headless by the
  runner with the packet as the prompt and read-only permissions (Codex `:read-only` profile; a
  Gemini read-only policy). Gemini CLI subagents cannot spawn subagents, so the runner dispatches it.

## Hosted graders

- A managed "outcomes" grader in its own context window is the same role; give it the packet, not
  the session log.

## Terminal-multiplexer coordinators (stagehand)

- The reviewer is a separate persistent agent in the task's workspace, given the exact PR, head,
  base and worktree; the coordinator routes only selected findings back to the author and asks the
  same reviewer for a complete re-review after fixes.
