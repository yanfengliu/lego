# Review 13: implementation

## Target

Independent review of the six-case source-free finite image-to-owner study in `output/first50-fresh-search-20260908/forward-camera-route`, plus the claims and gaps in its proposed next design. Repository: `%USERPROFILE%/Documents/github/lego`. Base and observed HEAD: `6300c6b817722d2652924ba9df7e06264c135e31`. The checkout is heavily dirty; this review neither accepts unrelated changes nor changes production files. The reviewed estimator, generator and records are ignored, uncommitted study artifacts.

The exact authored targets are preserved byte-for-byte as [physical admission](../snapshots/13_forward-physical-admission.md), 11,047 bytes, SHA-256 `05e7111f68429fc88e5e54286423ccae6ebbf2a8c153ad9b2f176eed1d3badf3`; [results](../snapshots/13_forward-results.md), 7,367 bytes, SHA-256 `e242fa3bd01b7336bcd37927bb82c6bcf5d0dc3595c466427b46883403da0413`; and [next design](../snapshots/13_forward-next-design.md), 5,898 bytes, SHA-256 `5b28079b7c69fa3c8dcd31a623659fe398b2ba1b8823e74d560ff65104483e55`. Admission statements that execution is pending describe preparation time, not the later retained results.

The frozen packet manifest is `packet-v1/packet-manifest-v2.json`, SHA-256 `d916c1369ed268e177cc1ed39922ed61666d14d57982e551adafacfa5759ec83`. All sixteen entries matched their declared byte lengths and hashes before this review's image access and matched again afterward. The full seventeen-file packet, including that manifest, is retained byte-for-byte in [review evidence](../../../../output/first50-fresh-search-20260908/forward-camera-route/review-13-verification/packet-source/). This copy preserves the uncommitted source target; no later child packet inherits this review merely by keeping the same filenames. The original run tree remains intentionally retained.

The corresponding ignored `review-13-verification/source-target.patch` covers all seventeen new packet files, 71,897 bytes, SHA-256 `2b67dd4f2a6dcfece6c7540d699a83ef89ddeb54874cd7e5f3e241bd92973a3b`. That readable addition patch uses LF lines; the adjacent byte-exact source copies, not newline-normalized patch text, bind the reviewed source hashes.

| Reviewed executable | SHA-256 |
|---|---|
| `estimate-case.mjs` | `9c36a95a2e0f1806f0cb168b5e0d3c86b68fbd211f731460dd42cf2577b4777a` |
| `finite-estimator.mjs` | `25947208b8e41877d57a946de6fc2fe373120376c602b0b065a0137c357566bf` |
| `surface-raster.mjs` | `75b4fde2487203501532604f44d3a58e4a0a8d99f2489ce404fb52526d2ae1e5` |
| `study-io.mjs` | `a419e3826dcfb45e5c78f7d367fbaba7f8ccaa381352723b5650e85ec5e4a58c` |
| `generate-physical.mjs` | `f244fef2c36658398f424cc3fb2db3c340c5cde4287881432e0116e9f383f63a` |
| `ray-render.mjs` | `1573a69cd34a440cb8cde62e834e8bd2700df4eaee84790636a24da4064b1548` |
| `packet-io.mjs` | `0737af0d04288690a7a965a251dc4a42815a2ae8226535edb7a02acecd04effe` |
| `judge-case.mjs` | `0773e2f6ddda26a1c1073b4db0af025891f69311f87cd6e77780052aa419a0f3` |
| `prepare-truth-swap.mjs` | `14c94d7e17e31998aaf3ad83132668a838a564fb2dc8db043b82e7808ff088a6` |
| `compare-estimates.mjs` | `b513b24210fea03000aab946db0d3dc5988239be69c491792c37fbe41219f770` |

## Reviewers and coverage

Reviewer: `/root/forward_finite_review`, 2026-09-08. The parent admitted the six synthetic PNG/RGBA/model/private-truth inputs and retained run records for this read-only review. The reviewer read the ten executables above, the public grid and geometry, admission/manifest, six estimates/closures/judgments/telemetry, generation roster, invocation records, truth-swap inputs/receipt/comparison, results, and next design. Each of the six PNGs was viewed individually at its native 720 by 470 size with before/after digests.

The reviewer ran only metadata/hash checks and read-only arithmetic over existing records. No estimator, generator, judge, comparator, renderer, compiler, test suite, native payload, Poppler process, PDF reader, browser, network request or production path was executed. No source image, other camera candidate or incident record was read. The earlier cap-only source and images were not independently re-reviewed; this report accepts no new claim about that earlier instrument. No browser, GUI, server, watcher or child-process tree was launched. The only writes are this report, its document snapshots and ignored review evidence.

