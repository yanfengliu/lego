import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { compile } from "json-schema-to-typescript";
import { format } from "prettier";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const schemaPath = fileURLToPath(new URL("../schemas/protocol.schema.json", import.meta.url));
const generatedDirectory = fileURLToPath(new URL("../src/generated", import.meta.url));
const checkOnly = process.argv.includes("--check");
const banner = "// Generated from schemas/protocol.schema.json. Do not edit by hand.\n";

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
visitSchema(schema, (node) => {
  if (node.type === "object" && node.additionalProperties !== false) {
    throw new Error(
      `Every protocol object must declare additionalProperties:false (${JSON.stringify(node)})`,
    );
  }
});

// Runtime schemas retain every collection bound. For TypeScript ergonomics, only
// the fixed-size LDU vector is represented as a tuple; other min/max item bounds
// remain validator responsibilities instead of creating unwieldy tuple unions.
const typeSchema = structuredClone(schema);
for (const [definitionName, definition] of Object.entries(typeSchema.definitions)) {
  if (definitionName === "LduVector") {
    continue;
  }
  visitSchema(definition, (node) => {
    if (node.type === "array") {
      delete node.minItems;
      delete node.maxItems;
    }
  });
}

const generatedTypes = await compile(typeSchema, "LegoStudioProtocol", {
  additionalProperties: false,
  bannerComment: banner.trimEnd(),
  cwd: packageDirectory,
  declareExternallyReferenced: true,
  enableConstEnums: false,
  ignoreMinAndMaxItems: false,
  maxItems: 8,
  strictIndexSignatures: true,
  unknownAny: true,
  unreachableDefinitions: true,
  style: {
    bracketSpacing: true,
    printWidth: 100,
    semi: true,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "all",
    useTabs: false,
  },
});

const exportedTypeNames = [...generatedTypes.matchAll(/^export (?:interface|type) (\w+)/gm)].map(
  (match) => match[1],
);
const publicTypes = `${banner}import type * as Wire from "./types.generated.js";\n\nexport type DeepReadonly<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;\n\n${exportedTypeNames
        .map((typeName) => `export type ${typeName} = DeepReadonly<Wire.${typeName}>;`)
        .join("\n")}\n`;

const validatorDefinitions = {
  validateTruthSnapshot: "TruthSnapshot",
  validateRigidTransform: "RigidTransform",
  validateBrickDocumentV1: "BrickDocumentV1",
  validateBuildProgramV1: "BuildProgramV1",
  validateBuildOperation: "BuildOperation",
  validateScopeCapabilityV1: "ScopeCapabilityV1",
  validateAssemblyPatchV1: "AssemblyPatchV1",
  validateValidationReportV1: "ValidationReportV1",
};

const ajv = new Ajv({
  allErrors: true,
  code: { esm: true, lines: true, source: true },
  strict: true,
});
ajv.addSchema(schema);

const validatorIds = {};
for (const [exportName, definitionName] of Object.entries(validatorDefinitions)) {
  const validatorId = `${schema.$id}/validators/${definitionName}`;
  ajv.addSchema({
    $id: validatorId,
    $ref: `${schema.$id}#/definitions/${definitionName}`,
  });
  validatorIds[exportName] = validatorId;
}

const standaloneValidators = `${banner}${standaloneCode(ajv, validatorIds)}`;
const esmValidators = standaloneValidators.replace(
  /const (\w+) = require\("([^"]+)"\)\.default;/g,
  (_match, binding, moduleId) =>
    `import ${binding}Module from "${moduleId}.js";\nconst ${binding} = typeof ${binding}Module === "function" ? ${binding}Module : ${binding}Module.default;`,
);
if (/\brequire\(|\beval\(|\bnew Function\b/.test(esmValidators)) {
  throw new Error("Generated validators must be browser-safe ESM without dynamic evaluation");
}

const validatorDeclarations = `${banner}import type { ValidateFunction } from "ajv";\n\n${Object.keys(
  validatorDefinitions,
)
  .map((exportName) => `export const ${exportName}: ValidateFunction<unknown>;`)
  .join("\n")}\n`;

const outputs = new Map([
  ["types.generated.ts", await format(generatedTypes, { parser: "typescript" })],
  ["public-types.generated.ts", await format(publicTypes, { parser: "typescript" })],
  ["validators.generated.js", await format(esmValidators, { parser: "babel" })],
  ["validators.generated.d.ts", await format(validatorDeclarations, { parser: "typescript" })],
]);

if (!checkOnly) {
  await mkdir(generatedDirectory, { recursive: true });
}

let stale = false;
for (const [filename, expected] of outputs) {
  const outputPath = fileURLToPath(new URL(`../src/generated/${filename}`, import.meta.url));
  let actual;
  try {
    actual = await readFile(outputPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  if (actual === expected) {
    continue;
  }

  if (checkOnly) {
    stale = true;
    console.error(`Generated protocol artifact is stale: ${filename}`);
  } else {
    await writeFile(outputPath, expected, "utf8");
    console.log(`Generated ${filename}`);
  }
}

if (stale) {
  process.exitCode = 1;
}

function visitSchema(value, visitor) {
  if (value === null || typeof value !== "object") {
    return;
  }

  visitor(value);
  for (const child of Object.values(value)) {
    visitSchema(child, visitor);
  }
}
