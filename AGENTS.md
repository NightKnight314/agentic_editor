# Nightcut agent instructions

When asked to test, verify, reproduce, diagnose, or assess demo readiness, read and follow `skills/test-nightcut-app/SKILL.md` completely before acting.

- Default to its free-smoke profile.
- Never run paid analysis unless the user explicitly authorizes it.
- Do not run parallel Next dev servers against the shared `.next` directory.
- Preserve evidence paths and report the first failing boundary.
- Check `research/INDEX.md` and `design/INDEX.md` before architecture or editing-pipeline changes.
