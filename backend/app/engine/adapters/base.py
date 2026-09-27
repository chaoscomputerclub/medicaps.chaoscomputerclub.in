"""
Chaos Computer Club — Language Adapter Protocol & Interface
Defines the contract for language-specific starter code generators,
trusted execution drivers, and testcase input serializers.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List
from app.engine.contracts import FunctionSignature, DataType


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

    def serialize_input(self, signature: FunctionSignature, input_dict: Dict[str, Any]) -> str:
        """
        Serializes structured input argument dictionary into stdin payload for the driver.
        By default, serializes as a canonical JSON object {param_name: value}.
        """
        # Ensure ordered argument dictionary according to signature
        ordered_args = {}
        for param in signature.parameters:
            if param.name in input_dict:
                ordered_args[param.name] = input_dict[param.name]
            else:
                ordered_args[param.name] = None
        return json.dumps(ordered_args)

    def validate_contract(self, signature: FunctionSignature) -> List[str]:
        """Validates if the signature can be compiled and executed in this language."""
        errors: List[str] = []
        return errors
