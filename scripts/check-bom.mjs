#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const bomPath = path.join(repositoryRoot, "docs", "dependency-data-bom.md");
const dependencySections = ["dependencies", "devDependencies"];
const errors = [];

function relativePath(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

function readJson(relativeFile) {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativeFile), "utf8"));
}

function requireNonEmptyString(value, location) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${location} must be a non-empty string`);
  }
}

function wildcardPattern(segment) {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`);
}

function expandWorkspacePattern(pattern) {
  let candidates = [repositoryRoot];

  for (const segment of pattern.split(/[\\/]/).filter(Boolean)) {
    const next = [];
    const matcher = segment.includes("*") ? wildcardPattern(segment) : null;

    for (const candidate of candidates) {
      if (!matcher) {
        const resolved = path.join(candidate, segment);
        if (existsSync(resolved)) next.push(resolved);
        continue;
      }

      if (!existsSync(candidate)) continue;
      for (const entry of readdirSync(candidate, { withFileTypes: true })) {
        if (entry.isDirectory() && matcher.test(entry.name)) {
          next.push(path.join(candidate, entry.name));
        }
      }
    }

    candidates = next;
  }

  return candidates
    .filter((candidate) => existsSync(path.join(candidate, "package.json")))
    .map((candidate) => `${relativePath(candidate)}/package.json`);
}

function extractBom() {
  const markdown = readFileSync(bomPath, "utf8");
  const match = markdown.match(
    /<!-- bom-data:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- bom-data:end -->/,
  );

  if (!match) {
    throw new Error("missing the machine-readable BOM data block");
  }

  return JSON.parse(match[1]);
}

function declarationKey(declaration) {
  return `${declaration.manifest}\u0000${declaration.section}\u0000${declaration.name}`;
}

function packageKey(name, version) {
  return `${name}\u0000${version}`;
}

function findLockEntry(lockfile, manifest, packageName) {
  let directory = path.posix.dirname(manifest);

  while (true) {
    const prefix = directory === "." ? "" : `${directory}/`;
    const lockKey = `${prefix}node_modules/${packageName}`;
    const entry = lockfile.packages?.[lockKey];
    if (entry) return { entry, lockKey };

    if (directory === ".") break;
    directory = path.posix.dirname(directory);
  }

  return null;
}

function compareSet(actualValues, recordedValues, label) {
  const actual = new Set(actualValues);
  const recorded = new Set(recordedValues);
  const display = (value) => value.replaceAll("\u0000", " | ");

  for (const value of actual) {
    if (!recorded.has(value)) errors.push(`${label} missing from BOM: ${display(value)}`);
  }
  for (const value of recorded) {
    if (!actual.has(value)) errors.push(`${label} is stale in BOM: ${display(value)}`);
  }
}

let bom;
try {
  bom = extractBom();
} catch (error) {
  console.error(`BOM check failed: ${error.message}`);
  process.exit(1);
}

if (bom.schemaVersion !== 1) {
  errors.push(`unsupported BOM schemaVersion: ${String(bom.schemaVersion)}`);
}

const rootManifest = readJson("package.json");
const lockfile = readJson("package-lock.json");
const workspacePatterns = Array.isArray(rootManifest.workspaces)
  ? rootManifest.workspaces
  : rootManifest.workspaces?.packages;

if (!Array.isArray(workspacePatterns)) {
  errors.push("package.json workspaces must be an array or contain a packages array");
}

const workspaceManifests = [
  ...new Set((workspacePatterns ?? []).flatMap(expandWorkspacePattern)),
].sort();
const liveWorkspaceRecords = workspaceManifests.map((manifest) => {
  const packageManifest = readJson(manifest);
  return {
    manifest,
    name: packageManifest.name,
    version: packageManifest.version,
    packageManifest,
  };
});

const recordedWorkspaceMap = new Map();
for (const workspace of bom.workspaces ?? []) {
  requireNonEmptyString(workspace.manifest, "BOM workspace manifest");
  if (recordedWorkspaceMap.has(workspace.manifest)) {
    errors.push(`duplicate BOM workspace: ${workspace.manifest}`);
  }
  recordedWorkspaceMap.set(workspace.manifest, workspace);
}

compareSet(
  liveWorkspaceRecords.map(({ manifest }) => manifest),
  [...recordedWorkspaceMap.keys()],
  "workspace",
);

