"""
Chaos Computer Club — C++ Language Execution Adapter
Generates typed C++ Solution templates and high-performance drivers with JSON stream extraction.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class CppAdapter(BaseLanguageAdapter):
    language_name = "cpp"

    @staticmethod
    def _map_type(type_input: Any, is_param: bool = False) -> str:
        ref = "&" if is_param else ""
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 1:
                    base = "int" if td.base == "int" else ("double" if td.base == "float" else ("string" if td.base == "string" else ("bool" if td.base == "boolean" else "int")))
                    return f"vector<{base}>{ref}"
                elif td.dimensions == 2:
                    base = "int" if td.base == "int" else ("double" if td.base == "float" else ("string" if td.base == "string" else "int"))
                    return f"vector<vector<{base}>>{ref}"
            if td.base == "int":
                return "int"
            elif td.base == "float":
                return "double"
            elif td.base == "boolean":
                return "bool"
            elif td.base == "string":
                return f"string{ref}"
            elif td.base == "object":
                return f"unordered_map<string, string>{ref}"
            return f"int{ref}"
        except Exception:
            return f"int{ref}"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_type(signature.return_type, is_param=False)

        if not signature.parameters:
            return (
                f"class {class_name} {{\n"
                "public:\n"
                f"    {ret_type} {fn_name}() {{\n"
                "        \n"
                "    }\n"
                "};\n"
            )

        param_lines = []
        for p in signature.parameters:
            t = self._map_type(p.type, is_param=True)
            param_lines.append(f"        {t} {p.name}")
        params_str = ",\n".join(param_lines)

        return (
            f"class {class_name} {{\n"
            "public:\n"
            f"    {ret_type} {fn_name}(\n"
            f"{params_str}\n"
            "    ) {\n"
            "        \n"
            "    }\n"
            "};\n"
        )

    @staticmethod
    def _partition_cpp_source(user_code: str, class_name: str) -> tuple[str, str]:
        """
        Partitions user code into (global_directives, class_body).
        Global directives (includes, defines, using namespace, pragmas) MUST be placed at file scope,
        NEVER inside class Solution.
        """
        if f"class {class_name}" in user_code or "class Solution" in user_code or f"struct {class_name}" in user_code:
            return "", user_code

        global_lines = []
        body_lines = []

        for line in user_code.splitlines(keepends=True):
            s = line.strip()
            if (
                s.startswith("#")
                or s.startswith("using namespace ")
                or (s.startswith("using ") and s.endswith(";") and "::" in s)
            ):
                global_lines.append(line)
            else:
                body_lines.append(line)

        global_part = "".join(global_lines)
        body_part = "".join(body_lines)
        wrapped_class = f"class {class_name} {{\npublic:\n{body_part}\n}};\n"
        return global_part, wrapped_class

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_type(signature.return_type, is_param=False)

        headers = [
            "#include <iostream>",
            "#include <vector>",
            "#include <string>",
            "#include <sstream>",
            "#include <algorithm>",
            "#include <unordered_map>",
            "#include <cctype>",
            "using namespace std;",
        ]
        header_block = "\n".join(headers) + "\n\n"

        global_part, wrapped_code = self._partition_cpp_source(user_code, class_name)

        # Build parameter parsers
        decl_lines = []
        call_args = []
        for idx, p in enumerate(signature.parameters):
            pname = f"_arg_{p.name}"
            call_args.append(pname)
            p_type_clean = self._map_type(p.type, is_param=False)
            decl_lines.append(self._build_param_extraction(p.type, p_type_clean, pname, idx, p.name))

        args_str = ", ".join(call_args)
        if ret_type == "void":
            invoke_str = f"    _sol.{fn_name}({args_str});\n"
            if call_args:
                invoke_str += f"    _ccc_print({call_args[0]});\n"
        else:
            invoke_str = f"    _ccc_print(_sol.{fn_name}({args_str}));\n"

        driver = r"""
// ==========================================
// CCC Trusted Judge Execution Driver (C++)
// ==========================================

inline void _ccc_print(bool v) { cout << (v ? "true" : "false") << "\n"; }
template<typename T> inline void _ccc_print(const T& v) { cout << v << "\n"; }
template<typename T> inline void _ccc_print(const vector<T>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); i++) { if (i > 0) cout << ", "; cout << vec[i]; }
    cout << "]\n";
}
template<typename T> inline void _ccc_print(const vector<vector<T>>& vec2d) {
    cout << "[";
    for (size_t i = 0; i < vec2d.size(); i++) {
        if (i > 0) cout << ", ";
        cout << "[";
        for (size_t j = 0; j < vec2d[i].size(); j++) { if (j > 0) cout << ", "; cout << vec2d[i][j]; }
        cout << "]";
    }
    cout << "]\n";
}

