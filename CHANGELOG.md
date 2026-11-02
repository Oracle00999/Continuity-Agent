# Changelog

All notable user-facing changes to this app are documented here.

## 2026-10-31

### Added

- Overview landing dashboard with complete workspace aggregates, risk/task queues, latest reported test attempts, ownership candidates, and readable recent activity.
- Departure handover plans draft risk-linked tasks with descriptions, priorities and suggested owners/deadlines. Human approval confirms assignments; suggestions can be edited or removed without changing risk or procedure outcomes.
- Source-linked Risk Register with visible Analyst assessment, severity rationale, uncertainty, test-gap snapshots, and audited human reviews/corrections.
- Interactive Knowledge Map of saved people, systems, procedures and source documents, with person filters, review-status styles, zoom controls and source-linked details.

## 2026-10-30

### Fixed

- Follow-up suggestions hide internal IDs while keeping reference context for the Analyst. Selecting a suggestion immediately returns focus to the message composer to prevent Enter activating another suggestion.

### Added

- Document knowledge extraction with exact source quotes, matched people/systems, reusable processes, and persisted human reviews.
- Handover tasks linked to blocked or unclear procedure steps, with owners, deadlines, progress, and resolution notes. Resolving a task preserves the original test outcome for retesting.

## Inherited starter history

The entries below describe the pre-existing Agent-Native Chat starter.

## 2026-10-10

### Fixed

- Large prompts with full context remain available to retry when sending fails.

## 2026-09-30

### Improved

- Chat uses a compact + menu with context submenus, keeps task, automation, and skill actions at the root, and omits Generate Image.

## 2026-09-27

### Fixed

- Chat retries the original request with its attachments after model setup.

## 2026-08-27

### Fixed

- Chat includes the runtime packages needed for provider keys after deployment.

Continuity feature details are documented in [docs](./docs/GETTING_STARTED.md).
