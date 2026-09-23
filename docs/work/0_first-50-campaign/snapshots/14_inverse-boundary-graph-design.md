# Boundary graph inverse experiment: preparation 02 addendum

Owner: `/root/inverse_boundary_graph`. Source-only successor, 2026-09-08. This addendum replaces the acceptance, translation-gauge and unfinished sampling clauses of immutable `proposal.md` at SHA-256 `f91e05d14a9eb9c4849da764a56c44c8300c4889bebfeda24bae83b92c36c3c4`. Its `source-closure.json` remains unchanged at `4838d4eb314c3eb589367a4f6d393917c3945fa9ee85898f9931c75d7cd7697c`. Other original clauses remain in force.

It addresses F9/F10 in `docs/work/0_first-50-campaign/reviews/12_design.md`, read at SHA-256 `de073b87ba69e72a8e876fe64d1d1d1524cd326e0aebfa1240748cf48ca502b5`. The scope remains eight upright synthetic images and five proposed source files. No implementation, image creation/read, runtime import or execution occurred. Mathematical and implementation obligations below are requirements, not completed proofs. The rotated campaign subject remains excluded.

## F10 replacement: observed-vertex coordinates

Remove `tx,ty` from the identified-camera interval tuple; it contains only `(s,c,t,q,k)`. For each supported physical correspondence, fix a local physical origin at an actually observed platform-top vertex and retain that vertex's raw support IDs and image uncertainty box. A deterministic image-coordinate/support-ID ordering may choose the anchor solely as a coordinate gauge. It may not select a camera, physical owner or axis direction. An occluded vertex reconstructed from other edges is not an observed anchor.

Set the anchor's local coordinate to `(0,0,0)`. Preserve every unresolved x/z assignment and directed sign; a positive coordinate direction need not point into the platform. If a diagnostic projection needs translation, name it `translationRelativeToObservedVertex` and set it to the observed anchor box. It is not an identified canonical-document translation. Changes between observed anchors are gauge-equivalent only with the explicit coordinate conversion; they do not quotient physical ownership or axis alternatives. A0/A1 report no platform anchor.

For the independently audited P0, the minimum image-x vertex is `(140,152)`. In the audit's original axis directions, the local platform occupies `x in [0,80], z in [-20,0]`, top `y=0`, and stud bases are `(10+20*i,0,-10)`. Its illustrative relative translation is `(140,152)`. These audit coordinates are not supplied labels to the extractor.

## Fixed sampling, support and occlusion clauses

Freeze pixel-center sampling at `(i+1/2,j+1/2)`, alpha 255, no antialiasing and zero ink width. Use exact rational polygon/conic tests and physical frontmost visibility. A pixel exactly on a shared boundary uses a frozen tie convention after visibility. A later-emitted line may not cross an occluder.

Freeze the palette: background `(240,240,240)`, platform top `(48,48,48)`, platform sides `(48,176,48)` and `(48,48,176)`, cap `(176,48,48)`, wall `(176,176,48)`, P2 foreground `(48,176,176)`. Distinct entries differ by more than 64 in at least one channel. Palette-role labels belong only to fixture authoring. P1 inverts final decoded RGB bytes and leaves alpha unchanged.

One neighboring pixel pair has one support identity with seven threshold-membership bits. The physical graph is the union of the seven nested graphs, equivalently level zero. Higher levels provide provenance/diagnostics, not repeated physical samples, votes or a best-threshold selection. P1 must preserve support IDs, memberships and incidence; its side RGB values invert, so whole raw records are not byte-identical.

The matching envelope is fixed at a Chebyshev radius of 2 pixels around original support. This is an experimental sampling envelope for the eight analytic observations, not a production tolerance. Before P0/P1/P2 can pass, independent fixture/support review must prove both directions: assigned raw samples are within 2 pixels of the physical boundary, and every boundary portion claimed fully observed has raw support within 2 pixels. Full cap extrema and platform vertices used below require this bound separately. Missing/merged extrema or junctions fail that prerequisite; they are not repaired or supplied from truth. No envelope enlargement or faceting term is allowed after results.

Freeze P2's opaque foreground polygon to `(174,108),(216,108),(216,122),(188,122),(188,146),(174,146)`, in front of the subject. It removes part of the first cap's upper/left arc and its left generator. The other three studs and four outer platform vertices remain its positive population. Occluder edges cannot serve as stud/platform calibration edges.

