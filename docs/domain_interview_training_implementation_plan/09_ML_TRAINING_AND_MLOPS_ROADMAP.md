# 09 — ML Training and MLOps Roadmap

## Stage 0 — Reliable baseline
Versioned graph, curated question bank, node-constrained generation, structured rubric judge, deterministic transitions, approved knowledge retrieval, gold evaluation suite.

## Stage 1 — Retrieval
Curate approved corpus, chunk with provenance, evaluate embeddings and retrieval ranking, add reranking only if measured improvement exists, monitor stale/conflicting content.

## Stage 2 — Judge calibration
Compare judge with reviewer-approved gold data. Analyze disagreements by competency, domain, language, and response type. Improve rubric clarity before fine-tuning. Calibrate confidence and abstention.

## Stage 3 — Optional fine-tuning
Proceed only if a stable task exists, dataset is large/diverse/licensed/reviewed, baseline reveals a measurable gap, model license permits use, compute is available, and rollback is designed.

Potential tasks: structured criterion classification, evidence extraction, response categorization, domain-specific question formatting. Do not train a foundation model from scratch by default. Synthetic-only labels are insufficient as the sole gold source.

## Model registry
Track base model/license, artifact checksum, training dataset version, training code/config, hyperparameters, evaluation results, approval, deployment version, rollback target.

## Monitoring
Judge-human disagreement, score drift, unsupported evidence, duplicate questions, coverage gaps, retrieval relevance, latency/errors, cost/compute, and fairness indicators subject to privacy/legal review.

Roll back model, prompt, embedding, and blueprint versions independently.
