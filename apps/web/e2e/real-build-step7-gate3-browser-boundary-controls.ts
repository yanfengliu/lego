import type { Page } from "@playwright/test";

export interface Step7Gate3BrowserErrorBoundaryControl {
  readonly objectMessage: string;
  readonly functionMessage: string;
  readonly nativeErrorMessage: string;
  readonly nativeErrorWithHostilePrototypeMessage: string;
  readonly accessorErrorMessage: string;
  readonly proxiedErrorMessage: string;
  readonly liveGlobalErrorMessage: string;
  readonly pollutedPrototypeAccessorErrorMessage: string;
  readonly longStringMessage: string;
  readonly numberMessage: string;
  readonly hostileTrapCalls: {
    readonly get: number;
    readonly descriptor: number;
    readonly keys: number;
    readonly prototype: number;
    readonly apply: number;
    readonly construct: number;
    readonly accessor: number;
    readonly globalError: number;
    readonly inheritedDescriptorValue: number;
  };
  readonly replacementIntrinsicCalls: {
    readonly reflectApply: number;
    readonly stringSlice: number;
    readonly numberToString: number;
    readonly errorIsError: number;
    readonly objectGetOwnPropertyDescriptor: number;
  };
}

export async function runStep7Gate3BrowserErrorBoundaryControl(
  page: Page,
  diagnosticContractUrl: string,
): Promise<Step7Gate3BrowserErrorBoundaryControl> {
  return page.evaluate(async (moduleUrl) => {
    const diagnostic = (await import(/* @vite-ignore */ moduleUrl)) as {
      describeBrowserThrown(value: unknown): string;
    };
    const NativeError = Error;
    const hostileTrapCalls = {
      get: 0,
      descriptor: 0,
      keys: 0,
      prototype: 0,
      apply: 0,
      construct: 0,
      accessor: 0,
      globalError: 0,
      inheritedDescriptorValue: 0,
    };
    const objectValue = new Proxy(Object.create(null) as object, {
      get: () => {
        hostileTrapCalls.get += 1;
        throw new Error("must not read hostile object");
      },
      getOwnPropertyDescriptor: () => {
        hostileTrapCalls.descriptor += 1;
        throw new Error("must not inspect hostile object descriptors");
      },
      getPrototypeOf: () => {
        hostileTrapCalls.prototype += 1;
        throw new Error("must not inspect hostile object prototype");
      },
      ownKeys: () => {
        hostileTrapCalls.keys += 1;
        throw new Error("must not enumerate hostile object");
      },
    });
    const functionValue = new Proxy(function hostileCallable() {}, {
      apply: () => {
        hostileTrapCalls.apply += 1;
        throw new Error("must not call hostile function");
      },
      construct: () => {
        hostileTrapCalls.construct += 1;
        throw new Error("must not construct hostile function");
      },
      get: () => {
        hostileTrapCalls.get += 1;
        throw new Error("must not read hostile function");
      },
      getOwnPropertyDescriptor: () => {
        hostileTrapCalls.descriptor += 1;
        throw new Error("must not inspect hostile function descriptors");
      },
      getPrototypeOf: () => {
        hostileTrapCalls.prototype += 1;
        throw new Error("must not inspect hostile function prototype");
      },
      ownKeys: () => {
        hostileTrapCalls.keys += 1;
        throw new Error("must not enumerate hostile function");
      },
    });
    const objectMessage = diagnostic.describeBrowserThrown(objectValue);
    const functionMessage = diagnostic.describeBrowserThrown(functionValue);
    const nativeError = new Error("native error detail");
    const nativeErrorWithHostilePrototype = new Error("hostile prototype detail");
    Object.setPrototypeOf(nativeErrorWithHostilePrototype, objectValue);
    const accessorError = new Error("replaced detail");
    Object.defineProperty(accessorError, "message", {
      configurable: true,
      get: () => {
        hostileTrapCalls.accessor += 1;
        throw new Error("must not invoke a native Error message accessor");
      },
    });
    const proxiedError = new Proxy(new Error("proxied error detail"), {
      get: () => {
        hostileTrapCalls.get += 1;
        throw new Error("must not read proxied Error data");
      },
      getOwnPropertyDescriptor: () => {
        hostileTrapCalls.descriptor += 1;
        throw new Error("must not inspect proxied Error descriptors");
      },
      getPrototypeOf: () => {
        hostileTrapCalls.prototype += 1;
        throw new Error("must not inspect the proxied Error prototype");
      },
      ownKeys: () => {
        hostileTrapCalls.keys += 1;
        throw new Error("must not enumerate the proxied Error");
      },
    });

    const replacementIntrinsicCalls = {
      reflectApply: 0,
      stringSlice: 0,
      numberToString: 0,
      errorIsError: 0,
      objectGetOwnPropertyDescriptor: 0,
    };
    const reflectApplyDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply");
    const stringSliceDescriptor = Object.getOwnPropertyDescriptor(String.prototype, "slice");
    const numberToStringDescriptor = Object.getOwnPropertyDescriptor(Number.prototype, "toString");
    const errorIsErrorDescriptor = Object.getOwnPropertyDescriptor(NativeError, "isError");
    const globalErrorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Error");
    const objectPrototypeValueDescriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "value",
    );
    const objectGetOwnPropertyDescriptorDescriptor = Object.getOwnPropertyDescriptor(
      Object,
      "getOwnPropertyDescriptor",
    );
    if (
      reflectApplyDescriptor === undefined ||
      stringSliceDescriptor === undefined ||
      numberToStringDescriptor === undefined ||
      errorIsErrorDescriptor === undefined ||
      globalErrorDescriptor === undefined ||
      globalErrorDescriptor.configurable !== true ||
      objectGetOwnPropertyDescriptorDescriptor === undefined
    ) {
      throw new TypeError("Browser primitive-formatting intrinsics have no own descriptors.");
    }
    let longStringMessage: string;
    let numberMessage: string;
    let nativeErrorMessage: string;
    let nativeErrorWithHostilePrototypeMessage: string;
    let accessorErrorMessage: string;
    let proxiedErrorMessage: string;
    let liveGlobalErrorMessage: string;
    let pollutedPrototypeAccessorErrorMessage: string;
    try {
      Object.defineProperty(Reflect, "apply", {
        ...reflectApplyDescriptor,
        value: () => {
          replacementIntrinsicCalls.reflectApply += 1;
          throw new Error("must use captured Reflect.apply");
        },
      });
      Object.defineProperty(String.prototype, "slice", {
        ...stringSliceDescriptor,
        value: () => {
          replacementIntrinsicCalls.stringSlice += 1;
          throw new Error("must use captured String.prototype.slice");
        },
      });
      Object.defineProperty(Number.prototype, "toString", {
        ...numberToStringDescriptor,
        value: () => {
          replacementIntrinsicCalls.numberToString += 1;
          throw new Error("must use captured Number.prototype.toString");
        },
      });
      Object.defineProperty(NativeError, "isError", {
        ...errorIsErrorDescriptor,
        value: () => {
          replacementIntrinsicCalls.errorIsError += 1;
          throw new Error("must use captured Error.isError");
        },
      });
      Object.defineProperty(Object, "getOwnPropertyDescriptor", {
        ...objectGetOwnPropertyDescriptorDescriptor,
        value: () => {
          replacementIntrinsicCalls.objectGetOwnPropertyDescriptor += 1;
          throw new Error("must use captured Object.getOwnPropertyDescriptor");
        },
      });
      longStringMessage = diagnostic.describeBrowserThrown("x".repeat(600));
      numberMessage = diagnostic.describeBrowserThrown(42.5);
      nativeErrorMessage = diagnostic.describeBrowserThrown(nativeError);
      nativeErrorWithHostilePrototypeMessage = diagnostic.describeBrowserThrown(
        nativeErrorWithHostilePrototype,
      );
      accessorErrorMessage = diagnostic.describeBrowserThrown(accessorError);
      proxiedErrorMessage = diagnostic.describeBrowserThrown(proxiedError);
      try {
        Object.defineProperty(globalThis, "Error", {
          configurable: true,
          enumerable: globalErrorDescriptor.enumerable === true,
          get: () => {
            hostileTrapCalls.globalError += 1;
            return NativeError;
          },
        });
        liveGlobalErrorMessage = diagnostic.describeBrowserThrown(
          new NativeError("live global detail"),
        );
      } finally {
        Object.defineProperty(globalThis, "Error", globalErrorDescriptor);
      }
      try {
        Object.defineProperty(Object.prototype, "value", {
          configurable: true,
          get: () => {
            hostileTrapCalls.inheritedDescriptorValue += 1;
            return "forged inherited detail";
          },
        });
        pollutedPrototypeAccessorErrorMessage = diagnostic.describeBrowserThrown(accessorError);
      } finally {
        if (objectPrototypeValueDescriptor === undefined) {
          Reflect.deleteProperty(Object.prototype, "value");
        } else {
          Object.defineProperty(Object.prototype, "value", objectPrototypeValueDescriptor);
        }
      }
    } finally {
      Object.defineProperty(Reflect, "apply", reflectApplyDescriptor);
      Object.defineProperty(String.prototype, "slice", stringSliceDescriptor);
      Object.defineProperty(Number.prototype, "toString", numberToStringDescriptor);
      Object.defineProperty(NativeError, "isError", errorIsErrorDescriptor);
      Object.defineProperty(
        Object,
        "getOwnPropertyDescriptor",
        objectGetOwnPropertyDescriptorDescriptor,
      );
    }

    return {
      objectMessage,
      functionMessage,
      nativeErrorMessage,
      nativeErrorWithHostilePrototypeMessage,
      accessorErrorMessage,
      proxiedErrorMessage,
      liveGlobalErrorMessage,
      pollutedPrototypeAccessorErrorMessage,
      longStringMessage,
      numberMessage,
      hostileTrapCalls,
      replacementIntrinsicCalls,
    };
  }, diagnosticContractUrl);
}