The reviewed coordinates place the rear platform edge on `v-0.45*u-14=0`. Every cap center has functional value 21.5 and ellipse support radius 22.5, so it crosses that edge by 1 pixel in the unnormalized functional. The fixture must clip platform-edge portions hidden by the cap/stud according to frontmost visibility. It must not draw an uninterrupted line through the cap or simply delete the cap arc. Independent coordinate/visibility review and separate native image inspection must check all four crossings. An incorrect painter is a failed positive fixture.

## F9 replacement: concrete nonvacuity

For P0/P1/P2, require the following fixed set-containment predicate in addition to safe pruning. P2 must use a remaining fully supported stud. The numerical bounds are derived before pixels exist from the declared two-pixel observation envelope and the reviewed subject dimensions; the extractor receives neither this camera witness nor expected labels.

A physical extremum/vertex is at most 2 pixels from its raw support. A candidate matching that support within 2 pixels can therefore differ from its audited position by at most 4 pixels per coordinate. A full rim with audited semiaxes 30 and 18 consequently gives:

```text
a in [26,34], b in [14,22]
s = a/6 in [13/3,17/3]
abs(q) = b/a in [7/17,11/13]
```

Replace `abs(q)` by positive `q` only after supported cap/wall/base/platform incidence independently excludes negative elevation. A positive case name cannot do that. Two candidate vertices can differ from the audit by 4 pixels each, so their edge displacement differs by at most 8. The physical 80-LDU and 20-LDU edges have audited horizontal magnitudes 320 and 60, giving candidate magnitudes `[312,328]` and `[52,68]`. Therefore:

```text
long direction assigned to x:
  abs(t/c) = 4*abs(shortEdgeU)/abs(longEdgeU) in [26/41,34/39]
exchanged x/z assignment:
  abs(t/c) in [39/34,41/26]
```

**Unresolved yaw prerequisite:** the two-pixel boundary envelope does not establish a two-pixel coordinate box for an inferred vertex. Even with the fixed audit slopes 0.45 and -0.8, two Chebyshev-radius-2 line bands permit horizontal intersection error up to `(2*(1+0.45)+2*(1+0.8))/(0.45+0.8) = 5.2` pixels in one stage. The proposed plus/minus-eight edge-component bounds and yaw bands above therefore remain conditional on a separate direct per-vertex coordinate-localization proof at both stages. That proof has not been completed. These yaw numbers are a reviewable proposed acceptance clause, not an admitted inference from the boundary envelope. Focused review must either establish that direct vertex-support premise for the fixed raster or replace this clause with a justified looser bound before implementation/execution. The scale/elevation and no-false-prune clauses do not remove this missing yaw premise.

The inverse derives its constraints from actual observed support and declared dimensions. A correspondence assigning physical dimensions to different observed edges remains in the initial roster until a valid constraint rejects it. The separate evaluator uses the audited enclosing numbers to check nonvacuity; it does not feed them to extraction.

Every returned identified-camera box for these three inputs must lie entirely within `s in [13/3,17/3]`, positive `q in [7/17,11/13]`, and its applicable ratio band. Preserve the signed quadrant copies of every surviving axis correspondence. Split boxes crossing a band boundary or report incomplete; merely appending an equation to a whole-quadrant box does not pass. Independent exact-rational checks verify these containments. At least one independently feasible point is required per claimed supported branch, and empty output fails.

The fixed q-width is `96/221`; the long-x ratio width is `380/1599`. An almost unchanged quadrant or a positive-elevation interval almost spanning zero to one fails explicitly. These necessary bounds do not certify that every enclosed tuple is feasible. They establish bounded positive contraction; the separate obligations below establish conservativeness. An unsupported bound makes the experiment incomplete rather than triggering a fitted cutoff or production tolerance change.

## F9 replacement: no false pruning and complete alternatives

The target feasible set is defined by the frozen physical-incidence, visibility and boundary-support model for the observed graph. It does not include arbitrary textured scenes or assert pixel equality under an unspecified renderer. The flat-texture impossibility witness remains in force.

