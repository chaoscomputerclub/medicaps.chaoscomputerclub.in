"""
Chaos Computer Club — Java Language Execution Adapter
Generates typed Java Solution class templates and trusted Main driver runner.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class JavaAdapter(BaseLanguageAdapter):
    language_name = "java"

    @staticmethod
    def _map_type(type_input: Any) -> str:
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 1:
                    base = "int" if td.base == "int" else ("double" if td.base == "float" else ("String" if td.base == "string" else ("boolean" if td.base == "boolean" else "int")))
                    return f"{base}[]"
                elif td.dimensions == 2:
                    base = "int" if td.base == "int" else ("double" if td.base == "float" else ("String" if td.base == "string" else "int"))
                    return f"{base}[][]"
            if td.base == "int":
                return "int"
            elif td.base == "float":
                return "double"
            elif td.base == "boolean":
                return "boolean"
            elif td.base == "string":
                return "String"
            elif td.base == "object":
                return "java.util.Map<String, Object>"
            return "int"
        except Exception:
            return "int"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_type(signature.return_type)

        if not signature.parameters:
            return (
                f"class {class_name} {{\n"
                f"    public {ret_type} {fn_name}() {{\n"
                "        \n"
                "    }\n"
                "}\n"
            )

        param_lines = []
        for p in signature.parameters:
            t = self._map_type(p.type)
            param_lines.append(f"        {t} {p.name}")
        params_str = ",\n".join(param_lines)

        return (
            f"class {class_name} {{\n"
            f"    public {ret_type} {fn_name}(\n"
            f"{params_str}\n"
            "    ) {\n"
            "        \n"
            "    }\n"
            "}\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        if "public static void main" in user_code:
            return user_code

        class_name = signature.class_name or "Solution"
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_type(signature.return_type)

        # Build parameter parsers
        decl_lines = []
        call_args = []
        for idx, p in enumerate(signature.parameters):
            pname = f"_arg_{p.name}"
            call_args.append(pname)
            decl_lines.append(self._build_param_extraction(p.type, pname, idx, p.name))

        args_str = ", ".join(call_args)
        invoke_str = f"            var result = sol.{fn_name}({args_str});\n"
        invoke_str += "            _printResult(result);\n"

        driver = r"""
public class Main {
    static void _printResult(Object res) {
        if (res == null) {
            System.out.println("null");
        } else if (res instanceof int[]) {
            System.out.println(Arrays.toString((int[]) res));
        } else if (res instanceof long[]) {
            System.out.println(Arrays.toString((long[]) res));
        } else if (res instanceof boolean[]) {
            System.out.println(Arrays.toString((boolean[]) res));
        } else if (res instanceof double[]) {
            System.out.println(Arrays.toString((double[]) res));
        } else if (res instanceof Object[]) {
            System.out.println(Arrays.deepToString((Object[]) res));
        } else {
            System.out.println(res);
        }
    }

    static List<String> _extractChunks(String input) {
        List<String> chunks = new ArrayList<>();
        Scanner sc = new Scanner(input);
        StringBuilder cur = new StringBuilder();
        int bracketDepth = 0;
        while (sc.hasNextLine()) {
            String line = sc.nextLine().trim();
            if (line.isEmpty()) continue;
            if (bracketDepth == 0) {
                int eq = line.indexOf('=');
                if (eq != -1 && !line.startsWith("[") && !line.startsWith("{") && !line.startsWith("\"")) {
                    if (cur.length() > 0) chunks.add(cur.toString().trim());
                    cur = new StringBuilder(line.substring(eq + 1).trim());
                } else {
                    if (cur.length() > 0) cur.append(" ");
                    cur.append(line);
                }
            } else {
                cur.append(" ").append(line);
            }
            for (char c : line.toCharArray()) {
                if (c == '[' || c == '{') bracketDepth++;
                else if (c == ']' || c == '}') bracketDepth = Math.max(0, bracketDepth - 1);
            }
            if (bracketDepth == 0 && cur.length() > 0 && cur.indexOf("=") == -1) {
                chunks.add(cur.toString().trim());
                cur = new StringBuilder();
            }
        }
        if (cur.length() > 0) chunks.add(cur.toString().trim());
        return chunks;
    }

