"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.adaptive_selector — Adaptive Question Selection & Policy Engine

Implements:
1. Hard constraint filtering (domain relevance, time remaining, duplicate prevention, difficulty bounds).
2. Multi-objective assessment utility scoring combining:
   - Fisher Information Gain I(θ) from IRT.
   - Competency gap/uncertainty resolution from BKT.
   - Unassessed taxonomy coverage incentive.
   - Recency & repetition damping.
3. Transparent, explainable selection rationales for every chosen question.
4. Deterministic fallback for graceful degradation under edge conditions.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.interview.bkt_engine import BKTEngine, CompetencyBKTState
from app.services.interview.competency_taxonomy import (
    COMPETENCY_REGISTRY,
    CompetencyDomain,
    CompetencyNodeDef,
    CompetencyTaxonomyService,
)
from app.services.interview.irt_engine import IRTEngine


@dataclass
class QuestionCandidate:
    question_id: str
    title: str
    prompt: str
    competency_id: str
    difficulty_b: float = 0.0
    discrimination_a: float = 1.2
    question_type: str = "PRIMARY"
    estimated_minutes: int = 5


@dataclass
class SelectionDecision:
    selected_question: QuestionCandidate
    target_competency_id: str
    target_difficulty: str
    selection_score: float
    rationale: str
    candidate_pool_size: int
    scores_breakdown: Dict[str, float] = field(default_factory=dict)


class AdaptiveQuestionSelector:
    """Selects the highest-utility next question based on active IRT ability and BKT uncertainties."""

    # Policy weights for multi-objective reward function
    WEIGHT_INFO_GAIN: float = 0.35
    WEIGHT_UNCERTAINTY: float = 0.30
    WEIGHT_COVERAGE: float = 0.25
    WEIGHT_RECENCY_PENALTY: float = 0.20

    @classmethod
    def evaluate_candidate_utility(
        cls,
        candidate: QuestionCandidate,
        current_theta: float,
        bkt_states: Dict[str, CompetencyBKTState],
        recent_competency_ids: List[str],
    ) -> Tuple[float, Dict[str, float]]:
        """
        Computes composite reward score R for a candidate question:
        R = w1 * InfoGain + w2 * Uncertainty + w3 * Coverage - w4 * RecencyPenalty
        """
        # 1. Fisher Information Gain from IRT
        info = IRTEngine.fisher_information(
            theta=current_theta,
            a=candidate.discrimination_a,
            b=candidate.difficulty_b,
        )
        # Max theoretical 2PL info with a=1.2 is 1.2^2 * 0.25 = 0.36
        norm_info = min(1.0, info / 0.36)

        # 2. Epistemic Uncertainty from BKT
        bkt_state = bkt_states.get(candidate.competency_id)
        if bkt_state:
            uncertainty = bkt_state.uncertainty
            evidence_count = bkt_state.evidence_count
        else:
            uncertainty = 1.0
            evidence_count = 0

        # 3. Unassessed Coverage Incentive
        if evidence_count == 0:
            coverage_score = 1.0
        elif evidence_count == 1:
            coverage_score = 0.4
        else:
            coverage_score = 0.1

        # 4. Recency & Repetition Penalty (prevent asking same competency back-to-back)
        recency_penalty = 0.0
        if recent_competency_ids:
            if recent_competency_ids[-1] == candidate.competency_id:
                recency_penalty = 1.0
            elif candidate.competency_id in recent_competency_ids[-2:]:
                recency_penalty = 0.5

        # Composite utility score
        total_score = (
            cls.WEIGHT_INFO_GAIN * norm_info
            + cls.WEIGHT_UNCERTAINTY * uncertainty
            + cls.WEIGHT_COVERAGE * coverage_score
            - cls.WEIGHT_RECENCY_PENALTY * recency_penalty
        )

        breakdown = {
            "norm_info_gain": round(norm_info, 3),
            "uncertainty": round(uncertainty, 3),
            "coverage_incentive": round(coverage_score, 3),
            "recency_penalty": round(recency_penalty, 3),
            "total_score": round(total_score, 3),
        }
        return round(total_score, 4), breakdown

    @classmethod
    def select_next_question(
        cls,
        available_questions: List[QuestionCandidate],
        asked_question_ids: Set[str],
        current_theta: float,
        bkt_states: Dict[str, CompetencyBKTState],
        recent_competency_ids: List[str],
        remaining_minutes: int = 25,
        allowed_domains: Optional[Set[CompetencyDomain]] = None,
    ) -> SelectionDecision:
        """
        Filters candidates against hard constraints and ranks by composite assessment utility.
        """
        # Hard Constraint 1: Remove already asked questions
        eligible = [q for q in available_questions if q.question_id not in asked_question_ids]

        # Hard Constraint 2: Time budget filter
        eligible = [q for q in eligible if q.estimated_minutes <= remaining_minutes + 2]

        # Hard Constraint 3: Domain filter if specified
        if allowed_domains:
            eligible = [
                q for q in eligible
                if COMPETENCY_REGISTRY.get(q.competency_id) and COMPETENCY_REGISTRY[q.competency_id].domain in allowed_domains
            ]

        # Deterministic Fallback if no questions pass constraints
        if not eligible:
            fallback = available_questions[0] if available_questions else QuestionCandidate(
                question_id="fallback-q",
                title="System Architecture Fundamentals",
                prompt="Explain the difference between vertical scaling and horizontal scaling in cloud systems.",
                competency_id="sys.scalability",
                difficulty_b=0.0,
            )
            return SelectionDecision(
                selected_question=fallback,
                target_competency_id=fallback.competency_id,
                target_difficulty="MEDIUM",
                selection_score=0.5,
                rationale="Fallback question selected due to exhausted constraint pool.",
                candidate_pool_size=0,
                scores_breakdown={},
            )

        # Score and rank all eligible candidates
        best_candidate: Optional[QuestionCandidate] = None
        best_score = -float("inf")
        best_breakdown: Dict[str, float] = {}

        for candidate in eligible:
            score, breakdown = cls.evaluate_candidate_utility(
                candidate=candidate,
                current_theta=current_theta,
                bkt_states=bkt_states,
                recent_competency_ids=recent_competency_ids,
            )
            if score > best_score:
                best_score = score
                best_candidate = candidate
                best_breakdown = breakdown

        assert best_candidate is not None

        # Build transparent human-readable selection rationale
        _, difficulty_band = IRTEngine.select_optimal_difficulty(best_candidate.difficulty_b)
        bkt_comp = bkt_states.get(best_candidate.competency_id)
        u_val = bkt_comp.uncertainty if bkt_comp else 1.0

        rationale = (
            f"Selected '{best_candidate.title}' (Competency: {best_candidate.competency_id}) "
            f"to maximize assessment information gain (I={best_breakdown.get('norm_info_gain', 0):.2f}) "
            f"and resolve epistemic uncertainty (U={u_val:.2f}) "
            f"calibrated for candidate ability θ={current_theta:.2f}."
        )

        return SelectionDecision(
            selected_question=best_candidate,
            target_competency_id=best_candidate.competency_id,
            target_difficulty=difficulty_band,
            selection_score=best_score,
            rationale=rationale,
            candidate_pool_size=len(eligible),
            scores_breakdown=best_breakdown,
        )