const CLOSE_TIME_ACK_KEY = "__legoStep7Gate3CloseTimeAckV1";
const CLOSE_TIME_ACK_TIMEOUT_MILLISECONDS = 5_000;
const MAXIMUM_CLOSE_TIME_CONTROL_DELAY_MILLISECONDS = 1_000;

export interface Step7Gate3CloseTimeCompletionAck {
  readonly schemaVersion: "lego.step7-gate3-close-time-completion/1";
  readonly status: "complete";
  readonly absoluteUrl: string;
  readonly pagehideSignalReceived: true;
  readonly fetchCompleted: true;
  readonly responseConsumed: true;
  readonly bytes: number;
  readonly messageHandlingDelayMs: number;
  readonly responseConsumptionDelayMs: number;
  readonly signalToFetchElapsedMs: number;
  readonly responseToConsumptionElapsedMs: number;
}

export interface Step7Gate3CloseTimeFetchControl {
  readonly companion: Page;
  readonly completion: Promise<Step7Gate3CloseTimeCompletionAck>;
}

const closeTimeDelay = (value: number | undefined, label: string): number => {
  const delay = value ?? 0;
  if (
    !Number.isSafeInteger(delay) ||
    delay < 0 ||
    delay > MAXIMUM_CLOSE_TIME_CONTROL_DELAY_MILLISECONDS
  ) {
    throw new RangeError(
      `Gate-3 ${label} delay must be an integer from 0 through ${MAXIMUM_CLOSE_TIME_CONTROL_DELAY_MILLISECONDS} ms.`,
    );
  }
  return delay;
};

