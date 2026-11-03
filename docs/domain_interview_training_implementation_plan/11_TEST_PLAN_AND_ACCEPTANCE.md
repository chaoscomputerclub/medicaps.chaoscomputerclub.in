# 11 — Test Plan and Acceptance

## Dynamic catalog
A valid active domain with a published blueprint appears without frontend code change. Unpublished/inactive domains stay hidden. Unknown icons use safe fallback.

## Blueprint
Published blueprint has competencies, concepts, graph, rubrics, question policies, and completion policy. Validator catches broken edges, dead ends, unbounded cycles, unreachable required nodes, missing rubrics/fallbacks, and competency gaps. Published versions are immutable and sessions stay pinned.

## Preparation and data
Generated artifacts are marked draft with provenance. Duplicate/coverage checks run. Gold set is locked and excluded from training. Agent-only labels are not called human gold. Publish blocked on mandatory failures.

## Judge
Output schema valid; evidence grounded in response; alternatives accepted; resume claims not scored as demonstrated ability; prompt injection cannot alter rubric; ambiguity can trigger clarification; judge-human agreement measured on holdout.

## No candidate key
Candidate completes interview without entering credentials. Runtime uses configured server-side or self-hosted inference. No secret in browser traffic, bundle, or logs. Fallback works during provider outage.

## End-to-end release gate
Admin creates domain → authors curriculum/graph → generates and validates dataset → approves/publishes → catalog displays domain → candidate starts → judge evaluates → graph transitions within allowed nodes → report is produced with full version provenance.

Profile the actual deployment before committing latency/concurrency targets.
