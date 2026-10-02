"""
Chaos Computer Club — Certification Harness: Language Matrix & Cross-Layer Registry
Guarantees strict audit of language identifiers across all pipeline tiers:
Frontend -> API -> ExecutionRouter -> Redis Job -> Worker/Docker -> Compiler -> Runtime
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass


@dataclass(frozen=True)
class LanguageAuditProfile:
    canonical_id: str
    frontend_aliases: List[str]
    api_id: str
    router_id: str
    redis_job_lang: str
    docker_image: str
    compiler: Optional[str]
    runtime: str
    file_extension: str
    requires_compilation: bool


LANGUAGE_REGISTRY: Dict[str, LanguageAuditProfile] = {
    "python": LanguageAuditProfile(
        canonical_id="python",
        frontend_aliases=["python", "python3", "py", "Python 3"],
        api_id="python",
        router_id="python",
        redis_job_lang="python",
        docker_image="interleet-python:latest",
        compiler=None,
        runtime="python3",
        file_extension=".py",
        requires_compilation=False,
    ),
    "cpp": LanguageAuditProfile(
        canonical_id="cpp",
        frontend_aliases=["cpp", "c++", "g++", "clang++", "C++"],
        api_id="cpp",
        router_id="cpp",
        redis_job_lang="cpp",
        docker_image="interleet-cpp:latest",
        compiler="g++ -O2 -std=c++17",
        runtime="./solution",
        file_extension=".cpp",
        requires_compilation=True,
    ),
    "java": LanguageAuditProfile(
        canonical_id="java",
        frontend_aliases=["java", "openjdk", "java17", "java21", "Java"],
        api_id="java",
        router_id="java",
        redis_job_lang="java",
        docker_image="interleet-java:latest",
        compiler="javac Main.java",
        runtime="java -Xmx256m -Xss64m Main",
        file_extension=".java",
        requires_compilation=True,
    ),
    "javascript": LanguageAuditProfile(
        canonical_id="javascript",
        frontend_aliases=["javascript", "js", "node", "nodejs", "JavaScript"],
        api_id="javascript",
        router_id="javascript",
        redis_job_lang="javascript",
        docker_image="interleet-node:latest",
        compiler=None,
        runtime="node solution.js",
        file_extension=".js",
        requires_compilation=False,
    ),
    "typescript": LanguageAuditProfile(
        canonical_id="typescript",
        frontend_aliases=["typescript", "ts", "TypeScript"],
        api_id="typescript",
        router_id="typescript",
        redis_job_lang="typescript",
        docker_image="interleet-typescript:latest",
        compiler="tsc --target ES2020",
        runtime="node solution.js",
        file_extension=".ts",
        requires_compilation=True,
    ),
    "go": LanguageAuditProfile(
        canonical_id="go",
        frontend_aliases=["go", "golang", "Go"],
        api_id="go",
        router_id="go",
        redis_job_lang="go",
        docker_image="interleet-go:latest",
        compiler="go build -o solution",
        runtime="./solution",
        file_extension=".go",
        requires_compilation=True,
    ),
}


class LanguageContractAuditor:
    """Audits cross-tier language mappings to prevent silent fallbacks or mismatches."""

    @staticmethod
    def audit_language_request(lang: str) -> Dict[str, Any]:
        normalized = lang.strip().lower()
        matched_profile = None

        for canonical, profile in LANGUAGE_REGISTRY.items():
            if normalized == canonical or normalized in [a.lower() for a in profile.frontend_aliases]:
                matched_profile = profile
                break

        if not matched_profile:
            return {
                "valid": False,
                "input_language": lang,
                "error": f"Language '{lang}' is not supported by the production judge matrix.",
                "supported_languages": list(LANGUAGE_REGISTRY.keys()),
            }

        return {
            "valid": True,
            "input_language": lang,
            "canonical_id": matched_profile.canonical_id,
            "api_id": matched_profile.api_id,
            "router_id": matched_profile.router_id,
            "docker_image": matched_profile.docker_image,
            "requires_compilation": matched_profile.requires_compilation,
            "file_extension": matched_profile.file_extension,
        }

    @staticmethod
    def verify_pipeline_consistency(
        frontend_lang: str,
        api_lang: str,
        router_lang: str,
        docker_image: Optional[str] = None,
    ) -> List[str]:
        mismatches = []
        audit = LanguageContractAuditor.audit_language_request(frontend_lang)
        if not audit["valid"]:
            mismatches.append(f"Invalid frontend language: {frontend_lang}")
            return mismatches

        canonical = audit["canonical_id"]
        profile = LANGUAGE_REGISTRY[canonical]

        if api_lang.lower() != profile.api_id:
            mismatches.append(
                f"API language mismatch: expected '{profile.api_id}', got '{api_lang}'"
            )

        if router_lang.lower() != profile.router_id:
            mismatches.append(
                f"Router language mismatch: expected '{profile.router_id}', got '{router_lang}'"
            )

        if docker_image and profile.docker_image not in docker_image:
            mismatches.append(
                f"Docker image mismatch: expected image containing '{profile.docker_image}', got '{docker_image}'"
            )

        return mismatches
