"""
Chaos Computer Club — Medi-Caps Chapter
app.services.interview.state_estimator — Kalman State-Space Performance Filter

Implements:
1. Continuous latent performance state x = [proficiency, velocity]^T.
2. Kalman filter predict & update steps with dynamic covariance propagation.
3. Confidence-weighted measurement noise R = R_0 / confidence^2.
4. Outlier-resistant innovation gating against momentary candidate slips.
5. Trajectory smoothing across sequential question turns.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class KalmanState:
    proficiency: float            # Estimated underlying proficiency [0.0, 100.0]
    velocity: float               # Estimated improvement / degradation rate per turn
    p_00: float = 16.0            # Covariance matrix P element (0,0) [variance of proficiency]
    p_01: float = 0.0             # Covariance matrix P element (0,1)
    p_10: float = 0.0             # Covariance matrix P element (1,0)
    p_11: float = 4.0             # Covariance matrix P element (1,1) [variance of velocity]
    step_count: int = 0
    history: List[Dict[str, float]] = field(default_factory=list)

    @property
    def standard_deviation(self) -> float:
        return math.sqrt(max(0.01, self.p_00))


class KalmanPerformanceFilter:
    """Kalman filter for smoothing noisy rubric scores and tracking performance velocity."""

    # Default process noise covariance Q
    DEFAULT_Q_PROFICIENCY: float = 1.0
    DEFAULT_Q_VELOCITY: float = 0.25
    BASE_MEASUREMENT_NOISE_R: float = 9.0  # (3.0 points std dev on rubric)

    @classmethod
    def initialize_state(cls, initial_score: float = 60.0) -> KalmanState:
        init_p = max(0.0, min(100.0, float(initial_score)))
        return KalmanState(
            proficiency=init_p,
            velocity=0.0,
            p_00=25.0,  # Prior variance (+-5 points)
            p_01=0.0,
            p_10=0.0,
            p_11=4.0,
            step_count=0,
            history=[],
        )

    @classmethod
    def update(
        cls,
        state: KalmanState,
        observed_score: float,
        confidence: float = 1.0,
        dt: float = 1.0,
    ) -> KalmanState:
        """
        Executes Kalman predict and update cycle with confidence-weighted measurement noise.
        """
        z = max(0.0, min(100.0, float(observed_score)))
        conf = max(0.2, min(1.0, float(confidence)))

        # 1. Predict Step: x_pred = F * x
        prof_pred = state.proficiency + state.velocity * dt
        vel_pred = state.velocity

        # P_pred = F * P * F^T + Q
        # F = [[1, dt], [0, 1]]
        p00_pred = state.p_00 + dt * (state.p_10 + state.p_01) + (dt ** 2) * state.p_11 + cls.DEFAULT_Q_PROFICIENCY
        p01_pred = state.p_01 + dt * state.p_11
        p10_pred = state.p_10 + dt * state.p_11
        p11_pred = state.p_11 + cls.DEFAULT_Q_VELOCITY

        # 2. Measurement Noise with Confidence Scaling
        # Lower evaluator confidence inflates measurement noise R
        r = cls.BASE_MEASUREMENT_NOISE_R / (conf ** 2)

        # Innovation: y = z - H * x_pred (where H = [1, 0])
        y = z - prof_pred

        # Innovation Covariance: S = H * P_pred * H^T + R = p00_pred + R
        s = p00_pred + r

        # Outlier Gating: if residual exceeds 3.5 std deviations, inflate R to dampen anomaly
        if abs(y) > 3.5 * math.sqrt(s):
            r *= 2.5
            s = p00_pred + r

        # 3. Kalman Gain: K = P_pred * H^T * S^-1 = [p00_pred / S, p10_pred / S]^T
        k_prof = p00_pred / s
        k_vel = p10_pred / s

        # 4. State Update: x = x_pred + K * y
        prof_updated = prof_pred + k_prof * y
        vel_updated = vel_pred + k_vel * y

        # Clamp proficiency to [0.0, 100.0]
        prof_updated = max(0.0, min(100.0, prof_updated))

        # 5. Covariance Update: P = (I - K * H) * P_pred
        # I - K*H = [[1 - k_prof, 0], [-k_vel, 1]]
        p00_new = (1.0 - k_prof) * p00_pred
        p01_new = (1.0 - k_prof) * p01_pred
        p10_new = -k_vel * p00_pred + p10_pred
        p11_new = -k_vel * p01_pred + p11_pred

        new_history = list(state.history)
        new_history.append({
            "observation": round(z, 2),
            "filtered_proficiency": round(prof_updated, 2),
            "filtered_velocity": round(vel_updated, 2),
            "std_dev": round(math.sqrt(max(0.01, p00_new)), 2),
        })

        return KalmanState(
            proficiency=round(prof_updated, 2),
            velocity=round(vel_updated, 2),
            p_00=round(max(0.01, p00_new), 4),
            p_01=round(p01_new, 4),
            p_10=round(p10_new, 4),
            p_11=round(max(0.01, p11_new), 4),
            step_count=state.step_count + 1,
            history=new_history,
        )

