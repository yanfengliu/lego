import { once } from "node:events";

import { chromium } from "playwright";

const browserServer = await chromium.launchServer({ headless: true });
process.stdout.write(`STEP44_BROWSER_WS:${browserServer.wsEndpoint()}\n`);
const browserProcess = browserServer.process();
if (browserProcess.exitCode === null && browserProcess.signalCode === null)
  await once(browserProcess, "exit");
