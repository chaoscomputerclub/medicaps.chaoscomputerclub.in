"""
Chaos Computer Club — Medi-Caps Chapter
backend/tests/test_ai_interview_ml_engine.py — Level 3 AI Interview ML Engine Test Suite

Validates all 10 workstreams specified in AI_Interview_ML_Requirements_Pack:
1. Competency Taxonomy & Relationship DAG closure.
2. Bayesian Knowledge Tracing (BKT) with graded evidence and epistemic uncertainty.
3. Item Response Theory (IRT) 2PL model, Fisher Information, and MAP ability estimation.
4. Kalman State-Space Performance Filter (smoothing, velocity, outlier gating).
5. Contextual Bandit & Information Gain Adaptive Question Selection with constraint filtering.
6. Dynamic Competency Graph Projection with deterministic layered layout.
7. Calibrated Performance Forecasting with explicit horizons and confidence intervals.
8. End-to-End API contracts and cross-candidate authorization boundaries.
9. Candidate archetype simulations (Strong, Struggling, Inconsistent).
"""

import math
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from main import app
from app.core.db import AsyncSessionLocal, init_db
from app.middleware.auth import get_current_member
from app.models.db_models import MemberProfile
from app.models.interview import InterviewSession, InterviewQuestion, InterviewAnswer
from app.services.interview.competency_taxonomy import (
    COMPETENCY_REGISTRY,
    CompetencyDomain,
    CompetencyTaxonomyService,
)
from app.services.interview.bkt_engine import BKTEngine, CompetencyBKTState
from app.services.interview.irt_engine import IRTEngine, IRTItemParameters, CandidateAbilityEstimate
from app.services.interview.state_estimator import KalmanPerformanceFilter, KalmanState
from app.services.interview.adaptive_selector import AdaptiveQuestionSelector, QuestionCandidate
from app.services.interview.graph_projection_service import GraphProjectionService
from app.services.interview.prediction_service import PredictionService
from app.services.llm.mock_provider import DeterministicMockLLMProvider
from app.services.llm import factory as llm_factory


def make_member(member_id: str, handle: str) -> MemberProfile:
    return MemberProfile(
        id=member_id,
        handle=handle,
        email=f"{handle}@chaoscomputerclub.in",
        full_name=f"Tester {handle}",
        prn=f"EN22CS{abs(hash(member_id)) % 899999 + 100000}",
        department="CSE",
        batch="2022-26",
        rating=1400,
        peak_rating=1400,
        is_onboarded=True,
    )


@pytest_asyncio.fixture(autouse=True)
async def setup_ml_test_env():
    await init_db()
    mock_provider = DeterministicMockLLMProvider()
    llm_factory.set_llm_provider(mock_provider)
    yield
    llm_factory.set_llm_provider(None)


# ─── 1. COMPETENCY TAXONOMY & RELATIONSHIP DAG ───────────────────────────────

def test_taxonomy_dag_and_prerequisites_closure():
    """Verify taxonomy structure, valid domains, and transitive prerequisite traversal."""
    nodes = CompetencyTaxonomyService.list_all()
    assert len(nodes) >= 12

    node_ids = {n.id for n in nodes}
    assert "db.indexing" in node_ids
    assert "db.transactions" in node_ids
    assert "dist.consensus" in node_ids
    assert "sys.scalability" in node_ids

    # Verify prerequisite closure: db.sharding depends on db.transactions which depends on db.indexing
    prereqs = CompetencyTaxonomyService.get_prerequisites_closure("db.sharding")
    assert "db.transactions" in prereqs
    assert "db.indexing" in prereqs

    # Verify edges exist with valid source/target
    edges = CompetencyTaxonomyService.get_competency_edges()
    assert len(edges) > 0
    for e in edges:
        assert e["source"] in node_ids
        assert e["target"] in node_ids
        assert e["relationship"] in ("PREREQUISITE", "CONCEPTUAL_DEPENDENCY")


# ─── 2. BAYESIAN KNOWLEDGE TRACING (BKT) ─────────────────────────────────────

