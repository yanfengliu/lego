// Generated from schemas/protocol.schema.json. Do not edit by hand.
"use strict";
export const validateTruthSnapshot = validate10;
const schema11 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/TruthSnapshot",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/TruthSnapshot",
};
const schema13 = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "catalog",
    "connectorTaxonomy",
    "collisionModel",
    "transformPolicy",
    "validatorSet",
  ],
  properties: {
    schemaVersion: { const: "lego.truth-snapshot/1" },
    catalog: { $ref: "#/definitions/SnapshotRef" },
    connectorTaxonomy: { $ref: "#/definitions/SnapshotRef" },
    collisionModel: { $ref: "#/definitions/SnapshotRef" },
    transformPolicy: { $ref: "#/definitions/SnapshotRef" },
    validatorSet: { $ref: "#/definitions/SnapshotRef" },
  },
};
const schema14 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "version", "hash"],
  properties: {
    id: { $ref: "#/definitions/Identifier" },
    version: { $ref: "#/definitions/Identifier" },
    hash: { $ref: "#/definitions/Hash" },
  },
};
const schema15 = {
  type: "string",
  minLength: 1,
  maxLength: 128,
  pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$",
};
const schema17 = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" };
import func2Module from "ajv/dist/runtime/ucs2length.js";
const func2 =
  typeof func2Module === "function" ? func2Module : func2Module.default;
const pattern0 = new RegExp("^[A-Za-z0-9][A-Za-z0-9._:/-]*$", "u");
const pattern2 = new RegExp("^sha256:[0-9a-f]{64}$", "u");