const boundedCloseTimeCompletion = async (
  rawCompletion: Promise<unknown>,
  expectedUrl: string,
): Promise<Step7Gate3CloseTimeCompletionAck> => {
  const timeoutMarker = Symbol("close-time-ack-timeout");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(timeoutMarker), CLOSE_TIME_ACK_TIMEOUT_MILLISECONDS);
  });
  let rawAck: unknown;
  try {
    rawAck = await Promise.race([rawCompletion, timeoutPromise]);
  } catch (error) {
    if (error === timeoutMarker) {
      throw new TypeError(
        `Gate-3 close-time completion ACK did not arrive within ${CLOSE_TIME_ACK_TIMEOUT_MILLISECONDS} ms.`,
        { cause: error },
      );
    }
    throw new Error("Gate-3 close-time completion ACK rejected before it was recorded.", {
      cause: error,
    });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  if (typeof rawAck !== "object" || rawAck === null) {
    throw new TypeError("Gate-3 close-time completion ACK was not a record.");
  }
  const ack = rawAck as Record<string, unknown>;
  if (ack.status === "failed") {
    throw new TypeError("Gate-3 close-time completion ACK recorded a fetch/body failure.");
  }
  if (
    ack.schemaVersion !== "lego.step7-gate3-close-time-completion/1" ||
    ack.status !== "complete" ||
    ack.absoluteUrl !== expectedUrl ||
    ack.pagehideSignalReceived !== true ||
    ack.fetchCompleted !== true ||
    ack.responseConsumed !== true ||
    typeof ack.bytes !== "number" ||
    !Number.isSafeInteger(ack.bytes) ||
    ack.bytes < 0 ||
    typeof ack.messageHandlingDelayMs !== "number" ||
    typeof ack.responseConsumptionDelayMs !== "number" ||
    typeof ack.signalToFetchElapsedMs !== "number" ||
    typeof ack.responseToConsumptionElapsedMs !== "number"
  ) {
    throw new TypeError("Gate-3 close-time completion ACK had an invalid exact shape.");
  }
  return Object.freeze(ack as unknown as Step7Gate3CloseTimeCompletionAck);
};

