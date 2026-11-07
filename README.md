# Cinderluna Open-Source Windows Software Catalog

Public, transparent catalog and cryptographic integrity manifest for the **61 curated open-source Windows x64 applications** available on [Cinderluna](https://cinderluna.com).

## Purpose

1. **Security & Cryptographic Transparency**: Every open-source installer distributed through Cinderluna is pulled directly from its official upstream release URL. This repository serves as a verifiable public ledger of upstream URLs, byte sizes, and SHA-256 digests.
2. **Automated Verification CI**: A scheduled GitHub Actions workflow continuously streams installer binaries from upstream servers, computes SHA-256 digests, and validates file sizes to detect upstream tampering, silent updates, or broken links.
3. **Decoupled Architecture**: Keeps catalog verification on public GitHub Actions runners with **zero secrets**, allowing community auditability while `cinderluna-api` operates privately.

---

## Catalog Manifest Structure

The primary manifest is [`manifests/apps.json`](manifests/apps.json). Each application entry contains:

```json
{
  "id": "app_vscode",
  "slug": "vscode",
  "name": "Visual Studio Code",
  "publisherName": "Microsoft",
  "categoryId": "specialist-tools",
  "taskId": "write-debug-code",
  "taskLabel": "Write, refactor and debug code across languages",
  "spdx": "MIT",
  "websiteUrl": "https://code.visualstudio.com",
  "sourceUrl": "https://github.com/microsoft/vscode",
  "summary": "Extensible code editor with built-in Git, debugging, terminal, and language intelligence.",
  "description": "Visual Studio Code is a lightweight but powerful source code editor...",
  "version": "1.145.2",
  "publishedAt": "2026-10-19T18:00:00.000Z",
  "installerUrl": "https://update.code.visualstudio.com/latest/win32-x64-user/stable",
  "installerFilename": "VSCodeUserSetup-x64-1.145.2.exe",
  "installerSize": 256452536,
  "sha256": "706ba8b326d87637a923676076eb2936060be6de5c0ae4691b3f76d2cac54f08"
}
```

---

## Verifying Hashes Locally

You can verify any or all apps locally with Node.js 24+:

```bash
# Verify all 61 installers
npm run verify

# Verify specific applications
node scripts/verify-hashes.mjs localsend vscode 7-zip

# Verify and update manifests/apps.json with resolved sizes/hashes
npm run verify:update
```

A verification report is written to [`manifests/verification-report.json`](manifests/verification-report.json) with detailed per-file results, latency, and status.

---

## GitHub Actions Verification Workflow

The workflow at [`.github/workflows/verify-catalog.yml`](.github/workflows/verify-catalog.yml) runs:
- **Weekly Schedule**: Every Sunday at midnight UTC.
- **Manual Trigger (`workflow_dispatch`)**: Can be triggered manually on demand via GitHub Actions UI or `gh workflow run verify-catalog.yml`.

---

## Integration with Cinderluna API

`cinderluna-api` synchronizes verified manifests from this repository using:

```bash
pnpm catalog:pull
```

This updates `src/oss-catalog.ts` in `cinderluna-api` and seeds the live Neon Serverless Postgres database.

---

## License

This manifest and verification tooling are open-sourced under the [MIT License](LICENSE). Individual cataloged applications retain their respective open-source licenses as documented in each entry's `spdx` field.
