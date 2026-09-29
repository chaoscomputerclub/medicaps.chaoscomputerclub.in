"""
Chaos Computer Club — JavaScript Language Execution Adapter
Generates Solution class templates and trusted Node.js runner drivers.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class JavaScriptAdapter(BaseLanguageAdapter):
    language_name = "javascript"

    @staticmethod
    def _map_jsdoc_type(type_input: Any) -> str:
        try:
            td = parse_type_descriptor(type_input)
            base_map = {
                "int": "number",
                "float": "number",
                "boolean": "boolean",
                "string": "string",
                "object": "Object",
                "void": "void",
            }
            js_base = base_map.get(td.base, "any")
            if td.kind == TypeKind.ARRAY:
                res = js_base
                for _ in range(td.dimensions):
                    res = f"{res}[]"
                return res
            return js_base
        except Exception:
            return "any"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_jsdoc_type(signature.return_type)

        jsdoc_lines = ["/**"]
        for p in signature.parameters:
            t = self._map_jsdoc_type(p.type)
            jsdoc_lines.append(f" * @param {{{t}}} {p.name}")
        jsdoc_lines.append(f" * @return {{{ret_type}}}")
        jsdoc_lines.append(" */")
        jsdoc_str = "\n".join(jsdoc_lines)

        param_names = [p.name for p in signature.parameters]
        params_str = ", ".join(param_names)

        return (
            f"{jsdoc_str}\n"
            f"var {fn_name} = function({params_str}) {{\n"
            "    \n"
            "};\n"
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

        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
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
    let targetClass = null;
    try {{
        if (typeof {class_name} === 'function') {{
            targetClass = {class_name};
        }} else if (typeof Solution === 'function') {{
            targetClass = Solution;
        }}
    }} catch(e) {{
        try {{
            if (typeof Solution === 'function') targetClass = Solution;
        }} catch(e2) {{}}
    }}

    if (targetClass) {{
        try {{
            const inst = new targetClass();
            if (typeof inst['{fn_name}'] === 'function') {{
                targetFn = inst['{fn_name}'].bind(inst);
            }}
        }} catch(e) {{}}
    }}

    if (!targetFn && typeof {fn_name} === 'function') {{
        targetFn = {fn_name};
    }}

    if (!targetFn) {{
        console.error("Judge Error: Method '{fn_name}' or class {class_name} not found.");
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
    }} catch (err) {{
        console.error(`Runtime Exception in '{fn_name}': ${{err.stack || err}}`);
        process.exit(1);
    }}
}})();
"""
        return user_code + "\n" + driver