## Reports

### `/root/forward_finite_review`

The retained measurement supports the stated finite synthetic result. It does not establish a correct reusable judge: F11 and F12 are class-level omissions in that instrument. Direct review of the actual records supplies the missing corroboration for these exact bytes, without retroactively strengthening the original judge.

#### Enumeration, raster and ownership

`finite-estimator.mjs:80-115` visits the Cartesian product of 24 azimuths, 10 elevations, two up signs and three scales: 1,440 camera rows. It does not inspect generator truth, seed from the true pose, rank away survivors or restrict the search to an observed orientation. `surface-raster.mjs` constructs physical convex faces and a depth-buffer projection independently of the generator's ray/halfspace implementation. Both use the public boxes, regular 32-sided prisms and known neutral surface-class tones; this is a strong declared appearance prior.

The bbox reduction at lines 85-94 is necessary under the frozen symmetric 3-by-3 per-tone support relation. Every extremal foreground coordinate must be within one integer coordinate of the corresponding predicted extremum. Intersecting the two extrema intervals leaves at most three translations per axis. It cannot remove a pixel-feasible integer translation in this declared universe. Full projected foreground must fit the image. The comparison rectangle includes the union of both foreground bounds and a one-pixel margin; omitted pixels are background in both images. Candidate tiles have background padding, so the outside-tile background shortcut does not discard a feasible foreground neighbor. This reasoning covers the defined finite raster model, not exact arithmetic certification of continuous polyhedra or arbitrary clipping.

For every survivor, lines 110-113 compute compatible physical owners from same-tone samples in the declared neighborhoods. Any missing, multiple or disagreeing owner clears the consensus. Base edges additionally require the known `middle4` body and a prism wall. The four final groups contain only consensus edges. Lines 125-131 enumerate all top/base pairs meeting the frozen three-pixel displacement compatibility rule for every retained pose. Their intervals are pixel-compatible signed pairs conditional on the retained finite model. They are not measured exact continuous correspondences. The full finite census, retained owner consensus and restricted claim in `RESULTS.md` agree with this implementation.

#### Actual six-case records

| Case | Camera / translation cells | Retained poses | Distinct camera rows: azimuth, elevation, up sign, scale | Owned top / base edges | Compatible pairs | Signed interval range over all pairs |
|---|---:|---:|---|---:|---:|---|
| Native | 1,440 / 120 | 9 | 30, 30, +1, 2 | 130 / 186 | 938 | +1.5 to +12.5 px |
| Horizontal | 1,440 / 120 | 9 | 150, 30, +1, 2 | 130 / 186 | 938 | +1.5 to +12.5 px |
| Vertical | 1,440 / 120 | 9 | 150, 30, -1, 2 | 130 / 186 | 938 | -12.5 to -1.5 px |
| Combined | 1,440 / 120 | 9 | 30, 30, -1, 2 | 130 / 186 | 938 | -12.5 to -1.5 px |
| Symmetric | 1,440 / 144 | 18 | 30 and 210, 30, +1, 2 | 0 / 0 | 0 | None |
| Erased | 1,440 / 0 | 0 | None | 0 / 0 | 0 | None |

All six records have `complete: true`, no refusal, and their reported judgment binds the actual estimate hash. The positive cases retain all nine neighboring integer translations. The symmetric record really retains two distinct orientations 180 degrees apart, each with nine translations, and all four ownership groups are empty. The erased case is rejected by the necessary bbox condition before pixel comparison; its zero feasible count is full-model mismatch, not a new cap-only ambiguity proof.

Independent read-only inspection checked 446 cap/wall sample references in each positive case against the retained private owner bytes, with zero mismatches. Those are references, not 446 distinct support sites. It also checked all 938 reported intervals per positive case against the private pose's projected four-unit stud height: approximately +6.928203 px for native/horizontal and -6.928203 px for vertical/combined. Every interval contains that displacement. These direct checks corroborate the exact runs despite the judge omissions below.

The six estimate SHA-256 values in table order are `40ece4daa33c1af6a13fd72d09dd5d01d360c864fa78e12bc6f55c1f35fcf832`, `37d091a29b6c72129b5270c0732be033c3dc0306bbbd6e9278018c5e9fffa250`, `95e477164fc946e43f1ab3575a9a1aee5aaf1ce683ab00f67a5261b75213f667`, `0f940a550e79f0400d0e0b15683e1729892b3217a0a6b188cb56a40e3a7598d1`, `360d1863577d974b334b0312d3ce84ad4bc220f244714528640238e459b4cea4`, and `d0a729c11bdabdf191221bc4100fddab12da3b5d5a5d9340553bf6ea9e30b23f`.

