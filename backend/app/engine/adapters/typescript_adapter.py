"""
Chaos Computer Club — TypeScript Language Execution Adapter
Generates typed Solution class templates and trusted execution drivers for Node.js/TypeScript.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature


class TypeScriptAdapter(BaseLanguageAdapter):
    language_name = "typescript"

    @staticmethod
    def _map_ts_type(dt: DataType) -> str:
        mapping = {
            DataType.INTEGER: "number",
            DataType.LONG: "number",
            DataType.FLOAT: "number",
            DataType.DOUBLE: "number",
            DataType.BOOLEAN: "boolean",
            DataType.STRING: "string",
            DataType.INTEGER_ARRAY: "number[]",
            DataType.LONG_ARRAY: "number[]",
            DataType.FLOAT_ARRAY: "number[]",
            DataType.DOUBLE_ARRAY: "number[]",
            DataType.STRING_ARRAY: "string[]",
            DataType.BOOLEAN_ARRAY: "boolean[]",
            DataType.INTEGER_2D_ARRAY: "number[][]",
            DataType.LONG_2D_ARRAY: "number[][]",
            DataType.FLOAT_2D_ARRAY: "number[][]",
            DataType.DOUBLE_2D_ARRAY: "number[][]",
            DataType.STRING_2D_ARRAY: "string[][]",
            DataType.OBJECT: "Record<string, any>",
            DataType.MAP: "Record<string, any>",
        }
        return mapping.get(dt, "any")

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name
        ret_type = self._map_ts_type(signature.return_type)

        params_list = [f"{p.name}: {self._map_ts_type(p.type)}" for p in signature.parameters]
        params_str = ", ".join(params_list)

        return (
            "class Solution {\n"
            f"    {fn_name}({params_str}): {ret_type} {{\n"
            "        \n"
            "    }\n"
            "}\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        fn_name = signature.name
        param_names = [p.name for p in signature.parameters]
        param_args = [f'parsed["{p}"]' for p in param_names]
        args_str = ", ".join(param_args)

        driver = f"""

// CCC Trusted Judge Execution Driver (TypeScript/Node.js)
(function _ccc_run() {{
    const fs = require('fs');
    try {{
        const raw = fs.readFileSync(0, 'utf-8').trim();
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const sol = new Solution();
        if (typeof sol['{fn_name}'] !== 'function') {{
            console.error('Error: Solution has no method named "{fn_name}"');
            process.exit(1);
        }}
        const result = sol['{fn_name}']({args_str});
        if (result === undefined || result === null) {{
            console.log('null');
        }} else {{
            console.log(JSON.stringify(result));
        }}
    }} catch (err) {{
        console.error('Runtime error in driver execution:', err);
        process.exit(1);
    }}
}})();
"""
        return user_code + "\n" + driver
