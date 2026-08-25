import { expect, test } from "@playwright/test";

const DATA_MODULE_URL: string = "/e2e/real-build-step-one-proper-c4-data-snapshot.ts";

test("proper-C4 browser snapshots reject unowned Proxies without invoking traps", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (moduleUrl) => {
    const boundary = await import(/* @vite-ignore */ moduleUrl);
    let objectTraps = 0;
    const objectProxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          objectTraps += 1;
          throw new Error("object descriptor trap ran");
        },
        getPrototypeOf() {
          objectTraps += 1;
          throw new Error("object prototype trap ran");
        },
        ownKeys() {
          objectTraps += 1;
          throw new Error("object keys trap ran");
        },
      },
    );
    let objectMessage = "";
    try {
      boundary.snapshotRealBuildStepOneProperC4DataObject(objectProxy, "hostile object", []);
    } catch (error) {
      objectMessage = error instanceof Error ? error.message : String(error);
    }

    let arrayTraps = 0;
    const arrayProxy = new Proxy([], {
      getOwnPropertyDescriptor() {
        arrayTraps += 1;
        throw new Error("array descriptor trap ran");
      },
      getPrototypeOf() {
        arrayTraps += 1;
        throw new Error("array prototype trap ran");
      },
      ownKeys() {
        arrayTraps += 1;
        throw new Error("array keys trap ran");
      },
    });
    let arrayMessage = "";
    try {
      boundary.snapshotRealBuildStepOneProperC4DataArray(arrayProxy, "hostile array", 1);
    } catch (error) {
      arrayMessage = error instanceof Error ? error.message : String(error);
    }

    const owned = boundary.createRealBuildStepOneProperC4DataObject("nested", objectProxy);
    const ownedSnapshot = boundary.snapshotRealBuildStepOneProperC4DataObject(
      owned,
      "owned wrapper",
      ["nested"],
    );
    let nestedMessage = "";
    try {
      boundary.snapshotRealBuildStepOneProperC4DataObject(
        ownedSnapshot.nested,
        "nested hostile object",
        [],
      );
    } catch (error) {
      nestedMessage = error instanceof Error ? error.message : String(error);
    }

    const parsed = boundary.parseRealBuildStepOneProperC4BrowserJson(
      '{"source":{"width":500},"rows":[1,2,3]}',
      "parsed control",
      1_024,
    );
    const parsedOuter = boundary.snapshotRealBuildStepOneProperC4DataObject(
      parsed,
      "parsed control",
      ["source", "rows"],
    );
    const parsedSource = boundary.snapshotRealBuildStepOneProperC4DataObject(
      parsedOuter.source,
      "parsed source",
      ["width"],
    );
    const parsedRows = boundary.snapshotRealBuildStepOneProperC4DataArray(
      parsedOuter.rows,
      "parsed rows",
      3,
    );
    return {
      objectTraps,
      arrayTraps,
      objectMessage,
      arrayMessage,
      nestedMessage,
      parsedWidth: parsedSource.width,
      parsedRows,
    };
  }, DATA_MODULE_URL);

  expect(result).toEqual({
    objectTraps: 0,
    arrayTraps: 0,
    objectMessage: expect.stringMatching(/bounded JSON parser or module-owned C4 constructor/u),
    arrayMessage: expect.stringMatching(/bounded JSON parser or module-owned C4 constructor/u),
    nestedMessage: expect.stringMatching(/bounded JSON parser or module-owned C4 constructor/u),
    parsedWidth: 500,
    parsedRows: [1, 2, 3],
  });
});
