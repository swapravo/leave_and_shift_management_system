# Leave & Shift Management System — Design Docs

Design documents written **before implementation**. They are the source of truth for the build;
if code and docs disagree, fix one of them deliberately.

| # | Document | What it answers |
|---|----------|-----------------|
| 0 | [Feature plan & decisions](00-feature-plan.md) | What we build, every confirmed decision, open questions |
| 1 | [High-level design](01-high-level-design.md) | Technical overview of the whole system |
| 2 | [Low-level design](02-low-level-design.md) | Component breakdown and per-feature rules, algorithms, state machines |
| 3 | [Technical requirements](03-technical-requirements.md) | Stack, versions, DB, async model, auth, testing, config |
| 4 | [Architecture](04-architecture.md) | Diagrams: context, containers, components, key sequences, deployment |
| 5 | [Data model](05-data-model.md) | Tables, columns, constraints, ER diagram, state machines |
| 6 | [API contract](openapi.yaml) | OpenAPI 3.1 spec for every endpoint |

Source requirement: *Leave & Shift Management System — Business Requirement Document* (Swapravo Sinha Roy).

## Diagrams
Diagrams are PNG images in [`diagrams/`](diagrams/), embedded in the docs so they display anywhere (GitHub's
built-in Mermaid rendering wasn't displaying them). Each image has its [Mermaid](https://mermaid.js.org/) source
in a collapsible **Diagram source (Mermaid)** section directly below it — that source is the source of truth.

To change a diagram, edit its source in the doc, then regenerate all images (needs Node.js and Chromium):

```bash
python docs/diagrams/render.py                      # or add: --puppeteer-config pp.json
```
