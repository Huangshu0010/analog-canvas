# Bootstrap Repository Workflow

## Goal

Initialize this circuit asset project as a GitHub repository and adopt the
plan-log-experience management kernel from `chenzc24/agent-workflow-kernel`,
with validation and ownership rules specialized for SPICE netlists and the
binary Visio stencil.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## No commits yet on main
?? lib/
?? netlists/
```

The repository was newly initialized. The existing untracked paths are the
user's project assets and are in scope for the initial repository commit. No
pre-existing tracked changes or overlapping ownership were present.

## Owned Files

- `README.md`
- `AGENTS.md`
- `.gitattributes`
- `lib/`
- `netlists/`
- `plan/`
- `docs/experience/`

## Read-Only Files

- The reference repository `chenzc24/agent-workflow-kernel`

## Shared Dependencies

- Git and GitHub CLI authentication
- SPICE syntax and hierarchy conventions in `netlists/`
- The binary format of `lib/circuit.vss`

## Expected Work

1. Add repository documentation and project-specific Agent rules.
2. Add plan, maintenance-log, and experience-note templates.
3. Mark the Visio stencil as binary and document project validation policy.
4. Validate Markdown structure, SPICE subcircuit balance, and repository scope.
5. Record the result, create the initial commit, create a private GitHub
   repository, and push `main`.

## Validation

- `git diff --check`
- `git status --short --branch`
- Confirm every `.subckt` in `netlists/` has a matching `.ends`.
- Confirm local `.include` targets exist.
- Confirm the workflow documents and templates contain the required sections.

These checks cover the documentation-only workflow changes and the structural
integrity of the existing netlist fixtures without pretending to perform an
electrical simulation. No full simulator suite is available or justified for
this repository bootstrap.

## Experience Signal (for human review)


## Commit Intent

Commit as:

```text
Initialize circuit project workflow
```
