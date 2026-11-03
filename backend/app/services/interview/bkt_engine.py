"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.bkt_engine — Bayesian Knowledge Tracing (BKT) Engine

Implements:
1. Standard BKT Bayesian posterior updates for discrete observations.
2. Graded BKT extension for partial-credit continuous rubric evidence [0.0, 1.0].
3. Per-competency parameter configuration (L0, T, G, S).
4. Epistemic uncertainty quantification U(L) = 4 * L * (1 - L).
5. Immutable update records for reproducible state replay.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.interview.competency_taxonomy import COMPETENCY_REGISTRY, CompetencyTaxonomyService


@dataclass
class BKTParameters:
    l0: float = 0.25  # Prior mastery probability P(L0)
    t: float = 0.15   # Transition / learning rate P(T)
    g: float = 0.10   # Guess rate P(G)
    s: float = 0.10   # Slip rate P(S)


@dataclass
class CompetencyBKTState:
    competency_id: str
    mastery_prob: float
    uncertainty: float
    evidence_count: int = 0
    consecutive_correct: int = 0
    history: List[Dict[str, Any]] = field(default_factory=list)
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def is_mastered(self, threshold: float = 0.75) -> bool:
        return self.mastery_prob >= threshold

    def is_gap(self, threshold: float = 0.35) -> bool:
        return self.mastery_prob < threshold and self.evidence_count >= 1

    def status(self) -> str:
        if self.evidence_count == 0:
            return "UNASSESSED"
        if self.mastery_prob >= 0.75:
            return "MASTERED"
        if self.mastery_prob < 0.35:
            return "GAP"
        return "DEVELOPING"


class BKTEngine:
    """Bayesian Knowledge Tracing service for continuous student mastery tracking."""

    @staticmethod
    def get_default_parameters(competency_id: str) -> BKTParameters:
        node = CompetencyTaxonomyService.get_competency(competency_id)
        if node:
            return BKTParameters(
                l0=node.default_bkt_l0,
                t=node.default_bkt_t,
                g=node.default_bkt_g,
                s=node.default_bkt_s,
            )
        return BKTParameters()

    @staticmethod
    def calculate_uncertainty(p_mastery: float) -> float:
        """
        Calculates epistemic uncertainty normalized to [0.0, 1.0].
        U(0.5) = 1.0 (maximum uncertainty)
        U(1.0) = 0.0 (certain mastery)
        U(0.0) = 0.0 (certain non-mastery)
        """
        p = max(0.0, min(1.0, p_mastery))
        return round(4.0 * p * (1.0 - p), 4)

    @classmethod
    def initialize_state(cls, competency_id: str) -> CompetencyBKTState:
        params = cls.get_default_parameters(competency_id)
        p = max(0.01, min(0.99, params.l0))
        return CompetencyBKTState(
            competency_id=competency_id,
            mastery_prob=p,
            uncertainty=cls.calculate_uncertainty(p),
            evidence_count=0,
            consecutive_correct=0,
            history=[],
        )

    @classmethod
    def update_with_evidence(
        cls,
        state: CompetencyBKTState,
        evidence_score: float,
        turn_id: Optional[str] = None,
        confidence: float = 1.0,
        custom_params: Optional[BKTParameters] = None,
    ) -> CompetencyBKTState:
        """
        Applies a graded evidence observation c in [0.0, 1.0] to update mastery state.
        
        Graded Likelihood Formulation:
        P(obs | L)   = c * (1 - S) + (1 - c) * S
        P(obs | ¬L)  = c * G + (1 - c) * (1 - G)
        
        Posterior:
        P(L | obs)   = P(L) * P(obs | L) / [P(L) * P(obs | L) + (1 - P(L)) * P(obs | ¬L)]
        
        Transition to Next Opportunity:
        P(L_next)    = P(L | obs) + (1 - P(L | obs)) * T
        """
        c = max(0.0, min(1.0, float(evidence_score)))
        conf = max(0.1, min(1.0, float(confidence)))
        params = custom_params or cls.get_default_parameters(state.competency_id)

        # Scale observation strength by evaluator confidence
        effective_c = 0.5 + conf * (c - 0.5)

        prior_l = max(0.001, min(0.999, state.mastery_prob))
        s = max(0.01, min(0.40, params.s))
        g = max(0.01, min(0.40, params.g))
        t = max(0.01, min(0.40, params.t))

        # 1. Graded Likelihoods
        p_obs_given_l = effective_c * (1.0 - s) + (1.0 - effective_c) * s
        p_obs_given_not_l = effective_c * g + (1.0 - effective_c) * (1.0 - g)

        # 2. Bayesian Posterior
        numerator = prior_l * p_obs_given_l
        denominator = (prior_l * p_obs_given_l) + ((1.0 - prior_l) * p_obs_given_not_l)
        if denominator <= 0:
            posterior_l = prior_l
        else:
            posterior_l = numerator / denominator

        # 3. Transition / Learning Rate Update
        p_next = posterior_l + (1.0 - posterior_l) * t
        new_mastery = round(max(0.01, min(0.99, p_next)), 4)
        new_uncertainty = cls.calculate_uncertainty(new_mastery)

        # Track streak
        consecutive = state.consecutive_correct + 1 if c >= 0.7 else 0

        new_history = list(state.history)
        new_history.append({
            "turn_id": turn_id,
            "evidence_score": c,
            "confidence": conf,
            "prior_mastery": prior_l,
            "posterior_mastery": new_mastery,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return CompetencyBKTState(
            competency_id=state.competency_id,
            mastery_prob=new_mastery,
            uncertainty=new_uncertainty,
            evidence_count=state.evidence_count + 1,
            consecutive_correct=consecutive,
            history=new_history,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