export async function installStep7Gate3CloseTimeFetchControl(
  page: Page,
  closeTimeCompanionUrl: string,
  closeTimeControlUrl: string,
  delays: {
    readonly messageHandlingDelayMs?: number;
    readonly responseConsumptionDelayMs?: number;
  } = {},
): Promise<Step7Gate3CloseTimeFetchControl> {
  const messageHandlingDelayMs = closeTimeDelay(delays.messageHandlingDelayMs, "message-handling");
  const responseConsumptionDelayMs = closeTimeDelay(
    delays.responseConsumptionDelayMs,
    "response-consumption",
  );
  const context = page.context();
  const companionOpened = context.waitForEvent("page");
  const popupCreated = await page.evaluate(
    (companionUrl) => window.open(companionUrl, "gate3-close-time-control") !== null,
    closeTimeCompanionUrl,
  );
  if (!popupCreated) {
    throw new TypeError(
      "Gate-3 close-time control could not create its same-origin companion page.",
    );
  }
  const companion = await companionOpened;
  await companion.waitForLoadState("domcontentloaded");
  const expectedOrigin = new URL(page.url()).origin;
  const companionOrigin = await companion.evaluate(() => location.origin);
  if (companionOrigin !== expectedOrigin) {
    throw new TypeError(
      `Gate-3 close-time companion origin ${companionOrigin} differs from ${expectedOrigin}.`,
    );
  }
  const channelName = "lego-gate3-close-time-observer-control";
  await companion.evaluate(
    ({ ackKey, channel, controlUrl, messageDelayMs, consumptionDelayMs }) => {
      const closeTimeChannel = new BroadcastChannel(channel);
      let resolveCompletion: (value: unknown) => void = () => undefined;
      const completion = new Promise<unknown>((resolve) => {
        resolveCompletion = resolve;
      });
      Object.defineProperty(globalThis, ackKey, {
        value: completion,
        configurable: false,
        enumerable: false,
        writable: false,
      });
      const wait = (milliseconds: number): Promise<void> =>
        new Promise((resolve) => setTimeout(resolve, milliseconds));
      closeTimeChannel.addEventListener(
        "message",
        async (event) => {
          if (event.data !== "primary-page-hidden") return;
          closeTimeChannel.close();
          const signalReceivedAt = performance.now();
          await wait(messageDelayMs);
          const fetchStartedAt = performance.now();
          try {
            const response = await fetch(controlUrl, {
              method: "GET",
              cache: "no-store",
              credentials: "same-origin",
              keepalive: true,
            });
            const responseReceivedAt = performance.now();
            await wait(consumptionDelayMs);
            const bytes = await response.arrayBuffer();
            const responseConsumedAt = performance.now();
            if (!response.ok || response.url !== controlUrl) {
              throw new TypeError("close-time response was not exact success");
            }
            resolveCompletion({
              schemaVersion: "lego.step7-gate3-close-time-completion/1",
              status: "complete",
              absoluteUrl: response.url,
              pagehideSignalReceived: true,
              fetchCompleted: true,
              responseConsumed: true,
              bytes: bytes.byteLength,
              messageHandlingDelayMs: messageDelayMs,
              responseConsumptionDelayMs: consumptionDelayMs,
              signalToFetchElapsedMs: fetchStartedAt - signalReceivedAt,
              responseToConsumptionElapsedMs: responseConsumedAt - responseReceivedAt,
            });
          } catch {
            resolveCompletion({
              schemaVersion: "lego.step7-gate3-close-time-completion/1",
              status: "failed",
              failure: "close-time fetch or body consumption failed",
              pagehideSignalReceived: true,
            });
          }
        },
        { once: true },
      );
    },
    {
      ackKey: CLOSE_TIME_ACK_KEY,
      channel: channelName,
      controlUrl: closeTimeControlUrl,
      messageDelayMs: messageHandlingDelayMs,
      consumptionDelayMs: responseConsumptionDelayMs,
    },
  );
  const rawCompletion = companion.evaluate(async (ackKey) => {
    const completion = (globalThis as unknown as Record<string, unknown>)[ackKey];
    if (!(completion instanceof Promise)) {
      throw new TypeError("Gate-3 close-time browser completion promise is unavailable.");
    }
    return completion;
  }, CLOSE_TIME_ACK_KEY);
  await page.evaluate((channel) => {
    const closeTimeChannel = new BroadcastChannel(channel);
    addEventListener(
      "pagehide",
      () => {
        closeTimeChannel.postMessage("primary-page-hidden");
        closeTimeChannel.close();
      },
      { once: true },
    );
  }, channelName);
  return Object.freeze({
    companion,
    completion: boundedCloseTimeCompletion(rawCompletion, closeTimeControlUrl),
  });
}
