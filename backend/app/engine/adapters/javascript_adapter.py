"""
Chaos Computer Club — JavaScript Language Execution Adapter
Generates Solution class templates and deterministic trusted Node.js runner drivers.
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
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {{
                if (paramNames.length > 0 && paramNames.every(p => p in parsed)) {{
                    args = paramNames.map(p => parsed[p]);
                }} else if (paramNames.length === 1 && Object.keys(parsed).length === 1) {{
                    args = [Object.values(parsed)[0]];
                }} else if (paramNames.length > 0 && Object.keys(parsed).length === paramNames.length) {{
                    args = Object.values(parsed);
                }} else if (paramNames.length > 0) {{
                    args = paramNames.map(p => parsed[p] !== undefined ? parsed[p] : Object.values(parsed)[0]);
                }} else {{
                    args = Object.values(parsed);
                }}
            }} else if (Array.isArray(parsed)) {{
                if (paramNames.length === 1) {{
                    args = [parsed];
                }} else if (parsed.length === paramNames.length) {{
                    args = parsed;
                }} else {{
                    args = [parsed];
                }}
            }} else {{
                args = [parsed];
            }}
        }} catch(e) {{
            // Line-based fallback
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
            }} else if (typeof targetClass['{fn_name}'] === 'function') {{
                targetFn = targetClass['{fn_name}'].bind(targetClass);
            }}
        }} catch(e) {{
            if (typeof targetClass['{fn_name}'] === 'function') {{
                targetFn = targetClass['{fn_name}'].bind(targetClass);
            }}
        }}
    }}

    if (!targetFn) {{
        try {{
            if (typeof {fn_name} === 'function') {{
                targetFn = {fn_name};
            }}
        }} catch(e) {{}}
    }}

    if (!targetFn) {{
        process.stderr.write("FUNCTION_NOT_FOUND: Method '{fn_name}' or class {class_name} not found.\\n");
        process.exit(1);
    }}

    try {{
        const result = targetFn.apply(null, args);
        if (typeof result === 'boolean') {{
            process.stdout.write((result ? 'true' : 'false') + '\\n');
        }} else if (result === null) {{
            process.stdout.write('null\\n');
        }} else if (result === undefined) {{
            process.stdout.write('undefined\\n');
        }} else if (typeof result === 'object') {{
            process.stdout.write(JSON.stringify(result) + '\\n');
        }} else {{
            process.stdout.write(String(result) + '\\n');
        }}
    }} catch (err) {{
        process.stderr.write(`Runtime Exception in '{fn_name}': ${{err.stack || err}}\\n`);
        process.exit(1);
    }}
}})();
"""
        return user_code + "\n" + driver
