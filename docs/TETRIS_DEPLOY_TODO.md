# Master Jorge Tetris Wars - Build/Deploy TODO

## Mission
Ship a Star Wars-themed, production-quality Tetris experience as a Miami3PL portal page and standalone browser page, with test coverage, MCP observability, and rollback safety.

## Assumptions
- Active repo root: `project/`
- MCP server root: `../`
- Hosting target: Firebase project `miamialliance3pl`
- Tool timeout ceiling: 10 minutes (`600000ms`) per command

## Parallel Agent Plan (Codex + Opus)
- `Codex lane` (this execution): implement code, tests, docs, deploy.
- `Opus lane` (simulated task split): run independent reviews/checklists in parallel artifacts:
  - accessibility checklist
  - gameplay balance checklist
  - deployment verification checklist
- Timeout watcher: break long operations into bounded commands and checkpoint after each.

## Work Breakdown
- [ ] Baseline snapshot (git status + checksum checkpoint)
- [ ] Upgrade Tetris engine (7-bag, hold, ghost, combos, B2B, leveling)
- [ ] Add cool features (Force meter, mission events, challenge mode)
- [ ] Add accessibility improvements (aria-live, reduced motion support, keyboard clarity)
- [ ] Add/expand mobile touch controls
- [ ] Add high-score persistence and reset handling
- [ ] Add automated tests for pure game logic
- [ ] Run iterative test passes, fix failures, rerun
- [ ] Create dedicated portal page (`portal/tetris.html`)
- [ ] Add Tetris nav entry across portal pages
- [ ] Extend MCP server with Tetris status/info tools
- [ ] Update `CLAUDE.md` with full Tetris/MCP/deploy docs
- [ ] Add feed/index artifact for feature operations
- [ ] Deploy to hosting
- [ ] Verify public and portal URLs

## Checkpoints / Rollback
- Checkpoint A: before engine refactor
- Checkpoint B: after tests pass locally
- Checkpoint C: before deploy
- Checkpoint D: after deploy verification

Rollback path:
1. Use git diff to isolate Tetris rollout files only.
2. If deploy fails, redeploy previous stable commit or manually restore known-good files from checkpoint A/B.
3. Re-run MCP health diagnostics after rollback.

## Deliverables
- Functional Star Wars Tetris game playable in browser
- Miami3PL portal page and navigation integration
- Test suite + test report
- MCP enhancements + docs (`CLAUDE.md`, feed/index)
- Deployment verification links