inline vector<string> _ccc_extract_chunks(const string& input) {
    vector<string> chunks;
    stringstream ss(input);
    string line;
    string cur;
    int bracket_depth = 0;
    while (getline(ss, line)) {
        string t = line;
        while (!t.empty() && isspace((unsigned char)t.back())) t.pop_back();
        size_t s = 0;
        while (s < t.size() && isspace((unsigned char)t[s])) s++;
        t = t.substr(s);
        if (t.empty()) continue;

        if (bracket_depth == 0) {
            size_t eq = t.find('=');
            if (eq != string::npos && t[0] != '[' && t[0] != '{' && t[0] != '"') {
                if (!cur.empty()) {
                    while (!cur.empty() && isspace((unsigned char)cur.back())) cur.pop_back();
                    size_t cs = 0;
                    while (cs < cur.size() && isspace((unsigned char)cur[cs])) cs++;
                    cur = cur.substr(cs);
                    if (!cur.empty()) chunks.push_back(cur);
                }
                cur = t.substr(eq + 1);
            } else {
                cur += (cur.empty() ? "" : " ") + t;
            }
        } else {
            cur += " " + t;
        }

        for (char c : t) {
            if (c == '[' || c == '{') bracket_depth++;
            else if (c == ']' || c == '}') bracket_depth = max(0, bracket_depth - 1);
        }

        if (bracket_depth == 0 && !cur.empty() && cur.find('=') == string::npos) {
            while (!cur.empty() && isspace((unsigned char)cur.back())) cur.pop_back();
            size_t cs = 0;
            while (cs < cur.size() && isspace((unsigned char)cur[cs])) cs++;
            cur = cur.substr(cs);
            if (!cur.empty()) chunks.push_back(cur);
            cur.clear();
        }
    }
    if (!cur.empty()) {
        while (!cur.empty() && isspace((unsigned char)cur.back())) cur.pop_back();
        size_t cs = 0;
        while (cs < cur.size() && isspace((unsigned char)cur[cs])) cs++;
        cur = cur.substr(cs);
        if (!cur.empty()) chunks.push_back(cur);
    }
    return chunks;
}

inline string _ccc_find_param(const string& src, const string& name, size_t fallback_idx, const vector<string>& chunks) {
    string pat = "\"" + name + "\"";
    size_t p = src.find(pat);
    if (p != string::npos) {
        p += pat.size();
        while (p < src.size() && (isspace((unsigned char)src[p]) || src[p] == ':')) p++;
        if (p < src.size()) {
            if (src[p] == '[' || src[p] == '{') {
                char open_ch = src[p];
                char close_ch = (open_ch == '[') ? ']' : '}';
                int depth = 0;
                size_t start = p;
                for (; p < src.size(); p++) {
                    if (src[p] == open_ch) depth++;
                    else if (src[p] == close_ch) {
                        depth--;
                        if (depth == 0) { p++; break; }
                    }
                }
                return src.substr(start, p - start);
            } else if (src[p] == '"') {
                size_t start = p++;
                while (p < src.size() && src[p] != '"') {
                    if (src[p] == '\\' && p + 1 < src.size()) p++;
                    p++;
                }
                if (p < src.size()) p++;
                return src.substr(start, p - start);
            } else {
                size_t start = p;
                while (p < src.size() && src[p] != ',' && src[p] != '}' && !isspace((unsigned char)src[p])) p++;
                return src.substr(start, p - start);
            }
        }
    }
    size_t eq_pos = src.find(name + " =");
    if (eq_pos == string::npos) eq_pos = src.find(name + "=");
    if (eq_pos != string::npos) {
        size_t start = src.find('=', eq_pos) + 1;
        while (start < src.size() && isspace((unsigned char)src[start])) start++;
        size_t end = src.find('\n', start);
        if (end == string::npos) end = src.size();
        return src.substr(start, end - start);
    }
    if (fallback_idx < chunks.size()) return chunks[fallback_idx];
    return "";
}

inline int _ccc_to_int(const string& raw) {
    if (raw.empty()) return 0;
    string num;
    for (char c : raw) {
        if (isdigit((unsigned char)c) || c == '-') num += c;
        else if (!num.empty()) break;
    }
    if (num.empty() || num == "-") return 0;
    try { return stoi(num); } catch (...) { return 0; }
}

inline long long _ccc_to_long_long(const string& raw) {
    if (raw.empty()) return 0LL;
    string num;
    for (char c : raw) {
        if (isdigit((unsigned char)c) || c == '-') num += c;
        else if (!num.empty()) break;
    }
    if (num.empty() || num == "-") return 0LL;
    try { return stoll(num); } catch (...) { return 0LL; }
}

inline double _ccc_to_double(const string& raw) {
    if (raw.empty()) return 0.0;
    try { return stod(raw); } catch (...) { return 0.0; }
}

inline bool _ccc_to_bool(const string& raw) {
    string lower = raw;
    for (char& c : lower) c = tolower((unsigned char)c);
    return lower.find("true") != string::npos || lower == "1";
}

