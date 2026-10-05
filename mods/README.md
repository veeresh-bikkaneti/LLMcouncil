# Claude Code mods

Two function-hook plugins for Claude Code.

| Mod | What it does |
| --- | --- |
| `clean-view` | Hides tool calls and raw code from the chat and shows a minimalist progress checklist above the prompt. `/clean-view` toggles it. |
| `agent-dock` | Splits a job across background helper agents and shows a live progress card for each in a side pane. `/dock <job>` starts one; `maxParallel` (default 3) caps how many run at once. |

## Install globally

```sh
mkdir -p ~/.claude/skills
cp -r mods/clean-view mods/agent-dock ~/.claude/skills/
```

They load at the start of the next session. To try one for a single session instead:

```sh
claude --plugin-dir mods/clean-view --plugin-dir mods/agent-dock
```

## Check

```sh
claude plugin validate mods/clean-view && claude plugin test mods/clean-view
claude plugin validate mods/agent-dock && claude plugin test mods/agent-dock
```

The panes and bands draw on the terminal and desktop surfaces. The Agent Dock pane opens on its own only in terminals at least 144 columns wide; run `/dock` to open it on a narrower one.
