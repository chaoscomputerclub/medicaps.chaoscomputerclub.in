# Chaos Computer Club — Medi-Caps Chapter
# Root Makefile for local verification and regression pipeline

.PHONY: help regression verify typecheck build lint

help:
	@echo "Chaos Computer Club — Verification & Quality Commands:"
	@echo "  make regression  Run all historical invariant regression tests"
	@echo "  make verify      Run full validation (typecheck, build, regression)"
	@echo "  make report      Generate regression intelligence report artifacts"

regression:
	python3 scripts/regression/select_tests.py --all --run

verify:
	npx tsc --noEmit
	npm run build
	python3 scripts/regression/select_tests.py --all --run

report:
	python3 scripts/regression/generate_report.py