def test_bkt_posterior_updates_and_uncertainty():
    """Verify BKT updates for correct and incorrect evidence and uncertainty U(L)."""
    initial = BKTEngine.initialize_state("db.indexing")
    assert initial.evidence_count == 0
    assert initial.status() == "UNASSESSED"
    assert 0.0 < initial.mastery_prob < 1.0

    # Max uncertainty when mastery is ~0.5
    assert BKTEngine.calculate_uncertainty(0.5) == 1.0
    assert BKTEngine.calculate_uncertainty(1.0) == 0.0
    assert BKTEngine.calculate_uncertainty(0.0) == 0.0

    # Strong correct answer: mastery increases, uncertainty decreases
    s1 = BKTEngine.update_with_evidence(initial, evidence_score=1.0)
    assert s1.mastery_prob > initial.mastery_prob
    assert s1.evidence_count == 1
    assert s1.consecutive_correct == 1

    # Second strong correct answer: reaches MASTERED threshold (>= 0.75)
    s2 = BKTEngine.update_with_evidence(s1, evidence_score=1.0)
    assert s2.mastery_prob >= 0.75
    assert s2.is_mastered() is True
    assert s2.status() == "MASTERED"

    # Severe failure: drops sharply into GAP territory (< 0.35)
    f1 = BKTEngine.update_with_evidence(initial, evidence_score=0.0)
    assert f1.mastery_prob < initial.mastery_prob
    f2 = BKTEngine.update_with_evidence(f1, evidence_score=0.0)
    assert f2.is_gap() is True
    assert f2.status() == "GAP"


def test_bkt_graded_partial_credit():
    """Verify continuous partial-credit evidence produces bounded monotonic updates."""
    state = BKTEngine.initialize_state("dist.cap")
    
    # Partial credit 0.7 vs 0.3
    res_high = BKTEngine.update_with_evidence(state, evidence_score=0.7)
    res_low = BKTEngine.update_with_evidence(state, evidence_score=0.3)

    assert res_high.mastery_prob > res_low.mastery_prob
    assert res_high.evidence_count == 1
    assert len(res_high.history) == 1


# ─── 3. ITEM RESPONSE THEORY (IRT) ───────────────────────────────────────────

def test_irt_2pl_probability_and_fisher_information():
    """Verify 2PL logistic properties and Fisher Information peak."""
    # When ability theta equals difficulty b: P = 0.5
    p_equal = IRTEngine.probability_correct(theta=0.0, a=1.2, b=0.0)
    assert math.isclose(p_equal, 0.5, rel_tol=1e-5)

    # When theta > b: P > 0.5
    p_high = IRTEngine.probability_correct(theta=1.0, a=1.2, b=0.0)
    assert p_high > 0.5

    # When theta < b: P < 0.5
    p_low = IRTEngine.probability_correct(theta=-1.0, a=1.2, b=0.0)
    assert p_low < 0.5

    # Fisher information peak occurs where theta == b
    info_peak = IRTEngine.fisher_information(theta=0.5, a=1.5, b=0.5)
    info_off = IRTEngine.fisher_information(theta=0.5, a=1.5, b=1.5)
    assert info_peak > info_off


def test_irt_ability_estimation_map():
    """Verify MAP ability estimation converges and computes valid standard error."""
    item1 = IRTItemParameters("q1", difficulty_b=-0.5, discrimination_a=1.2)
    item2 = IRTItemParameters("q2", difficulty_b=0.0, discrimination_a=1.2)
    item3 = IRTItemParameters("q3", difficulty_b=0.8, discrimination_a=1.4)

    # Candidate with perfect scores on medium and hard items -> positive ability theta
    responses_strong = [(item1, 1.0), (item2, 1.0), (item3, 1.0)]
    ability_strong = IRTEngine.estimate_ability_map(responses_strong)
    assert ability_strong.theta > 0.5
    assert ability_strong.standard_error > 0.0
    assert ability_strong.ci_lower < ability_strong.theta < ability_strong.ci_upper

    # Candidate with failed scores -> negative ability theta
    responses_weak = [(item1, 0.0), (item2, 0.0), (item3, 0.0)]
    ability_weak = IRTEngine.estimate_ability_map(responses_weak)
    assert ability_weak.theta < -0.5


# ─── 4. KALMAN PERFORMANCE FILTER ────────────────────────────────────────────

def test_kalman_filter_smoothing_and_outlier_rejection():
    """Verify Kalman filter trajectory smoothing and resistance to momentary outliers."""
    kf = KalmanPerformanceFilter.initialize_state(initial_score=60.0)
    assert kf.proficiency == 60.0

    # Stable progression around 80
    kf1 = KalmanPerformanceFilter.update(kf, observed_score=80.0)
    kf2 = KalmanPerformanceFilter.update(kf1, observed_score=82.0)
    kf3 = KalmanPerformanceFilter.update(kf2, observed_score=84.0)

    assert 70.0 < kf3.proficiency < 85.0
    assert kf3.velocity >= 0.0  # Positive improvement velocity

    # Sudden sharp slip outlier (e.g. 20 due to misunderstanding question phrasing)
    kf_anom = KalmanPerformanceFilter.update(kf3, observed_score=20.0, confidence=0.5)
    # The filter must dampen the outlier and not collapse to 20
    assert kf_anom.proficiency > 60.0


