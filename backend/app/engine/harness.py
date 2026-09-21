"""
Chaos Computer Club India — Medi-Caps Chapter
Evaluation Harness for Function-Based (LeetCode-Style) Solution Evaluation.

Supports:
- Python: Dynamic method introspection & parameter parsing
- JavaScript: Solution class / function detection & JSON parsing
- C++: Solution class driver injection with JSON/token stream parsing
- Backward-compatible fallback for raw competitive programming scripts with main()
"""

from __future__ import annotations

import re
from typing import Optional, Dict, Any


def prepare_solution_code(
    code: str,
    language: str,
    problem_index: Optional[str] = None,
    method_name: Optional[str] = None,
) -> str:
    """
    Inspects candidate solution code. If it's a function or class Solution,
    wraps/appends the appropriate execution driver harness.
    If the candidate already submitted an explicit main() entrypoint,
    leaves the code untouched for backward compatibility.
    """
    lang = (language or "").lower().strip()

    if lang in {"python", "py", "python3"}:
        return _prepare_python_solution(code)
    elif lang in {"javascript", "js", "nodejs", "node", "typescript", "ts"}:
        return _prepare_javascript_solution(code)
    elif lang in {"cpp", "c++", "cxx"}:
        return _prepare_cpp_solution(code, problem_index=problem_index, method_name=method_name)
    elif lang in {"java"}:
        return _prepare_java_solution(code)

    return code


def _prepare_python_solution(code: str) -> str:
    # If code already has a standalone main script and NO class Solution / method, leave as-is
    has_script_main = (
        "if __name__ == '__main__':" in code
        or "if __name__ == \"__main__\":" in code
        or ("def main():" in code and "class Solution" not in code)
    )
    if has_script_main:
        return code

    harness = """
# ==========================================
# CCC LeetCode-Style Evaluation Driver Harness
# ==========================================
if __name__ == '__main__':
    import sys
    import json
    import inspect
    import ast

    def _ccc_parse_val(val_str):
        val_str = val_str.strip()
        try:
            return json.loads(val_str)
        except Exception:
            try:
                return ast.literal_eval(val_str)
            except Exception:
                return val_str

    def _ccc_parse_args(raw_data, expected_param_count):
        raw_data = raw_data.strip()
        if not raw_data:
            return []

        lines = [l.strip() for l in raw_data.splitlines() if l.strip()]

        # 1. Parameter assignment syntax: e.g. "passes = [...]", "k = 3"
        param_vals = []
        is_all_param = True
        for l in lines:
            if '=' in l and not (l.startswith('[') or l.startswith('{') or l.startswith('"')):
                param_vals.append(l.split('=', 1)[1].strip())
            else:
                is_all_param = False
                break

        if is_all_param and len(param_vals) == expected_param_count:
            return [_ccc_parse_val(v) for v in param_vals]

        # 2. Multi-line inputs where each line is one JSON arg
        if len(lines) == expected_param_count and expected_param_count > 1:
            try:
                return [_ccc_parse_val(l) for l in lines]
            except Exception:
                pass

        # 3. Whole raw as single JSON object / array / primitive
        try:
            parsed = _ccc_parse_val(raw_data)
            if expected_param_count > 1 and isinstance(parsed, list) and len(parsed) == expected_param_count:
                return parsed
            if expected_param_count == 1:
                return [parsed]
        except Exception:
            pass

        # 4. Fallback: space-delimited tokens
        tokens = raw_data.split()
        if expected_param_count == 1:
            return [tokens]
        return [_ccc_parse_val(t) for t in tokens[:expected_param_count]]

    raw_input = sys.stdin.read()

    # Discover Solution method
    target_fn = None
    if 'Solution' in globals() and isinstance(globals()['Solution'], type):
        sol = Solution()
        methods = [
            getattr(sol, m) for m in dir(sol)
            if callable(getattr(sol, m)) and not m.startswith('_')
        ]
        if methods:
            target_fn = methods[0]

    if not target_fn:
        known_names = [
            'countMirrorPairs',
            'maxBandwidthUtility',
            'minTransmissionLatency',
            'maxPacketPriority',
            'solve',
            'solution',
        ]
        for name in known_names:
            if name in globals() and callable(globals()[name]):
                target_fn = globals()[name]
                break

    if not target_fn:
        # Check any globally defined function
        for k, v in list(globals().items()):
            if callable(v) and not k.startswith('_') and not inspect.isclass(v) and not inspect.ismodule(v):
                target_fn = v
                break

    if not target_fn:
        sys.stderr.write("Judge Harness Error: No Solution class method or solution function found.\\n")
        sys.exit(1)

    sig = inspect.signature(target_fn)
    param_count = len(sig.parameters)
    call_args = _ccc_parse_args(raw_input, param_count)

    try:
        res = target_fn(*call_args)
        if isinstance(res, bool):
            print("true" if res else "false")
        elif isinstance(res, (list, dict)):
            print(json.dumps(res, separators=(',', ':')))
        elif res is None:
            print("null")
        else:
            print(res)
    except Exception as exc:
        sys.stderr.write(f"Runtime Exception: {exc}\\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
"""
    return code + "\n" + harness


