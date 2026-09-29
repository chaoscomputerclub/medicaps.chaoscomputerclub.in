"""
Chaos Computer Club — TypeScript Language Execution Adapter
Generates typed Solution class templates and trusted execution drivers for Node.js/TypeScript.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class TypeScriptAdapter(BaseLanguageAdapter):
    language_name = "typescript"

    @staticmethod
    def _map_ts_type(type_input: Any) -> str:
        try:
            td = parse_type_descriptor(type_input)
            base_map = {
                "int": "number",
                "float": "number",
                "boolean": "boolean",
                "string": "string",
                "object": "Record<string, any>",
                "void": "void",
            }
            ts_base = base_map.get(td.base, "any")
            if td.kind == TypeKind.ARRAY:
                res = ts_base
                for _ in range(td.dimensions):
                    res = f"{res}[]"
                return res
            if td.is_nullable:
                return f"{ts_base} | null"
            return ts_base
        except Exception:
            return "any"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_ts_type(signature.return_type)

        params_list = [f"{p.name}: {self._map_ts_type(p.type)}" for p in signature.parameters]
        params_str = ", ".join(params_list)

        return (
            f"class {class_name} {{\n"
            f"    {fn_name}({params_str}): {ret_type} {{\n"
            "        \n"
            "    }\n"
            "}\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
        param_names = [p.name for p in signature.parameters]
        param_names_repr = json.dumps(param_names)

        driver = f"""

// CCC Trusted Judge Execution Driver (TypeScript/Node.js)
(function _ccc_run() {{
    const fs = require('fs');
    try {{
        const raw = fs.readFileSync(0, 'utf-8').trim();
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const paramNames = {param_names_repr};

        let args = [];
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && paramNames.length > 0) {{
            args = paramNames.map(p => parsed[p]);
        }} else if (Array.isArray(parsed)) {{
            args = parsed;
        }} else {{
            args = [parsed];
        }}

        let targetCls = (typeof {class_name} === 'function') ? {class_name} : (typeof Solution === 'function' ? Solution : null);
        if (!targetCls) {{
            console.error('Error: Class {class_name} not found');
            process.exit(1);
        }}
        const sol = new targetCls();
        if (typeof sol['{fn_name}'] !== 'function') {{
            console.error('Error: Method "{fn_name}" not found on {class_name}');
            process.exit(1);
        }}
        const result = sol['{fn_name}'](...args);
        if (result === undefined || result === null) {{
            console.log('null');
        }} else if (typeof result === 'boolean') {{
            console.log(result ? 'true' : 'false');
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
