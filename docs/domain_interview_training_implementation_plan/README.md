# Domain Interview Training & Implementation Plan

This pack specifies a database-driven system for admin-authored interview agents across Frontend, Backend, Python, ML, Database, DevOps, System Design, HR, Behavioral, and any future domain added to the database.

## Product rules
- Database records determine which domains and interviews exist. The frontend must not hardcode the catalog.
- Admin/platform owner authors every domain blueprint, curriculum, graph, node instructions, questions, rubrics, and transition policies.
- Candidates only select a published interview, optionally upload a resume, and practice. No custom interview creation.
- Published blueprint versions are immutable. Candidate-specific performance is stored in a separate session state.
- Candidate never supplies an AI provider API key.
- Coding agent assists offline with curriculum authoring, dataset generation, critique, validation, tests, and implementation.
- The deployed application still needs an explicitly supported inference runtime for live question generation and judging. An interactive coding-agent session is not automatically a production API.
- Prompt packs, embeddings, and examples are not foundation-model fine-tuning. Fine-tuning is a separate optional workstream requiring a compatible model, curated data, compute, evaluation, and deployment.

## Files
00 Vision and architecture decisions
01 Database-driven domain catalog
02 Domain curriculum and graph blueprint
03 Pretraining and agent preparation
04 Dataset creation and quality
05 Judge and evaluation framework
06 Runtime inference without candidate keys
07 Admin training workflow
08 Architecture and APIs
09 MLOps and fine-tuning roadmap
10 Security and governance
11 Test plan and acceptance
12 Implementation backlog
13 Coding-agent execution prompt
diagrams/DOMAIN_TRAINING_AND_RUNTIME.md

## Recommended sequence
Repository audit → dynamic catalog → blueprint schema/validator → coding-agent-assisted domain authoring → dataset/evaluation harness → runtime judge and graph executor → optional resume retrieval → MLOps/fine-tuning only if justified.
