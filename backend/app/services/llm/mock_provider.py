"""
Chaos Computer Club — Medi-Caps Chapter
app.services.llm.mock_provider — Deterministic Offline LLM Provider
Used in CI quality gates, unit tests, and air-gapped/offline local development.
"""

from typing import Type, TypeVar, Any, Dict
from pydantic import BaseModel
from .provider import LLMProvider

T = TypeVar("T", bound=BaseModel)


class DeterministicMockLLMProvider(LLMProvider):
    """
    Simulates high-fidelity LLM responses without external network access or API keys.
    Generates structured objects strictly satisfying the requested Pydantic schema.
    """

    @property
    def provider_name(self) -> str:
        return "deterministic-mock"

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Type[T],
        temperature: float = 0.2,
        timeout_seconds: float = 30.0,
    ) -> T:
        model_name = response_model.__name__
        lower_prompt = user_prompt.lower()

        # 1. Interview Question Plan Generator
        if "plan" in model_name.lower():
            mock_data = {
                "interview_title": "Targeted Technical Interview",
                "agenda": [
                    {
                        "topic": "Concurrency & Locking",
                        "title": "Optimistic vs Pessimistic Concurrency in High-Throughput Databases",
                        "prompt": "Explain the difference between optimistic concurrency control (OCC) and pessimistic row locking in PostgreSQL. In what workload scenario would OCC outperform pessimistic locking?",
                        "expected_criteria": ["Isolation levels", "MVCC", "Serialization failures", "Retry overhead"],
                    },
                    {
                        "topic": "Database Indexing",
                        "title": "B-Tree vs Hash Indexes for Read-Heavy Telemetry",
                        "prompt": "Why are B-Trees preferred over Hash indexes in relational databases, and how does a composite B-Tree index support range queries on prefix columns?",
                        "expected_criteria": ["Range scans", "Leftmost prefix rule", "Disk block locality"],
                    },
                    {
                        "topic": "Distributed Caching",
                        "title": "Cache Invalidation & Thundering Herd Mitigation",
                        "prompt": "When caching hot database keys in Redis, what strategies prevent cache stampedes (thundering herd) when a high-traffic key expires?",
                        "expected_criteria": ["Probabilistic early expiration (XFetch)", "Mutex locks", "Soft TTLs", "Background prefetching"],
                    },
                    {
                        "topic": "System Reliability",
                        "title": "Circuit Breakers & Graceful Degradation",
                        "prompt": "Describe how you would implement a circuit breaker pattern between an edge API gateway and a struggling downstream service to prevent cascading failures.",
                        "expected_criteria": ["Half-open state", "Fallback responses", "Failure rate thresholds"],
                    },
                ]
            }
            return response_model.model_validate(mock_data)

        # 2. Single Question / Follow-up Generator
        if "question" in model_name.lower():
            is_follow_up = "follow_up" in lower_prompt or "incomplete" in lower_prompt or "probe" in lower_prompt
            if is_follow_up:
                mock_data = {
                    "question_type": "FOLLOW_UP",
                    "topic": "Concurrency & Trade-offs",
                    "title": "Handling Write Skew and Serialization Anomalies",
                    "prompt": "You mentioned version checking for optimistic locking. How would you handle write skew anomalies where two concurrent transactions update different rows based on overlapping read preconditions?",
                    "expected_criteria": ["Serializable snapshot isolation", "Pessimistic locking fallback", "Explicit conflict materialization"],
                }
            else:
                mock_data = {
                    "question_type": "PRIMARY",
                    "topic": "Core Fundamentals",
                    "title": "Explaining Distributed Deadlock Resolution",
                    "prompt": "In a distributed transaction spanning two independent database shards, how does two-phase commit (2PC) handle a coordinator crash during the prepare phase?",
                    "expected_criteria": ["Presumed abort", "Coordinator recovery log", "Blocking protocol limitation"],
                }
            return response_model.model_validate(mock_data)

        # 3. Answer Turn Evaluation
        if "evaluation" in model_name.lower():
            # If answer is very short or vague, simulate lower score with follow-up recommended
            words = user_prompt.split()
            is_short = len(words) < 25
            score = 65 if is_short else 88

            mock_data = {
                "score": score,
                "rubric_scores": {
                    "technical_correctness": 70 if is_short else 90,
                    "depth_of_understanding": 60 if is_short else 85,
                    "communication_clarity": 75 if is_short else 90,
                    "trade_off_awareness": 55 if is_short else 85,
                },
                "strengths": [
                    "Correctly identified fundamental architectural principles.",
                    "Demonstrated foundational understanding of database concurrency.",
                ],
                "gaps": [
                    "Could elaborate further on edge-case behavior under sudden connection spikes.",
                    "Omitted specific PostgreSQL configuration parameters (e.g. max_connections, work_mem).",
                ] if is_short else [
                    "Minor clarification on operational monitoring would enhance the response."
                ],
                "evidence_quotes": [
                    user_prompt[:80] + "..." if len(user_prompt) > 80 else user_prompt
                ],
                "model_answer": "An ideal answer discusses both optimistic and pessimistic mechanisms: Optimistic Concurrency Control (OCC) uses a version or timestamp column where updates verify that `version = expected_version`, aborting or retrying if mismatched. This achieves high throughput in low-conflict workloads because transactions read without holding exclusive locks. In contrast, pessimistic locking (`SELECT FOR UPDATE`) places exclusive row locks immediately, which prevents retry overhead under high write contention at the cost of reduced concurrency and potential deadlocks.",
                "follow_up_recommended": is_short,
                "suggested_follow_up": "How would you handle high retry contention if multiple workers attempt to modify the same record simultaneously?" if is_short else None,
            }
            return response_model.model_validate(mock_data)

        # 4. Final Coaching Report
        if "report" in model_name.lower():
            mock_data = {
                "overall_score": 84,
                "verdict": "STRONG_HIRE",
                "executive_summary": "The candidate demonstrated solid architectural maturity across distributed systems, database locking mechanisms, and asynchronous queues. Technical answers were structured and grounded in realistic production constraints. Targeted practice in edge-case failure modes and memory allocation tuning will elevate their profile to senior tier.",
                "dimension_breakdown": {
                    "Technical Correctness": 88,
                    "Depth of Understanding": 82,
                    "Problem Solving": 85,
                    "Trade-off Awareness": 80,
                    "Communication & Articulation": 86,
                },
                "top_strengths": [
                    "Clear articulation of concurrency control trade-offs (OCC vs 2PL).",
                    "Effective explanation of cache stampede mitigations using probabilistic early expiration.",
                    "Structured technical communication with clear definitions.",
                ],
                "areas_to_improve": [
                    "Provide concrete metrics and mathematical bounds when discussing cache TTLs and latency.",
                    "Anticipate network partition failures and explain reconciliation mechanisms more thoroughly.",
                ],
                "recommended_practice": [
                    {
                        "topic": "Concurrency Control & Isolation Levels",
                        "description": "Deep-dive into PostgreSQL repeatable read and serializable snapshot isolation anomalies.",
                        "action_type": "STUDY_MODULE",
                    },
                    {
                        "topic": "Distributed Lock Algorithms",
                        "description": "Practice implementing distributed mutex locks with fencing tokens in Redis/PostgreSQL.",
                        "action_type": "PRACTICE_CHALLENGE",
                    },
                ],
            }
            return response_model.model_validate(mock_data)

        # Fallback dynamic mock if unknown model
        return response_model.model_validate({})

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.5,
        timeout_seconds: float = 30.0,
    ) -> str:
        return (
            "Thank you for sharing your perspective on that architecture. "
            "To delve deeper into the trade-offs: could you explain how this approach behaves during a network partition?"
        )
