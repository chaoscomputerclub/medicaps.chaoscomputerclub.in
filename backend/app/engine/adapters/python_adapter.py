"""
Chaos Computer Club — Python Language Execution Adapter
Generates typed Solution class starter templates and trusted driver harnesses.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature


class PythonAdapter(BaseLanguageAdapter):
    language_name = "python"

    @staticmethod
    def _map_type(dt: DataType) -> str:
        mapping = {
            DataType.INTEGER: "int",
            DataType.LONG: "int",
            DataType.FLOAT: "float",
            DataType.DOUBLE: "float",
            DataType.BOOLEAN: "bool",
            DataType.STRING: "str",
            DataType.INTEGER_ARRAY: "list[int]",
            DataType.LONG_ARRAY: "list[int]",
            DataType.FLOAT_ARRAY: "list[float]",
            DataType.DOUBLE_ARRAY: "list[float]",
            DataType.STRING_ARRAY: "list[str]",
            DataType.BOOLEAN_ARRAY: "list[bool]",
            DataType.INTEGER_2D_ARRAY: "list[list[int]]",
            DataType.LONG_2D_ARRAY: "list[list[int]]",
            DataType.FLOAT_2D_ARRAY: "list[list[float]]",
            DataType.DOUBLE_2D_ARRAY: "list[list[float]]",
            DataType.STRING_2D_ARRAY: "list[list[str]]",
            DataType.OBJECT: "dict",
            DataType.MAP: "dict",
        }
        return mapping.get(dt, "Any")

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name
        ret_type = self._map_type(signature.return_type)

        if not signature.parameters:
            return (
                "class Solution:\n"
                f"    def {fn_name}(self) -> {ret_type}:\n"
                "        pass\n"
            )

        param_lines = []
        for p in signature.parameters:
            t = self._map_type(p.type)
            param_lines.append(f"        {p.name}: {t}")
        params_str = ",\n".join(param_lines)

        return (
            "class Solution:\n"
            f"    def {fn_name}(\n"
            "        self,\n"
            f"{params_str}\n"
            f"    ) -> {ret_type}:\n"
            "        pass\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        # Check if user already provided standalone script entry
        has_script_main = (
            "if __name__ == '__main__':" in user_code
            or 'if __name__ == "__main__":' in user_code
        )
        if has_script_main:
            return user_code

        fn_name = signature.name
        param_names = [p.name for p in signature.parameters]
        param_names_repr = json.dumps(param_names)

        # Trusted harness script appended after contestant's Solution
        driver = f"""
# ==========================================
# CCC Trusted Judge Execution Driver (Python)
# ==========================================
if __name__ == '__main__':
    import sys
    import json

    raw = sys.stdin.read().strip()
    args = []

    if raw:
        try:
            parsed = json.loads(raw)
            param_names = {param_names_repr}
            if isinstance(parsed, dict) and param_names:
                args = [parsed.get(p) for p in param_names]
            elif isinstance(parsed, list):
                args = parsed
            else:
                args = [parsed]
        except Exception:
            # Fallback for plain scalar or line-based inputs
            lines = [l.strip() for l in raw.splitlines() if l.strip()]
            param_names = {param_names_repr}
            if len(lines) == len(param_names) and len(param_names) > 1:
                args = []
                for l in lines:
                    try:
                        args.append(json.loads(l))
                    except Exception:
                        args.append(l)
            else:
                args = [raw]

    if 'Solution' not in globals():
        sys.stderr.write("Judge Error: class Solution not found in contestant submission.\\n")
        sys.exit(1)

    sol = Solution()
    if not hasattr(sol, "{fn_name}"):
        sys.stderr.write("Judge Error: method '{fn_name}' not found on Solution class.\\n")
        sys.exit(1)

    target_method = getattr(sol, "{fn_name}")

    try:
        result = target_method(*args)
        if isinstance(result, bool):
            print("true" if result else "false")
        elif isinstance(result, (list, tuple, dict)):
            print(json.dumps(result))
        elif result is None:
            print("null")
        else:
            print(result)
    except Exception as e:
        sys.stderr.write(f"Runtime Exception in '{fn_name}': {{e}}\\n")
        sys.exit(1)
"""
        return user_code + "\n" + driver
