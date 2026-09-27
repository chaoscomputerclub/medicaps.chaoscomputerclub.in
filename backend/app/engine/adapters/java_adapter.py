"""
Chaos Computer Club — Java Language Execution Adapter
Generates typed Java Solution class templates and trusted Main driver runner.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature


class JavaAdapter(BaseLanguageAdapter):
    language_name = "java"

    @staticmethod
    def _map_type(dt: DataType) -> str:
        mapping = {
            DataType.INTEGER: "int",
            DataType.LONG: "long",
            DataType.FLOAT: "float",
            DataType.DOUBLE: "double",
            DataType.BOOLEAN: "boolean",
            DataType.STRING: "String",
            DataType.INTEGER_ARRAY: "int[]",
            DataType.LONG_ARRAY: "long[]",
            DataType.FLOAT_ARRAY: "float[]",
            DataType.DOUBLE_ARRAY: "double[]",
            DataType.STRING_ARRAY: "String[]",
            DataType.BOOLEAN_ARRAY: "boolean[]",
            DataType.INTEGER_2D_ARRAY: "int[][]",
            DataType.LONG_2D_ARRAY: "long[][]",
            DataType.FLOAT_2D_ARRAY: "float[][]",
            DataType.DOUBLE_2D_ARRAY: "double[][]",
            DataType.STRING_2D_ARRAY: "String[][]",
            DataType.OBJECT: "java.util.Map<String, Object>",
            DataType.MAP: "java.util.Map<String, Object>",
        }
        return mapping.get(dt, "int")

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name
        ret_type = self._map_type(signature.return_type)

        if not signature.parameters:
            return (
                "class Solution {\n"
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
            "class Solution {\n"
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

        fn_name = signature.name
        ret_type = self._map_type(signature.return_type)

        # Build parameter parsers
        decl_lines = []
        call_args = []
        for idx, p in enumerate(signature.parameters):
            pname = f"_arg_{p.name}"
            call_args.append(pname)
            decl_lines.append(self._build_param_extraction(p.type, pname, idx))

        args_str = ", ".join(call_args)
        invoke_str = f"            var result = sol.{fn_name}({args_str});\n"
        invoke_str += "            _printResult(result);\n"

        driver = r"""
import java.util.*;
import java.io.*;

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
        body = "\n".join(decl_lines) + f"\n\n        Solution sol = new Solution();\n{invoke_str}    }}\n}}\n"
        return user_code + "\n\n" + driver + body

    def _build_param_extraction(self, dt: DataType, pname: str, idx: int) -> str:
        chunk_expr = f'(chunks.size() > {idx} ? chunks.get({idx}) : "")'
        t_val = dt.value

        if t_val == DataType.INTEGER.value:
            return f"        int {pname} = _toInt({chunk_expr});"
        elif t_val == DataType.LONG.value:
            return f"        long {pname} = _toLong({chunk_expr});"
        elif t_val in (DataType.FLOAT.value, DataType.DOUBLE.value):
            return f"        double {pname} = _toDouble({chunk_expr});"
        elif t_val == DataType.BOOLEAN.value:
            return f"        boolean {pname} = _toBool({chunk_expr});"
        elif t_val == DataType.STRING.value:
            return f"        String {pname} = _toString({chunk_expr});"
        elif t_val in (DataType.INTEGER_ARRAY.value, DataType.LONG_ARRAY.value):
            return f"        int[] {pname} = _toIntArray({chunk_expr});"
        elif t_val in (DataType.INTEGER_2D_ARRAY.value, DataType.LONG_2D_ARRAY.value):
            return f"        int[][] {pname} = _toInt2DArray({chunk_expr});"
        else:
            return f"        int {pname} = _toInt({chunk_expr});"
