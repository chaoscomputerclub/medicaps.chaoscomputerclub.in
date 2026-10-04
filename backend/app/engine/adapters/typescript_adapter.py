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
        // IMPORTANT: Do NOT trim raw here — user input may be a meaningful
        // whitespace-only string (e.g. s = " " for palindrome check).
        const raw = fs.readFileSync(0, 'utf-8');
        const paramNames = {param_names_repr};

        function _parseVal(s) {{
            try {{ return JSON.parse(s); }} catch(e) {{ return s; }}
        }}

        // Parse LeetCode-style "paramName = value" per-line format.
        // Handles multi-line bracket-enclosed values (arrays, objects).
        // e.g.:
        //   s = "A man, a plan, a canal: Panama"
        //   nums = [2,7,11,15]
        //   target = 9
        function _parseParamAssign(input, paramNames) {{
            const lines = input.split('\\n');
            const results = new Array(paramNames.length);
            let filledCount = 0;
            let currentParamIdx = -1;
            let curValue = '';
            let depth = 0;

            const flushCurrent = function() {{
                if (currentParamIdx >= 0 && curValue !== '') {{
                    results[currentParamIdx] = _parseVal(curValue.trim());
                    filledCount++;
                    currentParamIdx = -1;
                    curValue = '';
                    depth = 0;
                }}
            }};

            for (let i = 0; i < lines.length; i++) {{
                const line = lines[i];
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (depth === 0) {{
                    // Try to match a param assignment start: "paramName = ..."
                    let matched = false;
                    for (let pi = 0; pi < paramNames.length; pi++) {{
                        const pn = paramNames[pi];
                        // Match "s = ...", "s= ...", "s =..." etc.
                        const re = new RegExp('^' + pn.replace(/[.*+?^${{}}()|[\\]\\\\]/g, '\\\\$&') + '\\\\s*=\\\\s*');
                        const m = re.exec(trimmed);
                        if (m) {{
                            flushCurrent();
                            currentParamIdx = pi;
                            curValue = trimmed.slice(m[0].length);
                            matched = true;
                            break;
                        }}
                    }}
                    if (!matched && currentParamIdx >= 0) {{
                        // Continuation of previous value
                        curValue += '\\n' + line;
                    }}
                }} else {{
                    // Inside brackets — accumulate
                    curValue += '\\n' + line;
                }}

                // Track bracket depth
                for (let j = 0; j < trimmed.length; j++) {{
                    const c = trimmed[j];
                    if (c === '[' || c === '{{') depth++;
                    else if (c === ']' || c === '}}') depth = Math.max(0, depth - 1);
                }}
            }}
            flushCurrent();

            // Only return if ALL params were found
            if (filledCount === paramNames.length && results.every(r => r !== undefined)) {{
                return results;
            }}
            return null;
        }}

        let args = [];
        const rawTrimmed = raw.trim();

        if (rawTrimmed === '' && raw !== '') {{
            // Input was only whitespace (e.g. " ") — pass it as-is as a single arg
            args = [raw];
        }} else if (rawTrimmed !== '') {{
            // 1. Try param=value line-format first (LeetCode standard)
            if (paramNames.length > 0) {{
                const assigned = _parseParamAssign(rawTrimmed, paramNames);
                if (assigned !== null) {{
                    args = assigned;
                }} else {{
                    // 2. Try JSON parse
                    try {{
                        const parsed = JSON.parse(rawTrimmed);
                        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {{
                            if (paramNames.every(p => p in parsed)) {{
                                args = paramNames.map(p => parsed[p]);
                            }} else if (paramNames.length === 1 && Object.keys(parsed).length === 1) {{
                                args = [Object.values(parsed)[0]];
                            }} else if (Object.keys(parsed).length === paramNames.length) {{
                                args = Object.values(parsed);
                            }} else {{
                                args = paramNames.map(p => parsed[p] !== undefined ? parsed[p] : Object.values(parsed)[0]);
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
                        // 3. Multi-line JSON fallback (one value per line)
                        const lines = rawTrimmed.split('\\n').filter(l => l.trim());
                        if (lines.length === paramNames.length && paramNames.length > 1) {{
                            args = lines.map(l => {{ try {{ return JSON.parse(l.trim()); }} catch(err) {{ return l; }} }});
                        }} else {{
                            args = [rawTrimmed];
                        }}
                    }}
                }}
            }} else {{
                args = [rawTrimmed];
            }}
        }}
        // If raw was empty and rawTrimmed was empty, args stays [] (no-arg function)

        let targetFn = null;
        let targetCls = null;
        try {{ targetCls = (typeof {class_name} === 'function') ? {class_name} : (typeof Solution === 'function' ? Solution : null); }} catch(e) {{ try {{ targetCls = (typeof Solution === 'function' ? Solution : null); }} catch(e2) {{}} }}
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
        if (!targetFn) {{
            try {{ if (typeof {fn_name} === 'function') targetFn = {fn_name}; }} catch(e) {{}}
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
