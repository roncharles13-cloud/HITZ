# HITZ — NHL Hitz 2003 Remake (Game Studio Architecture)

An HTML5 arcade-hockey remake of NHL Hitz 2003 (2v2), developed with the
Claude Code Game Studios agent architecture — specialist subagents own their
domains, with design-first workflow and quality gates.

> **Stack note:** This project runs on the **web**, not Unity. The Unity / Godot /
> Unreal specialist agents and the engine-asset/commit-validation hooks were
> intentionally **excluded** during install. Where studio docs/rules say "engine
> code," read it as the **Three.js / WebGL** layer.

## Technology Stack

- **Runtime**: HTML5 Canvas + WebGL via **Three.js r160** (ES-module importmap, unpkg CDN)
- **Language**: JavaScript (ES modules, no transpile step)
- **Build System**: none — static files served directly; local dev via the preview server in `.claude/launch.json` (`npx serve`, port 5200/5600)
- **Asset Pipeline**: hand-authored `assets/` (PNG textures, TTF/bitmap fonts, AVI) + canvas-baked textures at runtime
- **Version Control**: Git, trunk-based; no commits without explicit user instruction

## Project Structure

```
HITZ/
├── index.html          # entry: importmap, HUD/menu/settings/pause overlays
├── css/style.css       # Hitz-look UI (Impact italic + orange glow)
├── js/                 # ES modules
│   ├── main.js         # game loop, state machine, scoring, faceoffs, pause, settings wiring
│   ├── arena.js        # rink/ice/boards/glass/seating (BREAKAWAY arena, HITZ coords)
│   ├── rink.js         # RINK constants (shared by gameplay)
│   ├── player.js       # skater model + mechanics (turbo, spin, one-timer, check, stride/shot anim)
│   ├── goalie.js       # goalie model + AI + butterfly save anim
│   ├── puck.js         # puck physics + pooled fire trail
│   ├── ai.js           # skater AI controller
│   ├── camera.js       # broadcast chase cam
│   ├── hud.js          # scoreboard/SOG, fire + turbo meters, bitmap-font overlay
│   ├── input.js        # configurable keyboard+mouse bindings (localStorage)
│   ├── meshutil.js     # static-mesh merge (draw-call reduction)
│   ├── teams.js        # 31 NHL teams + specials, rosters
│   ├── trivia.js       # 1,649 disc-ripped trivia questions
│   └── ...             # goalietex, bitmapfont, hitzfont_data
└── assets/             # textures, fonts, logos, goalie gear, movies
```

## Studio Process

@.claude/docs/coordination-rules.md

@.claude/docs/context-management.md

Full studio reference (roster, gates, skills, review workflow) lives in
`.claude/docs/`. Those docs are Unity-flavored from the upstream framework —
apply the **process**, translate engine specifics to Three.js/WebGL.

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question → Options → Decision → Draft → Approval**

- Ask before writing/editing files; surface drafts or summaries first.
- Multi-file changes require explicit approval for the full changeset.
- No commits, pushes, or branch changes without user instruction.

## Coding Standards (web/JS)

- ES modules, no build step — keep imports CDN/importmap-compatible.
- Match surrounding style: 2-space indent, single quotes, terse comments.
- Gameplay constants named and grouped at module top (no magic numbers inline).
- World units ≈ feet (rink 200×85, net 6 wide); mesh `scale` is visual only —
  collision/range logic stays in world units.
- Per-frame code: no allocations in the loop (pool particles, reuse vectors).
- Verify changes in the preview (`launch.json`) and check for console/WebGL errors
  before declaring done.
