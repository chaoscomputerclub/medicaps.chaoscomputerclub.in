# Codex Project Instructions — Medi-Caps Competitive Programming Platform

## 1. Project Overview & Architecture
This repository is the official competitive programming arena and judge fabric for Medi-Caps University (Chaos Computer Club).
- **Backend API**: FastAPI (`backend/main.py`), SQLAlchemy Async, Redis 7, PostgreSQL 16.
- **Compute Fabric**: Distributed bare-metal Go `node-agent` daemons running Docker sandboxes (`--network none`, `--cap-drop ALL`).
- **Emergency Fallback**: Codebox API for synchronous isolated sandboxes.
- **Frontend**: Vite + React 18 + Tailwind v4 + Radix UI + SWR cache engine.

---

## 2. graphify Knowledge Graph

This project has an authoritative knowledge graph indexed at `graphify-out/` (16,594 nodes, 33,598 edges, 1,089 communities).

### Slash Command Usage (`/graphify`)
When the user types `/graphify`, execute the relevant workflow:

- `/graphify query "<question>"`: Query the knowledge graph using BFS traversal to trace architectural relationships, call paths, and data flows.
- `/graphify path "<ComponentA>" "<ComponentB>"`: Trace the shortest dependency path between two components.
- `/graphify explain "<Symbol>"`: Explain a god node, class, or community in plain language.
- `/graphify update .` or `/graphify --update`: Re-index changed files incrementally (AST-only, fast, zero token cost).
- `/graphify`: Scan current repository, build or update `graphify-out/graph.json` and `graphify-out/graph.html`.

### Mandatory Rules for Codebase Questions
1. **Always query the graph first**: When `graphify-out/graph.json` exists, run `graphify query "<question>"` instead of blindly grepping raw files.
2. **Post-modification updates**: After modifying backend or frontend code, run `graphify update .` to keep the knowledge graph in sync.
3. **Dirty graph files**: Uncommitted `graphify-out/` changes are normal after AST updates; do not skip graphify because of them.
