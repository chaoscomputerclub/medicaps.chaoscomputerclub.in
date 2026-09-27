"""
Chaos Computer Club — JavaScript Language Execution Adapter
Generates Solution class templates and trusted Node.js runner drivers.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature


class JavaScriptAdapter(BaseLanguageAdapter):
    language_name = "javascript"

    @staticmethod
    def _map_jsdoc_type(dt: DataType) -> str:
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
            DataType.OBJECT: "Object",
            DataType.MAP: "Object",
        }
        return mapping.get(dt, "any")

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name
        ret_type = self._map_jsdoc_type(signature.return_type)

        jsdoc_lines = ["    /**"]
        for p in signature.parameters:
            t = self._map_jsdoc_type(p.type)
            jsdoc_lines.append(f"     * @param {{{t}}} {p.name}")
        jsdoc_lines.append(f"     * @return {{{ret_type}}}")
        jsdoc_lines.append("     */")
        jsdoc_str = "\n".join(jsdoc_lines)

        param_names = [p.name for p in signature.parameters]
        params_str = ", ".join(param_names)

        return (
            "class Solution {\n"
            f"{jsdoc_str}\n"
            f"    {fn_name}({params_str}) {{\n"
            "        \n"
            "    }\n"
            "}\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        has_script_main = (
            "process.stdin" in user_code
            or "require('readline')" in user_code
            or 'require("readline")' in user_code
            or "fs.readFileSync" in user_code
        )
        if has_script_main:
            return user_code

        fn_name = signature.name
        param_names = [p.name for p in signature.parameters]
        param_names_repr = json.dumps(param_names)

        driver = f"""
// ==========================================
// CCC Trusted Judge Execution Driver (Node.js)
// ==========================================
(function() {{
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf-8').trim();
    const paramNames = {param_names_repr};

    let args = [];
    if (raw) {{
        try {{
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && paramNames.length > 0) {{
                args = paramNames.map(p => parsed[p]);
            }} else if (Array.isArray(parsed)) {{
                args = parsed;
            }} else {{
                args = [parsed];
            }}
        }} catch(e) {{
            // Line based fallback
            const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
            if (lines.length === paramNames.length && paramNames.length > 1) {{
                args = lines.map(l => {{
                    try {{ return JSON.parse(l); }} catch(err) {{ return l; }}
                }});
            }} else {{
                args = [raw];
            }}
        }}
    }}

    let targetFn = null;
    if (typeof Solution === 'function') {{
        try {{
            const inst = new Solution();
            if (typeof inst.{fn_name} === 'function') {{
                targetFn = inst.{fn_name}.bind(inst);
            }}
        }} catch(e) {{}}
    }}

    if (!targetFn && typeof {fn_name} === 'function') {{
        targetFn = {fn_name};
    }}

    if (!targetFn) {{
        console.error("Judge Error: Method '{fn_name}' or class Solution not found.");
        process.exit(1);
    }}

    try {{
        const result = targetFn.apply(null, args);
        if (typeof result === 'boolean') {{
            console.log(result ? 'true' : 'false');
        }} else if (result !== undefined && result !== null && typeof result === 'object') {{
            console.log(JSON.stringify(result));
        }} else if (result === undefined) {{
            console.log('null');
        }} else {{
            console.log(result);
        }}
    }} catch(err) {{
        console.error("Runtime Error in '{fn_name}':", err);
        process.exit(1);
    }}
}})();
"""
        return user_code + "\n\n" + driver
