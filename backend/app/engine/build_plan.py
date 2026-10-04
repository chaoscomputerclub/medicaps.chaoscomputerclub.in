"""
Chaos Computer Club — Canonical Source Build Plan & Builder Architecture
Authoritative abstraction for language compilation, preparation, and execution plans across all providers.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Union

from app.engine.enums import Language, SubmissionMode
from app.engine.contracts import FunctionSignature
from app.engine.languages import LanguageRegistry

logger = logging.getLogger(__name__)


@dataclass
class SourceBuildPlan:
    language: Language
    submission_mode: SubmissionMode
    user_source: str
    generated_source: str
    wrapper_source: Optional[str] = None
    entrypoint: str = "solution"
    compile_command: Optional[List[str]] = None
    run_command: List[str] = field(default_factory=list)
    input_adapter: Optional[str] = None
    output_adapter: Optional[str] = None
    compiler_version: Optional[str] = None
    runtime_version: Optional[str] = None
    architecture: str = "x86_64"
    sandbox_profile: str = "default"
    source_hash: str = ""
    wrapper_version: str = "v2"
    diagnostics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["language"] = self.language.value if hasattr(self.language, "value") else str(self.language)
        d["submission_mode"] = (
            self.submission_mode.value if hasattr(self.submission_mode, "value") else str(self.submission_mode)
        )
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SourceBuildPlan:
        lang = LanguageRegistry.normalize(data.get("language", "python"))
        raw_mode = data.get("submission_mode", "FUNCTION")
        mode = (
            SubmissionMode.FULL_PROGRAM
            if str(raw_mode).upper() in ("FULL_PROGRAM", "STDIN_STDOUT")
            else SubmissionMode.FUNCTION
        )
        return cls(
            language=lang,
            submission_mode=mode,
            user_source=data.get("user_source", ""),
            generated_source=data.get("generated_source", ""),
            wrapper_source=data.get("wrapper_source"),
            entrypoint=data.get("entrypoint", "solution"),
            compile_command=data.get("compile_command"),
            run_command=data.get("run_command", []),
            input_adapter=data.get("input_adapter"),
            output_adapter=data.get("output_adapter"),
            compiler_version=data.get("compiler_version"),
            runtime_version=data.get("runtime_version"),
            architecture=data.get("architecture", "x86_64"),
            sandbox_profile=data.get("sandbox_profile", "default"),
            source_hash=data.get("source_hash", ""),
            wrapper_version=data.get("wrapper_version", "v2"),
            diagnostics=data.get("diagnostics", {}),
        )


class SourcePlanBuilder:
    """Canonical factory for constructing executable SourceBuildPlans."""

    @staticmethod
    def build_plan(
        language: Union[str, Language],
        user_source: str,
        submission_mode: Optional[Union[str, SubmissionMode]] = None,
        function_signature: Optional[Union[Dict[str, Any], FunctionSignature]] = None,
        starter_codes: Optional[Dict[str, str]] = None,
        method_name: Optional[str] = None,
    ) -> SourceBuildPlan:
        lang_enum = LanguageRegistry.normalize(language)
        lang_config = LanguageRegistry.get_config(lang_enum)

        # 1. Determine canonical submission mode explicitly
        if submission_mode is not None:
            if isinstance(submission_mode, SubmissionMode):
                mode = submission_mode
            else:
                s_mode = str(submission_mode).strip().upper()
                if s_mode in ("FULL_PROGRAM", "STDIN_STDOUT"):
                    mode = SubmissionMode.FULL_PROGRAM
                else:
                    mode = SubmissionMode.FUNCTION
        else:
            if function_signature is not None:
                mode = SubmissionMode.FUNCTION
            else:
                mode = SubmissionMode.FULL_PROGRAM

        # 2. Build according to mode
        wrapper_source: Optional[str] = None
        if mode == SubmissionMode.FULL_PROGRAM:
            # FULL_PROGRAM: Never wrap user source into Solution class, namespace, or function.
            # Execute exactly as submitted.
            generated_source = user_source
            entrypoint = "main"
        else:
            # FUNCTION mode: Requires structured or inferred function contract
            sig: Optional[FunctionSignature] = None
            if function_signature:
                if isinstance(function_signature, FunctionSignature):
                    sig = function_signature
                else:
                    try:
                        sig = FunctionSignature(**function_signature)
                    except Exception as e:
                        logger.warning("Failed to deserialize function signature: %s", e)

            if not sig:
                # Infer minimal signature from method_name or starter_codes if possible
                from app.engine.harness import extract_function_name
                fn = method_name or (extract_function_name(starter_codes, lang_enum.value) if starter_codes else None) or "solution"
                sig = FunctionSignature(
                    function_name=fn,
                    parameters=[],
                    return_type="any",
                )

            adapter = LanguageRegistry.get_adapter(lang_enum)
            if adapter:
                generated_source = adapter.generate_wrapper(sig, user_source)
                wrapper_source = generated_source
            else:
                # Language has no function adapter (e.g., shell/sql)
                generated_source = user_source
            entrypoint = sig.name or sig.function_name or "solution"

        # Validate syntax/source sanity
        try:
            LanguageRegistry.validate_source(lang_enum, generated_source)
        except Exception as e:
            logger.warning("Source sanity check flagged warning for %s: %s", lang_enum.value, e)

        source_hash = hashlib.sha256(generated_source.encode("utf-8")).hexdigest()

        plan = SourceBuildPlan(
            language=lang_enum,
            submission_mode=mode,
            user_source=user_source,
            generated_source=generated_source,
            wrapper_source=wrapper_source,
            entrypoint=entrypoint,
            compile_command=list(lang_config.compile_command) if lang_config.compile_command else None,
            run_command=list(lang_config.run_command) if lang_config.run_command else [],
            compiler_version=lang_config.compiler_version,
            runtime_version=getattr(lang_config, "runtime_version", None) or lang_config.runtime,
            source_hash=source_hash,
            wrapper_version="v2",
            diagnostics={
                "language_id": lang_config.language_id,
                "requires_compile": lang_config.requires_compile,
                "source_bytes": len(generated_source.encode("utf-8")),
            },
        )
        return plan
