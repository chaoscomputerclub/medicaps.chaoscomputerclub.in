"""
Chaos Computer Club — Execution Strategy Factory
Instantiates and routes the appropriate execution strategy based on canonical LanguageConfig.
"""

from __future__ import annotations

from typing import Any

from app.engine.languages import LanguageConfig, LanguageFamily, LanguageRegistry
from app.engine.strategy.base import ExecutionStrategy
from app.engine.strategy.compiled_strategy import NativeCompiledExecutionStrategy
from app.engine.strategy.interpreted_strategy import InterpretedExecutionStrategy
from app.engine.strategy.vm_strategy import VMExecutionStrategy


def get_strategy(config: LanguageConfig) -> ExecutionStrategy:
    """Instantiate appropriate execution strategy for the given LanguageConfig."""
    if config.family == LanguageFamily.INTERPRETED:
        return InterpretedExecutionStrategy(config)
    elif config.family == LanguageFamily.VM:
        return VMExecutionStrategy(config)
    elif config.family == LanguageFamily.COMPILED:
        return NativeCompiledExecutionStrategy(config)
    else:
        # Fallback to compiled
        return NativeCompiledExecutionStrategy(config)


def get_strategy_for_language(lang_input: Any) -> ExecutionStrategy:
    """Resolve language and return its configured ExecutionStrategy."""
    config = LanguageRegistry.get_config(lang_input)
    return get_strategy(config)
