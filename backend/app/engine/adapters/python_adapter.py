"""
Chaos Computer Club — Python Language Execution Adapter
Generates typed Solution class starter templates and trusted driver harnesses.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class PythonAdapter(BaseLanguageAdapter):
    language_name = "python"

    @staticmethod
    def _map_type(type_input: Any) -> str:
        try:
            td = parse_type_descriptor(type_input)
            base_map = {
                "int": "int",
                "float": "float",
                "boolean": "bool",
                "string": "str",
                "object": "dict",
                "void": "None",
            }
            py_base = base_map.get(td.base, "Any")
            if td.kind == TypeKind.ARRAY:
                res = py_base
                for _ in range(td.dimensions):
                    res = f"list[{res}]"
                return res
            if td.is_nullable:
                return f"Optional[{py_base}]"
            return py_base
        except Exception:
            return "Any"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_type(signature.return_type)

        if not signature.parameters:
            return (
                f"class {class_name}:\n"
                f"    def {fn_name}(self) -> {ret_type}:\n"
                "        pass\n"
            )

        param_lines = []
        for p in signature.parameters:
            t = self._map_type(p.type)
            param_lines.append(f"        {p.name}: {t}")
        params_str = ",\n".join(param_lines)

        return (
            f"class {class_name}:\n"
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

        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
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

    target_method = None
    target_cls = globals().get('{class_name}') or globals().get('Solution')
    if target_cls:
        try:
            sol = target_cls()
            if hasattr(sol, "{fn_name}"):
                target_method = getattr(sol, "{fn_name}")
        except Exception:
            pass

    if not target_method:
        candidate_fn = globals().get('{fn_name}')
        if callable(candidate_fn):
            target_method = candidate_fn

    if not target_method:
        sys.stderr.write("Judge Error: method '{fn_name}' or class {class_name} not found in submission.\\n")
        sys.exit(1)

    try:
        result = target_method(*args)
        if isinstance(result, bool):
            print("true" if result else "false")
        elif isinstance(result, (list, tuple, dict)):
            print(json.dumps(result, ensure_ascii=False))
        elif result is None:
            print("null")
        else:
            print(result)
    except Exception as e:
        sys.stderr.write(f"Runtime Exception in '{fn_name}': {{e}}\\n")
        sys.exit(1)
"""
        return user_code + "\n" + driver