    static String _findParam(String src, String name, int fallbackIdx, List<String> chunks) {
        String pat = "\"" + name + "\"";
        int p = src.indexOf(pat);
        if (p != -1) {
            p += pat.length();
            while (p < src.length() && (Character.isWhitespace(src.charAt(p)) || src.charAt(p) == ':')) p++;
            if (p < src.length()) {
                char ch = src.charAt(p);
                if (ch == '[' || ch == '{') {
                    char closeCh = (ch == '[') ? ']' : '}';
                    int depth = 0;
                    int start = p;
                    for (; p < src.length(); p++) {
                        if (src.charAt(p) == ch) depth++;
                        else if (src.charAt(p) == closeCh) {
                            depth--;
                            if (depth == 0) { p++; break; }
                        }
                    }
                    return src.substring(start, p);
                } else if (ch == '"') {
                    int start = p++;
                    while (p < src.length() && src.charAt(p) != '"') {
                        if (src.charAt(p) == '\\' && p + 1 < src.length()) p++;
                        p++;
                    }
                    if (p < src.length()) p++;
                    return src.substring(start, p);
                } else {
                    int start = p;
                    while (p < src.length() && src.charAt(p) != ',' && src.charAt(p) != '}' && !Character.isWhitespace(src.charAt(p))) p++;
                    return src.substring(start, p);
                }
            }
        }
        if (fallbackIdx < chunks.size()) return chunks.get(fallbackIdx);
        return "";
    }

    static int _toInt(String s) {
        s = s.replaceAll("[^0-9\\-]", "");
        if (s.isEmpty() || s.equals("-")) return 0;
        try { return Integer.parseInt(s); } catch (Exception e) { return 0; }
    }

    static long _toLong(String s) {
        s = s.replaceAll("[^0-9\\-]", "");
        if (s.isEmpty() || s.equals("-")) return 0L;
        try { return Long.parseLong(s); } catch (Exception e) { return 0L; }
    }

    static double _toDouble(String s) {
        s = s.replaceAll("[^0-9\\.\\-]", "");
        if (s.isEmpty() || s.equals("-")) return 0.0;
        try { return Double.parseDouble(s); } catch (Exception e) { return 0.0; }
    }

    static boolean _toBool(String s) {
        s = s.toLowerCase();
        return s.contains("true") || s.equals("1");
    }

    static String _toString(String s) {
        int q1 = s.indexOf('"');
        if (q1 != -1) {
            int q2 = s.indexOf('"', q1 + 1);
            if (q2 != -1) return s.substring(q1 + 1, q2);
        }
        return s;
    }

    static int[] _toIntArray(String s) {
        s = s.replace("[", "").replace("]", "").replace(",", " ").trim();
        if (s.isEmpty()) return new int[0];
        String[] parts = s.split("\\s+");
        int[] res = new int[parts.length];
        for (int i = 0; i < parts.length; i++) res[i] = _toInt(parts[i]);
        return res;
    }

    static int[][] _toInt2DArray(String s) {
        List<int[]> rows = new ArrayList<>();
        int lb = s.indexOf("[[");
        if (lb == -1) return new int[0][0];
        int depth = 0;
        StringBuilder curRow = new StringBuilder();
        for (int i = lb + 1; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '[') {
                depth++;
                curRow = new StringBuilder();
            } else if (c == ']') {
                if (depth > 0) {
                    rows.add(_toIntArray(curRow.toString()));
                    curRow = new StringBuilder();
                    depth--;
                }
            } else if (depth > 0) {
                curRow.append(c);
            }
        }
        int[][] res = new int[rows.size()][];
        for (int i = 0; i < rows.size(); i++) res[i] = rows.get(i);
        return res;
    }

    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        String fullInput = sb.toString();
        List<String> chunks = _extractChunks(fullInput);

"""
        body = "\n".join(decl_lines) + f"\n\n        {class_name} sol = new {class_name}();\n{invoke_str}    }}\n}}\n"
        sanitized_code = re.sub(rf"\bpublic\s+class\s+{re.escape(class_name)}\b", f"class {class_name}", user_code)
        header = "// CCC Trusted Judge Execution Driver (Java)\nimport java.util.*;\nimport java.io.*;\n\n"
        return f"{header}{sanitized_code}\n\n{driver}{body}"

    def _build_param_extraction(self, type_input: Any, pname: str, idx: int, orig_name: str) -> str:
        find_expr = f'_findParam(fullInput, "{orig_name}", {idx}, chunks)'
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 2:
                    return f"        int[][] {pname} = _toInt2DArray({find_expr});"
                return f"        int[] {pname} = _toIntArray({find_expr});"
            if td.base == "string":
                return f"        String {pname} = _toString({find_expr});"
            if td.base == "boolean":
                return f"        boolean {pname} = _toBool({find_expr});"
            if td.base == "float":
                return f"        double {pname} = _toDouble({find_expr});"
            return f"        int {pname} = _toInt({find_expr});"
        except Exception:
            return f"        int {pname} = _toInt({find_expr});"
