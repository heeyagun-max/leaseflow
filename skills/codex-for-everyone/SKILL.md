---
name: codex-for-everyone
description: Turn a person's lived work, raw documents, screenshots, corrections, and natural-language feedback into a testable workflow product with Codex. Use when a domain expert wants to remove recurring bottlenecks without first translating the job into software terminology, especially for workflow discovery, information architecture, governed automation, prototype building, real-user testing, and evidence-backed iteration.
---

# Codex for Everyone

Convert real work into a small, usable, verifiable system. Start from the person's job and artifacts, not from a technology stack.

## Operating loop

1. **Collect evidence**
   - Ask for the documents, screenshots, messages, forms, and outputs already used in the job.
   - Identify the real user, the person who approves the work, and the person affected by errors.
   - Treat files and observed behavior as stronger evidence than feature guesses.

2. **Reconstruct the work**
   - Map the trigger, inputs, decisions, handoffs, outputs, exceptions, and repeat frequency.
   - Name the bottleneck in the user's language.
   - Separate information the user needs from internal implementation details the interface should hide.

3. **Define authority before automation**
   - Mark which source is authoritative, what AI may only propose, what code must enforce, and who must approve.
   - Preserve provenance, versions, and reversibility when an incorrect action would matter.
   - Never convert an inferred rule into product behavior when it changes authority, external communication, money, access, or official data. Ask one short question instead.

4. **Shape one end-to-end slice**
   - Design the smallest path that starts with a real input and ends with a useful output.
   - Define the information architecture around user goals and next actions, not around database or program concepts.
   - State observable acceptance criteria before implementation.

5. **Build and expose the artifact**
   - Reuse the user's vocabulary in menus, titles, status labels, and actions.
   - Keep explanations out of the primary interface when one use teaches the interaction.
   - Make uncertain, pending, blocked, approved, and completed states visibly different.

6. **Test with the real user**
   - Exercise the actual path with representative files or safe synthetic equivalents.
   - Capture each complaint as one of: missing information, wrong hierarchy, unnecessary step, unclear authority, stale data, or failed action.
   - Fix the workflow, rerun it, and keep concrete evidence such as screenshots, test output, or before/after data.

7. **Package the learning**
   - Produce a concise workflow map, authority map, implemented path, test evidence, limitations, and next decision.
   - Explain impact as time, errors, handoffs, or uncertainty removed.
   - Distinguish what was observed working from what is only planned.

## Default deliverables

Return only the artifacts needed for the current stage:

- **Workflow contract:** user, trigger, input, bottleneck, decisions, output, owner.
- **Authority contract:** source of truth, AI proposal, deterministic rule, human approval.
- **Product slice:** screens or commands, data fields, states, and next actions.
- **Acceptance path:** a short real-user scenario with pass/fail outcomes.
- **Evidence note:** what was tested, what changed, and what remains unverified.

## Collaboration rules

- Use plain language and mirror the user's domain vocabulary.
- Do not expose program names, lifecycle codes, schemas, or implementation explanations in user-facing UI unless the user needs them to act.
- Ask when a missing answer changes the workflow's purpose or authority. Otherwise make the smallest reversible assumption and continue.
- Prefer one working vertical path over a broad static mockup.
- Do not claim an integration, model call, delivery, or deployment that was not observed.
- Preserve earlier artifacts and decisions unless the user explicitly replaces them.

## Completion test

Stop only when a real user can follow the target path, the output reflects the latest accepted information, consequential actions have the intended approval boundary, and the result is supported by fresh evidence.