#### Private truth and byte comparison

The estimator entry point reads its five-file source roster, public grid, exact case RGBA and public model. Its import closure contains no generator or private judge. The swapped input supplies byte-identical native RGBA and public model but a different private camera and reversed part IDs. The reviewer independently compared every byte of both 247,280-byte `estimate.json` files and found equality, matching SHA-256 `40ece4daa33c1af6a13fd72d09dd5d01d360c864fa78e12bc6f55c1f35fcf832`. Original and swapped truth hashes are `8522d312339fa370674ed1dee298f74d23ff1ee9dbefa55dcd09c5167bba03ce` and `6aaea237298ab302684becae1d2611566138a126dd99f2e19e7624a39c69887a`. Actual closure inputs/sources agree and the separate receipt binds the substituted truth to the original public bytes.

This establishes source-level truth separation and observed functional independence for this substitution. `study-io.mjs` exposes ordinary filesystem reads; the standalone process is not an OS isolation boundary and these same-user files are not production seals. The study does not claim those guarantees. Timing and sampled RSS are correctly excluded from functional byte equality. The largest reported six-case RSS sample is 120,111,104 bytes; neither these samples nor the cooperative guards prove an OS memory ceiling.

#### Individual visual review

`same` below means the picture matches its authored synthetic fixture intent. It does not mean source-art realism, admitted catalog geometry, exact physical ownership from pixels alone, or production qualification. Every image was separately displayed at 720 by 470 pixels. Every listed digest was identical before and after inspection.

| PNG under `runs/physical-input-first-20260908` | SHA-256 | Verdict and observed content |
|---|---|---|
| `native.png` | `d1eb460cc60d4eec8009ba0a0d428241256ad49ccf8b6877f9d97cef46d36148` | Same. Four separate caps and dark walls, long left extension and short right extension, no clipping. |
| `horizontal.png` | `e78601ca81c8eafa7a6c8c3fdb339dab1ddfa1a7768b448d722da3024835a090` | Same. Four caps/walls, long right extension and short left extension, reflected slope and no clipping. |
| `vertical.png` | `6c3e172e0a8f8c1aa38dc411776644b59f0979a5fd22963585508f21e8b4b03e` | Same. Long left extension; stud caps and wall strips appear below the body in image coordinates. |
| `combined.png` | `815cd535af99370190742e4b50af60e9b77b9a4257ed98fa831dad13e1f2ed2d` | Same. Long right extension; four stud caps and walls below the body in image coordinates. |
| `symmetric.png` | `6623e83fd8f796fc97cc520ac7eb59cb45a8b082f52bd3a98dce7b772e560eca` | Same. Compact four-stud part with both unequal extensions removed, cap/wall/body classes still visible. |
| `erased.png` | `afe7a38535c84f05eac9e22b127257b0ac37d13babadbe9deb8f3bb7b3e7029d` | Same. Four isolated cap patches; no visible body or wall. |

#### F11: Negative-control judgment checks a weaker condition than the required ambiguity/refusal

`judge-case.mjs:17` accepts the symmetric case when there are at least two feasible rows and `fourFiniteModelOwnedSignedRims` is false. Two translations of one orientation satisfy that condition without retaining the physical 180-degree ambiguity. Negating the four-group aggregate also permits one, two or three fixed-owner groups. The erased branch likewise only negates that aggregate and does not require zero owned wall-rim claims. Thus the instrument can mark a violated negative-control contract as passed.

This is a reusable-check defect, not a counterexample to these actual outputs: the retained symmetric result has azimuths 30 and 210 and zero owned edges/pairs, and the erased result has zero poses/claims. A corrected immutable judge child should require the specified distinct physical explanations and zero fixed-owner support for symmetry, and zero owned wall-rim support for erasure. Explicit false-positive records should show that translation multiplicity and partial-owner claims are refused. Do not overwrite the original judge or run records.

#### F12: The private judge does not independently check signed displacement output

`judge-case.mjs:10-19` checks true-pose retention and claimed owner samples, then trusts `fourFiniteModelOwnedSignedRims`. It never checks pair references, pair coordinates, reported interval endpoints, or the independently projected physical stud height/sign. An interval sign inversion or malformed pair can therefore pass while retaining correct owner samples and the aggregate boolean. This leaves the signed measurement, one of the study's main outcomes, unchecked by the original private judge.