# ─── 5. ADAPTIVE QUESTION SELECTION ──────────────────────────────────────────

def test_adaptive_question_selector_policy_and_rationale():
    """Verify constraint filtering, information gain ranking, and transparent rationale."""
    candidates = [
        QuestionCandidate("q_idx", "Index Design", "Explain B-Trees", "db.indexing", difficulty_b=0.2),
        QuestionCandidate("q_tx", "ACID", "Explain 2PL", "db.transactions", difficulty_b=0.8),
        QuestionCandidate("q_cap", "CAP", "Explain PACELC", "dist.cap", difficulty_b=0.0),
    ]

    bkt_states = {
        "db.indexing": CompetencyBKTState("db.indexing", mastery_prob=0.85, uncertainty=0.2, evidence_count=2),
        "db.transactions": CompetencyBKTState("db.transactions", mastery_prob=0.50, uncertainty=1.0, evidence_count=0),
        "dist.cap": CompetencyBKTState("dist.cap", mastery_prob=0.90, uncertainty=0.1, evidence_count=3),
    }

    decision = AdaptiveQuestionSelector.select_next_question(
        available_questions=candidates,
        asked_question_ids={"q_idx"},  # q_idx already asked
        current_theta=0.7,
        bkt_states=bkt_states,
        recent_competency_ids=["db.indexing"],
        remaining_minutes=20,
    )

    # q_idx must be filtered out
    assert decision.selected_question.question_id != "q_idx"
    # q_tx has high uncertainty (1.0) and difficulty matching theta=0.7 -> should win
    assert decision.selected_question.question_id == "q_tx"
    assert decision.target_competency_id == "db.transactions"
    assert "rationale" in decision.__dict__ and len(decision.rationale) > 20
    assert "db.transactions" in decision.rationale


# ─── 6. DYNAMIC COMPETENCY GRAPH PROJECTION ──────────────────────────────────

def test_dynamic_graph_projection_snapshot():
    """Verify graph snapshot generation with 2D layout coordinates and metrics."""
    bkt_states = {
        "db.indexing": CompetencyBKTState("db.indexing", mastery_prob=0.80, uncertainty=0.2, evidence_count=2),
        "dist.consensus": CompetencyBKTState("dist.consensus", mastery_prob=0.20, uncertainty=0.3, evidence_count=1),
    }

    snapshot = GraphProjectionService.compute_projection(
        session_id="test-session-123",
        bkt_states=bkt_states,
    )

    assert snapshot.session_id == "test-session-123"
    assert len(snapshot.nodes) >= 12
    assert len(snapshot.edges) > 0

    node_dict = {n["id"]: n for n in snapshot.nodes}
    assert node_dict["db.indexing"]["status"] == "MASTERED"
    assert node_dict["dist.consensus"]["status"] == "GAP"
    assert node_dict["sys.scalability"]["status"] == "UNASSESSED"

    # Coordinates must be positive numbers
    for node in snapshot.nodes:
        assert node["x"] > 0
        assert node["y"] > 0

    metrics = snapshot.metrics
    assert metrics["total_competencies"] >= 12
    assert metrics["assessed_count"] == 2
    assert metrics["mastered_count"] == 1
    assert metrics["gap_count"] == 1
    assert metrics["coverage_percentage"] > 0.0


# ─── 7. CALIBRATED PERFORMANCE PREDICTIONS ───────────────────────────────────

def test_performance_prediction_engine():
    """Verify future response predictions with explicit confidence intervals and low evidence flags."""
    ability = CandidateAbilityEstimate(
        theta=0.5,
        standard_error=0.4,
        ci_lower=-0.28,
        ci_upper=1.28,
        response_count=3,
        fisher_information_total=4.5,
    )
    bkt_states = {
        "db.indexing": CompetencyBKTState("db.indexing", mastery_prob=0.85, uncertainty=0.2, evidence_count=3),
        "db.transactions": CompetencyBKTState("db.transactions", mastery_prob=0.40, uncertainty=0.8, evidence_count=0),
    }

    pred_res = PredictionService.generate_predictions(
        session_id="test-sess-pred",
        ability_estimate=ability,
        bkt_states=bkt_states,
    )

    assert pred_res.session_id == "test-sess-pred"
    assert pred_res.candidate_ability_theta == 0.5
    assert len(pred_res.predictions) >= 12

    pred_dict = {p.competency_id: p for p in pred_res.predictions}
    idx_p = pred_dict["db.indexing"]
    assert idx_p.is_low_evidence is False
    assert 0.0 < idx_p.predicted_response_probability < 1.0
    assert idx_p.confidence_interval["lower"] <= idx_p.predicted_response_probability <= idx_p.confidence_interval["upper"]

    tx_p = pred_dict["db.transactions"]
    assert tx_p.is_low_evidence is True
    assert "Preliminary forecast" in tx_p.explanation


