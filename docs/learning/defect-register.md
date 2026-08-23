# Defect register

Every defect the user reports gets a permanent entry here with the symptom as reported, the investigation, the root cause, the fix, and the whole-class check that remains. This is neither the [devlog](../devlog/summary.md) nor [lessons.md](lessons.md): history records what changed, a lesson is removed when a gate absorbs it, and this register preserves the symptom-to-cause mapping even after the fix ships.

Newest first.

---

## 2026-08-23 - Six fail-closed paths hid genuine native Error detail

**Status:** fixed and gated in the Gate-3 step-7 evidence unit.

**Symptom.** The authoritative `npm run verify` reached Vitest and then failed five cases in `real-build-run-panel-camera-lifecycle.test.ts` - hostile page rejection, genuine raster failure, page-disposal failure, PDF plus loading-task cleanup failure, and hostile cleanup values - plus the hostile transition-witness case in `real-build-browser-output-v3.test.ts`. The retained error text had collapsed the genuine native failures into a generic non-native thrown-object fallback, so the evidence no longer named what actually failed.

**Investigation.** Running only those two files reproduced all six failures. Each path handed a real native `Error` to the newly generalized non-probing formatter. The blanket object fallback intentionally refused to inspect hostile objects but also erased safe own name/message data from native errors. The first repair was not safe enough: it called the live global `Error.isError` receiver and trusted `descriptor.value` without proving that `value` was an own data property, so replaced globals and polluted descriptor prototypes could still steer the formatter.

**Root cause.** The formatter had treated "do not probe an arbitrary thrown object" and "do not read captured own data from a proved native Error" as the same rule. Its attempted exception then depended on mutable globals and an incompletely validated descriptor record.

**Fix.** The browser path captures `Error.isError`, constructor/descriptor/Reflect/string/number intrinsics before hostile code can replace them and validates the descriptor of the descriptor's own `value` property. The host path uses captured `util.types.isNativeError`, builds Error-name descriptors on null-prototype records through captured `Reflect.defineProperty`, and both paths bound the resulting strings. Evidence branding uses captured `WeakMap` set/get methods, so prototype replacement cannot forge or erase membership.

**How it is checked from now on.** `non-probing-error.test.ts`, the two original failing suites, and the forced browser source-boundary controls cover genuine native errors alongside strings, null, arbitrary objects, proxies, accessors, inherited descriptor values, replaced globals and polluted prototypes. The focused repair set passes 115/115 plus three forced-browser controls, the final Gate-3-focused unit slice passes 132/132, and the complete repository gate reruns the original six paths.

**Class.** A safety formatter that hides the cause it is supposed to retain. The standing rule is to recognize only proved native errors through captured intrinsics, copy only validated own data, and keep every other thrown object opaque.
