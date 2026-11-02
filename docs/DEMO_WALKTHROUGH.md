# Demo from a clean start

The fictional problem: Alex, the engineer who maintains Northstar Digital's
backups, releases and infrastructure, is leaving. The team has a handover pack,
but reading a document is not the same as being able to run the operation.
Continuity helps expose the responsibilities, missing instructions and work
that needs human review.

## Start the presentation

1. Open `http://localhost:8080/workspace`. Refresh any tabs left open before
   the reset. Keep your existing sign-in; there is no need to show the IDE.
2. Click **Load demo workspace**. This creates the fictional team and systems
   only. It does not load runbooks, findings, tasks, or successful test results.
   Alex's departure is set one week from when this button is clicked.
3. Open **Documents** and upload
   `output/pdf/Northstar-Digital-Operations-Handover.pdf` using the upload control.
   Do not load the separate sample documents. The PDF has three readable pages
   and has been checked with the app's actual PDF extractor.
4. Open the source and briefly show that it is the same document you uploaded.

## Ask the Analyst

Use the document's Extract knowledge control first, or ask:

> Extract the responsibilities documented in this handover pack. Save them as
> candidate claims with exact supporting passages. Do not confirm them for me.

Show the review controls and the knowledge map. A reviewer can confirm an
explicit responsibility against its source; reading the runbook does not
establish recovery readiness.

Then, with the uploaded document selected, ask:

> Assess this handover pack for gaps that could matter when Alex leaves. Save
> proposed findings with supporting source passages, explain what remains
> uncertain, and suggest follow-up actions. Do not resolve or accept findings.

Possible findings include an unspecified backup location, vague checksum and
recovery checks, missing alert recipient details, an unclear rollback procedure,
and unapproved replacement ownership. These are prompts for review, not a
guaranteed model output or proof that other documentation does not exist.

Open **Departure handover**, select relevant findings and use its draft control,
or ask:

> Draft a handover plan for Alex from the saved unresolved findings. Save the
> proposed tasks for review. Do not approve assignments or invent commitments.

Show the suggested tasks. Review proposed owners and dates; make an explicit
approval only if you want it to be part of this fictional demo.

## Close with the distinction that matters

Open **Verification** to explain how an engineer would record what happened in
an independent test. The PDF contains numbered procedure instructions. Do not
claim that an actual restoration ran or mark it successful during this demo.

Finish at **Overview**: show the open risks and remaining handover work. Explain
that tasks being complete would still not prove a procedure passed a test.