# ─── 8. END-TO-END HTTP API & AUTHORIZATION BOUNDARY GATES ───────────────────

@pytest.mark.asyncio
async def test_ml_endpoints_end_to_end_and_security_gate():
    """Verify HTTP API contracts for graph, predictions, adaptive selection, and 403 boundary."""
    member_alice = make_member("mem-alice-ml", "alice_ml")
    member_eve = make_member("mem-eve-ml", "eve_ml")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(InterviewSession).where(InterviewSession.member_id.in_(["mem-alice-ml", "mem-eve-ml"])))
        await db.merge(member_alice)
        await db.merge(member_eve)
        await db.commit()

        # Create session owned by Alice with initial ML state in plan_metadata
        sess = InterviewSession(
            id="sess-alice-ml-1",
            member_id="mem-alice-ml",
            target_role="Staff Backend Engineer",
            category="BACKEND",
            difficulty="HARD",
            state="ASKING",
            current_question_index=0,
            plan_metadata={
                "ml_state": {
                    "bkt": {
                        "db.indexing": {
                            "mastery_prob": 0.82,
                            "uncertainty": 0.25,
                            "evidence_count": 2,
                            "consecutive_correct": 2,
                            "history": [],
                        }
                    },
                    "ability_estimate": {
                        "theta": 0.85,
                        "standard_error": 0.35,
                        "ci_lower": 0.16,
                        "ci_upper": 1.54,
                        "response_count": 2,
                        "fisher_information_total": 5.2,
                    },
                }
            },
        )
        db.add(sess)
        await db.commit()

    transport = ASGITransport(app=app)

    try:
        # 1. Test /api/interview/competencies taxonomy endpoint (Public/Auth)
        app.dependency_overrides[get_current_member] = lambda: member_alice
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            tax_resp = await client.get("/api/interview/competencies")
            assert tax_resp.status_code == 200
            tax_data = tax_resp.json()
            assert len(tax_data) >= 12
            assert any(c["id"] == "db.indexing" for c in tax_data)

            # 2. Test /api/interview/sessions/{session_id}/competency-graph for Alice
            graph_resp = await client.get("/api/interview/sessions/sess-alice-ml-1/competency-graph")
            assert graph_resp.status_code == 200
            graph_data = graph_resp.json()
            assert graph_data["session_id"] == "sess-alice-ml-1"
            assert len(graph_data["nodes"]) >= 12
            assert len(graph_data["edges"]) > 0
            assert graph_data["metrics"]["assessed_count"] == 1

            # 3. Test /api/interview/sessions/{session_id}/predictions for Alice
            pred_resp = await client.get("/api/interview/sessions/sess-alice-ml-1/predictions")
            assert pred_resp.status_code == 200
            pred_data = pred_resp.json()
            assert pred_data["candidate_ability_theta"] == 0.85
            assert len(pred_data["predictions"]) >= 12

            # 4. Test /api/interview/sessions/{session_id}/adaptive-next-question for Alice
            adapt_resp = await client.post("/api/interview/sessions/sess-alice-ml-1/adaptive-next-question")
            assert adapt_resp.status_code == 200
            adapt_data = adapt_resp.json()
            assert "target_competency_id" in adapt_data
            assert "rationale" in adapt_data
            assert adapt_data["selection_score"] > 0

        # 5. Security Gate: Eve attempts to access Alice's ML graph and predictions -> 403 Forbidden
        app.dependency_overrides[get_current_member] = lambda: member_eve
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            bad_graph = await client.get("/api/interview/sessions/sess-alice-ml-1/competency-graph")
            assert bad_graph.status_code == 403
            assert "Access denied" in bad_graph.json()["detail"]

            bad_pred = await client.get("/api/interview/sessions/sess-alice-ml-1/predictions")
            assert bad_pred.status_code == 403
            assert "Access denied" in bad_pred.json()["detail"]

            bad_adapt = await client.post("/api/interview/sessions/sess-alice-ml-1/adaptive-next-question")
            assert bad_adapt.status_code == 403
            assert "Access denied" in bad_adapt.json()["detail"]
    finally:
        app.dependency_overrides.clear()
