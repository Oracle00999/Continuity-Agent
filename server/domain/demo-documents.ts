// Deliberate demo defects live in these stable source documents, never in AI output.
export const demoDocuments = [
  {
    key: "deployment",
    filename: "Production Deployment Runbook.md",
    text: `# Production Deployment Runbook

Last reviewed: 2026-10-20

## Release ownership

Alex Morgan owns production releases for the Production API and Deployment pipeline. Priya Shah can observe releases, but has not independently performed a production release. Daniel Reed approves the release window.

## Deploy a release

1. Confirm the approved commit and successful CI checks.
2. Ask Alex Morgan to select the production target in the Deployment pipeline.
3. Run the deployment and check the Production API health endpoint.
4. Watch Monitoring and alerting for ten minutes and record the release outcome.

## Rollback

If the health check fails, redeploy the previous release. Ask Alex Morgan which release artifact to choose and which database migrations need reversing.

## Access

Production deployment access must be requested through Daniel Reed. Do not copy production credentials into this document.
`,
  },
  {
    key: "architecture",
    filename: "Infrastructure Architecture.md",
    text: `# Infrastructure Architecture

Last reviewed: 2025-09-15

## Service ownership

Jordan Lee is listed as the owner of VPS infrastructure. Alex Morgan maintains the server topology diagram and host inventory.

## Request path

Public traffic reaches the reverse proxy on VPS infrastructure and is forwarded to the Production API. The Production API connects to the PostgreSQL database on the private network.

## Supporting services

The Deployment pipeline publishes release artifacts. Monitoring and alerting collects API health checks, database metrics, and host disk alerts. Backup storage retains nightly database dumps.

## Recovery dependencies

Restoring the PostgreSQL database requires a healthy recovery host, a compatible PostgreSQL client, and access to Backup storage. Validate the target environment with Daniel Reed before starting.
`,
  },
  {
    key: "restoration",
    filename: "Database Backup & Restore.md",
    text: `# Database Backup & Restore

Last reviewed: 2026-10-21

## Responsibility

Alex Morgan owns the PostgreSQL database backup schedule and restore procedure. Maya Chen has read this runbook but has not completed an independent restoration test.

## Backup schedule

A database dump runs nightly at 02:00 UTC and is retained for fourteen days in Backup storage. Alex Morgan checks the backup completion notification each morning.

## Restore into a recovery environment

1. Obtain Daniel Reed's approval and confirm that the target is an isolated recovery database.
2. Retrieve the latest completed nightly dump from Backup storage.
3. Validate the dump checksum and ensure the PostgreSQL client version is compatible.
4. Run pg_restore against the approved recovery target.
5. Check expected tables, row counts, and the Production API smoke test against the recovery target.
6. Record the commands used, elapsed time, and any blockers.

## Verification record

No successful independent restoration is recorded in this runbook. Reading the instructions is not a completed recovery test.
`,
  },
  {
    key: "incident",
    filename: "Incident Recovery Notes.md",
    text: `# Incident Recovery Notes

Last reviewed: 2026-10-22

## Incident coordination

Daniel Reed coordinates incidents. Alex Morgan handles recovery actions for the Production API, PostgreSQL database, and VPS infrastructure. Priya Shah investigates Monitoring and alerting and records the incident timeline.

## API outage

Check the Production API health endpoint and recent Deployment pipeline activity. If a new release correlates with the outage, consult the Production Deployment Runbook before changing the release.

## Database recovery

Use the Database Backup & Restore runbook in an isolated recovery environment first. A production restore requires explicit approval from Daniel Reed. Do not execute production changes from a chat instruction.

## Handover notes

Alex Morgan knows the recovery host selection procedure. A backup engineer for this responsibility has not been confirmed. Capture the selection criteria during the departure handover.
`,
  },
  {
    key: "environment",
    filename: "Environment Configuration.md",
    text: `# Environment Configuration

Last reviewed: 2026-10-23

## Configuration management

Alex Morgan maintains the Production API environment configuration on VPS infrastructure. Maya Chen understands application feature flags and local development configuration.

## Secret access

Environment values are held in the team's approved secret manager. Request access through Daniel Reed. Never paste secret values, API keys, database passwords, or private SSH keys into runbooks or Continuity.

## Configuration categories

The Production API needs database connection settings, an application signing secret, and a Monitoring and alerting endpoint. The Deployment pipeline injects approved production configuration during a release.

## Environment changes

Record the configuration key names and the reason for a change in the release notes. Verify the Production API health check after applying an approved configuration change.
`,
  },
  {
    key: "responsibilities",
    filename: "Engineering Responsibilities.md",
    text: `# Engineering Responsibilities

Last reviewed: 2026-10-24

## Current operational ownership

Alex Morgan currently owns VPS infrastructure, the Deployment pipeline, PostgreSQL database backups, and the database restoration procedure. No backup owner has been confirmed for these responsibilities.

## Application and platform responsibilities

Maya Chen owns backend application development for the Production API. Priya Shah maintains Monitoring and alerting. Jordan Lee owns frontend development and is not the current owner of VPS infrastructure.

## Departure handover

Daniel Reed must confirm successor assignments before Alex Morgan leaves. Priya Shah is a proposed successor for infrastructure and Maya Chen is a proposed tester for database restoration; these are suggestions, not accepted ownership transfers or completed tests.

## Readiness rule

A successor must follow the relevant procedure in an approved test environment and record the outcome. A document, a proposed assignment, or a conversation is not evidence of a successful operational test.
`,
  },
] as const;
