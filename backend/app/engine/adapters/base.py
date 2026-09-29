"""
Chaos Computer Club — Language Adapter Protocol & Interface
Defines the contract for language-specific starter code generators,
trusted execution drivers, and testcase input serializers.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from app.engine.contracts import FunctionSignature, DataType
from app.engine.binder import InputBinder, InputBindingError, BoundArgument


def resolve_dynamic_input(signature: FunctionSignature, raw_input: Any) -> Dict[str, Any]:
    """
    Backward-compatible dynamic parameter resolution helper.
    Delegates directly to InputBinder to produce a canonical {param_name: value} dictionary.
    """
    if not signature or not signature.parameters:
        return {}
    try:
        bound_args = InputBinder.bind(signature, raw_input)
        return InputBinder.to_dict(bound_args)
    except InputBindingError:
        # If binding fails due to partial/empty data, provide empty/null mapping safely
        return {p.name: None for p in signature.parameters}


class BaseLanguageAdapter(ABC):
    """Abstract base class for all language-specific function execution adapters."""

    language_name: str

    @abstractmethod
    def generate_starter_code(self, signature: FunctionSignature) -> str:
        """Generates idiomatic starter code template containing the Solution class and method."""
        pass

    @abstractmethod
    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        """
        Generates the complete trusted sandbox execution bundle:
        user_code + trusted runner driver that reads serialized input from stdin,
        calls Solution().<fn_name>(...), and writes JSON output to stdout.
        """
        pass

    def serialize_input(self, signature: FunctionSignature, raw_input: Any) -> str:
        """
        Serializes any dynamic structured or positional testcase input representation into
        a canonical JSON payload for the language driver.
        Uses InputBinder to guarantee strict positional binding and typed validation.
        """
        bound_args = InputBinder.bind(signature, raw_input)
        return InputBinder.to_serialized_payload(bound_args)

    def validate_contract(self, signature: FunctionSignature) -> List[str]:
        """Validates if the signature can be compiled and executed in this language."""
        errors: List[str] = []
        return errors