for (const workspace of liveWorkspaceRecords) {
  const recorded = recordedWorkspaceMap.get(workspace.manifest);
  if (!recorded) continue;
  if (recorded.name !== workspace.name) {
    errors.push(
      `${workspace.manifest} name mismatch: live=${workspace.name}, BOM=${recorded.name}`,
    );
  }
  if (recorded.version !== workspace.version) {
    errors.push(
      `${workspace.manifest} version mismatch: live=${workspace.version}, BOM=${recorded.version}`,
    );
  }

  const workspaceDirectory = path.posix.dirname(workspace.manifest);
  const lockedWorkspace = lockfile.packages?.[workspaceDirectory];
  if (!lockedWorkspace) {
    errors.push(`package-lock.json is missing workspace entry ${workspaceDirectory}`);
  } else if (
    lockedWorkspace.name !== workspace.name ||
    lockedWorkspace.version !== workspace.version
  ) {
    errors.push(`package-lock.json workspace metadata is stale for ${workspaceDirectory}`);
  }
}

const allManifests = [
  { manifest: "package.json", packageManifest: rootManifest },
  ...liveWorkspaceRecords,
];
const liveDeclarations = [];

for (const { manifest, packageManifest } of allManifests) {
  for (const section of dependencySections) {
    for (const [name, spec] of Object.entries(packageManifest[section] ?? {})) {
      liveDeclarations.push({ manifest, section, name, spec });
    }
  }
}

liveDeclarations.sort((left, right) => declarationKey(left).localeCompare(declarationKey(right)));

const recordedDeclarationMap = new Map();
for (const declaration of bom.declarations ?? []) {
  const key = declarationKey(declaration);
  if (recordedDeclarationMap.has(key)) {
    errors.push(
      `duplicate BOM dependency declaration: ${declaration.manifest} ${declaration.section} ${declaration.name}`,
    );
  }
  recordedDeclarationMap.set(key, declaration);
}

compareSet(
  liveDeclarations.map(declarationKey),
  [...recordedDeclarationMap.keys()],
  "dependency declaration",
);

for (const declaration of liveDeclarations) {
  const recorded = recordedDeclarationMap.get(declarationKey(declaration));
  if (recorded && recorded.spec !== declaration.spec) {
    errors.push(
      `${declaration.manifest} ${declaration.name} spec mismatch: live=${declaration.spec}, BOM=${recorded.spec}`,
    );
  }
}

const rightsPolicies = bom.rightsPolicies ?? {};
for (const [name, policy] of Object.entries(rightsPolicies)) {
  for (const field of ["licenseEvidence", "attribution", "redistribution", "trainingUse"]) {
    requireNonEmptyString(policy[field], `rightsPolicies.${name}.${field}`);
  }
}

const workspaceByName = new Map(
  liveWorkspaceRecords.map((workspace) => [workspace.name, workspace]),
);
const livePackages = new Map();

for (const declaration of liveDeclarations) {
  const workspace = workspaceByName.get(declaration.name);
  let resolved;

  if (workspace) {
    resolved = {
      name: declaration.name,
      version: workspace.version,
      kind: "workspace",
      resolvedSource: `workspace:${path.posix.dirname(workspace.manifest)}`,
      declaredLicense: "MIT",
    };
  } else {
    const locked = findLockEntry(lockfile, declaration.manifest, declaration.name);
    if (!locked) {
      errors.push(
        `${declaration.manifest} ${declaration.name} has no resolvable package-lock entry`,
      );
      continue;
    }

    resolved = {
      name: declaration.name,
      version: locked.entry.version,
      kind: "npm",
      resolvedSource: locked.entry.resolved,
      declaredLicense: locked.entry.license,
    };
  }

  if (declaration.spec !== resolved.version) {
    errors.push(
      `${declaration.manifest} ${declaration.name} must use an exact version pin; spec=${declaration.spec}, resolved=${resolved.version}`,
    );
  }

  const key = packageKey(resolved.name, resolved.version);
  const prior = livePackages.get(key);
  if (
    prior &&
    (prior.kind !== resolved.kind ||
      prior.resolvedSource !== resolved.resolvedSource ||
      prior.declaredLicense !== resolved.declaredLicense)
  ) {
    errors.push(`${resolved.name}@${resolved.version} resolves inconsistently across workspaces`);
  } else {
    livePackages.set(key, resolved);
  }
}