def _prepare_javascript_solution(code: str) -> str:
    # If code already reads stdin and has no class Solution or function assignment, leave as-is
    has_script_main = (
        ("readFileSync(0" in code or "readline" in code)
        and "class Solution" not in code
        and "countMirrorPairs" not in code
        and "maxBandwidthUtility" not in code
        and "minTransmissionLatency" not in code
        and "maxPacketPriority" not in code
    )
    if has_script_main:
        return code

    harness = """
// ==========================================
// CCC LeetCode-Style Evaluation Driver Harness
// ==========================================
(function() {
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf-8').trim();

    let targetFn = null;
    if (typeof Solution === 'function') {
        const proto = Solution.prototype;
        const methods = Object.getOwnPropertyNames(proto).filter(p => typeof proto[p] === 'function' && p !== 'constructor');
        if (methods.length > 0) {
            const inst = new Solution();
            targetFn = inst[methods[0]].bind(inst);
        }
    }
    if (!targetFn) {
        const known = ['countMirrorPairs', 'maxBandwidthUtility', 'minTransmissionLatency', 'maxPacketPriority', 'solve', 'solution'];
        for (const k of known) {
            try {
                if (typeof eval(k) === 'function') {
                    targetFn = eval(k);
                    break;
                }
            } catch(e) {}
        }
    }

    if (!targetFn) {
        console.error("Judge Harness Error: No Solution class method or solution function found.");
        process.exit(1);
    }

    const paramCount = targetFn.length;
    let args = [];
    if (raw) {
        const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
        let isParamAssign = true;
        let paramVals = [];
        for (const l of lines) {
            if (l.includes('=') && !l.startsWith('[') && !l.startsWith('{') && !l.startsWith('"')) {
                paramVals.push(l.split('=').slice(1).join('=').trim());
            } else {
                isParamAssign = false;
                break;
            }
        }
        if (isParamAssign && paramVals.length === paramCount) {
            args = paramVals.map(v => {
                try { return JSON.parse(v); } catch(e) { return v; }
            });
        } else if (lines.length === paramCount && paramCount > 1) {
            try {
                args = lines.map(l => JSON.parse(l));
            } catch(e) {
                args = [raw];
            }
        } else {
            try {
                const parsed = JSON.parse(raw);
                if (paramCount > 1 && Array.isArray(parsed) && parsed.length === paramCount) {
                    args = parsed;
                } else {
                    args = [parsed];
                }
            } catch(e) {
                args = [raw];
            }
        }
    }

    try {
        const result = targetFn.apply(null, args);
        if (typeof result === 'boolean') {
            console.log(result ? 'true' : 'false');
        } else if (result !== undefined && result !== null && typeof result === 'object') {
            console.log(JSON.stringify(result));
        } else if (result === undefined) {
            console.log('null');
        } else {
            console.log(result);
        }
    } catch(err) {
        console.error("Runtime Error:", err);
        process.exit(1);
    }
})();
"""
    return code + "\n" + harness


