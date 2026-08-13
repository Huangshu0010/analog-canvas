# Optional Phase 9 Research Tools

These programs reproduce historical Phase 9 evaluation evidence. They are not
product runtime dependencies, default Agent context, or CI exit gates. Build
the workspace before running a tool because the programs intentionally consume
the compiled package interfaces.

```powershell
pnpm build
node tools/research/phase9/skill-evaluation.mjs --check
node tools/research/phase9/external-quality-eval.mjs self-test
```

The external evaluator is retained only for comparing a materially new model,
Skill, knowledge package, or evaluation method. Completed studies are archived
under `docs/archive/phase9-external-quality-studies/`. Earlier deterministic
programs and their generated artifacts no longer satisfy current project
schemas; their evidence is preserved under
`docs/archive/phase9-research-evidence/`, without presenting stale programs as
working gates.
