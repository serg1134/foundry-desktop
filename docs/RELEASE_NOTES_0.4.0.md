# Foundry Desktop 0.4.0

Foundry 0.4.0 makes the build loop visible, controllable, and visually self-correcting.

## Highlights

- Live Plan, Explore, Build, Verify, and Repair timeline backed by real agent events
- Screenshot-aware quality review with one bounded visual repair pass
- Select Element mode for contextual preview change requests
- Stop control with safe rollback for active builds
- Undo and Accept controls for completed AI builds
- Persistent file-level build details and verification evidence
- Ten-case desktop benchmark baseline at 100% before this milestone

## Upgrade notes

Visual review adds one image-capable OpenAI request to a successful build. A visual repair uses additional requests only when the review identifies a blocking layout problem. Projects and screenshots remain local except for the screenshot sent directly to OpenAI for this review.