Require a complete partition record for each discrete correspondence: initial domain, every split, retained leaves and pruned leaves. Children must cover their parent exactly. Each deleted leaf names a constraint and an exact rational interval certificate that proves impossibility over the whole cell. Unproved cells remain or make the result incomplete. Starting-domain restrictions themselves require containment proofs from the observed support; a box around the known answer is forbidden. An exception, divide-through-zero or work limit cannot serve as an infeasibility certificate.

An independently authored checker, within the proposed `run.mjs`, must verify root coverage, every split and every exclusion without importing `interval.mjs` or calling the contractor/pruning predicates. It may share the declarative equations and raw support that define the problem. Its integer numerator/denominator checks independently evaluate exclusion certificates. Source/algebra review must establish enclosure laws for each permitted arithmetic operation/predicate and the induction from covered roots to retained leaves. Finite reference tests alone do not prove those laws. This checker and its proof remain implementation prerequisites, not completed work or a demand to build a general proof framework.

Independently enumerate the complete discrete population from the actual graph and fixed grammar: every admissible cap-cycle/wall/base/supporting-face map, compatible row assignment, both x/z assignments and all directed signs. Compare that independently traversed roster of canonical raw-support/role maps with the contractor's initial roster. Do not trust the contractor's count or supply fixture stud indices. Quotient only chain reversal, cycle starting point, graph-ID renaming, angle periodicity and the explicit local-origin gauge. No physical owner, axis/sign branch, occlusion explanation or camera interval disappears by similarity. Further whole-subject symmetry quotienting is excluded from this increment. If complete enumeration exceeds 256 correspondences or partition checking exceeds the existing limits, report incomplete without truncation.

## Fixed falsifying mutants and second point

Apply these behavior/certificate mutants without adding images:

1. Return a near-full quadrant with `q in [1/1000,999/1000]` containing the primary witness. Fixed nonvacuity must fail.
2. Correctly refuse N0/N1/N2 but return broad positive regions. Positive acceptance still fails; negative success cannot satisfy a shared flag.
3. Keep the primary witness but prune to `q <= 3/5`. The exact second feasible point below and complete partition checks must detect the loss.
4. Remove an independently enumerated feasible axis/sign correspondence while keeping the primary witness. Roster and root/leaf accounting must fail.
5. Alter one bound or inequality so a feasible cell is declared impossible. The independent certificate checker must reject the exclusion.

Preregister the second point with the same vertex gauge, `s=5,c=4/5,t=3/5`, and half-angle parameter `r=10001/30000`:

```text
q2 = 600060000/1000020001 > 3/5
k2 = 799979999/1000020001
q2*q2 + k2*k2 = 1
```

For the bounded local subject, `abs(x)<=80, abs(z)<=20, abs(y)<=8`. The vertical-projection change is at most `5*(64*abs(q2-3/5)+8*abs(k2-4/5)) < 1/50` pixel; horizontal projection and the observed anchor are unchanged. This is small compared with the frozen support envelope but is not itself a full feasibility proof. The independent checker must establish all raw-support, full-coverage and visibility constraints for this exact point on P0/P1, especially the near-tangent rear-edge crossings. If it fails, the prescribed mutant test and experiment acceptance remain incomplete; selecting another point after results requires a reviewed successor. Finite points test the mutant; the independent containment/partition proof separately protects omitted continuous regions.

## Remaining bounded preflight

Keep eight images, five files, one headless Node process, and all original segment/chain/correspondence/subdivision/output/time limits. Add normalized rational numerator/denominator limits of 512 bits, intermediate integers of 1,536 bits, and 48 MiB of accounted live rational/partition payload. Check operand size bounds before multiplication/allocation. Over-limit arithmetic yields `unresolved-arithmetic-budget`, never an empty successful region. Runtime review must separately establish enforcement of the original 256 MiB process target; payload accounting is not an RSS measurement.

Required before execution: focused review of this exact addendum; implementation and independently authored containment checker within the same five-file closure; proof/audit of allowed interval operations, initial domains and graph roster; fixture/raster/visibility and support-envelope checks; actual Node loader-metadata closure and source hashes; admission of the one synthetic execution. New source hashes remain absent and `executionReady` remains false. The future case-set name is `inverse-boundary-graph-synthetic-v2` and its output directory is fresh `run-v2-01`. No original proposal/closure, PNG, code or canonical document is changed. No native or rotated qualification is requested.
