# lego

An AI-native digital brick modeling studio for manually building, generating, repairing, and evolving digitally connection- and collision-validated brick assemblies.

Status: design draft; implementation has not started.

## Design

- [Product and architecture specification](docs/design/spec.md)
- [Learning harness and improvement loops](docs/design/learning-system.md)
- [Brick assembly loop skill procedure](docs/skills/brick-assembly-loop.md)

## First vertical slice

The first useful slice is deliberately small: a curated basic-part catalog, a precise manual editor, deterministic connection and collision validation, text-to-model candidate generation, canonical multi-view renders, previewable AI patches, LDraw interchange, and replayable run artifacts.

The app owns brick-specific semantics. The sibling `3d-maker` repository remains a separate procedural-asset evolution studio; the two projects may later share experiment, lineage, and visual-evaluation protocols after real duplicate implementations exist.
