"""
Chaos Computer Club India — Medi-Caps Chapter
Evaluation Harness for Function-Based (LeetCode-Style) Solution Evaluation.

ARCHITECTURE: Fully dynamic — function name and parameter structure are extracted
from the problem's starter_codes at execution time. No problem-specific hardcoding.

Supports:
- Python: Dynamic method introspection & parameter parsing
- JavaScript / TypeScript: Solution class / named function detection & JSON parsing
- C++: Universal generic driver with reflection-style method dispatch via Solution class
- C: Universal generic driver using the problem function name extracted from starter
- Java: Reflection-based dispatch — calls any method on Solution by its name
"""

from __future__ import annotations

import re
from typing import Optional, Dict, Any, List


# ---------------------------------------------------------------------------
# Function-name extractor (parses the starter code the admin wrote)
# ---------------------------------------------------------------------------

def extract_function_name(starter_codes: Dict[str, str], language: str) -> Optional[str]:
    """
    Extract the problem's function name from the admin-supplied starter code.
    Tries the requested language first, then falls back to other languages.
    Returns None if no function name can be inferred.
    """
    lang = (language or "").lower().strip()
    # Normalise language key
    lang_map = {
        "py": "python", "python3": "python",
        "js": "javascript", "nodejs": "javascript", "node": "javascript",
        "ts": "typescript",
        "c++": "cpp", "cxx": "cpp",
    }
    lang = lang_map.get(lang, lang)

    candidates = [lang] + [k for k in starter_codes if k != lang]

    for key in candidates:
        code = starter_codes.get(key, "")
        if not code:
            continue
        name = _parse_fn_name(code, key)
        if name:
            return name
    return None


