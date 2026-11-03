"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.irt_engine — Item Response Theory (IRT) Engine

Implements:
1. 2-Parameter Logistic (2PL) response probability model P(θ, a, b).
2. Fisher Information calculation I(θ) for active difficulty matching.
3. Bayes Modal / MAP ability estimation θ with standard error and 95% confidence intervals.
4. Item difficulty calibration lookup and exposure limits.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class IRTItemParameters:
    item_id: str
    difficulty_b: float = 0.0     # b in [-3.0, 3.0]
    discrimination_a: float = 1.2 # a in [0.5, 2.5]
    competency_id: Optional[str] = None


@dataclass
class CandidateAbilityEstimate:
    theta: float                  # Estimated ability θ in [-3.0, 3.0]
    standard_error: float         # SE(θ)
    ci_lower: float               # 95% CI lower bound
    ci_upper: float               # 95% CI upper bound
    response_count: int
    fisher_information_total: float


class IRTEngine:
    """Item Response Theory engine for calibrated difficulty selection and ability estimation."""

    @staticmethod
    def probability_correct(theta: float, a: float, b: float) -> float:
        """
        2PL logistic formula:
        P(θ) = 1 / [1 + exp(-a * (θ - b))]
        """
        exponent = max(-30.0, min(30.0, -a * (theta - b)))
        return 1.0 / (1.0 + math.exp(exponent))

    @classmethod
    def fisher_information(cls, theta: float, a: float, b: float) -> float:
        """
        Fisher Information for 2PL item:
        I(θ) = a^2 * P(θ) * (1 - P(θ))
        """
        p = cls.probability_correct(theta, a, b)
        return (a ** 2) * p * (1.0 - p)

    @classmethod
    def estimate_ability_map(
        cls,
        responses: List[Tuple[IRTItemParameters, float]],
        prior_mean: float = 0.0,
        prior_variance: float = 1.0,
        max_iterations: int = 25,
        tolerance: float = 1e-4,
    ) -> CandidateAbilityEstimate:
        """
        Maximum A Posteriori (MAP) estimation of candidate ability θ via Newton-Raphson.
        Each response is (IRTItemParameters, score) where score is in [0.0, 1.0].
        """
        if not responses:
            se = math.sqrt(prior_variance)
            return CandidateAbilityEstimate(
                theta=prior_mean,
                standard_error=round(se, 4),
                ci_lower=round(prior_mean - 1.96 * se, 4),
                ci_upper=round(prior_mean + 1.96 * se, 4),
                response_count=0,
                fisher_information_total=0.0,
            )

        theta = prior_mean

        for _ in range(max_iterations):
            first_deriv = -(theta - prior_mean) / prior_variance
            second_deriv = -1.0 / prior_variance

            for item, score in responses:
                p = cls.probability_correct(theta, item.discrimination_a, item.difficulty_b)
                u = max(0.0, min(1.0, score))
                first_deriv += item.discrimination_a * (u - p)
                second_deriv -= (item.discrimination_a ** 2) * p * (1.0 - p)

            if abs(second_deriv) < 1e-9:
                break

            delta = first_deriv / second_deriv
            theta = theta - delta

            # Clamp theta to realistic bounds [-3.5, 3.5]
            theta = max(-3.5, min(3.5, theta))

            if abs(delta) < tolerance:
                break

        # Calculate standard error from Fisher Information + prior precision
        total_info = 0.0
        for item, _ in responses:
            total_info += cls.fisher_information(theta, item.discrimination_a, item.difficulty_b)

        total_precision = total_info + (1.0 / prior_variance)
        se = 1.0 / math.sqrt(max(0.01, total_precision))

        return CandidateAbilityEstimate(
            theta=round(theta, 4),
            standard_error=round(se, 4),
            ci_lower=round(theta - 1.96 * se, 4),
            ci_upper=round(theta + 1.96 * se, 4),
            response_count=len(responses),
            fisher_information_total=round(total_info, 4),
        )

    @classmethod
    def select_optimal_difficulty(cls, current_theta: float) -> Tuple[float, str]:
        """
        Determines target item difficulty b to maximize Fisher Information for current ability.
        Returns target difficulty b and discrete difficulty band label.
        """
        target_b = round(max(-2.5, min(2.5, current_theta)), 2)
        if target_b < -0.8:
            band = "EASY"
        elif target_b > 0.8:
            band = "HARD"
        else:
            band = "MEDIUM"
        return target_b, band

