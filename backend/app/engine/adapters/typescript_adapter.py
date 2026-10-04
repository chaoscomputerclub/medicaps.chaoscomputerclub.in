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
        let targetCls = (typeof {class_name} === 'function') ? {class_name} : (typeof Solution === 'function' ? Solution : null);
        if (targetCls) {{
            try {{
                const sol = new targetCls();
                if (typeof sol['{fn_name}'] === 'function') {{
                    targetFn = sol['{fn_name}'].bind(sol);
                }} else if (typeof targetCls['{fn_name}'] === 'function') {{
                    targetFn = targetCls['{fn_name}'].bind(targetCls);
                }}
            }} catch(e) {{
                if (typeof targetCls['{fn_name}'] === 'function') {{
                    targetFn = targetCls['{fn_name}'].bind(targetCls);
                }}
            }}
        }}
        if (!targetFn && typeof {fn_name} === 'function') {{
            targetFn = {fn_name};
        }}
        if (!targetFn) {{
            process.stderr.write("FUNCTION_NOT_FOUND: Method '{fn_name}' or class {class_name} not found.\\n");
            process.exit(1);
        }}
        const result = targetFn(...args);
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
        process.stderr.write(`Runtime error in driver execution: ${{err.stack || err}}\\n`);
        process.exit(1);
    }}
}})();
"""
        return "// @ts-nocheck\n" + user_code + "\n" + driver