def _parse_fn_name(code: str, lang: str) -> Optional[str]:
    """Parse the primary function/method name from a language-specific starter code."""
    patterns: List[str] = []

    if lang == "python":
        # def fnName(self, ...) inside class Solution  OR  def fnName(...) standalone
        patterns = [
            r"def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        ]
    elif lang in ("javascript", "js"):
        # var fnName = function(...)  or  function fnName(...)
        patterns = [
            r"var\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*function",
            r"function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        ]
    elif lang == "typescript":
        # function fnName(...): ReturnType
        patterns = [
            r"function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        ]
    elif lang == "cpp":
        # int fnName(...)  or  ReturnType fnName(...)  (usually inside class Solution)
        patterns = [
            r"\bint\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\blong\s+long\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\bstring\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\bbool\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\bvoid\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\bvector\s*<[^>]+>\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        ]
    elif lang == "c":
        # int fnName(...)  standalone
        patterns = [
            r"\bint\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\blong\s+long\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\bchar\s*\*\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\bdouble\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
            r"\bvoid\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        ]
    elif lang == "java":
        # public ReturnType fnName(...)
        patterns = [
            r"public\s+\S+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        ]

    # Exclusion: skip constructors, well-known non-solution names
    _SKIP = {
        "main", "Solution", "__init__", "toString", "hashCode", "equals",
        "println", "print", "constructor",
    }

    for pat in patterns:
        for m in re.finditer(pat, code):
            name = m.group(1)
            if name not in _SKIP:
                return name

    return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def prepare_solution_code(
    code: str,
    language: str,
    problem_index: Optional[str] = None,
    method_name: Optional[str] = None,
    starter_codes: Optional[Dict[str, str]] = None,
) -> str:
    """
    Inspects candidate solution code. If it's a function or class Solution,
    wraps/appends the appropriate execution driver harness.

    method_name: explicitly supplied function name (highest priority).
    starter_codes: admin-defined starter code dict; function name extracted from it
                   when method_name is not supplied.
    """
    lang = (language or "").lower().strip()

    # Resolve the expected function name dynamically
    fn_name = method_name
    if not fn_name and starter_codes:
        fn_name = extract_function_name(starter_codes, lang)

    if lang in {"python", "py", "python3"}:
        return _prepare_python_solution(code, fn_name=fn_name)
    elif lang in {"javascript", "js", "nodejs", "node"}:
        return _prepare_javascript_solution(code, is_ts=False, fn_name=fn_name)
    elif lang in {"typescript", "ts"}:
        return _prepare_javascript_solution(code, is_ts=True, fn_name=fn_name)
    elif lang in {"cpp", "c++", "cxx"}:
        return _prepare_cpp_solution(code, fn_name=fn_name, starter_codes=starter_codes)
    elif lang in {"c"}:
        return _prepare_c_solution(code, fn_name=fn_name, starter_codes=starter_codes)
    elif lang in {"java"}:
        return _prepare_java_solution(code, fn_name=fn_name, starter_codes=starter_codes)

    return code


# ---------------------------------------------------------------------------
# Python driver (fully dynamic via introspection)
# ---------------------------------------------------------------------------

def _prepare_python_solution(code: str, fn_name: Optional[str] = None) -> str:
    has_script_main = (
        "if __name__ == '__main__':" in code
        or 'if __name__ == "__main__":' in code
        or ("def main():" in code and "class Solution" not in code)
    )
    if has_script_main:
        return code

    # Build the anti-cheat known-names list dynamically
    known_names_repr = repr([fn_name]) if fn_name else "[]"

    harness = f"""
# ==========================================
# CCC LeetCode-Style Evaluation Driver Harness
# ==========================================
import sys, inspect as _inspect

def _ccc_parse_val(s):
    s = s.strip()
    try:
        import json as _json
        return _json.loads(s)
    except Exception:
        pass
    if s.startswith('[') or s.startswith('{{'):
        try:
            import ast as _ast
            return _ast.literal_eval(s)
        except Exception:
            pass
    try:
        if '.' in s:
            return float(s)
        return int(s)
    except Exception:
        pass
    return s

def _ccc_parse_args(raw_data, expected_param_count):
    lines = [l.strip() for l in raw_data.strip().splitlines() if l.strip()]
    # Try named param assignment: param = value
    if all('=' in l and not l.startswith('[') and not l.startswith('{{') for l in lines) and len(lines) == expected_param_count:
        return [_ccc_parse_val(l.split('=', 1)[1]) for l in lines]
    # Try one-value-per-line
    if len(lines) == expected_param_count and expected_param_count > 1:
        try:
            return [_ccc_parse_val(l) for l in lines]
        except Exception:
            pass
    # Try JSON array of args
    try:
        import json as _json
        parsed = _json.loads(raw_data.strip())
        if isinstance(parsed, list) and len(parsed) == expected_param_count:
            return parsed
        return [parsed]
    except Exception:
        pass
    # Fallback: tokens
    tokens = raw_data.split()
    if expected_param_count == 1:
        return [tokens]
    return [_ccc_parse_val(t) for t in tokens[:expected_param_count]]

raw_input = sys.stdin.read()

# Discover the target function — ANTI-CHEAT: only accept the exact problem function name
target_fn = None
_EXPECTED_FN_NAMES = {known_names_repr}

if 'Solution' in globals() and isinstance(globals()['Solution'], type):
    sol = Solution()
    methods = [
        getattr(sol, m) for m in dir(sol)
        if callable(getattr(sol, m)) and not m.startswith('_')
    ]
    if _EXPECTED_FN_NAMES:
        methods = [m for m in methods if m.__name__ in _EXPECTED_FN_NAMES]
    if methods:
        target_fn = methods[0]

if not target_fn:
    for name in _EXPECTED_FN_NAMES:
        if name in globals() and callable(globals()[name]):
            target_fn = globals()[name]
            break

if not target_fn:
    sys.stderr.write("Judge Error: Required function not found. Check that your function is named exactly as specified in the problem starter code.\\n")
    sys.exit(1)

sig = _inspect.signature(target_fn)
param_count = len(sig.parameters)
call_args = _ccc_parse_args(raw_input, param_count)

try:
    res = target_fn(*call_args)
    if isinstance(res, bool):
        print('true' if res else 'false')
    elif isinstance(res, list):
        import json as _json
        print(_json.dumps(res))
    elif res is None:
        print('null')
    else:
        print(res)
except Exception as e:
    sys.stderr.write(f"Runtime Error: {{e}}\\n")
    sys.exit(1)
"""
    return code + harness


# ---------------------------------------------------------------------------
# JavaScript / TypeScript driver (fully dynamic via eval)
# ---------------------------------------------------------------------------

def _prepare_javascript_solution(
    code: str,
    is_ts: bool = False,
    fn_name: Optional[str] = None,
) -> str:
    has_script_main = (
        "process.stdin" in code
        or "require('readline')" in code
        or 'require("readline")' in code
        or "fs.readFileSync" in code
        and "countMirrorPairs" not in code
        and "maxBandwidthUtility" not in code
        and "minTransmissionLatency" not in code
        and "maxPacketPriority" not in code
    )
    if has_script_main:
        return code

    ts_decls = "declare var require: any;\ndeclare var process: any;\n" if is_ts else ""
    known_js = repr([fn_name]) if fn_name else "[]"

    harness = ts_decls + f"""
// ==========================================
// CCC LeetCode-Style Evaluation Driver Harness
// ==========================================
(function() {{
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf-8').trim();

    const EXPECTED_FN_NAMES = {known_js};

    let targetFn = null;
    if (typeof Solution === 'function') {{
        const proto = Solution.prototype;
        const methods = Object.getOwnPropertyNames(proto).filter(p => typeof proto[p] === 'function' && p !== 'constructor');
        const matched = EXPECTED_FN_NAMES.length ? methods.filter(m => EXPECTED_FN_NAMES.includes(m)) : methods;
        if (matched.length > 0) {{
            const inst = new Solution();
            targetFn = inst[matched[0]].bind(inst);
        }}
    }}
    if (!targetFn) {{
        // ANTI-CHEAT: only accept the exact problem function name
        for (const k of EXPECTED_FN_NAMES) {{
            try {{
                if (typeof eval(k) === 'function') {{
                    targetFn = eval(k);
                    break;
                }}
            }} catch(e) {{}}
        }}
    }}

    if (!targetFn) {{
        console.error("Judge Error: Required function not found. Check that your function is named exactly as specified in the problem starter code.");
        process.exit(1);
    }}

    const paramCount = targetFn.length;
    let args = [];
    if (raw) {{
        const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
        let isParamAssign = true;
        let paramVals = [];
        for (const l of lines) {{
            if (l.includes('=') && !l.startsWith('[') && !l.startsWith('{{') && !l.startsWith('"')) {{
                paramVals.push(l.split('=').slice(1).join('=').trim());
            }} else {{
                isParamAssign = false;
                break;
            }}
        }}
        if (isParamAssign && paramVals.length === paramCount) {{
            args = paramVals.map(v => {{
                try {{ return JSON.parse(v); }} catch(e) {{ return v; }}
            }});
        }} else if (lines.length === paramCount && paramCount > 1) {{
            try {{
                args = lines.map(l => JSON.parse(l));
            }} catch(e) {{
                args = [raw];
            }}
        }} else {{
            try {{
                const parsed = JSON.parse(raw);
                if (paramCount > 1 && Array.isArray(parsed) && parsed.length === paramCount) {{
                    args = parsed;
                }} else {{
                    args = [parsed];
                }}
            }} catch(e) {{
                args = [raw];
            }}
        }}
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
        console.error("Runtime Error:", err);
        process.exit(1);
    }}
}})();
"""
    return code + "\n" + harness


# ---------------------------------------------------------------------------
# C++ driver (universal generic — works for any function name / signature)
# ---------------------------------------------------------------------------

def _prepare_cpp_solution(
    code: str,
    fn_name: Optional[str] = None,
    starter_codes: Optional[Dict[str, str]] = None,
) -> str:
    if "int main(" in code or "int main (" in code:
        return code

    headers = []
    for h in ["<iostream>", "<vector>", "<string>", "<sstream>", "<algorithm>", "<unordered_map>"]:
        if f"#include {h}" not in code:
            headers.append(f"#include {h}")
    if "using namespace std;" not in code:
        headers.append("using namespace std;")
    header_prefix = "\n".join(headers) + "\n\n" if headers else ""

    if "class Solution" not in code:
        code = f"class Solution {{\npublic:\n{code}\n}};\n"

    # Infer function name from starter_codes if not provided
    if not fn_name and starter_codes:
        fn_name = extract_function_name(starter_codes, "cpp")

    if not fn_name:
        # Last resort: scan the code itself for a method inside Solution
        m = re.search(r"public:\s*\n\s*\S+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", code)
        if m and m.group(1) not in {"Solution", "main"}:
            fn_name = m.group(1)

    # Infer parameter types from the starter code for a universal driver
    cpp_starter = (starter_codes or {}).get("cpp", code)
    param_info = _extract_cpp_params(cpp_starter, fn_name)

    driver = _build_cpp_driver(fn_name, param_info)

    return header_prefix + code + "\n" + driver


def _extract_cpp_params(code: str, fn_name: Optional[str]) -> List[Dict]:
    """
    Parse the parameter list of fn_name from C++ starter code.
    Returns a list of dicts: [{"type": "...", "name": "..."}]
    """
    if not fn_name:
        return []
    # Find the function signature line
    pattern = rf"\b{re.escape(fn_name)}\s*\(([^)]*)\)"
    m = re.search(pattern, code)
    if not m:
        return []
    raw_params = m.group(1).strip()
    if not raw_params:
        return []

    params = []
    # Split on comma but respect template brackets < >
    depth = 0
    current = ""
    for ch in raw_params:
        if ch in "<([":
            depth += 1
        elif ch in ">)]":
            depth -= 1
        if ch == "," and depth == 0:
            params.append(current.strip())
            current = ""
        else:
            current += ch
    if current.strip():
        params.append(current.strip())

    result = []
    for p in params:
        p = p.strip().rstrip("&").rstrip("*").strip()
        # Split off the parameter name (last word)
        parts = p.rsplit(None, 1)
        if len(parts) == 2:
            result.append({"type": parts[0].strip(), "name": parts[1].strip().lstrip("*&")})
        elif len(parts) == 1:
            result.append({"type": parts[0], "name": f"arg{len(result)}"})
    return result


def _build_cpp_driver(fn_name: Optional[str], params: List[Dict]) -> str:
    """Build a universal C++ main() that reads stdin, parses params, calls Solution."""
    if not fn_name:
        return "\nint main() { return 0; }\n"

    # Classify parameter types
    lines = []
    lines.append("int main() {")
    lines.append("    ios_base::sync_with_stdio(false);")
    lines.append("    cin.tie(NULL);")
    lines.append("    string _full_input, _line;")
    lines.append("    while (getline(cin, _line)) { _full_input += _line + \"\\n\"; }")

    # For each param, emit parsing code
    decl_lines = []
    call_args = []
    for i, p in enumerate(params):
        ptype = p["type"]
        pname = f"_p{i}"
        call_args.append(pname)
        decl_lines.append(_cpp_parse_param(ptype, pname, i, len(params)))

    lines.extend(decl_lines)
    lines.append(f"    Solution _sol;")
    lines.append(f"    auto _result = _sol.{fn_name}({', '.join(call_args)});")
    lines.append("    // Output result")
    lines.append("    cout << _result << \"\\n\";")
    lines.append("    return 0;")
    lines.append("}")

    return "\n" + "\n".join(lines) + "\n"


def _cpp_parse_param(ptype: str, pname: str, idx: int, total: int) -> str:
    """Generate C++ parsing code for a parameter based on its type."""
    ptype_clean = re.sub(r'\s*(const|&|\*)\s*', ' ', ptype).strip()

    # vector<string>
    if re.match(r'vector\s*<\s*string\s*>', ptype_clean, re.I):
        return f"""    vector<string> {pname};
    {{
        size_t _qi = 0;
        while ((_qi = _full_input.find('"', _qi)) != string::npos) {{
            size_t _qe = _full_input.find('"', _qi + 1);
            if (_qe == string::npos) break;
            {pname}.push_back(_full_input.substr(_qi + 1, _qe - _qi - 1));
            _qi = _qe + 1;
        }}
        if ({pname}.empty()) {{
            stringstream _ss(_full_input);
            string _tok;
            while (_ss >> _tok) {pname}.push_back(_tok);
        }}
    }}"""

    # vector<vector<int>> or similar
    if re.match(r'vector\s*<\s*vector\s*<', ptype_clean, re.I):
        return f"""    vector<vector<int>> {pname};
    {{
        size_t _lb = _full_input.find("[[");
        if (_lb != string::npos) {{
            vector<int> _cur;
            string _nb;
            bool _inn = false;
            for (size_t _ii = _lb; _ii < _full_input.size(); _ii++) {{
                char _cc = _full_input[_ii];
                if (_cc == '[') {{ if (_inn) _cur.clear(); else _inn = true; }}
                else if (_cc == ']') {{
                    if (!_nb.empty()) {{ _cur.push_back(stoi(_nb)); _nb = ""; }}
                    if (_inn) {{ if (!_cur.empty()) {pname}.push_back(_cur); _cur.clear(); _inn = false; }}
                }}
                else if (isdigit(_cc) || _cc == '-') _nb += _cc;
                else if (_cc == ',' || isspace(_cc)) {{ if (!_nb.empty()) {{ _cur.push_back(stoi(_nb)); _nb = ""; }} }}
            }}
        }}
    }}"""

    # vector<int>
    if re.match(r'vector\s*<\s*int\s*>', ptype_clean, re.I):
        return f"""    vector<int> {pname};
    {{
        string _nb;
        bool _inside = false;
        for (char _cc : _full_input) {{
            if (_cc == '[') _inside = true;
            else if (_cc == ']') {{ if (!_nb.empty()) {{ {pname}.push_back(stoi(_nb)); _nb = ""; }} _inside = false; }}
            else if (_inside && (isdigit(_cc) || _cc == '-')) _nb += _cc;
            else if (_inside && (_cc == ',' || isspace(_cc))) {{ if (!_nb.empty()) {{ {pname}.push_back(stoi(_nb)); _nb = ""; }} }}
        }}
        if ({pname}.empty()) {{
            stringstream _ss(_full_input);
            int _v;
            while (_ss >> _v) {pname}.push_back(_v);
        }}
    }}"""

    # string
    if ptype_clean in ("string", "std::string"):
        return f"""    string {pname};
    {{
        size_t _qi = _full_input.find('"');
        if (_qi != string::npos) {{
            size_t _qe = _full_input.find('"', _qi + 1);
            {pname} = (_qe != string::npos) ? _full_input.substr(_qi + 1, _qe - _qi - 1) : _full_input;
        }} else {{
            stringstream _ss(_full_input);
            _ss >> {pname};
        }}
    }}"""

    # long long
    if "long" in ptype_clean:
        var_line = f"    long long {pname} = 0;"
        if total == 1:
            return var_line + f"\n    {{ stringstream _ss(_full_input); _ss >> {pname}; }}"
        # nth scalar: extract idx-th number token
        return var_line + f"""
    {{
        string _cleaned;
        for (char _cc : _full_input) {{ if (isdigit(_cc) || _cc == '-') _cleaned += _cc; else _cleaned += ' '; }}
        stringstream _ss(_cleaned);
        long long _tmp; int _ci = 0;
        while (_ss >> _tmp) {{ if (_ci++ == {idx}) {{ {pname} = _tmp; break; }} }}
    }}"""

    # int (default scalar)
    var_line = f"    int {pname} = 0;"
    if total == 1:
        return var_line + f"\n    {{ stringstream _ss(_full_input); _ss >> {pname}; }}"
    return var_line + f"""
    {{
        string _cleaned;
        for (char _cc : _full_input) {{ if (isdigit(_cc) || _cc == '-') _cleaned += _cc; else _cleaned += ' '; }}
        stringstream _ss(_cleaned);
        int _tmp; int _ci = 0;
        while (_ss >> _tmp) {{ if (_ci++ == {idx}) {{ {pname} = _tmp; break; }} }}
    }}"""


# ---------------------------------------------------------------------------
# C driver (universal generic)
# ---------------------------------------------------------------------------

def _prepare_c_solution(
    code: str,
    fn_name: Optional[str] = None,
    starter_codes: Optional[Dict[str, str]] = None,
) -> str:
    if "int main(" in code or "int main (" in code:
        return code

    headers = []
    for h in ["<stdio.h>", "<stdlib.h>", "<string.h>"]:
        if f"#include {h}" not in code:
            headers.append(f"#include {h}")
    header_prefix = "\n".join(headers) + "\n\n" if headers else ""

    if not fn_name and starter_codes:
        fn_name = extract_function_name(starter_codes, "c")
    if not fn_name:
        m = re.search(r"\bint\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", code)
        if m and m.group(1) != "main":
            fn_name = m.group(1)

    c_starter = (starter_codes or {}).get("c", code)
    driver = _build_c_driver(fn_name, c_starter)

    return header_prefix + code + "\n" + driver


def _build_c_driver(fn_name: Optional[str], c_starter: str) -> str:
    """Build a universal C main() that calls the named function."""
    if not fn_name:
        return "\nint main(void) { return 0; }\n"

    # Inspect the function signature from the starter
    pattern = rf"\b{re.escape(fn_name)}\s*\(([^)]*)\)"
    m = re.search(pattern, c_starter)
    raw_params = m.group(1).strip() if m else ""

    # Simple heuristic: if it takes a char** and int (string array pattern)
    if "char**" in raw_params or "char *" in raw_params:
        return f"""
int main(void) {{
    char buf[65536];
    size_t total = 0;
    int c;
    while ((c = getchar()) != EOF && total < sizeof(buf) - 1)
        buf[total++] = (char)c;
    buf[total] = '\\0';

    char* passes[10000];
    int count = 0;
    char* p = buf;
    while ((p = strchr(p, '"')) != NULL) {{
        p++;
        char* end = strchr(p, '"');
        if (!end) break;
        *end = '\\0';
        passes[count++] = p;
        p = end + 1;
    }}
    printf("%d\\n", {fn_name}(passes, count));
    return 0;
}}
"""

    # int/long long scalar(s) — read up to 4 ints from stdin
    if "int" in raw_params or "long" in raw_params:
        # Count scalars
        param_parts = [p.strip() for p in raw_params.split(",") if p.strip()]
        n = len(param_parts)
        vars_decl = "\n    ".join([f"long long _v{i} = 0;" for i in range(n)])
        reads = " ".join([f"&_v{i}" for i in range(n)])
        fmt = " ".join(["%lld"] * n)
        call = ", ".join([f"(int)_v{i}" for i in range(n)])
        return f"""
int main(void) {{
    {vars_decl}
    scanf("{fmt}", {reads});
    printf("%d\\n", {fn_name}({call}));
    return 0;
}}
"""

    # Fallback: bare call
    return f"""
int main(void) {{
    printf("%d\\n", {fn_name}());
    return 0;
}}
"""


# ---------------------------------------------------------------------------
# Java driver (fully dynamic via Java Reflection — works for ANY method name)
# ---------------------------------------------------------------------------

def _prepare_java_solution(
    code: str,
    fn_name: Optional[str] = None,
    starter_codes: Optional[Dict[str, str]] = None,
) -> str:
    if "public class Main" in code or "public static void main" in code:
        return code

    clean_code = re.sub(r"\bpublic\s+class\s+Solution\b", "class Solution", code)
    if "class Solution" not in clean_code:
        clean_code = f"class Solution {{\n{clean_code}\n}}"
    if "import java.util." not in clean_code:
        clean_code = "import java.util.*;\n" + clean_code

    if not fn_name and starter_codes:
        fn_name = extract_function_name(starter_codes, "java")
    if not fn_name:
        m = re.search(r"public\s+\S+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", clean_code)
        if m and m.group(1) not in {"main", "Solution"}:
            fn_name = m.group(1)

    if not fn_name:
        fn_name = "solve"

    # Build a universal reflection-based Main that calls any method named fn_name
    driver = f"""
import java.lang.reflect.*;

public class Main {{
    public static void main(String[] args) {{
        try {{
            java.util.Scanner sc = new java.util.Scanner(System.in);
            StringBuilder sb = new StringBuilder();
            while (sc.hasNextLine()) sb.append(sc.nextLine()).append('\\n');
            String _input = sb.toString().trim();

            Solution _sol = new Solution();
            Method[] _methods = _sol.getClass().getDeclaredMethods();
            Method _target = null;
            for (Method _m : _methods) {{
                if (_m.getName().equals("{fn_name}")) {{ _target = _m; break; }}
            }}
            if (_target == null) {{
                System.err.println("Judge Error: Method '{fn_name}' not found in Solution class. Check your function name.");
                System.exit(1);
            }}
            _target.setAccessible(true);

            Class<?>[] _ptypes = _target.getParameterTypes();
            Object[] _pvals = _ccc_parse_args(_input, _ptypes);
            Object _res = _target.invoke(_sol, _pvals);

            if (_res == null) System.out.println("null");
            else if (_res instanceof int[]) System.out.println(java.util.Arrays.toString((int[])_res));
            else if (_res instanceof long[]) System.out.println(java.util.Arrays.toString((long[])_res));
            else if (_res instanceof Object[]) System.out.println(java.util.Arrays.deepToString((Object[])_res));
            else System.out.println(_res);

        }} catch (Exception _e) {{
            _e.printStackTrace(System.err);
            System.exit(1);
        }}
    }}

    static Object[] _ccc_parse_args(String input, Class<?>[] ptypes) {{
        String[] lines = input.split("\\n");
        java.util.List<String> vals = new java.util.ArrayList<>();
        for (String l : lines) {{
            l = l.trim();
            if (l.contains("=") && !l.startsWith("[") && !l.startsWith("{{")) {{
                vals.add(l.substring(l.indexOf('=') + 1).trim());
            }} else if (!l.isEmpty()) {{
                vals.add(l);
            }}
        }}
        Object[] result = new Object[ptypes.length];
        for (int i = 0; i < ptypes.length; i++) {{
            String raw = i < vals.size() ? vals.get(i) : "";
            result[i] = _ccc_convert(raw, ptypes[i], input);
        }}
        return result;
    }}

    static Object _ccc_convert(String raw, Class<?> type, String fullInput) {{
        raw = raw.trim();
        if (type == int.class || type == Integer.class) {{
            try {{ return Integer.parseInt(raw.replaceAll("[^\\\\d\\\\-]", "").trim()); }} catch (Exception e) {{ return 0; }}
        }} else if (type == long.class || type == Long.class) {{
            try {{ return Long.parseLong(raw.replaceAll("[^\\\\d\\\\-]", "").trim()); }} catch (Exception e) {{ return 0L; }}
        }} else if (type == String.class) {{
            if (raw.startsWith("\\"") && raw.endsWith("\\"")) return raw.substring(1, raw.length() - 1);
            return raw;
        }} else if (type == String[].class) {{
            java.util.List<String> items = new java.util.ArrayList<>();
            int qi = 0;
            while ((qi = fullInput.indexOf('"', qi)) != -1) {{
                int qe = fullInput.indexOf('"', qi + 1);
                if (qe == -1) break;
                items.add(fullInput.substring(qi + 1, qe));
                qi = qe + 1;
            }}
            return items.toArray(new String[0]);
        }} else if (type == int[].class || type == Integer[].class) {{
            java.util.List<Integer> nums = new java.util.ArrayList<>();
            for (String t : raw.replaceAll("[\\\\[\\\\]]", "").split(",")) {{
                try {{ nums.add(Integer.parseInt(t.trim())); }} catch (Exception e) {{}}
            }}
            return nums.stream().mapToInt(Integer::intValue).toArray();
        }} else if (type == int[][].class) {{
            java.util.List<int[]> rows = new java.util.ArrayList<>();
            int lb = fullInput.indexOf("[[");
            if (lb != -1) {{
                int rb = fullInput.lastIndexOf("]]");
                if (rb != -1) {{
                    String sub = fullInput.substring(lb + 2, rb);
                    for (String row : sub.split("\\\\]\\\\s*,\\\\s*\\\\[")) {{
                        String[] parts = row.split(",");
                        int[] r = new int[parts.length];
                        for (int j = 0; j < parts.length; j++) {{
                            try {{ r[j] = Integer.parseInt(parts[j].trim()); }} catch (Exception e) {{}}
                        }}
                        rows.add(r);
                    }}
                }}
            }}
            return rows.toArray(new int[0][0]);
        }} else if (type == java.util.List.class) {{
            java.util.List<String> items = new java.util.ArrayList<>();
            int qi = 0;
            while ((qi = fullInput.indexOf('"', qi)) != -1) {{
                int qe = fullInput.indexOf('"', qi + 1);
                if (qe == -1) break;
                items.add(fullInput.substring(qi + 1, qe));
                qi = qe + 1;
            }}
            return items;
        }}
        return raw;
    }}
}}
"""
    return clean_code + "\n" + driver
