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


def infer_function_signature_from_sources(
    starter_codes: Optional[Dict[str, str]],
    lang_str: str,
    user_source: str = "",
    method_name: Optional[str] = None,
) -> Tuple[str, List[Tuple[str, str]]]:
    """
    Infers function name and parameter list (name, type) from starter_codes or user_source.
    Handles Python, TypeScript, JavaScript, Java, C++, C, Go, and Rust formats.
    """
    import re
    from app.engine.harness import extract_function_name

    fn_name = method_name
    params: List[Tuple[str, str]] = []

    def _split_params(raw_params: str) -> List[Tuple[str, str]]:
        chunks = []
        cur = ""
        depth = 0
        for ch in raw_params:
            if ch in "<[{(":
                depth += 1
                cur += ch
            elif ch in ">])}":
                depth = max(0, depth - 1)
                cur += ch
            elif ch == "," and depth == 0:
                chunks.append(cur.strip())
                cur = ""
            else:
                cur += ch
        if cur.strip():
            chunks.append(cur.strip())

        parsed = []
        for idx, chunk in enumerate(chunks):
            chunk = chunk.strip()
            if not chunk or chunk == "self":
                continue
            if ":" in chunk:
                pname = chunk.split(":")[0].strip()
                ptype = chunk.split(":")[1].strip()
            else:
                parts = chunk.replace("&", " ").replace("*", " ").split()
                if len(parts) >= 2:
                    pname = parts[-1].strip()
                    ptype = parts[0].strip()
                elif len(parts) == 1:
                    pname = parts[0].strip()
                    ptype = "object"
                else:
                    pname = f"arg{idx}"
                    ptype = "object"

            # Sanitize identifier
            clean_name = re.sub(r"[^a-zA-Z0-9_]", "", pname)
            if not clean_name or clean_name[0].isdigit():
                clean_name = f"param_{idx}"
            parsed.append((clean_name, ptype or "object"))
        return parsed

    # 1. Search in starter_codes
    if starter_codes:
        if not fn_name:
            fn_name = starter_codes.get("function_name")
        candidates = [lang_str] + [k for k in starter_codes.keys() if k != lang_str and k not in ("function_name", "slug")]
        for c_lang in candidates:
            code = starter_codes.get(c_lang, "")
            if not code:
                continue
            # Python pattern
            m_py = re.search(r"def\s+([a-zA-Z_]\w*)\s*\((.*?)\)", code, re.DOTALL)
            if m_py:
                if not fn_name:
                    fn_name = m_py.group(1)
                if not params:
                    params = _split_params(m_py.group(2))
                if fn_name and params:
                    return fn_name, params
            # JS/TS pattern
            m_js = re.search(r"(?:function\s+([a-zA-Z_]\w*)|var\s+([a-zA-Z_]\w*)\s*=\s*function|([a-zA-Z_]\w*)\s*\()\s*\((.*?)\)", code, re.DOTALL)
            if m_js:
                extracted = m_js.group(1) or m_js.group(2) or m_js.group(3)
                if extracted and extracted != "function":
                    if not fn_name:
                        fn_name = extracted
                    if not params:
                        params = _split_params(m_js.group(4))
                    if fn_name and params:
                        return fn_name, params
            # C++/Java/C pattern
            m_c = re.search(r"(?:public\s+)?(?:static\s+)?(?:\w+\s+)?(?:bool|int|void|string|String|char|long|double|vector<[^>]+>)\s+([a-zA-Z_]\w*)\s*\((.*?)\)", code, re.DOTALL)
            if m_c:
                if not fn_name:
                    fn_name = m_c.group(1)
                if not params:
                    params = _split_params(m_c.group(2))
                if fn_name and params:
                    return fn_name, params

    # 2. Search in user_source if needed
    if user_source:
        m_py = re.search(r"def\s+([a-zA-Z_]\w*)\s*\((.*?)\)", user_source, re.DOTALL)
        if m_py:
            if not fn_name:
                fn_name = m_py.group(1)
            if not params:
                params = _split_params(m_py.group(2))
        else:
            m_js = re.search(r"(?:function\s+([a-zA-Z_]\w*)|var\s+([a-zA-Z_]\w*)\s*=\s*function|([a-zA-Z_]\w*)\s*\()\s*\((.*?)\)", user_source, re.DOTALL)
            if m_js:
                extracted = m_js.group(1) or m_js.group(2) or m_js.group(3)
                if extracted and extracted != "function":
                    if not fn_name:
                        fn_name = extracted
                    if not params:
                        params = _split_params(m_js.group(4))

    if not fn_name and starter_codes:
        fn_name = extract_function_name(starter_codes, lang_str)

    return fn_name or "solution", params


class SourcePlanBuilder:
    """Builds an executable SourceBuildPlan from user source and language metadata."""

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
            from app.engine.harness import extract_function_name
            fn_candidate = method_name or (extract_function_name(starter_codes, lang_enum.value) if starter_codes else None)
            if (function_signature is not None and bool(function_signature)) or fn_candidate:
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
                elif isinstance(function_signature, dict) and bool(function_signature):
                    try:
                        sig = FunctionSignature(**function_signature)
                    except Exception as e:
                        logger.warning("Failed to deserialize function signature: %s", e)

            if not sig or not getattr(sig, "name", "") or len(sig.parameters) == 0:
                inferred_fn, inferred_params = infer_function_signature_from_sources(
                    starter_codes=starter_codes,
                    lang_str=lang_enum.value,
                    user_source=user_source,
                    method_name=method_name or (getattr(sig, "name", "") if sig else None),
                )
                from app.engine.contracts import ParameterDefinition
                param_defs = [ParameterDefinition(name=pname, type=ptype) for pname, ptype in inferred_params]
                if not sig or not getattr(sig, "name", ""):
                    sig = FunctionSignature(
                        class_name="Solution",
                        name=inferred_fn or "solution",
                        function_name=inferred_fn or "solution",
                        parameters=param_defs,
                        return_type="any",
                    )
                elif len(sig.parameters) == 0 and param_defs:
                    sig.parameters = param_defs

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