The exact outputs are corroborated above, but this judge is insufficient for a reusable sign gate. A corrected child should resolve each pair's referenced top/base edges in the claimed owner group; check their kinds, pixels and midpoint coordinates; derive the observed base-minus-top displacement; check the interval against the declared three-pixel allowance; and independently project the private model's top/base height through the private camera. It should require the appropriate sign and containment and derive group/aggregate decisions from validated records. These checks must retain the pixel-compatible scope, not introduce an exact continuous-correspondence claim. Sign inversion, forged interval, wrong edge reference and falsely asserted aggregate records need explicit rejection evidence before reuse.

#### Next-design assessment

The next design correctly treats continuous enclosure and drawing uncertainty as unresolved obligations. It refuses to treat rejected finite samples as lower bounds between samples and keeps all unexcluded camera regions. Conservative unions of possible projected surfaces can support one-sided exclusion; any future reverse requirement needs guaranteed occupancy, not the union of possible occupancy treated as mandatory foreground. Occlusion-based removal must remain conservative across the whole cell. These are implementation obligations, not already demonstrated algorithms.

An executable packet still needs a closed global domain including grazing/polar charts and fractional translation, outward numerical enclosures including floating-point error, correct existential quantification over appearance nuisance, explicit treatment of equal-depth surfaces, owner sets that remain conservative across a cell, and an independently generated off-grid control. Full-domain unresolved cells must survive budget exhaustion. The design acknowledges these gaps and the unproved 60-second/16,384-cell feasibility. Its separation of ideal geometry from a later bounded drawing family is reasonable. This is bounded approval of a research direction only; no new execution, production adapter or source-stage admission follows from it.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | Negative controls can pass translation multiplicity or partial fixed-owner claims. | Coordinator accepted as a class-level instrument fix before reusable gate use or promotion. Exact original negative records independently satisfy the stronger requirements. | Preserve original bytes. Author an immutable corrected judge child and explicit false-positive controls, then obtain focused independent review. |
| F12 | The judge trusts the signed aggregate without checking pair/interval semantics or private projected height. | Coordinator accepted as a class-level instrument fix before reusable gate use or promotion. Exact original positive records have zero owner mismatches and all intervals contain the private projected displacement. | Independently check pair references, midpoint/displacement/allowance semantics and private physical projection; reject malformed records in an immutable child. |

## Verification

All sixteen packet identities and all 42 generated member hashes/lengths matched the retained manifests. The six PNG headers report 720 by 470; all six individual native views completed and all before/after image/source hashes match. All six estimate digests, separate judgments, feasible sets and ownership groups were read. Read-only review counted zero owner mismatches over 1,784 positive-case sample references and zero private-projection exclusions over 3,752 signed intervals. The two native functional outputs and their public inputs are byte-identical; their private truth bytes differ.

Ignored evidence lives under `review-13-verification/`: `source-before.json`, `source-after.json`, `generation-member-checks.json`, `images-before.json`, `images-after.json`, `read-case-records.json`, `closure-record-checks.json`, `snapshot-documents.json`, `independent-byte-comparison.json` and `independent-owner-interval-data-review.json`. The last two have SHA-256 `0b43825d35a38e98f77cb3f8e71b334a8d7dcff79eab05cf05cfaf723e8a18ed` and `9aba2fce4ea45c2a003aa13ca126293b34cbb626804f7fbc8636437a0342b6ac`. Every six-case closure source/input identity also matches its actual file. All evidence is retained for the unresolved judge fixes and campaign handoff. No process cleanup was needed because this reviewer launched no browser, GUI, server, native payload or study process.

No production gate, complete browser verification, mutation execution, continuous-camera test or source-art evaluation was run. The earlier commands' exit statuses are retained execution provenance, not independently rerun results. The report and three snapshots have no trailing whitespace, unmatched Markdown fences or missing internal links. The source patch is confirmed ignored. Git's scoped diff check reported no error; these new documentation files were also checked directly because an unstaged diff alone does not inspect untracked text.

## Round outcome

Accept the exact retained six-case measurement as bounded finite synthetic evidence, with independent visual, owner, interval and byte-comparison corroboration. Do not accept the original judge as a complete reusable validation gate until F11/F12 are fixed and independently re-reviewed. The estimator has no continuous-camera uniqueness, fractional-translation, antialiasing, printed-art, source-extraction, native qualification, twelve-site lattice, placement or opaque-capability authority. Four synthetic studs remain four studs. The proposed continuous/nuisance design is unimplemented research work. This review does not complete the campaign or claim a merged implementation.
