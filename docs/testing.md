# Testing and Verification

## Recommended verification command

Run the full local verification bundle from the repository root:

```bash
npm run verify
```

This runs:
1. frontend automated tests
2. backend automated tests
3. production frontend build

## Available commands

### Frontend

```bash
npm test
```

Runs Vitest in interactive mode.

```bash
npm run test:frontend
```

Runs the frontend suite once, suitable for CI and evaluator verification.

### Backend

```bash
npm run test:backend
```

Runs the backend Jest suite once in-band, matching the CI workflow.

Equivalent direct command:

```bash
npm --prefix server test -- --runInBand
```

### Build

```bash
npm run build
```

Builds the Vite frontend into `build/`.

## CI contract

The repository CI workflow runs:
- frontend tests
- frontend build
- full backend test suite

Files:
- `.github/workflows/ci.yml`

## E2E scripts

Repository-provided browser flows:

```bash
npm run test:e2e:candidate
npm run test:e2e:job-flow
```

These assume the application stack is already running locally.

## Expected warnings

Known non-failing warnings may still appear:
- React test-render deprecation warnings in some frontend test runs
- Vite chunk-size and mixed static/dynamic import warnings during build

These do not currently fail CI, but they should still be tracked as technical debt.

## Manual verification checklist

Before submission, verify at least one path for each role:
- candidate registration, dashboard, application, interview access
- company admin organization access
- recruiter scheduling and reviewer assignment
- reviewer assigned reviews flow
- system admin login and restricted pages

Use `docs/evaluator-guide.md` as the manual walkthrough reference.