function validate13(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property '" + "id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.version === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "version" },
        message: "must have required property '" + "version" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.hash === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "hash" },
        message: "must have required property '" + "hash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "version" || key0 === "hash")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err4 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err6 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.version !== undefined) {
      let data1 = data.version;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err8 = {
            instancePath: instancePath + "/version",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err9 = {
            instancePath: instancePath + "/version",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err10 = {
            instancePath: instancePath + "/version",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/version",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.hash !== undefined) {
      let data2 = data.hash;
      if (typeof data2 === "string") {
        if (!pattern2.test(data2)) {
          const err12 = {
            instancePath: instancePath + "/hash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/hash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate13.errors = vErrors;
  return errors === 0;
}

function validate108(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property '" + "schemaVersion" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.catalog === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalog" },
        message: "must have required property '" + "catalog" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.connectorTaxonomy === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "connectorTaxonomy" },
        message: "must have required property '" + "connectorTaxonomy" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.collisionModel === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "collisionModel" },
        message: "must have required property '" + "collisionModel" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.transformPolicy === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "transformPolicy" },
        message: "must have required property '" + "transformPolicy" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.validatorSet === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "validatorSet" },
        message: "must have required property '" + "validatorSet" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "schemaVersion" ||
        key0 === "catalog" ||
        key0 === "connectorTaxonomy" ||
        key0 === "collisionModel" ||
        key0 === "transformPolicy" ||
        key0 === "validatorSet"
      )) {
        const err6 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== undefined) {
      if ("lego.truth-snapshot/1" !== data.schemaVersion) {
        const err7 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "lego.truth-snapshot/1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.catalog !== undefined) {
      if (
        !validate13(data.catalog, {
          instancePath: instancePath + "/catalog",
          parentData: data,
          parentDataProperty: "catalog",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.connectorTaxonomy !== undefined) {
      if (
        !validate13(data.connectorTaxonomy, {
          instancePath: instancePath + "/connectorTaxonomy",
          parentData: data,
          parentDataProperty: "connectorTaxonomy",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.collisionModel !== undefined) {
      if (
        !validate13(data.collisionModel, {
          instancePath: instancePath + "/collisionModel",
          parentData: data,
          parentDataProperty: "collisionModel",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.transformPolicy !== undefined) {
      if (
        !validate13(data.transformPolicy, {
          instancePath: instancePath + "/transformPolicy",
          parentData: data,
          parentDataProperty: "transformPolicy",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.validatorSet !== undefined) {
      if (
        !validate13(data.validatorSet, {
          instancePath: instancePath + "/validatorSet",
          parentData: data,
          parentDataProperty: "validatorSet",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err8 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate108.errors = vErrors;
  return errors === 0;
}

function validate10(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/TruthSnapshot" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate108(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate108.errors
        : vErrors.concat(validate108.errors);
    errors = vErrors.length;
  }
  validate10.errors = vErrors;
  return errors === 0;
}

export const validateRigidTransform = validate115;
const schema141 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/RigidTransform",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/RigidTransform",
};
const schema18 = {
  type: "object",
  additionalProperties: false,
  required: ["positionLdu", "orientationId"],
  properties: {
    positionLdu: { $ref: "#/definitions/LduVector" },
    orientationId: { $ref: "#/definitions/Identifier" },
  },
};
const schema19 = {
  type: "array",
  items: { $ref: "#/definitions/LduCoordinate" },
  minItems: 3,
  maxItems: 3,
};
const schema20 = { type: "integer", minimum: -10000000, maximum: 10000000 };

function validate21(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (Array.isArray(data)) {
    if (data.length > 3) {
      const err0 = {
        instancePath,
        schemaPath: "#/maxItems",
        keyword: "maxItems",
        params: { limit: 3 },
        message: "must NOT have more than 3 items",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.length < 3) {
      const err1 = {
        instancePath,
        schemaPath: "#/minItems",
        keyword: "minItems",
        params: { limit: 3 },
        message: "must NOT have fewer than 3 items",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    const len0 = data.length;
    for (let i0 = 0; i0 < len0; i0++) {
      let data0 = data[i0];
      if (!(
        typeof data0 == "number" &&
        !(data0 % 1) &&
        !isNaN(data0) &&
        isFinite(data0)
      )) {
        const err2 = {
          instancePath: instancePath + "/" + i0,
          schemaPath: "#/definitions/LduCoordinate/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
      if (typeof data0 == "number" && isFinite(data0)) {
        if (data0 > 10000000 || isNaN(data0)) {
          const err3 = {
            instancePath: instancePath + "/" + i0,
            schemaPath: "#/definitions/LduCoordinate/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 10000000 },
            message: "must be <= 10000000",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data0 < -10000000 || isNaN(data0)) {
          const err4 = {
            instancePath: instancePath + "/" + i0,
            schemaPath: "#/definitions/LduCoordinate/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: -10000000 },
            message: "must be >= -10000000",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      }
    }
  } else {
    const err5 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "array" },
      message: "must be array",
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}

function validate116(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.positionLdu === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "positionLdu" },
        message: "must have required property '" + "positionLdu" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.orientationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "orientationId" },
        message: "must have required property '" + "orientationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "positionLdu" || key0 === "orientationId")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.positionLdu !== undefined) {
      if (
        !validate21(data.positionLdu, {
          instancePath: instancePath + "/positionLdu",
          parentData: data,
          parentDataProperty: "positionLdu",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate21.errors
            : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
    if (data.orientationId !== undefined) {
      let data1 = data.orientationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err3 = {
            instancePath: instancePath + "/orientationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err4 = {
            instancePath: instancePath + "/orientationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err5 = {
            instancePath: instancePath + "/orientationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/orientationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate116.errors = vErrors;
  return errors === 0;
}

function validate115(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/RigidTransform" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate116(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate116.errors
        : vErrors.concat(validate116.errors);
    errors = vErrors.length;
  }
  validate115.errors = vErrors;
  return errors === 0;
}

export const validateBrickDocumentV1 = validate119;
const schema144 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/BrickDocumentV1",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/BrickDocumentV1",
};
const schema22 = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "revision",
    "truth",
    "name",
    "parts",
    "connections",
    "submodels",
    "steps",
    "semanticRegions",
    "constraints",
    "provenance",
  ],
  properties: {
    schemaVersion: { const: "lego.brick-document/1" },
    id: { $ref: "#/definitions/Identifier" },
    revision: { $ref: "#/definitions/Identifier" },
    truth: { $ref: "#/definitions/TruthSnapshot" },
    name: { $ref: "#/definitions/ShortText" },
    parts: {
      type: "array",
      items: { $ref: "#/definitions/PartInstance" },
      maxItems: 10000,
    },
    connections: {
      type: "array",
      items: { $ref: "#/definitions/ConnectionEdge" },
      maxItems: 50000,
    },
    submodels: {
      type: "array",
      items: { $ref: "#/definitions/Submodel" },
      minItems: 1,
      maxItems: 1024,
    },
    steps: {
      type: "array",
      items: { $ref: "#/definitions/BuildStep" },
      minItems: 1,
      maxItems: 10000,
    },
    semanticRegions: {
      type: "array",
      items: { $ref: "#/definitions/SemanticRegion" },
      maxItems: 1024,
    },
    constraints: { $ref: "#/definitions/DocumentConstraints" },
    provenance: { $ref: "#/definitions/DocumentProvenance" },
  },
};
const schema25 = { type: "string", maxLength: 256 };
const func8 = Object.prototype.hasOwnProperty;

function validate12(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property '" + "schemaVersion" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.catalog === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalog" },
        message: "must have required property '" + "catalog" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.connectorTaxonomy === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "connectorTaxonomy" },
        message: "must have required property '" + "connectorTaxonomy" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.collisionModel === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "collisionModel" },
        message: "must have required property '" + "collisionModel" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.transformPolicy === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "transformPolicy" },
        message: "must have required property '" + "transformPolicy" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.validatorSet === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "validatorSet" },
        message: "must have required property '" + "validatorSet" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "schemaVersion" ||
        key0 === "catalog" ||
        key0 === "connectorTaxonomy" ||
        key0 === "collisionModel" ||
        key0 === "transformPolicy" ||
        key0 === "validatorSet"
      )) {
        const err6 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== undefined) {
      if ("lego.truth-snapshot/1" !== data.schemaVersion) {
        const err7 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "lego.truth-snapshot/1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.catalog !== undefined) {
      if (
        !validate13(data.catalog, {
          instancePath: instancePath + "/catalog",
          parentData: data,
          parentDataProperty: "catalog",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.connectorTaxonomy !== undefined) {
      if (
        !validate13(data.connectorTaxonomy, {
          instancePath: instancePath + "/connectorTaxonomy",
          parentData: data,
          parentDataProperty: "connectorTaxonomy",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.collisionModel !== undefined) {
      if (
        !validate13(data.collisionModel, {
          instancePath: instancePath + "/collisionModel",
          parentData: data,
          parentDataProperty: "collisionModel",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.transformPolicy !== undefined) {
      if (
        !validate13(data.transformPolicy, {
          instancePath: instancePath + "/transformPolicy",
          parentData: data,
          parentDataProperty: "transformPolicy",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
    if (data.validatorSet !== undefined) {
      if (
        !validate13(data.validatorSet, {
          instancePath: instancePath + "/validatorSet",
          parentData: data,
          parentDataProperty: "validatorSet",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate13.errors
            : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err8 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate12.errors = vErrors;
  return errors === 0;
}

const schema26 = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "catalogPartId",
    "colorId",
    "transform",
    "submodelId",
    "stepId",
    "semanticTags",
    "provenance",
  ],
  properties: {
    id: { $ref: "#/definitions/Identifier" },
    catalogPartId: { $ref: "#/definitions/Identifier" },
    colorId: { $ref: "#/definitions/Identifier" },
    transform: { $ref: "#/definitions/RigidTransform" },
    submodelId: { $ref: "#/definitions/Identifier" },
    stepId: { $ref: "#/definitions/Identifier" },
    semanticTags: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 32,
      uniqueItems: true,
    },
    provenance: { $ref: "#/definitions/EntityProvenance" },
  },
};
import func0Module from "ajv/dist/runtime/equal.js";
const func0 =
  typeof func0Module === "function" ? func0Module : func0Module.default;

function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.positionLdu === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "positionLdu" },
        message: "must have required property '" + "positionLdu" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.orientationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "orientationId" },
        message: "must have required property '" + "orientationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "positionLdu" || key0 === "orientationId")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.positionLdu !== undefined) {
      if (
        !validate21(data.positionLdu, {
          instancePath: instancePath + "/positionLdu",
          parentData: data,
          parentDataProperty: "positionLdu",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate21.errors
            : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
    if (data.orientationId !== undefined) {
      let data1 = data.orientationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err3 = {
            instancePath: instancePath + "/orientationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err4 = {
            instancePath: instancePath + "/orientationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err5 = {
            instancePath: instancePath + "/orientationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/orientationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}

const schema33 = {
  type: "object",
  additionalProperties: false,
  required: ["source"],
  properties: {
    source: { enum: ["manual", "ai", "import", "template", "migration"] },
    sourceId: { $ref: "#/definitions/Identifier" },
  },
};

function validate28(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.source === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source" },
        message: "must have required property '" + "source" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "source" || key0 === "sourceId")) {
        const err1 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.source !== undefined) {
      let data0 = data.source;
      if (!(
        data0 === "manual" ||
        data0 === "ai" ||
        data0 === "import" ||
        data0 === "template" ||
        data0 === "migration"
      )) {
        const err2 = {
          instancePath: instancePath + "/source",
          schemaPath: "#/properties/source/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.source.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.sourceId !== undefined) {
      let data1 = data.sourceId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err3 = {
            instancePath: instancePath + "/sourceId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err4 = {
            instancePath: instancePath + "/sourceId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err5 = {
            instancePath: instancePath + "/sourceId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/sourceId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate28.errors = vErrors;
  return errors === 0;
}

function validate26(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property '" + "id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.catalogPartId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalogPartId" },
        message: "must have required property '" + "catalogPartId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.colorId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "colorId" },
        message: "must have required property '" + "colorId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.transform === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "transform" },
        message: "must have required property '" + "transform" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.submodelId === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "submodelId" },
        message: "must have required property '" + "submodelId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.stepId === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "stepId" },
        message: "must have required property '" + "stepId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.semanticTags === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "semanticTags" },
        message: "must have required property '" + "semanticTags" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.provenance === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "id" ||
        key0 === "catalogPartId" ||
        key0 === "colorId" ||
        key0 === "transform" ||
        key0 === "submodelId" ||
        key0 === "stepId" ||
        key0 === "semanticTags" ||
        key0 === "provenance"
      )) {
        const err8 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err9 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err10 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err11 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.catalogPartId !== undefined) {
      let data1 = data.catalogPartId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err13 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err14 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err15 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/catalogPartId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.colorId !== undefined) {
      let data2 = data.colorId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err17 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err18 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err19 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/colorId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.transform !== undefined) {
      if (
        !validate20(data.transform, {
          instancePath: instancePath + "/transform",
          parentData: data,
          parentDataProperty: "transform",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate20.errors
            : vErrors.concat(validate20.errors);
        errors = vErrors.length;
      }
    }
    if (data.submodelId !== undefined) {
      let data4 = data.submodelId;
      if (typeof data4 === "string") {
        if (func2(data4) > 128) {
          const err21 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err22 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (!pattern0.test(data4)) {
          const err23 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/submodelId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.stepId !== undefined) {
      let data5 = data.stepId;
      if (typeof data5 === "string") {
        if (func2(data5) > 128) {
          const err25 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err26 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (!pattern0.test(data5)) {
          const err27 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      } else {
        const err28 = {
          instancePath: instancePath + "/stepId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.semanticTags !== undefined) {
      let data6 = data.semanticTags;
      if (Array.isArray(data6)) {
        if (data6.length > 32) {
          const err29 = {
            instancePath: instancePath + "/semanticTags",
            schemaPath: "#/properties/semanticTags/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        const len0 = data6.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data7 = data6[i0];
          if (typeof data7 === "string") {
            if (func2(data7) > 128) {
              const err30 = {
                instancePath: instancePath + "/semanticTags/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err30];
              } else {
                vErrors.push(err30);
              }
              errors++;
            }
            if (func2(data7) < 1) {
              const err31 = {
                instancePath: instancePath + "/semanticTags/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
            if (!pattern0.test(data7)) {
              const err32 = {
                instancePath: instancePath + "/semanticTags/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
          } else {
            const err33 = {
              instancePath: instancePath + "/semanticTags/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
        let i1 = data6.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data6[i1], data6[j0])) {
                const err34 = {
                  instancePath: instancePath + "/semanticTags",
                  schemaPath: "#/properties/semanticTags/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err35 = {
          instancePath: instancePath + "/semanticTags",
          schemaPath: "#/properties/semanticTags/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.provenance !== undefined) {
      if (
        !validate28(data.provenance, {
          instancePath: instancePath + "/provenance",
          parentData: data,
          parentDataProperty: "provenance",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate28.errors
            : vErrors.concat(validate28.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err36 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err36];
    } else {
      vErrors.push(err36);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}

const schema35 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "kind", "a", "b", "provenance"],
  properties: {
    id: { $ref: "#/definitions/Identifier" },
    kind: { const: "stud-tube" },
    a: { $ref: "#/definitions/PartPortRef" },
    b: { $ref: "#/definitions/PartPortRef" },
    provenance: { $ref: "#/definitions/EntityProvenance" },
  },
};
const schema37 = {
  type: "object",
  additionalProperties: false,
  required: ["partId", "portId"],
  properties: {
    partId: { $ref: "#/definitions/Identifier" },
    portId: { $ref: "#/definitions/Identifier" },
  },
};

function validate32(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.partId === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partId" },
        message: "must have required property '" + "partId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.portId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "portId" },
        message: "must have required property '" + "portId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "partId" || key0 === "portId")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.partId !== undefined) {
      let data0 = data.partId;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err3 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err4 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err5 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/partId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.portId !== undefined) {
      let data1 = data.portId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err7 = {
            instancePath: instancePath + "/portId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err8 = {
            instancePath: instancePath + "/portId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err9 = {
            instancePath: instancePath + "/portId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/portId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate32.errors = vErrors;
  return errors === 0;
}

function validate31(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property '" + "id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.kind === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.a === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "a" },
        message: "must have required property '" + "a" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.b === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "b" },
        message: "must have required property '" + "b" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.provenance === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "id" ||
        key0 === "kind" ||
        key0 === "a" ||
        key0 === "b" ||
        key0 === "provenance"
      )) {
        const err5 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err6 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err7 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err8 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("stud-tube" !== data.kind) {
        const err10 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "stud-tube" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.a !== undefined) {
      if (
        !validate32(data.a, {
          instancePath: instancePath + "/a",
          parentData: data,
          parentDataProperty: "a",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate32.errors
            : vErrors.concat(validate32.errors);
        errors = vErrors.length;
      }
    }
    if (data.b !== undefined) {
      if (
        !validate32(data.b, {
          instancePath: instancePath + "/b",
          parentData: data,
          parentDataProperty: "b",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate32.errors
            : vErrors.concat(validate32.errors);
        errors = vErrors.length;
      }
    }
    if (data.provenance !== undefined) {
      if (
        !validate28(data.provenance, {
          instancePath: instancePath + "/provenance",
          parentData: data,
          parentDataProperty: "provenance",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate28.errors
            : vErrors.concat(validate28.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err11 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate31.errors = vErrors;
  return errors === 0;
}

const schema40 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "partIds"],
  properties: {
    id: { $ref: "#/definitions/Identifier" },
    name: { $ref: "#/definitions/ShortText" },
    partIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 10000,
      uniqueItems: true,
    },
  },
};

function validate37(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property '" + "id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.name === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property '" + "name" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.partIds === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partIds" },
        message: "must have required property '" + "partIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "name" || key0 === "partIds")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err4 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err6 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data1 = data.name;
      if (typeof data1 === "string") {
        if (func2(data1) > 256) {
          const err8 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/definitions/ShortText/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/definitions/ShortText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.partIds !== undefined) {
      let data2 = data.partIds;
      if (Array.isArray(data2)) {
        if (data2.length > 10000) {
          const err10 = {
            instancePath: instancePath + "/partIds",
            schemaPath: "#/properties/partIds/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (typeof data3 === "string") {
            if (func2(data3) > 128) {
              const err11 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
            if (func2(data3) < 1) {
              const err12 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
            if (!pattern0.test(data3)) {
              const err13 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          } else {
            const err14 = {
              instancePath: instancePath + "/partIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        let i1 = data2.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data2[i1], data2[j0])) {
                const err15 = {
                  instancePath: instancePath + "/partIds",
                  schemaPath: "#/properties/partIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/partIds",
          schemaPath: "#/properties/partIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  validate37.errors = vErrors;
  return errors === 0;
}

const schema44 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "index", "name", "partIds"],
  properties: {
    id: { $ref: "#/definitions/Identifier" },
    index: { type: "integer", minimum: 0, maximum: 9999 },
    name: { $ref: "#/definitions/ShortText" },
    partIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 10000,
      uniqueItems: true,
    },
  },
};

function validate39(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property '" + "id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.index === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "index" },
        message: "must have required property '" + "index" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.name === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property '" + "name" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.partIds === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partIds" },
        message: "must have required property '" + "partIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "id" ||
        key0 === "index" ||
        key0 === "name" ||
        key0 === "partIds"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err5 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err6 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err7 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.index !== undefined) {
      let data1 = data.index;
      if (!(
        typeof data1 == "number" &&
        !(data1 % 1) &&
        !isNaN(data1) &&
        isFinite(data1)
      )) {
        const err9 = {
          instancePath: instancePath + "/index",
          schemaPath: "#/properties/index/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 > 9999 || isNaN(data1)) {
          const err10 = {
            instancePath: instancePath + "/index",
            schemaPath: "#/properties/index/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 9999 },
            message: "must be <= 9999",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (data1 < 0 || isNaN(data1)) {
          const err11 = {
            instancePath: instancePath + "/index",
            schemaPath: "#/properties/index/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      }
    }
    if (data.name !== undefined) {
      let data2 = data.name;
      if (typeof data2 === "string") {
        if (func2(data2) > 256) {
          const err12 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/definitions/ShortText/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/definitions/ShortText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.partIds !== undefined) {
      let data3 = data.partIds;
      if (Array.isArray(data3)) {
        if (data3.length > 10000) {
          const err14 = {
            instancePath: instancePath + "/partIds",
            schemaPath: "#/properties/partIds/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data4 = data3[i0];
          if (typeof data4 === "string") {
            if (func2(data4) > 128) {
              const err15 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
            if (func2(data4) < 1) {
              const err16 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
            if (!pattern0.test(data4)) {
              const err17 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
          } else {
            const err18 = {
              instancePath: instancePath + "/partIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
        }
        let i1 = data3.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data3[i1], data3[j0])) {
                const err19 = {
                  instancePath: instancePath + "/partIds",
                  schemaPath: "#/properties/partIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err19];
                } else {
                  vErrors.push(err19);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/partIds",
          schemaPath: "#/properties/partIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
  } else {
    const err21 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err21];
    } else {
      vErrors.push(err21);
    }
    errors++;
  }
  validate39.errors = vErrors;
  return errors === 0;
}

const schema48 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "partIds"],
  properties: {
    id: { $ref: "#/definitions/Identifier" },
    label: { $ref: "#/definitions/ShortText" },
    partIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 10000,
      uniqueItems: true,
    },
  },
};

function validate41(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property '" + "id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "label" },
        message: "must have required property '" + "label" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.partIds === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partIds" },
        message: "must have required property '" + "partIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "label" || key0 === "partIds")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err4 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err6 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) > 256) {
          const err8 = {
            instancePath: instancePath + "/label",
            schemaPath: "#/definitions/ShortText/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/label",
          schemaPath: "#/definitions/ShortText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.partIds !== undefined) {
      let data2 = data.partIds;
      if (Array.isArray(data2)) {
        if (data2.length > 10000) {
          const err10 = {
            instancePath: instancePath + "/partIds",
            schemaPath: "#/properties/partIds/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (typeof data3 === "string") {
            if (func2(data3) > 128) {
              const err11 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
            if (func2(data3) < 1) {
              const err12 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
            if (!pattern0.test(data3)) {
              const err13 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          } else {
            const err14 = {
              instancePath: instancePath + "/partIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        let i1 = data2.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data2[i1], data2[j0])) {
                const err15 = {
                  instancePath: instancePath + "/partIds",
                  schemaPath: "#/properties/partIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/partIds",
          schemaPath: "#/properties/partIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  validate41.errors = vErrors;
  return errors === 0;
}

const schema52 = {
  type: "object",
  additionalProperties: false,
  required: ["maxParts", "allowedCatalogPartIds", "allowedColorIds"],
  properties: {
    maxParts: { type: "integer", minimum: 1, maximum: 10000 },
    allowedCatalogPartIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      minItems: 1,
      maxItems: 10000,
      uniqueItems: true,
    },
    allowedColorIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      minItems: 1,
      maxItems: 256,
      uniqueItems: true,
    },
  },
};

function validate43(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.maxParts === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "maxParts" },
        message: "must have required property '" + "maxParts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.allowedCatalogPartIds === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowedCatalogPartIds" },
        message:
          "must have required property '" + "allowedCatalogPartIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.allowedColorIds === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowedColorIds" },
        message: "must have required property '" + "allowedColorIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "maxParts" ||
        key0 === "allowedCatalogPartIds" ||
        key0 === "allowedColorIds"
      )) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.maxParts !== undefined) {
      let data0 = data.maxParts;
      if (!(
        typeof data0 == "number" &&
        !(data0 % 1) &&
        !isNaN(data0) &&
        isFinite(data0)
      )) {
        const err4 = {
          instancePath: instancePath + "/maxParts",
          schemaPath: "#/properties/maxParts/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      if (typeof data0 == "number" && isFinite(data0)) {
        if (data0 > 10000 || isNaN(data0)) {
          const err5 = {
            instancePath: instancePath + "/maxParts",
            schemaPath: "#/properties/maxParts/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 10000 },
            message: "must be <= 10000",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (data0 < 1 || isNaN(data0)) {
          const err6 = {
            instancePath: instancePath + "/maxParts",
            schemaPath: "#/properties/maxParts/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 1 },
            message: "must be >= 1",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
    if (data.allowedCatalogPartIds !== undefined) {
      let data1 = data.allowedCatalogPartIds;
      if (Array.isArray(data1)) {
        if (data1.length > 10000) {
          const err7 = {
            instancePath: instancePath + "/allowedCatalogPartIds",
            schemaPath: "#/properties/allowedCatalogPartIds/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data1.length < 1) {
          const err8 = {
            instancePath: instancePath + "/allowedCatalogPartIds",
            schemaPath: "#/properties/allowedCatalogPartIds/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 === "string") {
            if (func2(data2) > 128) {
              const err9 = {
                instancePath: instancePath + "/allowedCatalogPartIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
            if (func2(data2) < 1) {
              const err10 = {
                instancePath: instancePath + "/allowedCatalogPartIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
            if (!pattern0.test(data2)) {
              const err11 = {
                instancePath: instancePath + "/allowedCatalogPartIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
          } else {
            const err12 = {
              instancePath: instancePath + "/allowedCatalogPartIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
        let i1 = data1.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data1[i1], data1[j0])) {
                const err13 = {
                  instancePath: instancePath + "/allowedCatalogPartIds",
                  schemaPath: "#/properties/allowedCatalogPartIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err13];
                } else {
                  vErrors.push(err13);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/allowedCatalogPartIds",
          schemaPath: "#/properties/allowedCatalogPartIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.allowedColorIds !== undefined) {
      let data3 = data.allowedColorIds;
      if (Array.isArray(data3)) {
        if (data3.length > 256) {
          const err15 = {
            instancePath: instancePath + "/allowedColorIds",
            schemaPath: "#/properties/allowedColorIds/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (data3.length < 1) {
          const err16 = {
            instancePath: instancePath + "/allowedColorIds",
            schemaPath: "#/properties/allowedColorIds/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        const len1 = data3.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data4 = data3[i2];
          if (typeof data4 === "string") {
            if (func2(data4) > 128) {
              const err17 = {
                instancePath: instancePath + "/allowedColorIds/" + i2,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (func2(data4) < 1) {
              const err18 = {
                instancePath: instancePath + "/allowedColorIds/" + i2,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
            if (!pattern0.test(data4)) {
              const err19 = {
                instancePath: instancePath + "/allowedColorIds/" + i2,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
          } else {
            const err20 = {
              instancePath: instancePath + "/allowedColorIds/" + i2,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        let i3 = data3.length;
        let j1;
        if (i3 > 1) {
          outer1: for (; i3--;) {
            for (j1 = i3; j1--;) {
              if (func0(data3[i3], data3[j1])) {
                const err21 = {
                  instancePath: instancePath + "/allowedColorIds",
                  schemaPath: "#/properties/allowedColorIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i3, j: j1 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j1 +
                    " and " +
                    i3 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err21];
                } else {
                  vErrors.push(err21);
                }
                errors++;
                break outer1;
              }
            }
          }
        }
      } else {
        const err22 = {
          instancePath: instancePath + "/allowedColorIds",
          schemaPath: "#/properties/allowedColorIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
  } else {
    const err23 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  validate43.errors = vErrors;
  return errors === 0;
}

const schema55 = {
  type: "object",
  additionalProperties: false,
  required: ["origin"],
  properties: {
    origin: { enum: ["manual", "import", "migration"] },
    sourceId: { $ref: "#/definitions/Identifier" },
  },
};

function validate45(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.origin === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "origin" },
        message: "must have required property '" + "origin" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "origin" || key0 === "sourceId")) {
        const err1 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.origin !== undefined) {
      let data0 = data.origin;
      if (!(
        data0 === "manual" ||
        data0 === "import" ||
        data0 === "migration"
      )) {
        const err2 = {
          instancePath: instancePath + "/origin",
          schemaPath: "#/properties/origin/enum",
          keyword: "enum",
          params: { allowedValues: schema55.properties.origin.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.sourceId !== undefined) {
      let data1 = data.sourceId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err3 = {
            instancePath: instancePath + "/sourceId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err4 = {
            instancePath: instancePath + "/sourceId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err5 = {
            instancePath: instancePath + "/sourceId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/sourceId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate45.errors = vErrors;
  return errors === 0;
}

function validate120(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property '" + "schemaVersion" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property '" + "id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.revision === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revision" },
        message: "must have required property '" + "revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.truth === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "truth" },
        message: "must have required property '" + "truth" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.name === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property '" + "name" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.parts === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parts" },
        message: "must have required property '" + "parts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.connections === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "connections" },
        message: "must have required property '" + "connections" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.submodels === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "submodels" },
        message: "must have required property '" + "submodels" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.steps === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "steps" },
        message: "must have required property '" + "steps" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.semanticRegions === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "semanticRegions" },
        message: "must have required property '" + "semanticRegions" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.constraints === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "constraints" },
        message: "must have required property '" + "constraints" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.provenance === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func8.call(schema22.properties, key0)) {
        const err12 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== undefined) {
      if ("lego.brick-document/1" !== data.schemaVersion) {
        const err13 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "lego.brick-document/1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err14 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err15 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err16 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data2 = data.revision;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err18 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err19 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err20 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/revision",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.truth !== undefined) {
      if (
        !validate12(data.truth, {
          instancePath: instancePath + "/truth",
          parentData: data,
          parentDataProperty: "truth",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate12.errors
            : vErrors.concat(validate12.errors);
        errors = vErrors.length;
      }
    }
    if (data.name !== undefined) {
      let data4 = data.name;
      if (typeof data4 === "string") {
        if (func2(data4) > 256) {
          const err22 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/definitions/ShortText/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/definitions/ShortText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.parts !== undefined) {
      let data5 = data.parts;
      if (Array.isArray(data5)) {
        if (data5.length > 10000) {
          const err24 = {
            instancePath: instancePath + "/parts",
            schemaPath: "#/properties/parts/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        const len0 = data5.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate26(data5[i0], {
              instancePath: instancePath + "/parts/" + i0,
              parentData: data5,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate26.errors
                : vErrors.concat(validate26.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err25 = {
          instancePath: instancePath + "/parts",
          schemaPath: "#/properties/parts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.connections !== undefined) {
      let data7 = data.connections;
      if (Array.isArray(data7)) {
        if (data7.length > 50000) {
          const err26 = {
            instancePath: instancePath + "/connections",
            schemaPath: "#/properties/connections/maxItems",
            keyword: "maxItems",
            params: { limit: 50000 },
            message: "must NOT have more than 50000 items",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        const len1 = data7.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !validate31(data7[i1], {
              instancePath: instancePath + "/connections/" + i1,
              parentData: data7,
              parentDataProperty: i1,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate31.errors
                : vErrors.concat(validate31.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/connections",
          schemaPath: "#/properties/connections/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.submodels !== undefined) {
      let data9 = data.submodels;
      if (Array.isArray(data9)) {
        if (data9.length > 1024) {
          const err28 = {
            instancePath: instancePath + "/submodels",
            schemaPath: "#/properties/submodels/maxItems",
            keyword: "maxItems",
            params: { limit: 1024 },
            message: "must NOT have more than 1024 items",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (data9.length < 1) {
          const err29 = {
            instancePath: instancePath + "/submodels",
            schemaPath: "#/properties/submodels/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        const len2 = data9.length;
        for (let i2 = 0; i2 < len2; i2++) {
          if (
            !validate37(data9[i2], {
              instancePath: instancePath + "/submodels/" + i2,
              parentData: data9,
              parentDataProperty: i2,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate37.errors
                : vErrors.concat(validate37.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err30 = {
          instancePath: instancePath + "/submodels",
          schemaPath: "#/properties/submodels/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.steps !== undefined) {
      let data11 = data.steps;
      if (Array.isArray(data11)) {
        if (data11.length > 10000) {
          const err31 = {
            instancePath: instancePath + "/steps",
            schemaPath: "#/properties/steps/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (data11.length < 1) {
          const err32 = {
            instancePath: instancePath + "/steps",
            schemaPath: "#/properties/steps/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        const len3 = data11.length;
        for (let i3 = 0; i3 < len3; i3++) {
          if (
            !validate39(data11[i3], {
              instancePath: instancePath + "/steps/" + i3,
              parentData: data11,
              parentDataProperty: i3,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate39.errors
                : vErrors.concat(validate39.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err33 = {
          instancePath: instancePath + "/steps",
          schemaPath: "#/properties/steps/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
    if (data.semanticRegions !== undefined) {
      let data13 = data.semanticRegions;
      if (Array.isArray(data13)) {
        if (data13.length > 1024) {
          const err34 = {
            instancePath: instancePath + "/semanticRegions",
            schemaPath: "#/properties/semanticRegions/maxItems",
            keyword: "maxItems",
            params: { limit: 1024 },
            message: "must NOT have more than 1024 items",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        const len4 = data13.length;
        for (let i4 = 0; i4 < len4; i4++) {
          if (
            !validate41(data13[i4], {
              instancePath: instancePath + "/semanticRegions/" + i4,
              parentData: data13,
              parentDataProperty: i4,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate41.errors
                : vErrors.concat(validate41.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err35 = {
          instancePath: instancePath + "/semanticRegions",
          schemaPath: "#/properties/semanticRegions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.constraints !== undefined) {
      if (
        !validate43(data.constraints, {
          instancePath: instancePath + "/constraints",
          parentData: data,
          parentDataProperty: "constraints",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate43.errors
            : vErrors.concat(validate43.errors);
        errors = vErrors.length;
      }
    }
    if (data.provenance !== undefined) {
      if (
        !validate45(data.provenance, {
          instancePath: instancePath + "/provenance",
          parentData: data,
          parentDataProperty: "provenance",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate45.errors
            : vErrors.concat(validate45.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err36 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err36];
    } else {
      vErrors.push(err36);
    }
    errors++;
  }
  validate120.errors = vErrors;
  return errors === 0;
}

function validate119(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/BrickDocumentV1" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate120(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate120.errors
        : vErrors.concat(validate120.errors);
    errors = vErrors.length;
  }
  validate119.errors = vErrors;
  return errors === 0;
}

export const validateBuildProgramV1 = validate130;
const schema149 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/BuildProgramV1",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/BuildProgramV1",
};
const schema57 = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "operations"],
  properties: {
    schemaVersion: { const: "lego.build-program/1" },
    operations: {
      type: "array",
      items: { $ref: "#/definitions/ProgramOperation" },
      minItems: 1,
      maxItems: 1024,
    },
  },
};
const schema58 = {
  oneOf: [
    { $ref: "#/definitions/PlacePartInstruction" },
    { $ref: "#/definitions/AttachInstruction" },
    { $ref: "#/definitions/RemovePartInstruction" },
    { $ref: "#/definitions/ReplacePartInstruction" },
    { $ref: "#/definitions/MovePartInstruction" },
    { $ref: "#/definitions/RecolorPartInstruction" },
    { $ref: "#/definitions/AssignStepInstruction" },
    { $ref: "#/definitions/InstantiateTemplateInstruction" },
  ],
};
const schema59 = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "operationId",
    "localPartId",
    "catalogPartId",
    "colorId",
    "transform",
    "submodelId",
    "stepId",
    "semanticTags",
  ],
  properties: {
    kind: { const: "placePart" },
    operationId: { $ref: "#/definitions/Identifier" },
    localPartId: { $ref: "#/definitions/Identifier" },
    catalogPartId: { $ref: "#/definitions/Identifier" },
    colorId: { $ref: "#/definitions/Identifier" },
    transform: { $ref: "#/definitions/RigidTransform" },
    submodelId: { $ref: "#/definitions/Identifier" },
    stepId: { $ref: "#/definitions/Identifier" },
    semanticTags: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 32,
      uniqueItems: true,
    },
  },
};

function validate50(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.localPartId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "localPartId" },
        message: "must have required property '" + "localPartId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.catalogPartId === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalogPartId" },
        message: "must have required property '" + "catalogPartId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.colorId === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "colorId" },
        message: "must have required property '" + "colorId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.transform === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "transform" },
        message: "must have required property '" + "transform" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.submodelId === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "submodelId" },
        message: "must have required property '" + "submodelId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.stepId === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "stepId" },
        message: "must have required property '" + "stepId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.semanticTags === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "semanticTags" },
        message: "must have required property '" + "semanticTags" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func8.call(schema59.properties, key0)) {
        const err9 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("placePart" !== data.kind) {
        const err10 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "placePart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err11 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err12 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err13 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.localPartId !== undefined) {
      let data2 = data.localPartId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err15 = {
            instancePath: instancePath + "/localPartId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err16 = {
            instancePath: instancePath + "/localPartId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err17 = {
            instancePath: instancePath + "/localPartId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/localPartId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.catalogPartId !== undefined) {
      let data3 = data.catalogPartId;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err19 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err20 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (!pattern0.test(data3)) {
          const err21 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = {
          instancePath: instancePath + "/catalogPartId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.colorId !== undefined) {
      let data4 = data.colorId;
      if (typeof data4 === "string") {
        if (func2(data4) > 128) {
          const err23 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err24 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (!pattern0.test(data4)) {
          const err25 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      } else {
        const err26 = {
          instancePath: instancePath + "/colorId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.transform !== undefined) {
      if (
        !validate20(data.transform, {
          instancePath: instancePath + "/transform",
          parentData: data,
          parentDataProperty: "transform",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate20.errors
            : vErrors.concat(validate20.errors);
        errors = vErrors.length;
      }
    }
    if (data.submodelId !== undefined) {
      let data6 = data.submodelId;
      if (typeof data6 === "string") {
        if (func2(data6) > 128) {
          const err27 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (func2(data6) < 1) {
          const err28 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (!pattern0.test(data6)) {
          const err29 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
      } else {
        const err30 = {
          instancePath: instancePath + "/submodelId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.stepId !== undefined) {
      let data7 = data.stepId;
      if (typeof data7 === "string") {
        if (func2(data7) > 128) {
          const err31 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (func2(data7) < 1) {
          const err32 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        if (!pattern0.test(data7)) {
          const err33 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
      } else {
        const err34 = {
          instancePath: instancePath + "/stepId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
    }
    if (data.semanticTags !== undefined) {
      let data8 = data.semanticTags;
      if (Array.isArray(data8)) {
        if (data8.length > 32) {
          const err35 = {
            instancePath: instancePath + "/semanticTags",
            schemaPath: "#/properties/semanticTags/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
        const len0 = data8.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data9 = data8[i0];
          if (typeof data9 === "string") {
            if (func2(data9) > 128) {
              const err36 = {
                instancePath: instancePath + "/semanticTags/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
            if (func2(data9) < 1) {
              const err37 = {
                instancePath: instancePath + "/semanticTags/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            if (!pattern0.test(data9)) {
              const err38 = {
                instancePath: instancePath + "/semanticTags/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
          } else {
            const err39 = {
              instancePath: instancePath + "/semanticTags/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
        }
        let i1 = data8.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data8[i1], data8[j0])) {
                const err40 = {
                  instancePath: instancePath + "/semanticTags",
                  schemaPath: "#/properties/semanticTags/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err40];
                } else {
                  vErrors.push(err40);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err41 = {
          instancePath: instancePath + "/semanticTags",
          schemaPath: "#/properties/semanticTags/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
  } else {
    const err42 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err42];
    } else {
      vErrors.push(err42);
    }
    errors++;
  }
  validate50.errors = vErrors;
  return errors === 0;
}

const schema67 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "a", "b", "connectionKind"],
  properties: {
    kind: { const: "attach" },
    operationId: { $ref: "#/definitions/Identifier" },
    a: { $ref: "#/definitions/PartPortRef" },
    b: { $ref: "#/definitions/PartPortRef" },
    connectionKind: { const: "stud-tube" },
  },
};

function validate53(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.a === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "a" },
        message: "must have required property '" + "a" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.b === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "b" },
        message: "must have required property '" + "b" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.connectionKind === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "connectionKind" },
        message: "must have required property '" + "connectionKind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "a" ||
        key0 === "b" ||
        key0 === "connectionKind"
      )) {
        const err5 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("attach" !== data.kind) {
        const err6 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "attach" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err9 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.a !== undefined) {
      if (
        !validate32(data.a, {
          instancePath: instancePath + "/a",
          parentData: data,
          parentDataProperty: "a",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate32.errors
            : vErrors.concat(validate32.errors);
        errors = vErrors.length;
      }
    }
    if (data.b !== undefined) {
      if (
        !validate32(data.b, {
          instancePath: instancePath + "/b",
          parentData: data,
          parentDataProperty: "b",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate32.errors
            : vErrors.concat(validate32.errors);
        errors = vErrors.length;
      }
    }
    if (data.connectionKind !== undefined) {
      if ("stud-tube" !== data.connectionKind) {
        const err11 = {
          instancePath: instancePath + "/connectionKind",
          schemaPath: "#/properties/connectionKind/const",
          keyword: "const",
          params: { allowedValue: "stud-tube" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate53.errors = vErrors;
  return errors === 0;
}

const schema69 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "partId"],
  properties: {
    kind: { const: "removePart" },
    operationId: { $ref: "#/definitions/Identifier" },
    partId: { $ref: "#/definitions/Identifier" },
  },
};

function validate57(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.partId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partId" },
        message: "must have required property '" + "partId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "operationId" || key0 === "partId")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("removePart" !== data.kind) {
        const err4 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "removePart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err5 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.partId !== undefined) {
      let data2 = data.partId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err9 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err10 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err11 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/partId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
  } else {
    const err13 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  }
  validate57.errors = vErrors;
  return errors === 0;
}

const schema72 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "partId", "catalogPartId", "colorId"],
  properties: {
    kind: { const: "replacePart" },
    operationId: { $ref: "#/definitions/Identifier" },
    partId: { $ref: "#/definitions/Identifier" },
    catalogPartId: { $ref: "#/definitions/Identifier" },
    colorId: { $ref: "#/definitions/Identifier" },
  },
};

function validate59(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.partId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partId" },
        message: "must have required property '" + "partId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.catalogPartId === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalogPartId" },
        message: "must have required property '" + "catalogPartId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.colorId === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "colorId" },
        message: "must have required property '" + "colorId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "partId" ||
        key0 === "catalogPartId" ||
        key0 === "colorId"
      )) {
        const err5 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("replacePart" !== data.kind) {
        const err6 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "replacePart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err9 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.partId !== undefined) {
      let data2 = data.partId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err11 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err12 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err13 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/partId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.catalogPartId !== undefined) {
      let data3 = data.catalogPartId;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err15 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err16 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (!pattern0.test(data3)) {
          const err17 = {
            instancePath: instancePath + "/catalogPartId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/catalogPartId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.colorId !== undefined) {
      let data4 = data.colorId;
      if (typeof data4 === "string") {
        if (func2(data4) > 128) {
          const err19 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err20 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (!pattern0.test(data4)) {
          const err21 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = {
          instancePath: instancePath + "/colorId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
  } else {
    const err23 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  validate59.errors = vErrors;
  return errors === 0;
}

const schema77 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "partId", "transform"],
  properties: {
    kind: { const: "movePart" },
    operationId: { $ref: "#/definitions/Identifier" },
    partId: { $ref: "#/definitions/Identifier" },
    transform: { $ref: "#/definitions/RigidTransform" },
  },
};

function validate61(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.partId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partId" },
        message: "must have required property '" + "partId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.transform === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "transform" },
        message: "must have required property '" + "transform" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "partId" ||
        key0 === "transform"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("movePart" !== data.kind) {
        const err5 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "movePart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.partId !== undefined) {
      let data2 = data.partId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err10 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err11 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err12 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/partId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.transform !== undefined) {
      if (
        !validate20(data.transform, {
          instancePath: instancePath + "/transform",
          parentData: data,
          parentDataProperty: "transform",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate20.errors
            : vErrors.concat(validate20.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate61.errors = vErrors;
  return errors === 0;
}

const schema80 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "partId", "colorId"],
  properties: {
    kind: { const: "recolorPart" },
    operationId: { $ref: "#/definitions/Identifier" },
    partId: { $ref: "#/definitions/Identifier" },
    colorId: { $ref: "#/definitions/Identifier" },
  },
};

function validate64(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.partId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partId" },
        message: "must have required property '" + "partId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.colorId === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "colorId" },
        message: "must have required property '" + "colorId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "partId" ||
        key0 === "colorId"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("recolorPart" !== data.kind) {
        const err5 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "recolorPart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.partId !== undefined) {
      let data2 = data.partId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err10 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err11 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err12 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/partId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.colorId !== undefined) {
      let data3 = data.colorId;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err14 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err15 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern0.test(data3)) {
          const err16 = {
            instancePath: instancePath + "/colorId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/colorId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
  } else {
    const err18 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate64.errors = vErrors;
  return errors === 0;
}

const schema84 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "partId", "stepId"],
  properties: {
    kind: { const: "assignStep" },
    operationId: { $ref: "#/definitions/Identifier" },
    partId: { $ref: "#/definitions/Identifier" },
    stepId: { $ref: "#/definitions/Identifier" },
  },
};

function validate66(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.partId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partId" },
        message: "must have required property '" + "partId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.stepId === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "stepId" },
        message: "must have required property '" + "stepId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "partId" ||
        key0 === "stepId"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("assignStep" !== data.kind) {
        const err5 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "assignStep" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.partId !== undefined) {
      let data2 = data.partId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err10 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err11 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err12 = {
            instancePath: instancePath + "/partId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/partId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.stepId !== undefined) {
      let data3 = data.stepId;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err14 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err15 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern0.test(data3)) {
          const err16 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/stepId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
  } else {
    const err18 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate66.errors = vErrors;
  return errors === 0;
}

const schema88 = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "operationId",
    "instanceLocalId",
    "templateId",
    "parameters",
    "transform",
    "submodelId",
    "stepId",
  ],
  properties: {
    kind: { const: "instantiateTemplate" },
    operationId: { $ref: "#/definitions/Identifier" },
    instanceLocalId: { $ref: "#/definitions/Identifier" },
    templateId: { $ref: "#/definitions/Identifier" },
    parameters: {
      type: "array",
      items: { $ref: "#/definitions/TemplateParameter" },
      maxItems: 64,
    },
    transform: { $ref: "#/definitions/RigidTransform" },
    submodelId: { $ref: "#/definitions/Identifier" },
    stepId: { $ref: "#/definitions/Identifier" },
  },
};
const schema92 = {
  type: "object",
  additionalProperties: false,
  required: ["name", "value"],
  properties: {
    name: { $ref: "#/definitions/Identifier" },
    value: {
      oneOf: [
        { type: "string", maxLength: 256 },
        { type: "number", minimum: -10000000, maximum: 10000000 },
        { type: "boolean" },
      ],
    },
  },
};

function validate69(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property '" + "name" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.value === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "value" },
        message: "must have required property '" + "value" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "name" || key0 === "value")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data0 = data.name;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err3 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err4 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err5 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data1 = data.value;
      const _errs6 = errors;
      let valid2 = false;
      let passing0 = null;
      const _errs7 = errors;
      if (typeof data1 === "string") {
        if (func2(data1) > 256) {
          const err7 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/oneOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      var _valid0 = _errs7 === errors;
      if (_valid0) {
        valid2 = true;
        passing0 = 0;
      }
      const _errs9 = errors;
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 > 10000000 || isNaN(data1)) {
          const err9 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/1/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 10000000 },
            message: "must be <= 10000000",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (data1 < -10000000 || isNaN(data1)) {
          const err10 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/1/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: -10000000 },
            message: "must be >= -10000000",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/oneOf/1/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      var _valid0 = _errs9 === errors;
      if (_valid0 && valid2) {
        valid2 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid2 = true;
          passing0 = 1;
        }
        const _errs11 = errors;
        if (typeof data1 !== "boolean") {
          const err12 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/2/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        var _valid0 = _errs11 === errors;
        if (_valid0 && valid2) {
          valid2 = false;
          passing0 = [passing0, 2];
        } else {
          if (_valid0) {
            valid2 = true;
            passing0 = 2;
          }
        }
      }
      if (!valid2) {
        const err13 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      } else {
        errors = _errs6;
        if (vErrors !== null) {
          if (_errs6) {
            vErrors.length = _errs6;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate69.errors = vErrors;
  return errors === 0;
}

function validate68(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.instanceLocalId === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "instanceLocalId" },
        message: "must have required property '" + "instanceLocalId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.templateId === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "templateId" },
        message: "must have required property '" + "templateId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.parameters === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parameters" },
        message: "must have required property '" + "parameters" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.transform === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "transform" },
        message: "must have required property '" + "transform" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.submodelId === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "submodelId" },
        message: "must have required property '" + "submodelId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.stepId === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "stepId" },
        message: "must have required property '" + "stepId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "instanceLocalId" ||
        key0 === "templateId" ||
        key0 === "parameters" ||
        key0 === "transform" ||
        key0 === "submodelId" ||
        key0 === "stepId"
      )) {
        const err8 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("instantiateTemplate" !== data.kind) {
        const err9 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "instantiateTemplate" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err10 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err11 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err12 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.instanceLocalId !== undefined) {
      let data2 = data.instanceLocalId;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err14 = {
            instancePath: instancePath + "/instanceLocalId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err15 = {
            instancePath: instancePath + "/instanceLocalId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err16 = {
            instancePath: instancePath + "/instanceLocalId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/instanceLocalId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.templateId !== undefined) {
      let data3 = data.templateId;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err18 = {
            instancePath: instancePath + "/templateId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err19 = {
            instancePath: instancePath + "/templateId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!pattern0.test(data3)) {
          const err20 = {
            instancePath: instancePath + "/templateId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/templateId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.parameters !== undefined) {
      let data4 = data.parameters;
      if (Array.isArray(data4)) {
        if (data4.length > 64) {
          const err22 = {
            instancePath: instancePath + "/parameters",
            schemaPath: "#/properties/parameters/maxItems",
            keyword: "maxItems",
            params: { limit: 64 },
            message: "must NOT have more than 64 items",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate69(data4[i0], {
              instancePath: instancePath + "/parameters/" + i0,
              parentData: data4,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate69.errors
                : vErrors.concat(validate69.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/parameters",
          schemaPath: "#/properties/parameters/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.transform !== undefined) {
      if (
        !validate20(data.transform, {
          instancePath: instancePath + "/transform",
          parentData: data,
          parentDataProperty: "transform",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate20.errors
            : vErrors.concat(validate20.errors);
        errors = vErrors.length;
      }
    }
    if (data.submodelId !== undefined) {
      let data7 = data.submodelId;
      if (typeof data7 === "string") {
        if (func2(data7) > 128) {
          const err24 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (func2(data7) < 1) {
          const err25 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (!pattern0.test(data7)) {
          const err26 = {
            instancePath: instancePath + "/submodelId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/submodelId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.stepId !== undefined) {
      let data8 = data.stepId;
      if (typeof data8 === "string") {
        if (func2(data8) > 128) {
          const err28 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (func2(data8) < 1) {
          const err29 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        if (!pattern0.test(data8)) {
          const err30 = {
            instancePath: instancePath + "/stepId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
      } else {
        const err31 = {
          instancePath: instancePath + "/stepId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
  } else {
    const err32 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err32];
    } else {
      vErrors.push(err32);
    }
    errors++;
  }
  validate68.errors = vErrors;
  return errors === 0;
}

function validate49(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (
    !validate50(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null ? validate50.errors : vErrors.concat(validate50.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs2 = errors;
  if (
    !validate53(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null ? validate53.errors : vErrors.concat(validate53.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs3 = errors;
    if (
      !validate57(data, {
        instancePath,
        parentData,
        parentDataProperty,
        rootData,
      })
    ) {
      vErrors =
        vErrors === null
          ? validate57.errors
          : vErrors.concat(validate57.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs3 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
      const _errs4 = errors;
      if (
        !validate59(data, {
          instancePath,
          parentData,
          parentDataProperty,
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate59.errors
            : vErrors.concat(validate59.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
        }
        const _errs5 = errors;
        if (
          !validate61(data, {
            instancePath,
            parentData,
            parentDataProperty,
            rootData,
          })
        ) {
          vErrors =
            vErrors === null
              ? validate61.errors
              : vErrors.concat(validate61.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs5 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
          }
          const _errs6 = errors;
          if (
            !validate64(data, {
              instancePath,
              parentData,
              parentDataProperty,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate64.errors
                : vErrors.concat(validate64.errors);
            errors = vErrors.length;
          }
          var _valid0 = _errs6 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
            }
            const _errs7 = errors;
            if (
              !validate66(data, {
                instancePath,
                parentData,
                parentDataProperty,
                rootData,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate66.errors
                  : vErrors.concat(validate66.errors);
              errors = vErrors.length;
            }
            var _valid0 = _errs7 === errors;
            if (_valid0 && valid0) {
              valid0 = false;
              passing0 = [passing0, 6];
            } else {
              if (_valid0) {
                valid0 = true;
                passing0 = 6;
              }
              const _errs8 = errors;
              if (
                !validate68(data, {
                  instancePath,
                  parentData,
                  parentDataProperty,
                  rootData,
                })
              ) {
                vErrors =
                  vErrors === null
                    ? validate68.errors
                    : vErrors.concat(validate68.errors);
                errors = vErrors.length;
              }
              var _valid0 = _errs8 === errors;
              if (_valid0 && valid0) {
                valid0 = false;
                passing0 = [passing0, 7];
              } else {
                if (_valid0) {
                  valid0 = true;
                  passing0 = 7;
                }
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate49.errors = vErrors;
  return errors === 0;
}

function validate131(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property '" + "schemaVersion" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operations === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operations" },
        message: "must have required property '" + "operations" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "schemaVersion" || key0 === "operations")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== undefined) {
      if ("lego.build-program/1" !== data.schemaVersion) {
        const err3 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "lego.build-program/1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.operations !== undefined) {
      let data1 = data.operations;
      if (Array.isArray(data1)) {
        if (data1.length > 1024) {
          const err4 = {
            instancePath: instancePath + "/operations",
            schemaPath: "#/properties/operations/maxItems",
            keyword: "maxItems",
            params: { limit: 1024 },
            message: "must NOT have more than 1024 items",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (data1.length < 1) {
          const err5 = {
            instancePath: instancePath + "/operations",
            schemaPath: "#/properties/operations/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate49(data1[i0], {
              instancePath: instancePath + "/operations/" + i0,
              parentData: data1,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate49.errors
                : vErrors.concat(validate49.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/operations",
          schemaPath: "#/properties/operations/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate131.errors = vErrors;
  return errors === 0;
}

function validate130(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/BuildProgramV1" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate131(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate131.errors
        : vErrors.concat(validate131.errors);
    errors = vErrors.length;
  }
  validate130.errors = vErrors;
  return errors === 0;
}

export const validateBuildOperation = validate134;
const schema151 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/BuildOperation",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/BuildOperation",
};
const schema112 = {
  oneOf: [
    { $ref: "#/definitions/AddPartOperation" },
    { $ref: "#/definitions/RemovePartOperation" },
    { $ref: "#/definitions/UpdatePartOperation" },
    { $ref: "#/definitions/AddConnectionOperation" },
    { $ref: "#/definitions/RemoveConnectionOperation" },
  ],
};
const schema113 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "part", "semanticRegionIds"],
  properties: {
    kind: { const: "addPart" },
    operationId: { $ref: "#/definitions/Identifier" },
    part: { $ref: "#/definitions/PartInstance" },
    semanticRegionIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      uniqueItems: true,
      maxItems: 1024,
    },
  },
};

function validate84(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.part === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "part" },
        message: "must have required property '" + "part" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.semanticRegionIds === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "semanticRegionIds" },
        message: "must have required property '" + "semanticRegionIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "part" ||
        key0 === "semanticRegionIds"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("addPart" !== data.kind) {
        const err5 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "addPart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.part !== undefined) {
      if (
        !validate26(data.part, {
          instancePath: instancePath + "/part",
          parentData: data,
          parentDataProperty: "part",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate26.errors
            : vErrors.concat(validate26.errors);
        errors = vErrors.length;
      }
    }
    if (data.semanticRegionIds !== undefined) {
      let data3 = data.semanticRegionIds;
      if (Array.isArray(data3)) {
        if (data3.length > 1024) {
          const err10 = {
            instancePath: instancePath + "/semanticRegionIds",
            schemaPath: "#/properties/semanticRegionIds/maxItems",
            keyword: "maxItems",
            params: { limit: 1024 },
            message: "must NOT have more than 1024 items",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data4 = data3[i0];
          if (typeof data4 === "string") {
            if (func2(data4) > 128) {
              const err11 = {
                instancePath: instancePath + "/semanticRegionIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
            if (func2(data4) < 1) {
              const err12 = {
                instancePath: instancePath + "/semanticRegionIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
            if (!pattern0.test(data4)) {
              const err13 = {
                instancePath: instancePath + "/semanticRegionIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          } else {
            const err14 = {
              instancePath: instancePath + "/semanticRegionIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        let i1 = data3.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data3[i1], data3[j0])) {
                const err15 = {
                  instancePath: instancePath + "/semanticRegionIds",
                  schemaPath: "#/properties/semanticRegionIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/semanticRegionIds",
          schemaPath: "#/properties/semanticRegionIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  validate84.errors = vErrors;
  return errors === 0;
}

const schema116 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "part", "semanticRegionIds"],
  properties: {
    kind: { const: "removePart" },
    operationId: { $ref: "#/definitions/Identifier" },
    part: { $ref: "#/definitions/PartInstance" },
    semanticRegionIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      uniqueItems: true,
      maxItems: 1024,
    },
  },
};

function validate87(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.part === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "part" },
        message: "must have required property '" + "part" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.semanticRegionIds === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "semanticRegionIds" },
        message: "must have required property '" + "semanticRegionIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "part" ||
        key0 === "semanticRegionIds"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("removePart" !== data.kind) {
        const err5 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "removePart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.part !== undefined) {
      if (
        !validate26(data.part, {
          instancePath: instancePath + "/part",
          parentData: data,
          parentDataProperty: "part",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate26.errors
            : vErrors.concat(validate26.errors);
        errors = vErrors.length;
      }
    }
    if (data.semanticRegionIds !== undefined) {
      let data3 = data.semanticRegionIds;
      if (Array.isArray(data3)) {
        if (data3.length > 1024) {
          const err10 = {
            instancePath: instancePath + "/semanticRegionIds",
            schemaPath: "#/properties/semanticRegionIds/maxItems",
            keyword: "maxItems",
            params: { limit: 1024 },
            message: "must NOT have more than 1024 items",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data4 = data3[i0];
          if (typeof data4 === "string") {
            if (func2(data4) > 128) {
              const err11 = {
                instancePath: instancePath + "/semanticRegionIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
            if (func2(data4) < 1) {
              const err12 = {
                instancePath: instancePath + "/semanticRegionIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
            if (!pattern0.test(data4)) {
              const err13 = {
                instancePath: instancePath + "/semanticRegionIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          } else {
            const err14 = {
              instancePath: instancePath + "/semanticRegionIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        let i1 = data3.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data3[i1], data3[j0])) {
                const err15 = {
                  instancePath: instancePath + "/semanticRegionIds",
                  schemaPath: "#/properties/semanticRegionIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/semanticRegionIds",
          schemaPath: "#/properties/semanticRegionIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  validate87.errors = vErrors;
  return errors === 0;
}

const schema119 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "before", "after"],
  properties: {
    kind: { const: "updatePart" },
    operationId: { $ref: "#/definitions/Identifier" },
    before: { $ref: "#/definitions/PartInstance" },
    after: { $ref: "#/definitions/PartInstance" },
  },
};

function validate90(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.before === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "before" },
        message: "must have required property '" + "before" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.after === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "after" },
        message: "must have required property '" + "after" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "before" ||
        key0 === "after"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("updatePart" !== data.kind) {
        const err5 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "updatePart" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.before !== undefined) {
      if (
        !validate26(data.before, {
          instancePath: instancePath + "/before",
          parentData: data,
          parentDataProperty: "before",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate26.errors
            : vErrors.concat(validate26.errors);
        errors = vErrors.length;
      }
    }
    if (data.after !== undefined) {
      if (
        !validate26(data.after, {
          instancePath: instancePath + "/after",
          parentData: data,
          parentDataProperty: "after",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate26.errors
            : vErrors.concat(validate26.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err10 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate90.errors = vErrors;
  return errors === 0;
}

const schema121 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "connection"],
  properties: {
    kind: { const: "addConnection" },
    operationId: { $ref: "#/definitions/Identifier" },
    connection: { $ref: "#/definitions/ConnectionEdge" },
  },
};

function validate94(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.connection === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "connection" },
        message: "must have required property '" + "connection" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "connection"
      )) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("addConnection" !== data.kind) {
        const err4 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "addConnection" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err5 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.connection !== undefined) {
      if (
        !validate31(data.connection, {
          instancePath: instancePath + "/connection",
          parentData: data,
          parentDataProperty: "connection",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate31.errors
            : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate94.errors = vErrors;
  return errors === 0;
}

const schema123 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "operationId", "connection"],
  properties: {
    kind: { const: "removeConnection" },
    operationId: { $ref: "#/definitions/Identifier" },
    connection: { $ref: "#/definitions/ConnectionEdge" },
  },
};

function validate97(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operationId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operationId" },
        message: "must have required property '" + "operationId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.connection === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "connection" },
        message: "must have required property '" + "connection" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "kind" ||
        key0 === "operationId" ||
        key0 === "connection"
      )) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if ("removeConnection" !== data.kind) {
        const err4 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "removeConnection" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.operationId !== undefined) {
      let data1 = data.operationId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err5 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err6 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err7 = {
            instancePath: instancePath + "/operationId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/operationId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.connection !== undefined) {
      if (
        !validate31(data.connection, {
          instancePath: instancePath + "/connection",
          parentData: data,
          parentDataProperty: "connection",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate31.errors
            : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate97.errors = vErrors;
  return errors === 0;
}

function validate135(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (
    !validate84(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null ? validate84.errors : vErrors.concat(validate84.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs2 = errors;
  if (
    !validate87(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null ? validate87.errors : vErrors.concat(validate87.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs3 = errors;
    if (
      !validate90(data, {
        instancePath,
        parentData,
        parentDataProperty,
        rootData,
      })
    ) {
      vErrors =
        vErrors === null
          ? validate90.errors
          : vErrors.concat(validate90.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs3 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
      const _errs4 = errors;
      if (
        !validate94(data, {
          instancePath,
          parentData,
          parentDataProperty,
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate94.errors
            : vErrors.concat(validate94.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
        }
        const _errs5 = errors;
        if (
          !validate97(data, {
            instancePath,
            parentData,
            parentDataProperty,
            rootData,
          })
        ) {
          vErrors =
            vErrors === null
              ? validate97.errors
              : vErrors.concat(validate97.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs5 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate135.errors = vErrors;
  return errors === 0;
}

function validate134(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/BuildOperation" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate135(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate135.errors
        : vErrors.concat(validate135.errors);
    errors = vErrors.length;
  }
  validate134.errors = vErrors;
  return errors === 0;
}

export const validateScopeCapabilityV1 = validate142;
const schema153 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/ScopeCapabilityV1",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/ScopeCapabilityV1",
};
const schema96 = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "capabilityId",
    "baseRevision",
    "baseDocumentHash",
    "frozenPartIds",
    "mutablePartIds",
    "requiredAttachmentPorts",
    "allowedVolume",
    "allowedCatalogPartIds",
    "allowedColorIds",
    "budgets",
  ],
  properties: {
    schemaVersion: { const: "lego.scope-capability/1" },
    capabilityId: { $ref: "#/definitions/Identifier" },
    baseRevision: { $ref: "#/definitions/Identifier" },
    baseDocumentHash: { $ref: "#/definitions/Hash" },
    frozenPartIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 10000,
      uniqueItems: true,
    },
    mutablePartIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 10000,
      uniqueItems: true,
    },
    requiredAttachmentPorts: {
      type: "array",
      items: { $ref: "#/definitions/PartPortRef" },
      maxItems: 256,
      uniqueItems: true,
    },
    allowedVolume: { $ref: "#/definitions/AllowedVolume" },
    allowedCatalogPartIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      minItems: 1,
      maxItems: 10000,
      uniqueItems: true,
    },
    allowedColorIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      minItems: 1,
      maxItems: 256,
      uniqueItems: true,
    },
    budgets: { $ref: "#/definitions/ScopeBudgets" },
  },
};
const schema105 = {
  type: "object",
  additionalProperties: false,
  required: ["maxAddedParts", "maxRemovedParts", "maxOperations"],
  properties: {
    maxAddedParts: { type: "integer", minimum: 0, maximum: 10000 },
    maxRemovedParts: { type: "integer", minimum: 0, maximum: 10000 },
    maxOperations: { type: "integer", minimum: 1, maximum: 10000 },
  },
};
const schema102 = {
  type: "object",
  additionalProperties: false,
  required: ["minLdu", "maxLdu"],
  properties: {
    minLdu: { $ref: "#/definitions/LduVector" },
    maxLdu: { $ref: "#/definitions/LduVector" },
  },
};

function validate77(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.minLdu === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "minLdu" },
        message: "must have required property '" + "minLdu" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.maxLdu === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "maxLdu" },
        message: "must have required property '" + "maxLdu" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "minLdu" || key0 === "maxLdu")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.minLdu !== undefined) {
      if (
        !validate21(data.minLdu, {
          instancePath: instancePath + "/minLdu",
          parentData: data,
          parentDataProperty: "minLdu",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate21.errors
            : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
    if (data.maxLdu !== undefined) {
      if (
        !validate21(data.maxLdu, {
          instancePath: instancePath + "/maxLdu",
          parentData: data,
          parentDataProperty: "maxLdu",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate21.errors
            : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err3 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate77.errors = vErrors;
  return errors === 0;
}

function validate143(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property '" + "schemaVersion" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.capabilityId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "capabilityId" },
        message: "must have required property '" + "capabilityId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.baseRevision === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "baseRevision" },
        message: "must have required property '" + "baseRevision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.baseDocumentHash === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "baseDocumentHash" },
        message: "must have required property '" + "baseDocumentHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.frozenPartIds === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "frozenPartIds" },
        message: "must have required property '" + "frozenPartIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.mutablePartIds === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "mutablePartIds" },
        message: "must have required property '" + "mutablePartIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.requiredAttachmentPorts === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "requiredAttachmentPorts" },
        message:
          "must have required property '" + "requiredAttachmentPorts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.allowedVolume === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowedVolume" },
        message: "must have required property '" + "allowedVolume" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.allowedCatalogPartIds === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowedCatalogPartIds" },
        message:
          "must have required property '" + "allowedCatalogPartIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.allowedColorIds === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowedColorIds" },
        message: "must have required property '" + "allowedColorIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.budgets === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "budgets" },
        message: "must have required property '" + "budgets" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func8.call(schema96.properties, key0)) {
        const err11 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== undefined) {
      if ("lego.scope-capability/1" !== data.schemaVersion) {
        const err12 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "lego.scope-capability/1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.capabilityId !== undefined) {
      let data1 = data.capabilityId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err13 = {
            instancePath: instancePath + "/capabilityId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err14 = {
            instancePath: instancePath + "/capabilityId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err15 = {
            instancePath: instancePath + "/capabilityId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/capabilityId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.baseRevision !== undefined) {
      let data2 = data.baseRevision;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err17 = {
            instancePath: instancePath + "/baseRevision",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err18 = {
            instancePath: instancePath + "/baseRevision",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err19 = {
            instancePath: instancePath + "/baseRevision",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/baseRevision",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.baseDocumentHash !== undefined) {
      let data3 = data.baseDocumentHash;
      if (typeof data3 === "string") {
        if (!pattern2.test(data3)) {
          const err21 = {
            instancePath: instancePath + "/baseDocumentHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = {
          instancePath: instancePath + "/baseDocumentHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.frozenPartIds !== undefined) {
      let data4 = data.frozenPartIds;
      if (Array.isArray(data4)) {
        if (data4.length > 10000) {
          const err23 = {
            instancePath: instancePath + "/frozenPartIds",
            schemaPath: "#/properties/frozenPartIds/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data5 = data4[i0];
          if (typeof data5 === "string") {
            if (func2(data5) > 128) {
              const err24 = {
                instancePath: instancePath + "/frozenPartIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
            if (func2(data5) < 1) {
              const err25 = {
                instancePath: instancePath + "/frozenPartIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
            if (!pattern0.test(data5)) {
              const err26 = {
                instancePath: instancePath + "/frozenPartIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
          } else {
            const err27 = {
              instancePath: instancePath + "/frozenPartIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
        }
        let i1 = data4.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data4[i1], data4[j0])) {
                const err28 = {
                  instancePath: instancePath + "/frozenPartIds",
                  schemaPath: "#/properties/frozenPartIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err28];
                } else {
                  vErrors.push(err28);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err29 = {
          instancePath: instancePath + "/frozenPartIds",
          schemaPath: "#/properties/frozenPartIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.mutablePartIds !== undefined) {
      let data6 = data.mutablePartIds;
      if (Array.isArray(data6)) {
        if (data6.length > 10000) {
          const err30 = {
            instancePath: instancePath + "/mutablePartIds",
            schemaPath: "#/properties/mutablePartIds/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        const len1 = data6.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data7 = data6[i2];
          if (typeof data7 === "string") {
            if (func2(data7) > 128) {
              const err31 = {
                instancePath: instancePath + "/mutablePartIds/" + i2,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
            if (func2(data7) < 1) {
              const err32 = {
                instancePath: instancePath + "/mutablePartIds/" + i2,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
            if (!pattern0.test(data7)) {
              const err33 = {
                instancePath: instancePath + "/mutablePartIds/" + i2,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err33];
              } else {
                vErrors.push(err33);
              }
              errors++;
            }
          } else {
            const err34 = {
              instancePath: instancePath + "/mutablePartIds/" + i2,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
        }
        let i3 = data6.length;
        let j1;
        if (i3 > 1) {
          outer1: for (; i3--;) {
            for (j1 = i3; j1--;) {
              if (func0(data6[i3], data6[j1])) {
                const err35 = {
                  instancePath: instancePath + "/mutablePartIds",
                  schemaPath: "#/properties/mutablePartIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i3, j: j1 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j1 +
                    " and " +
                    i3 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err35];
                } else {
                  vErrors.push(err35);
                }
                errors++;
                break outer1;
              }
            }
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/mutablePartIds",
          schemaPath: "#/properties/mutablePartIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.requiredAttachmentPorts !== undefined) {
      let data8 = data.requiredAttachmentPorts;
      if (Array.isArray(data8)) {
        if (data8.length > 256) {
          const err37 = {
            instancePath: instancePath + "/requiredAttachmentPorts",
            schemaPath: "#/properties/requiredAttachmentPorts/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        const len2 = data8.length;
        for (let i4 = 0; i4 < len2; i4++) {
          if (
            !validate32(data8[i4], {
              instancePath: instancePath + "/requiredAttachmentPorts/" + i4,
              parentData: data8,
              parentDataProperty: i4,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate32.errors
                : vErrors.concat(validate32.errors);
            errors = vErrors.length;
          }
        }
        let i5 = data8.length;
        let j2;
        if (i5 > 1) {
          outer2: for (; i5--;) {
            for (j2 = i5; j2--;) {
              if (func0(data8[i5], data8[j2])) {
                const err38 = {
                  instancePath: instancePath + "/requiredAttachmentPorts",
                  schemaPath:
                    "#/properties/requiredAttachmentPorts/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i5, j: j2 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j2 +
                    " and " +
                    i5 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err38];
                } else {
                  vErrors.push(err38);
                }
                errors++;
                break outer2;
              }
            }
          }
        }
      } else {
        const err39 = {
          instancePath: instancePath + "/requiredAttachmentPorts",
          schemaPath: "#/properties/requiredAttachmentPorts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.allowedVolume !== undefined) {
      if (
        !validate77(data.allowedVolume, {
          instancePath: instancePath + "/allowedVolume",
          parentData: data,
          parentDataProperty: "allowedVolume",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate77.errors
            : vErrors.concat(validate77.errors);
        errors = vErrors.length;
      }
    }
    if (data.allowedCatalogPartIds !== undefined) {
      let data11 = data.allowedCatalogPartIds;
      if (Array.isArray(data11)) {
        if (data11.length > 10000) {
          const err40 = {
            instancePath: instancePath + "/allowedCatalogPartIds",
            schemaPath: "#/properties/allowedCatalogPartIds/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
        if (data11.length < 1) {
          const err41 = {
            instancePath: instancePath + "/allowedCatalogPartIds",
            schemaPath: "#/properties/allowedCatalogPartIds/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        const len3 = data11.length;
        for (let i6 = 0; i6 < len3; i6++) {
          let data12 = data11[i6];
          if (typeof data12 === "string") {
            if (func2(data12) > 128) {
              const err42 = {
                instancePath: instancePath + "/allowedCatalogPartIds/" + i6,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
            if (func2(data12) < 1) {
              const err43 = {
                instancePath: instancePath + "/allowedCatalogPartIds/" + i6,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err43];
              } else {
                vErrors.push(err43);
              }
              errors++;
            }
            if (!pattern0.test(data12)) {
              const err44 = {
                instancePath: instancePath + "/allowedCatalogPartIds/" + i6,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err44];
              } else {
                vErrors.push(err44);
              }
              errors++;
            }
          } else {
            const err45 = {
              instancePath: instancePath + "/allowedCatalogPartIds/" + i6,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
        }
        let i7 = data11.length;
        let j3;
        if (i7 > 1) {
          outer3: for (; i7--;) {
            for (j3 = i7; j3--;) {
              if (func0(data11[i7], data11[j3])) {
                const err46 = {
                  instancePath: instancePath + "/allowedCatalogPartIds",
                  schemaPath: "#/properties/allowedCatalogPartIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i7, j: j3 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j3 +
                    " and " +
                    i7 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err46];
                } else {
                  vErrors.push(err46);
                }
                errors++;
                break outer3;
              }
            }
          }
        }
      } else {
        const err47 = {
          instancePath: instancePath + "/allowedCatalogPartIds",
          schemaPath: "#/properties/allowedCatalogPartIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
    if (data.allowedColorIds !== undefined) {
      let data13 = data.allowedColorIds;
      if (Array.isArray(data13)) {
        if (data13.length > 256) {
          const err48 = {
            instancePath: instancePath + "/allowedColorIds",
            schemaPath: "#/properties/allowedColorIds/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data13.length < 1) {
          const err49 = {
            instancePath: instancePath + "/allowedColorIds",
            schemaPath: "#/properties/allowedColorIds/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        const len4 = data13.length;
        for (let i8 = 0; i8 < len4; i8++) {
          let data14 = data13[i8];
          if (typeof data14 === "string") {
            if (func2(data14) > 128) {
              const err50 = {
                instancePath: instancePath + "/allowedColorIds/" + i8,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err50];
              } else {
                vErrors.push(err50);
              }
              errors++;
            }
            if (func2(data14) < 1) {
              const err51 = {
                instancePath: instancePath + "/allowedColorIds/" + i8,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (!pattern0.test(data14)) {
              const err52 = {
                instancePath: instancePath + "/allowedColorIds/" + i8,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err52];
              } else {
                vErrors.push(err52);
              }
              errors++;
            }
          } else {
            const err53 = {
              instancePath: instancePath + "/allowedColorIds/" + i8,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err53];
            } else {
              vErrors.push(err53);
            }
            errors++;
          }
        }
        let i9 = data13.length;
        let j4;
        if (i9 > 1) {
          outer4: for (; i9--;) {
            for (j4 = i9; j4--;) {
              if (func0(data13[i9], data13[j4])) {
                const err54 = {
                  instancePath: instancePath + "/allowedColorIds",
                  schemaPath: "#/properties/allowedColorIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i9, j: j4 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j4 +
                    " and " +
                    i9 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err54];
                } else {
                  vErrors.push(err54);
                }
                errors++;
                break outer4;
              }
            }
          }
        }
      } else {
        const err55 = {
          instancePath: instancePath + "/allowedColorIds",
          schemaPath: "#/properties/allowedColorIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err55];
        } else {
          vErrors.push(err55);
        }
        errors++;
      }
    }
    if (data.budgets !== undefined) {
      let data15 = data.budgets;
      if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
        if (data15.maxAddedParts === undefined) {
          const err56 = {
            instancePath: instancePath + "/budgets",
            schemaPath: "#/definitions/ScopeBudgets/required",
            keyword: "required",
            params: { missingProperty: "maxAddedParts" },
            message: "must have required property '" + "maxAddedParts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        if (data15.maxRemovedParts === undefined) {
          const err57 = {
            instancePath: instancePath + "/budgets",
            schemaPath: "#/definitions/ScopeBudgets/required",
            keyword: "required",
            params: { missingProperty: "maxRemovedParts" },
            message: "must have required property '" + "maxRemovedParts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
        if (data15.maxOperations === undefined) {
          const err58 = {
            instancePath: instancePath + "/budgets",
            schemaPath: "#/definitions/ScopeBudgets/required",
            keyword: "required",
            params: { missingProperty: "maxOperations" },
            message: "must have required property '" + "maxOperations" + "'",
          };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
        for (const key1 in data15) {
          if (!(
            key1 === "maxAddedParts" ||
            key1 === "maxRemovedParts" ||
            key1 === "maxOperations"
          )) {
            const err59 = {
              instancePath: instancePath + "/budgets",
              schemaPath: "#/definitions/ScopeBudgets/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
        if (data15.maxAddedParts !== undefined) {
          let data16 = data15.maxAddedParts;
          if (!(
            typeof data16 == "number" &&
            !(data16 % 1) &&
            !isNaN(data16) &&
            isFinite(data16)
          )) {
            const err60 = {
              instancePath: instancePath + "/budgets/maxAddedParts",
              schemaPath:
                "#/definitions/ScopeBudgets/properties/maxAddedParts/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err60];
            } else {
              vErrors.push(err60);
            }
            errors++;
          }
          if (typeof data16 == "number" && isFinite(data16)) {
            if (data16 > 10000 || isNaN(data16)) {
              const err61 = {
                instancePath: instancePath + "/budgets/maxAddedParts",
                schemaPath:
                  "#/definitions/ScopeBudgets/properties/maxAddedParts/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 10000 },
                message: "must be <= 10000",
              };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
            if (data16 < 0 || isNaN(data16)) {
              const err62 = {
                instancePath: instancePath + "/budgets/maxAddedParts",
                schemaPath:
                  "#/definitions/ScopeBudgets/properties/maxAddedParts/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
          }
        }
        if (data15.maxRemovedParts !== undefined) {
          let data17 = data15.maxRemovedParts;
          if (!(
            typeof data17 == "number" &&
            !(data17 % 1) &&
            !isNaN(data17) &&
            isFinite(data17)
          )) {
            const err63 = {
              instancePath: instancePath + "/budgets/maxRemovedParts",
              schemaPath:
                "#/definitions/ScopeBudgets/properties/maxRemovedParts/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err63];
            } else {
              vErrors.push(err63);
            }
            errors++;
          }
          if (typeof data17 == "number" && isFinite(data17)) {
            if (data17 > 10000 || isNaN(data17)) {
              const err64 = {
                instancePath: instancePath + "/budgets/maxRemovedParts",
                schemaPath:
                  "#/definitions/ScopeBudgets/properties/maxRemovedParts/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 10000 },
                message: "must be <= 10000",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
            if (data17 < 0 || isNaN(data17)) {
              const err65 = {
                instancePath: instancePath + "/budgets/maxRemovedParts",
                schemaPath:
                  "#/definitions/ScopeBudgets/properties/maxRemovedParts/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err65];
              } else {
                vErrors.push(err65);
              }
              errors++;
            }
          }
        }
        if (data15.maxOperations !== undefined) {
          let data18 = data15.maxOperations;
          if (!(
            typeof data18 == "number" &&
            !(data18 % 1) &&
            !isNaN(data18) &&
            isFinite(data18)
          )) {
            const err66 = {
              instancePath: instancePath + "/budgets/maxOperations",
              schemaPath:
                "#/definitions/ScopeBudgets/properties/maxOperations/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err66];
            } else {
              vErrors.push(err66);
            }
            errors++;
          }
          if (typeof data18 == "number" && isFinite(data18)) {
            if (data18 > 10000 || isNaN(data18)) {
              const err67 = {
                instancePath: instancePath + "/budgets/maxOperations",
                schemaPath:
                  "#/definitions/ScopeBudgets/properties/maxOperations/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 10000 },
                message: "must be <= 10000",
              };
              if (vErrors === null) {
                vErrors = [err67];
              } else {
                vErrors.push(err67);
              }
              errors++;
            }
            if (data18 < 1 || isNaN(data18)) {
              const err68 = {
                instancePath: instancePath + "/budgets/maxOperations",
                schemaPath:
                  "#/definitions/ScopeBudgets/properties/maxOperations/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err68];
              } else {
                vErrors.push(err68);
              }
              errors++;
            }
          }
        }
      } else {
        const err69 = {
          instancePath: instancePath + "/budgets",
          schemaPath: "#/definitions/ScopeBudgets/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err69];
        } else {
          vErrors.push(err69);
        }
        errors++;
      }
    }
  } else {
    const err70 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err70];
    } else {
      vErrors.push(err70);
    }
    errors++;
  }
  validate143.errors = vErrors;
  return errors === 0;
}

function validate142(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/ScopeCapabilityV1" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate143(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate143.errors
        : vErrors.concat(validate143.errors);
    errors = vErrors.length;
  }
  validate142.errors = vErrors;
  return errors === 0;
}

export const validateAssemblyPatchV1 = validate147;
const schema163 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/AssemblyPatchV1",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/AssemblyPatchV1",
};
const schema106 = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "baseRevision",
    "baseDocumentHash",
    "truthSnapshotHash",
    "scopeCapabilityId",
    "scopeDigest",
    "operations",
    "provenance",
  ],
  properties: {
    schemaVersion: { const: "lego.assembly-patch/1" },
    baseRevision: { $ref: "#/definitions/Identifier" },
    baseDocumentHash: { $ref: "#/definitions/Hash" },
    truthSnapshotHash: { $ref: "#/definitions/Hash" },
    scopeCapabilityId: { $ref: "#/definitions/Identifier" },
    scopeDigest: { $ref: "#/definitions/Hash" },
    operations: {
      type: "array",
      items: { $ref: "#/definitions/BuildOperation" },
      minItems: 1,
      maxItems: 10000,
    },
    provenance: { $ref: "#/definitions/GenerationProvenance" },
  },
};

function validate83(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (
    !validate84(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null ? validate84.errors : vErrors.concat(validate84.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs2 = errors;
  if (
    !validate87(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null ? validate87.errors : vErrors.concat(validate87.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs3 = errors;
    if (
      !validate90(data, {
        instancePath,
        parentData,
        parentDataProperty,
        rootData,
      })
    ) {
      vErrors =
        vErrors === null
          ? validate90.errors
          : vErrors.concat(validate90.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs3 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
      const _errs4 = errors;
      if (
        !validate94(data, {
          instancePath,
          parentData,
          parentDataProperty,
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate94.errors
            : vErrors.concat(validate94.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
        }
        const _errs5 = errors;
        if (
          !validate97(data, {
            instancePath,
            parentData,
            parentDataProperty,
            rootData,
          })
        ) {
          vErrors =
            vErrors === null
              ? validate97.errors
              : vErrors.concat(validate97.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs5 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate83.errors = vErrors;
  return errors === 0;
}

const schema125 = {
  type: "object",
  additionalProperties: false,
  required: [
    "jobId",
    "candidateId",
    "compilerSnapshotHash",
    "buildProgramHash",
  ],
  properties: {
    jobId: { $ref: "#/definitions/Identifier" },
    candidateId: { $ref: "#/definitions/Identifier" },
    compilerSnapshotHash: { $ref: "#/definitions/Hash" },
    buildProgramHash: { $ref: "#/definitions/Hash" },
  },
};

function validate101(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.jobId === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "jobId" },
        message: "must have required property '" + "jobId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.candidateId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "candidateId" },
        message: "must have required property '" + "candidateId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.compilerSnapshotHash === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "compilerSnapshotHash" },
        message: "must have required property '" + "compilerSnapshotHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.buildProgramHash === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "buildProgramHash" },
        message: "must have required property '" + "buildProgramHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "jobId" ||
        key0 === "candidateId" ||
        key0 === "compilerSnapshotHash" ||
        key0 === "buildProgramHash"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.jobId !== undefined) {
      let data0 = data.jobId;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err5 = {
            instancePath: instancePath + "/jobId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err6 = {
            instancePath: instancePath + "/jobId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err7 = {
            instancePath: instancePath + "/jobId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/jobId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.candidateId !== undefined) {
      let data1 = data.candidateId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err9 = {
            instancePath: instancePath + "/candidateId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err10 = {
            instancePath: instancePath + "/candidateId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err11 = {
            instancePath: instancePath + "/candidateId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/candidateId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.compilerSnapshotHash !== undefined) {
      let data2 = data.compilerSnapshotHash;
      if (typeof data2 === "string") {
        if (!pattern2.test(data2)) {
          const err13 = {
            instancePath: instancePath + "/compilerSnapshotHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/compilerSnapshotHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.buildProgramHash !== undefined) {
      let data3 = data.buildProgramHash;
      if (typeof data3 === "string") {
        if (!pattern2.test(data3)) {
          const err15 = {
            instancePath: instancePath + "/buildProgramHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/buildProgramHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  validate101.errors = vErrors;
  return errors === 0;
}

function validate148(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property '" + "schemaVersion" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.baseRevision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "baseRevision" },
        message: "must have required property '" + "baseRevision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.baseDocumentHash === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "baseDocumentHash" },
        message: "must have required property '" + "baseDocumentHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.truthSnapshotHash === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "truthSnapshotHash" },
        message: "must have required property '" + "truthSnapshotHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.scopeCapabilityId === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scopeCapabilityId" },
        message: "must have required property '" + "scopeCapabilityId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.scopeDigest === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scopeDigest" },
        message: "must have required property '" + "scopeDigest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.operations === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operations" },
        message: "must have required property '" + "operations" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.provenance === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "schemaVersion" ||
        key0 === "baseRevision" ||
        key0 === "baseDocumentHash" ||
        key0 === "truthSnapshotHash" ||
        key0 === "scopeCapabilityId" ||
        key0 === "scopeDigest" ||
        key0 === "operations" ||
        key0 === "provenance"
      )) {
        const err8 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== undefined) {
      if ("lego.assembly-patch/1" !== data.schemaVersion) {
        const err9 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "lego.assembly-patch/1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.baseRevision !== undefined) {
      let data1 = data.baseRevision;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err10 = {
            instancePath: instancePath + "/baseRevision",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err11 = {
            instancePath: instancePath + "/baseRevision",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err12 = {
            instancePath: instancePath + "/baseRevision",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/baseRevision",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.baseDocumentHash !== undefined) {
      let data2 = data.baseDocumentHash;
      if (typeof data2 === "string") {
        if (!pattern2.test(data2)) {
          const err14 = {
            instancePath: instancePath + "/baseDocumentHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = {
          instancePath: instancePath + "/baseDocumentHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.truthSnapshotHash !== undefined) {
      let data3 = data.truthSnapshotHash;
      if (typeof data3 === "string") {
        if (!pattern2.test(data3)) {
          const err16 = {
            instancePath: instancePath + "/truthSnapshotHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/truthSnapshotHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.scopeCapabilityId !== undefined) {
      let data4 = data.scopeCapabilityId;
      if (typeof data4 === "string") {
        if (func2(data4) > 128) {
          const err18 = {
            instancePath: instancePath + "/scopeCapabilityId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err19 = {
            instancePath: instancePath + "/scopeCapabilityId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!pattern0.test(data4)) {
          const err20 = {
            instancePath: instancePath + "/scopeCapabilityId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/scopeCapabilityId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.scopeDigest !== undefined) {
      let data5 = data.scopeDigest;
      if (typeof data5 === "string") {
        if (!pattern2.test(data5)) {
          const err22 = {
            instancePath: instancePath + "/scopeDigest",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/scopeDigest",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.operations !== undefined) {
      let data6 = data.operations;
      if (Array.isArray(data6)) {
        if (data6.length > 10000) {
          const err24 = {
            instancePath: instancePath + "/operations",
            schemaPath: "#/properties/operations/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data6.length < 1) {
          const err25 = {
            instancePath: instancePath + "/operations",
            schemaPath: "#/properties/operations/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        const len0 = data6.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate83(data6[i0], {
              instancePath: instancePath + "/operations/" + i0,
              parentData: data6,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate83.errors
                : vErrors.concat(validate83.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err26 = {
          instancePath: instancePath + "/operations",
          schemaPath: "#/properties/operations/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.provenance !== undefined) {
      if (
        !validate101(data.provenance, {
          instancePath: instancePath + "/provenance",
          parentData: data,
          parentDataProperty: "provenance",
          rootData,
        })
      ) {
        vErrors =
          vErrors === null
            ? validate101.errors
            : vErrors.concat(validate101.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err27 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err27];
    } else {
      vErrors.push(err27);
    }
    errors++;
  }
  validate148.errors = vErrors;
  return errors === 0;
}

function validate147(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/AssemblyPatchV1" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate148(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate148.errors
        : vErrors.concat(validate148.errors);
    errors = vErrors.length;
  }
  validate147.errors = vErrors;
  return errors === 0;
}

export const validateValidationReportV1 = validate152;
const schema170 = {
  $id: "https://schemas.brick-studio.local/protocol/1/validators/ValidationReportV1",
  $ref: "https://schemas.brick-studio.local/protocol/1#/definitions/ValidationReportV1",
};
const schema130 = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "targetDocumentHash",
    "truthSnapshotHash",
    "validatorSetHash",
    "patchValid",
    "documentGloballyValid",
    "issues",
  ],
  properties: {
    schemaVersion: { const: "lego.validation-report/1" },
    targetDocumentHash: { $ref: "#/definitions/Hash" },
    truthSnapshotHash: { $ref: "#/definitions/Hash" },
    validatorSetHash: { $ref: "#/definitions/Hash" },
    patchValid: { type: "boolean" },
    documentGloballyValid: { type: "boolean" },
    issues: {
      type: "array",
      items: { $ref: "#/definitions/ValidationIssue" },
      maxItems: 10000,
    },
  },
};
const schema134 = {
  type: "object",
  additionalProperties: false,
  required: [
    "issueId",
    "validatorId",
    "code",
    "severity",
    "message",
    "path",
    "partIds",
    "connectionIds",
    "scope",
  ],
  properties: {
    issueId: { $ref: "#/definitions/Identifier" },
    validatorId: { $ref: "#/definitions/Identifier" },
    code: {
      type: "string",
      minLength: 2,
      maxLength: 64,
      pattern: "^[A-Z][A-Z0-9_]*$",
    },
    severity: { enum: ["blocking", "advisory"] },
    message: { $ref: "#/definitions/ShortText" },
    path: { type: "string", maxLength: 512, pattern: "^(/([^~/]|~0|~1)*)*$" },
    partIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 256,
      uniqueItems: true,
    },
    connectionIds: {
      type: "array",
      items: { $ref: "#/definitions/Identifier" },
      maxItems: 256,
      uniqueItems: true,
    },
    scope: { enum: ["patch", "document"] },
  },
};
const pattern81 = new RegExp("^[A-Z][A-Z0-9_]*$", "u");
const pattern82 = new RegExp("^(/([^~/]|~0|~1)*)*$", "u");

function validate105(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.issueId === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "issueId" },
        message: "must have required property '" + "issueId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.validatorId === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "validatorId" },
        message: "must have required property '" + "validatorId" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.code === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "code" },
        message: "must have required property '" + "code" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.severity === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "severity" },
        message: "must have required property '" + "severity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.message === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "message" },
        message: "must have required property '" + "message" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.path === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "path" },
        message: "must have required property '" + "path" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.partIds === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partIds" },
        message: "must have required property '" + "partIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.connectionIds === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "connectionIds" },
        message: "must have required property '" + "connectionIds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.scope === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scope" },
        message: "must have required property '" + "scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func8.call(schema134.properties, key0)) {
        const err9 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.issueId !== undefined) {
      let data0 = data.issueId;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err10 = {
            instancePath: instancePath + "/issueId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err11 = {
            instancePath: instancePath + "/issueId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err12 = {
            instancePath: instancePath + "/issueId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/issueId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.validatorId !== undefined) {
      let data1 = data.validatorId;
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err14 = {
            instancePath: instancePath + "/validatorId",
            schemaPath: "#/definitions/Identifier/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err15 = {
            instancePath: instancePath + "/validatorId",
            schemaPath: "#/definitions/Identifier/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err16 = {
            instancePath: instancePath + "/validatorId",
            schemaPath: "#/definitions/Identifier/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
            message:
              'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/validatorId",
          schemaPath: "#/definitions/Identifier/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.code !== undefined) {
      let data2 = data.code;
      if (typeof data2 === "string") {
        if (func2(data2) > 64) {
          const err18 = {
            instancePath: instancePath + "/code",
            schemaPath: "#/properties/code/maxLength",
            keyword: "maxLength",
            params: { limit: 64 },
            message: "must NOT have more than 64 characters",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (func2(data2) < 2) {
          const err19 = {
            instancePath: instancePath + "/code",
            schemaPath: "#/properties/code/minLength",
            keyword: "minLength",
            params: { limit: 2 },
            message: "must NOT have fewer than 2 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!pattern81.test(data2)) {
          const err20 = {
            instancePath: instancePath + "/code",
            schemaPath: "#/properties/code/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Z][A-Z0-9_]*$" },
            message: 'must match pattern "' + "^[A-Z][A-Z0-9_]*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/code",
          schemaPath: "#/properties/code/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.severity !== undefined) {
      let data3 = data.severity;
      if (!(data3 === "blocking" || data3 === "advisory")) {
        const err22 = {
          instancePath: instancePath + "/severity",
          schemaPath: "#/properties/severity/enum",
          keyword: "enum",
          params: { allowedValues: schema134.properties.severity.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.message !== undefined) {
      let data4 = data.message;
      if (typeof data4 === "string") {
        if (func2(data4) > 256) {
          const err23 = {
            instancePath: instancePath + "/message",
            schemaPath: "#/definitions/ShortText/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/message",
          schemaPath: "#/definitions/ShortText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.path !== undefined) {
      let data5 = data.path;
      if (typeof data5 === "string") {
        if (func2(data5) > 512) {
          const err25 = {
            instancePath: instancePath + "/path",
            schemaPath: "#/properties/path/maxLength",
            keyword: "maxLength",
            params: { limit: 512 },
            message: "must NOT have more than 512 characters",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (!pattern82.test(data5)) {
          const err26 = {
            instancePath: instancePath + "/path",
            schemaPath: "#/properties/path/pattern",
            keyword: "pattern",
            params: { pattern: "^(/([^~/]|~0|~1)*)*$" },
            message: 'must match pattern "' + "^(/([^~/]|~0|~1)*)*$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/path",
          schemaPath: "#/properties/path/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.partIds !== undefined) {
      let data6 = data.partIds;
      if (Array.isArray(data6)) {
        if (data6.length > 256) {
          const err28 = {
            instancePath: instancePath + "/partIds",
            schemaPath: "#/properties/partIds/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        const len0 = data6.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data7 = data6[i0];
          if (typeof data7 === "string") {
            if (func2(data7) > 128) {
              const err29 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err29];
              } else {
                vErrors.push(err29);
              }
              errors++;
            }
            if (func2(data7) < 1) {
              const err30 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err30];
              } else {
                vErrors.push(err30);
              }
              errors++;
            }
            if (!pattern0.test(data7)) {
              const err31 = {
                instancePath: instancePath + "/partIds/" + i0,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
          } else {
            const err32 = {
              instancePath: instancePath + "/partIds/" + i0,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        let i1 = data6.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data6[i1], data6[j0])) {
                const err33 = {
                  instancePath: instancePath + "/partIds",
                  schemaPath: "#/properties/partIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err33];
                } else {
                  vErrors.push(err33);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err34 = {
          instancePath: instancePath + "/partIds",
          schemaPath: "#/properties/partIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
    }
    if (data.connectionIds !== undefined) {
      let data8 = data.connectionIds;
      if (Array.isArray(data8)) {
        if (data8.length > 256) {
          const err35 = {
            instancePath: instancePath + "/connectionIds",
            schemaPath: "#/properties/connectionIds/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
        const len1 = data8.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data9 = data8[i2];
          if (typeof data9 === "string") {
            if (func2(data9) > 128) {
              const err36 = {
                instancePath: instancePath + "/connectionIds/" + i2,
                schemaPath: "#/definitions/Identifier/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
            if (func2(data9) < 1) {
              const err37 = {
                instancePath: instancePath + "/connectionIds/" + i2,
                schemaPath: "#/definitions/Identifier/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            if (!pattern0.test(data9)) {
              const err38 = {
                instancePath: instancePath + "/connectionIds/" + i2,
                schemaPath: "#/definitions/Identifier/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" },
                message:
                  'must match pattern "' +
                  "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" +
                  '"',
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
          } else {
            const err39 = {
              instancePath: instancePath + "/connectionIds/" + i2,
              schemaPath: "#/definitions/Identifier/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
        }
        let i3 = data8.length;
        let j1;
        if (i3 > 1) {
          outer1: for (; i3--;) {
            for (j1 = i3; j1--;) {
              if (func0(data8[i3], data8[j1])) {
                const err40 = {
                  instancePath: instancePath + "/connectionIds",
                  schemaPath: "#/properties/connectionIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i3, j: j1 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j1 +
                    " and " +
                    i3 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err40];
                } else {
                  vErrors.push(err40);
                }
                errors++;
                break outer1;
              }
            }
          }
        }
      } else {
        const err41 = {
          instancePath: instancePath + "/connectionIds",
          schemaPath: "#/properties/connectionIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.scope !== undefined) {
      let data10 = data.scope;
      if (!(data10 === "patch" || data10 === "document")) {
        const err42 = {
          instancePath: instancePath + "/scope",
          schemaPath: "#/properties/scope/enum",
          keyword: "enum",
          params: { allowedValues: schema134.properties.scope.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
  } else {
    const err43 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err43];
    } else {
      vErrors.push(err43);
    }
    errors++;
  }
  validate105.errors = vErrors;
  return errors === 0;
}

function validate153(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property '" + "schemaVersion" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.targetDocumentHash === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "targetDocumentHash" },
        message: "must have required property '" + "targetDocumentHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.truthSnapshotHash === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "truthSnapshotHash" },
        message: "must have required property '" + "truthSnapshotHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.validatorSetHash === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "validatorSetHash" },
        message: "must have required property '" + "validatorSetHash" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.patchValid === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "patchValid" },
        message: "must have required property '" + "patchValid" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.documentGloballyValid === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "documentGloballyValid" },
        message:
          "must have required property '" + "documentGloballyValid" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.issues === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "issues" },
        message: "must have required property '" + "issues" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "schemaVersion" ||
        key0 === "targetDocumentHash" ||
        key0 === "truthSnapshotHash" ||
        key0 === "validatorSetHash" ||
        key0 === "patchValid" ||
        key0 === "documentGloballyValid" ||
        key0 === "issues"
      )) {
        const err7 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== undefined) {
      if ("lego.validation-report/1" !== data.schemaVersion) {
        const err8 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "lego.validation-report/1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.targetDocumentHash !== undefined) {
      let data1 = data.targetDocumentHash;
      if (typeof data1 === "string") {
        if (!pattern2.test(data1)) {
          const err9 = {
            instancePath: instancePath + "/targetDocumentHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/targetDocumentHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.truthSnapshotHash !== undefined) {
      let data2 = data.truthSnapshotHash;
      if (typeof data2 === "string") {
        if (!pattern2.test(data2)) {
          const err11 = {
            instancePath: instancePath + "/truthSnapshotHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/truthSnapshotHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.validatorSetHash !== undefined) {
      let data3 = data.validatorSetHash;
      if (typeof data3 === "string") {
        if (!pattern2.test(data3)) {
          const err13 = {
            instancePath: instancePath + "/validatorSetHash",
            schemaPath: "#/definitions/Hash/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/validatorSetHash",
          schemaPath: "#/definitions/Hash/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.patchValid !== undefined) {
      if (typeof data.patchValid !== "boolean") {
        const err15 = {
          instancePath: instancePath + "/patchValid",
          schemaPath: "#/properties/patchValid/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.documentGloballyValid !== undefined) {
      if (typeof data.documentGloballyValid !== "boolean") {
        const err16 = {
          instancePath: instancePath + "/documentGloballyValid",
          schemaPath: "#/properties/documentGloballyValid/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.issues !== undefined) {
      let data6 = data.issues;
      if (Array.isArray(data6)) {
        if (data6.length > 10000) {
          const err17 = {
            instancePath: instancePath + "/issues",
            schemaPath: "#/properties/issues/maxItems",
            keyword: "maxItems",
            params: { limit: 10000 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        const len0 = data6.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate105(data6[i0], {
              instancePath: instancePath + "/issues/" + i0,
              parentData: data6,
              parentDataProperty: i0,
              rootData,
            })
          ) {
            vErrors =
              vErrors === null
                ? validate105.errors
                : vErrors.concat(validate105.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/issues",
          schemaPath: "#/properties/issues/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
  } else {
    const err19 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err19];
    } else {
      vErrors.push(err19);
    }
    errors++;
  }
  validate153.errors = vErrors;
  return errors === 0;
}

function validate152(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {},
) {
  /*# sourceURL="https://schemas.brick-studio.local/protocol/1/validators/ValidationReportV1" */ let vErrors =
    null;
  let errors = 0;
  if (
    !validate153(data, {
      instancePath,
      parentData,
      parentDataProperty,
      rootData,
    })
  ) {
    vErrors =
      vErrors === null
        ? validate153.errors
        : vErrors.concat(validate153.errors);
    errors = vErrors.length;
  }
  validate152.errors = vErrors;
  return errors === 0;
}
