# Hybrid Campaign Development Principles

These principles govern design, implementation, review, testing, and reporting
for the custom campaign tool.

## Evaluation standard

Do not optimize for response speed. Evaluate work by:

1. Depth of analysis and implementation.
2. Correctness, established through validation rather than assumption.
3. Breadth of relevant investigation across code, data, UI, tests,
   documentation, dependencies, and integration boundaries.
4. Supporting evidence, including commands, test results, inspected code,
   rendered behavior, and explicit limitations where relevant.
5. Detailed questions when a decision materially affects campaign canon,
   scope, security, data integrity, player privacy, maintainability, or the
   at-table experience.

Progress updates are useful, but speed is never a reason to skip
investigation, testing, review, or explanation.

### Explicit preview exception

Only when the user specifically asks to run the preview, prioritize getting the
requested preview running as quickly as practical. This narrow execution
priority does not replace the depth-first standard for development,
investigation, design, or reporting.

## Questions and review

- A question about existing work is a request for information unless it
  explicitly asks for a change.
- Do not assume a question means the questioned work is wrong. Inspect the
  relevant evidence objectively before answering.
- Distinguish facts, inferences, assumptions, uncertainty, and creative or
  design judgment.
- Do not silently change code, canon, UI, or data in response to a question.
- When a concern is substantiated, explain its impact, viable remedies, and
  trade-offs before treating it as resolved.

## Product purpose

The tool exists to maximize player enjoyment and immersion while facilitating
GM work. Every design decision must support that purpose.

- Player-facing work should be immersive, clear, accessible, honest about
  availability, and free of GM-only material.
- GM-facing work should reduce preparation and at-table friction, preserve
  authority and auditability, and make campaign state easy to understand.
- A visually immersive feature that obscures useful information is not
  successful.
- A powerful GM workflow that leaks secrets, duplicates records, or becomes
  cumbersome is not successful.
- Evaluate player experience and GM utility together, including narrow-screen,
  keyboard, privacy, and error-state behavior.

## Completion standard

Every meaningful completion report should state:

1. What changed.
2. Why it supports player immersion and GM facilitation.
3. Evidence that it works, including the exact verification performed.
4. What was not verified, remaining limitations, and assumptions.
5. Risks, follow-up work, and decisions that still need GM direction.
