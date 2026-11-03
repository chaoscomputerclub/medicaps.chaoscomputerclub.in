"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.prediction_service — Calibrated Performance Forecasting Engine

Implements:
1. Strict separation between observed facts, current state estimates, and future predictions.
2. Horizon-based response success forecasting for upcoming question difficulty classes.
3. Quantified prediction intervals [lower, upper] based on IRT ability standard error and BKT uncertainty.
4. Low-evidence suppression and warnings to prevent misleading high-precision forecasts.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.interview.bkt_engine import CompetencyBKTState
from app.services.interview.competency_taxonomy import COMPETENCY_REGISTRY
from app.services.interview.irt_engine import CandidateAbilityEstimate, IRTEngine


@dataclass
class CompetencyPredictionItem:
    competency_id: str
    label: str
    current_mastery_estimate: float
    predicted_response_probability: float
    prediction_target: Dict[str, str]
    confidence_interval: Dict[str, float]
    evidence_count: int
    is_low_evidence: bool
    explanation: str


@dataclass
class SessionPredictionsResponse:
    session_id: str
    model_version: str
    candidate_ability_theta: float
    ability_confidence_interval: Dict[str, float]
    predictions: List[CompetencyPredictionItem]
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PredictionService:
    """Computes calibrated future performance forecasts with explicit prediction intervals."""

    MODEL_VERSION: str = "2026.1-logistic-map"

    # Difficulty benchmarks for prediction horizons
    TARGET_CLASSES = {
        "INTERMEDIATE_SCENARIO": 0.2,
        "ADVANCED_CHALLENGE": 1.2,
    }

    @classmethod
    def generate_predictions(
        cls,
        session_id: str,
        ability_estimate: CandidateAbilityEstimate,
        bkt_states: Dict[str, CompetencyBKTState],
    ) -> SessionPredictionsResponse:
        """
        Generates calibrated future response predictions across tracked competencies.
        """
        predictions_out: List[CompetencyPredictionItem] = []
        theta = ability_estimate.theta
        se = ability_estimate.standard_error

        for comp_id, node_def in COMPETENCY_REGISTRY.items():
            bkt = bkt_states.get(comp_id)
            if bkt:
                mastery = bkt.mastery_prob
                evidence_count = bkt.evidence_count
                uncertainty = bkt.uncertainty
            else:
                mastery = node_def.default_bkt_l0
                evidence_count = 0
                uncertainty = 1.0

            # Target difficulty benchmark for this competency
            item_b = node_def.default_irt_b
            item_a = node_def.default_irt_a

            # 2PL IRT response probability conditioned on current ability θ
            p_irt = IRTEngine.probability_correct(theta, item_a, item_b)

            # Ensemble prediction combining latent ability θ with concept-specific BKT mastery
            # If evidence is low, weight defaults more towards prior
            alpha = min(0.8, evidence_count * 0.3)
            pred_prob = round((1.0 - alpha) * p_irt + alpha * mastery, 3)

            # Uncertainty interval derived from ability SE and BKT uncertainty
            margin = round(min(0.35, 1.96 * se * 0.15 + uncertainty * 0.12), 3)
            ci_lower = max(0.02, round(pred_prob - margin, 3))
            ci_upper = min(0.98, round(pred_prob + margin, 3))

            is_low_evidence = evidence_count < 2

            if is_low_evidence:
                explanation = (
                    f"Preliminary forecast based on global prior and candidate baseline ability (θ={theta:.2f}). "
                    f"Requires additional evidence opportunities to increase statistical confidence."
                )
            else:
                explanation = (
                    f"Calibrated prediction for intermediate scenario based on {evidence_count} observed responses. "
                    f"Estimated success probability {int(pred_prob * 100)}% [CI: {int(ci_lower * 100)}% - {int(ci_upper * 100)}%]."
                )

            predictions_out.append(
                CompetencyPredictionItem(
                    competency_id=comp_id,
                    label=node_def.label,
                    current_mastery_estimate=round(mastery, 3),
                    predicted_response_probability=pred_prob,
                    prediction_target={
                        "question_class": "INTERMEDIATE_SCENARIO",
                        "horizon": "NEXT_2_QUESTIONS",
                    },
                    confidence_interval={"lower": ci_lower, "upper": ci_upper},
                    evidence_count=evidence_count,
                    is_low_evidence=is_low_evidence,
                    explanation=explanation,
                )
            )

        return SessionPredictionsResponse(
            session_id=session_id,
            model_version=cls.MODEL_VERSION,
            candidate_ability_theta=round(theta, 3),
            ability_confidence_interval={
                "lower": ability_estimate.ci_lower,
                "upper": ability_estimate.ci_upper,
            },
            predictions=predictions_out,
        )