const recordedPackageMap = new Map();
for (const packageRecord of bom.packages ?? []) {
  const key = packageKey(packageRecord.name, packageRecord.version);
  if (recordedPackageMap.has(key)) {
    errors.push(`duplicate BOM package record: ${packageRecord.name}@${packageRecord.version}`);
  }
  recordedPackageMap.set(key, packageRecord);

  for (const field of [
    "name",
    "version",
    "kind",
    "resolvedSource",
    "upstreamSource",
    "declaredLicense",
    "rightsPolicy",
  ]) {
    requireNonEmptyString(packageRecord[field], `${packageRecord.name ?? "package"}.${field}`);
  }
  if (
    !Array.isArray(packageRecord.allowedRoles) ||
    packageRecord.allowedRoles.length === 0 ||
    packageRecord.allowedRoles.some((role) => typeof role !== "string" || role.trim() === "")
  ) {
    errors.push(`${packageRecord.name ?? "package"}.allowedRoles must be non-empty strings`);
  }
  if (!rightsPolicies[packageRecord.rightsPolicy]) {
    errors.push(
      `${packageRecord.name ?? "package"} references unknown rights policy ${packageRecord.rightsPolicy}`,
    );
  }
}

compareSet([...livePackages.keys()], [...recordedPackageMap.keys()], "resolved direct package");

for (const [key, livePackage] of livePackages) {
  const recorded = recordedPackageMap.get(key);
  if (!recorded) continue;

  for (const field of ["kind", "resolvedSource", "declaredLicense"]) {
    if (recorded[field] !== livePackage[field]) {
      errors.push(
        `${livePackage.name}@${livePackage.version} ${field} mismatch: live=${livePackage[field]}, BOM=${recorded[field]}`,
      );
    }
  }

  const expectedPolicy =
    livePackage.kind === "workspace" ? "project-mit" : "npm-lockfile-spdx-unverified";
  if (recorded.rightsPolicy !== expectedPolicy) {
    errors.push(
      `${livePackage.name}@${livePackage.version} must use rights policy ${expectedPolicy}`,
    );
  }
}

const licenseText = readFileSync(path.join(repositoryRoot, "LICENSE"), "utf8");
if (!licenseText.startsWith("MIT License")) {
  errors.push("project-mit records require the repository LICENSE to contain the MIT license");
}

const assetIds = new Set();
for (const asset of bom.dataAssets ?? []) {
  for (const field of [
    "id",
    "category",
    "status",
    "source",
    "version",
    "declaredLicense",
    "rightsPolicy",
    "intent",
  ]) {
    requireNonEmptyString(asset[field], `dataAssets.${asset.id ?? "asset"}.${field}`);
  }
  if (assetIds.has(asset.id)) errors.push(`duplicate data asset id: ${asset.id}`);
  assetIds.add(asset.id);

  if (
    !Array.isArray(asset.allowedRoles) ||
    asset.allowedRoles.length === 0 ||
    asset.allowedRoles.some((role) => typeof role !== "string" || role.trim() === "")
  ) {
    errors.push(`dataAssets.${asset.id}.allowedRoles must be non-empty strings`);
  }
  if (!rightsPolicies[asset.rightsPolicy]) {
    errors.push(`dataAssets.${asset.id} references unknown rights policy ${asset.rightsPolicy}`);
  }

  if (
    asset.status === "planned-project-authored" ||
    asset.status === "implemented-project-authored"
  ) {
    if (asset.rightsPolicy !== "project-mit" || asset.declaredLicense !== "MIT") {
      errors.push(`${asset.id} is project-authored but does not use the project MIT policy`);
    }
    if (asset.source.endsWith("/") && !existsSync(path.join(repositoryRoot, asset.source))) {
      errors.push(`${asset.id} source path does not exist: ${asset.source}`);
    }
  }

  if (asset.status === "not-included-pending-audit") {
    if (asset.rightsPolicy !== "external-evaluation-pending-audit") {
      errors.push(`${asset.id} is pending audit but does not use the external audit policy`);
    }
    if (asset.allowedRoles.some((role) => role !== "evaluation-only-after-audit")) {
      errors.push(`${asset.id} has a role broader than evaluation-only-after-audit`);
    }
  }
}

if (assetIds.size === 0) errors.push("BOM must contain at least one data asset record");

if (errors.length > 0) {
  console.error(`BOM check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const externalCount = [...livePackages.values()].filter(
  (packageRecord) => packageRecord.kind === "npm",
).length;
const internalCount = livePackages.size - externalCount;
console.log(
  `BOM check passed: ${liveWorkspaceRecords.length} workspaces, ${liveDeclarations.length} dependency declarations, ${externalCount} third-party packages, ${internalCount} internal packages, and ${assetIds.size} data/source records.`,
);
