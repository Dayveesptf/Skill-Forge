# SkillForge — Architecture Notes

This file exists so that nobody — including future-you — mistakes intentional
design for accidental duplication. Read this before restructuring the
assessment-related modules.

## Dual assessment systems

SkillForge contains **two complementary assessment systems**. They look similar
by name, and it is easy to assume one is leftover/duplicate code. It isn't —
they capture different kinds of evidence and are deliberately combined in
reporting.

### 1. Self-Assessment system (`SelfAssessment*`)

- Models: `SelfAssessment`, `SelfAssessmentResponse`, `SelfAssessmentResult`
- Modules: `modules/selfAssessments`, `modules/selfAssessmentCampaigns`,
  `modules/managerCorroboration`
- **What it captures:** an employee's *self-reported* competency level against
  a Role Profile, with free-text evidence and a confidence rating, optionally
  corroborated (confirmed or adjusted) by their manager.
- **This is the core workflow described in the product requirements** —
  Assessment Campaign → Assignment → Self-Assessment → Corroboration →
  Scoring → Gap Analysis.

### 2. Assessment / Quiz system (`Assessment*`)

- Models: `Assessment`, `AssessmentQuestion`, `AssessmentSection`,
  `AssessmentAttempt`, `AssessmentResponse`, `AssessmentEvaluation`,
  `AssessmentScore`, `AssessmentAssignment`
- Modules: `modules/assessments`, `modules/assessmentAttempts`,
  `modules/scoring` (quiz-scoring half)
- **What it captures:** an *objective, question-based* evaluation — scored
  multiple-choice/graded questions, sections, timed attempts, correctness —
  optionally generated with AI assistance (`modules/ai`).

### Why both exist

A self-report is useful but unverified. An objective quiz score is verified
but narrower. `gapAnalysis.service.ts` and `reports.service.ts` deliberately
read from **both** and compute:

```
selfAssessmentLevel   (from SelfAssessmentResponse)
        vs.
objectiveLevel        (from AssessmentEvaluation)
        ↓
selfVsObjectiveGap    (flags OVER_SELF_ASSESSED / UNDER_SELF_ASSESSED /
                        CORROBORATED / NO_OBJECTIVE_EVIDENCE)
```

This is the intended design: the self-assessment is the primary workflow,
and an objective quiz score — where one exists for a candidate — is used as
a cross-check, not a replacement.

### What this means in practice

- **Do not delete or merge these systems** without tracing every call site in
  `gapAnalysis.service.ts` and `reports.service.ts` first — both are
  load-bearing consumers of `AssessmentEvaluation`.
- If you extend one system, check whether the other needs an equivalent
  change (e.g. a new evidence type should probably exist on both, or a
  documented reason why not).
- New code should refer to competency evidence as either "self-assessed" or
  "objective/quiz-assessed" — never just "the assessment," which is now
  ambiguous between the two systems.

## Career paths

`CareerPath` is implemented as a **point-to-point delta** between two
specific Role Profiles (per-skill `ADDED` / `INCREASED` / `UNCHANGED` /
`DECREASED` / `REMOVED`), computed on demand — not as a curated, ordered
progression graph (e.g. Junior → Mid → Senior → Lead). If the product needs
an actual multi-step progression UI, that would be built as an ordered
sequence of existing `CareerPath` delta records rather than a model change.

## Evidence attachments

`SelfAssessmentResponse.attachments` stores file evidence (documents,
screenshots, etc.) supporting a claimed competency level, uploaded via
presigned URLs directly to object storage (see `config/storage.ts` and
`modules/evidence`). Only the object key and metadata are stored in MongoDB;
the file itself never passes through the Node process.