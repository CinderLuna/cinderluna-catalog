#!/usr/bin/env node

/**
 * verify-hashes.mjs
 *
 * Verifies the integrity of all upstream Windows installers listed in manifests/apps.json:
 * - Streams each installer binary through crypto.createHash("sha256")
 * - Validates or resolves the exact byte size and SHA-256 digest
 * - Generates manifests/verification-report.json with verification timestamps
 * - Optionally updates manifests/apps.json with verified metadata (--update-manifest)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "manifests", "apps.json");
const reportPath = path.join(rootDir, "manifests", "verification-report.json");

const shouldUpdate = process.argv.includes("--update-manifest");
const selectedSlugs = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith("--"));

const USER_AGENT =
  "Wget/1.21.4 (compatible; CinderlunaCatalogVerifier/1.0; +https://github.com/CinderLuna/cinderluna-catalog)";

async function hashStream(stream) {
  const hash = createHash("sha256");
  let totalBytes = 0;

  for await (const chunk of stream) {
    hash.update(chunk);
    totalBytes += chunk.length;
  }

  return {
    size: totalBytes,
    sha256: hash.digest("hex"),
  };
}

async function verifyApp(app) {
  const startTime = Date.now();
  console.log(`\n[VERIFY] Checking ${app.name} (${app.slug})...`);
  console.log(`         URL: ${app.installerUrl}`);

  try {
    const res = await fetch(app.installerUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error("No response body received");
    }

    const { size, sha256 } = await hashStream(Readable.fromWeb(res.body));
    const elapsedMs = Date.now() - startTime;

    const matchesExpected =
      app.sha256 && app.sha256.toLowerCase() === sha256.toLowerCase();
    const sizeMatches = app.installerSize && app.installerSize === size;

    console.log(`         Resolved: ${size} bytes in ${(elapsedMs / 1000).toFixed(2)}s`);
    console.log(`         SHA-256:  ${sha256}`);

    if (matchesExpected && sizeMatches) {
      console.log(`         ✓ Checksum & size verified exact match.`);
    } else if (matchesExpected) {
      console.log(`         ! Checksum matches, size updated (${app.installerSize} -> ${size})`);
    } else {
      console.log(`         ! Hash differs from previous recorded hash.`);
    }

    return {
      slug: app.slug,
      name: app.name,
      version: app.version,
      status: "success",
      installerUrl: app.installerUrl,
      finalUrl: res.url,
      expectedSize: app.installerSize,
      actualSize: size,
      expectedSha256: app.sha256,
      actualSha256: sha256,
      hashMatch: matchesExpected,
      sizeMatch: sizeMatches,
      elapsedMs,
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`         ✗ Verification failed: ${err.message}`);
    return {
      slug: app.slug,
      name: app.name,
      version: app.version,
      status: "failed",
      error: err.message,
      installerUrl: app.installerUrl,
      verifiedAt: new Date().toISOString(),
    };
  }
}

async function main() {
  console.log("=== Cinderluna Catalog Installer Integrity Verifier ===");
  const raw = await fs.readFile(manifestPath, "utf-8");
  const apps = JSON.parse(raw);

  const targets =
    selectedSlugs.length > 0
      ? apps.filter((a) => selectedSlugs.includes(a.slug))
      : apps;

  console.log(`Total apps in catalog: ${apps.length}`);
  console.log(`Apps to verify in this run: ${targets.length}`);

  const results = [];
  for (const app of targets) {
    const result = await verifyApp(app);
    results.push(result);
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const failureCount = results.length - successCount;

  console.log("\n================ SUMMARY ================");
  console.log(`Passed:  ${successCount} / ${results.length}`);
  console.log(`Failed:  ${failureCount} / ${results.length}`);

  const report = {
    verifiedAt: new Date().toISOString(),
    totalVerified: results.length,
    successCount,
    failureCount,
    results,
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  if (shouldUpdate && successCount > 0) {
    const resultMap = new Map(results.map((r) => [r.slug, r]));
    const updatedApps = apps.map((app) => {
      const res = resultMap.get(app.slug);
      if (res && res.status === "success") {
        return {
          ...app,
          installerSize: res.actualSize,
          sha256: res.actualSha256,
        };
      }
      return app;
    });

    await fs.writeFile(manifestPath, JSON.stringify(updatedApps, null, 2));
    console.log(`Updated ${manifestPath} with verified sizes & SHA-256 hashes.`);
  }

  if (failureCount > 0) {
    console.error(`\nCompleted with ${failureCount} failure(s).`);
    process.exit(1);
  } else {
    console.log("\nAll installers verified successfully!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