inline string _ccc_to_string(const string& raw) {
    size_t q1 = raw.find('"');
    if (q1 != string::npos) {
        size_t q2 = raw.find('"', q1 + 1);
        if (q2 != string::npos) return raw.substr(q1 + 1, q2 - q1 - 1);
    }
    return raw;
}

inline vector<string> _ccc_to_vector_string(const string& raw, const string& full_input) {
    const string& src = (raw.find('"') != string::npos) ? raw : full_input;
    vector<string> res;
    size_t qi = 0;
    while ((qi = src.find('"', qi)) != string::npos) {
        size_t qe = src.find('"', qi + 1);
        if (qe == string::npos) break;
        res.push_back(src.substr(qi + 1, qe - qi - 1));
        qi = qe + 1;
    }
    return res;
}

inline vector<int> _ccc_to_vector_int(const string& raw, const string& full_input) {
    const string& src = (raw.find('[') != string::npos) ? raw : full_input;
    vector<int> res;
    string num;
    bool inside = false;
    for (char c : src) {
        if (c == '[') inside = true;
        else if (c == ']') {
            if (!num.empty()) { try { res.push_back(stoi(num)); } catch(...) {} num.clear(); }
            inside = false;
        } else if (inside && (isdigit((unsigned char)c) || c == '-')) {
            num += c;
        } else if (inside && (c == ',' || isspace((unsigned char)c))) {
            if (!num.empty()) { try { res.push_back(stoi(num)); } catch(...) {} num.clear(); }
        }
    }
    if (res.empty() && !raw.empty()) {
        stringstream ss(raw);
        int v;
        while (ss >> v) res.push_back(v);
    }
    return res;
}

inline vector<long long> _ccc_to_vector_long(const string& raw, const string& full_input) {
    const string& src = (raw.find('[') != string::npos) ? raw : full_input;
    vector<long long> res;
    string num;
    bool inside = false;
    for (char c : src) {
        if (c == '[') inside = true;
        else if (c == ']') {
            if (!num.empty()) { try { res.push_back(stoll(num)); } catch(...) {} num.clear(); }
            inside = false;
        } else if (inside && (isdigit((unsigned char)c) || c == '-')) {
            num += c;
        } else if (inside && (c == ',' || isspace((unsigned char)c))) {
            if (!num.empty()) { try { res.push_back(stoll(num)); } catch(...) {} num.clear(); }
        }
    }
    if (res.empty() && !raw.empty()) {
        stringstream ss(raw);
        long long v;
        while (ss >> v) res.push_back(v);
    }
    return res;
}

inline vector<vector<int>> _ccc_to_vector_vector_int(const string& raw, const string& full_input) {
    const string& src = (raw.find("[[") != string::npos) ? raw : full_input;
    vector<vector<int>> res;
    size_t lb = src.find("[[");
    if (lb == string::npos) return res;
    vector<int> cur;
    string num;
    bool in_row = false;
    for (size_t i = lb; i < src.size(); i++) {
        char c = src[i];
        if (c == '[') {
            if (in_row) cur.clear();
            else in_row = true;
        } else if (c == ']') {
            if (!num.empty()) { try { cur.push_back(stoi(num)); } catch(...) {} num.clear(); }
            if (in_row) { res.push_back(cur); cur.clear(); in_row = false; }
        } else if (isdigit((unsigned char)c) || c == '-') {
            num += c;
        } else if (c == ',' || isspace((unsigned char)c)) {
            if (!num.empty()) { try { cur.push_back(stoi(num)); } catch(...) {} num.clear(); }
        }
    }
    return res;
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string _full_input, _line;
    while (getline(cin, _line)) { _full_input += _line + "\n"; }
    vector<string> _chunks = _ccc_extract_chunks(_full_input);
"""
        body = "\n".join(decl_lines) + f"\n\n    {class_name} _sol;\n{invoke_str}    return 0;\n}}\n"
        return header_block + global_part + ("\n\n" if global_part else "") + wrapped_code + "\n" + driver + body

    def _build_param_extraction(self, type_input: Any, ptype: str, pname: str, idx: int, orig_name: str) -> str:
        chunk_expr = f'_ccc_find_param(_full_input, "{orig_name}", {idx}, _chunks)'
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 2:
                    return f"    vector<vector<int>> {pname} = _ccc_to_vector_vector_int({chunk_expr}, _full_input);"
                if td.base == "string":
                    return f"    vector<string> {pname} = _ccc_to_vector_string({chunk_expr}, _full_input);"
                return f"    vector<int> {pname} = _ccc_to_vector_int({chunk_expr}, _full_input);"
            if td.base == "string":
                return f"    string {pname} = _ccc_to_string({chunk_expr});"
            if td.base == "boolean":
                return f"    bool {pname} = _ccc_to_bool({chunk_expr});"
            if td.base == "float":
                return f"    double {pname} = _ccc_to_double({chunk_expr});"
            return f"    int {pname} = _ccc_to_int({chunk_expr});"
        except Exception:
            return f"    int {pname} = _ccc_to_int({chunk_expr});"
