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
    // IMPORTANT: Do NOT trim raw here — user input may be a meaningful
    // whitespace-only string (e.g. s = " " for palindrome check).
    const raw = fs.readFileSync(0, 'utf-8');
    const paramNames = {param_names_repr};

    function _parseVal(s) {{
        try {{ return JSON.parse(s); }} catch(e) {{ return s; }}
    }}

    // Parse LeetCode-style "paramName = value" per-line format.
    // Handles multi-line bracket-enclosed values.
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
                let matched = false;
                for (let pi = 0; pi < paramNames.length; pi++) {{
                    const pn = paramNames[pi];
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
                    curValue += '\\n' + line;
                }}
            }} else {{
                curValue += '\\n' + line;
            }}

            for (let j = 0; j < trimmed.length; j++) {{
                const c = trimmed[j];
                if (c === '[' || c === '{{') depth++;
                else if (c === ']' || c === '}}') depth = Math.max(0, depth - 1);
            }}
        }}
        flushCurrent();

        if (filledCount === paramNames.length && results.every(r => r !== undefined)) {{
            return results;
        }}
        return null;
    }}

    let args = [];
    const rawTrimmed = raw.trim();

    if (rawTrimmed === '' && raw !== '') {{
        // Input was only whitespace (e.g. " ") — pass it as-is
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
                    // 3. Multi-line fallback
                    const lines = rawTrimmed.split('\\n').filter(l => l.trim());
                    if (lines.length === paramNames.length && paramNames.length > 1) {{
                        try {{
                            args = lines.map(l => JSON.parse(l.trim()));
                        }} catch(e2) {{
                            args = [rawTrimmed];
                        }}
                    }} else {{
                        args = [rawTrimmed];
                    }}
                }}
            }}
        }} else {{
            args = [rawTrimmed];
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
        process.stdout.write("\\n<<<CCC_RUNNER_RESULT>>>\\n" + JSON.stringify({{
            status: "FUNCTION_NOT_FOUND",
            error: "Method '{fn_name}' or class {class_name} not found."
        }}) + "\\n<<<CCC_RUNNER_RESULT>>>\\n");
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

        let canonicalVal = result;
        if (result === undefined) {{
            canonicalVal = "undefined";
        }}
        process.stdout.write("\\n<<<CCC_RUNNER_RESULT>>>\\n" + JSON.stringify({{
            status: "SUCCESS",
            return_value: canonicalVal
        }}) + "\\n<<<CCC_RUNNER_RESULT>>>\\n");
    }} catch (err) {{
        process.stderr.write(`Runtime Exception in '{fn_name}': ${{err.stack || err}}\\n`);
        process.stdout.write("\\n<<<CCC_RUNNER_RESULT>>>\\n" + JSON.stringify({{
            status: "RUNTIME_ERROR",
            error: String(err && err.message ? err.message : err)
        }}) + "\\n<<<CCC_RUNNER_RESULT>>>\\n");
        process.exit(1);
    }}
}})();
"""
        return user_code + "\n" + driver