def _prepare_cpp_solution(
    code: str,
    problem_index: Optional[str] = None,
    method_name: Optional[str] = None,
) -> str:
    # If code already has a custom main(), leave as-is
    if "int main(" in code or "int main (" in code:
        return code

    # Ensure required headers exist
    headers = []
    if "#include <iostream>" not in code:
        headers.append("#include <iostream>")
    if "#include <vector>" not in code:
        headers.append("#include <vector>")
    if "#include <string>" not in code:
        headers.append("#include <string>")
    if "#include <sstream>" not in code:
        headers.append("#include <sstream>")
    if "#include <algorithm>" not in code:
        headers.append("#include <algorithm>")
    if "using namespace std;" not in code:
        headers.append("using namespace std;")

    header_prefix = "\n".join(headers) + "\n\n" if headers else ""

    # Detect which problem or method
    idx = (problem_index or "").upper()
    if not idx:
        if "countMirrorPairs" in code:
            idx = "A"
        elif "maxBandwidthUtility" in code:
            idx = "B"
        elif "minTransmissionLatency" in code:
            idx = "C"
        elif "maxPacketPriority" in code:
            idx = "D"

    if idx == "A" or "countMirrorPairs" in (method_name or ""):
        driver = """
// ==========================================
// CCC LeetCode-Style Driver for Problem A
// ==========================================
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    vector<string> passes;
    string full_input, line;
    while (getline(cin, line)) {
        full_input += line + "\\n";
    }
    size_t i = 0;
    while (i < full_input.size()) {
        if (full_input[i] == '"' || full_input[i] == '\\'') {
            char quote = full_input[i++];
            string s = "";
            while (i < full_input.size() && full_input[i] != quote) {
                s += full_input[i++];
            }
            passes.push_back(s);
            if (i < full_input.size()) i++;
        } else {
            i++;
        }
    }
    if (passes.empty()) {
        stringstream ss(full_input);
        int n = 0;
        if (ss >> n) {
            string s;
            while (ss >> s) passes.push_back(s);
        }
    }
    Solution sol;
    cout << sol.countMirrorPairs(passes) << "\\n";
    return 0;
}
"""
    elif idx == "B" or "maxBandwidthUtility" in (method_name or ""):
        driver = """
// ==========================================
// CCC LeetCode-Style Driver for Problem B
// ==========================================
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string full_input, line;
    while (getline(cin, line)) {
        full_input += line + "\\n";
    }
    int k = 0, m = 0;
    vector<vector<int>> processes;

    // Parse k and m
    string cleaned = "";
    bool in_processes = false;
    for (size_t i = 0; i < full_input.size(); i++) {
        if (full_input.substr(i, 9) == "processes") {
            in_processes = true;
            i += 8;
            continue;
        }
        if (!in_processes) {
            if (isdigit(full_input[i]) || full_input[i] == '-') cleaned += full_input[i];
            else cleaned += ' ';
        }
    }
    stringstream ss_head(cleaned);
    ss_head >> k >> m;

    size_t start_proc = full_input.find('[');
    if (start_proc != string::npos) {
        vector<int> cur;
        string num_buf = "";
        bool inside_inner = false;
        for (size_t i = start_proc; i < full_input.size(); i++) {
            char c = full_input[i];
            if (c == '[') {
                if (inside_inner) cur.clear();
                else inside_inner = true;
            } else if (c == ']') {
                if (!num_buf.empty()) {
                    cur.push_back(stoi(num_buf));
                    num_buf = "";
                }
                if (inside_inner) {
                    if (!cur.empty()) processes.push_back(cur);
                    cur.clear();
                    inside_inner = false;
                }
            } else if (isdigit(c) || c == '-') {
                num_buf += c;
            } else if (c == ',' || isspace(c)) {
                if (!num_buf.empty()) {
                    cur.push_back(stoi(num_buf));
                    num_buf = "";
                }
            }
        }
    }
    if (processes.empty()) {
        stringstream ss_all(full_input);
        if (ss_all >> k >> m) {
            int a, b, c;
            while (ss_all >> a >> b >> c) {
                processes.push_back({a, b, c});
            }
        }
    }
    Solution sol;
    cout << sol.maxBandwidthUtility(k, m, processes) << "\\n";
    return 0;
}
"""
    elif idx == "C" or "minTransmissionLatency" in (method_name or ""):
        driver = """
// ==========================================
// CCC LeetCode-Style Driver for Problem C
// ==========================================
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string full_input, line;
    while (getline(cin, line)) {
        full_input += line + "\\n";
    }
    int n = 0, m = 0, k = 0;
    vector<vector<int>> channels;

    string cleaned = "";
    bool in_channels = false;
    for (size_t i = 0; i < full_input.size(); i++) {
        if (full_input.substr(i, 8) == "channels") {
            in_channels = true;
            i += 7;
            continue;
        }
        if (!in_channels) {
            if (isdigit(full_input[i]) || full_input[i] == '-') cleaned += full_input[i];
            else cleaned += ' ';
        }
    }
    stringstream ss_head(cleaned);
    ss_head >> n >> m >> k;

    size_t start_chan = full_input.find('[');
    if (start_chan != string::npos) {
        vector<int> cur;
        string num_buf = "";
        bool inside_inner = false;
        for (size_t i = start_chan; i < full_input.size(); i++) {
            char c = full_input[i];
            if (c == '[') {
                if (inside_inner) cur.clear();
                else inside_inner = true;
            } else if (c == ']') {
                if (!num_buf.empty()) {
                    cur.push_back(stoi(num_buf));
                    num_buf = "";
                }
                if (inside_inner) {
                    if (!cur.empty()) channels.push_back(cur);
                    cur.clear();
                    inside_inner = false;
                }
            } else if (isdigit(c) || c == '-') {
                num_buf += c;
            } else if (c == ',' || isspace(c)) {
                if (!num_buf.empty()) {
                    cur.push_back(stoi(num_buf));
                    num_buf = "";
                }
            }
        }
    }
    if (channels.empty()) {
        stringstream ss_all(full_input);
        if (ss_all >> n >> m >> k) {
            int u, v, l;
            while (ss_all >> u >> v >> l) {
                channels.push_back({u, v, l});
            }
        }
    }
    Solution sol;
    cout << sol.minTransmissionLatency(n, m, k, channels) << "\\n";
    return 0;
}
"""
    elif idx == "D" or "maxPacketPriority" in (method_name or ""):
        driver = """
// ==========================================
// CCC LeetCode-Style Driver for Problem D
// ==========================================
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string full_input, line;
    while (getline(cin, line)) {
        full_input += line + "\\n";
    }
    vector<vector<int>> packets;

    size_t start_pkt = full_input.find('[');
    if (start_pkt != string::npos) {
        vector<int> cur;
        string num_buf = "";
        bool inside_inner = false;
        for (size_t i = start_pkt; i < full_input.size(); i++) {
            char c = full_input[i];
            if (c == '[') {
                if (inside_inner) cur.clear();
                else inside_inner = true;
            } else if (c == ']') {
                if (!num_buf.empty()) {
                    cur.push_back(stoi(num_buf));
                    num_buf = "";
                }
                if (inside_inner) {
                    if (!cur.empty()) packets.push_back(cur);
                    cur.clear();
                    inside_inner = false;
                }
            } else if (isdigit(c) || c == '-') {
                num_buf += c;
            } else if (c == ',' || isspace(c)) {
                if (!num_buf.empty()) {
                    cur.push_back(stoi(num_buf));
                    num_buf = "";
                }
            }
        }
    }
    if (packets.empty()) {
        stringstream ss_all(full_input);
        int n;
        if (ss_all >> n) {
            int s, e, p;
            while (ss_all >> s >> e >> p) {
                packets.push_back({s, e, p});
            }
        }
    }
    Solution sol;
    cout << sol.maxPacketPriority(packets) << "\\n";
    return 0;
}
"""
    else:
        # Generic driver fallback
        driver = """
int main() {
    return 0;
}
"""

    return header_prefix + code + "\n" + driver


def _prepare_java_solution(code: str) -> str:
    # Java typically has a public class Main or Solution
    return code
