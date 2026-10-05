"""
Chaos Computer Club — Go Language Execution Adapter
Generates typed Go starter templates and trusted driver harnesses for FUNCTION mode.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class GoAdapter(BaseLanguageAdapter):
    language_name = "go"

    @staticmethod
    def _map_type(type_input: Any) -> str:
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 1:
                    base = "int" if td.base == "int" else ("float64" if td.base == "float" else ("string" if td.base == "string" else ("bool" if td.base == "boolean" else "int")))
                    return f"[]{base}"
                elif td.dimensions == 2:
                    base = "int" if td.base == "int" else ("float64" if td.base == "float" else ("string" if td.base == "string" else "int"))
                    return f"[][]int"
            if td.base == "int":
                return "int"
            elif td.base == "float":
                return "float64"
            elif td.base == "boolean":
                return "bool"
            elif td.base == "string":
                return "string"
            elif td.base == "object":
                return "map[string]interface{}"
            return "int"
        except Exception:
            return "int"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_type(signature.return_type)

        params_list = [f"{p.name} {self._map_type(p.type)}" for p in signature.parameters]
        params_str = ", ".join(params_list)

        return (
            f"func {fn_name}({params_str}) {ret_type} {{\n"
            "    \n"
            "}\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        if "func main()" in user_code:
            return user_code

        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_type(signature.return_type)

        # Parse user code: extract package if present
        clean_code = re.sub(r'^\s*package\s+\w+', '', user_code, flags=re.MULTILINE)

        # Deduplicate and merge imports
        required_imports = {"encoding/json", "fmt", "io", "os", "strconv", "strings"}
        user_imports = set()
        
        single_imports = re.findall(r'import\s+(?:[a-zA-Z0-9_]+\s+)?"([^"]+)"', clean_code)
        for imp in single_imports:
            user_imports.add(imp)
            
        multi_blocks = re.findall(r'import\s*\((.*?)\)', clean_code, flags=re.DOTALL)
        for block in multi_blocks:
            for imp in re.findall(r'"([^"]+)"', block):
                user_imports.add(imp)
                
        clean_code = re.sub(r'import\s*\((.*?)\)', '', clean_code, flags=re.DOTALL)
        clean_code = re.sub(r'import\s+(?:[a-zA-Z0-9_]+\s+)?"[^"]+"', '', clean_code)
        
        all_imports = sorted(required_imports.union(user_imports))
        import_lines = "\n".join(f'\t"{imp}"' for imp in all_imports)
        header = f"package main\n\nimport (\n{import_lines}\n)\n\n"

        # Build parameter parsers
        decl_lines = []
        call_args = []
        for idx, p in enumerate(signature.parameters):
            pname = f"_arg_{p.name}"
            call_args.append(pname)
            ptype = self._map_type(p.type)
            decl_lines.append(self._build_param_extraction(p.type, ptype, pname, idx, p.name))

        args_str = ", ".join(call_args)

        driver = f"""
func _ccc_escape_json(s string) string {{
	b, err := json.Marshal(s)
	if err != nil {{
		return "\\"\\""
	}}
	return string(b)
}}

func _ccc_find_param(raw string, name string, fallbackIdx int, lines []string) string {{
	// Check for "name = ..."
	prefix := name + " ="
	prefix2 := name + "="
	for _, line := range lines {{
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, prefix) {{
			return strings.TrimSpace(trimmed[len(prefix):])
		}}
		if strings.HasPrefix(trimmed, prefix2) {{
			return strings.TrimSpace(trimmed[len(prefix2):])
		}}
	}}
	// JSON check
	var m map[string]interface{{}}
	if err := json.Unmarshal([]byte(raw), &m); err == nil {{
		if val, ok := m[name]; ok {{
			b, _ := json.Marshal(val)
			return string(b)
		}}
	}}
	if fallbackIdx < len(lines) {{
		return lines[fallbackIdx]
	}}
	return ""
}}

func _ccc_parse_string(s string) string {{
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "\\"") && strings.HasSuffix(s, "\\"") && len(s) >= 2 {{
		var out string
		if err := json.Unmarshal([]byte(s), &out); err == nil {{
			return out
		}}
	}}
	return s
}}

func _ccc_parse_bool(s string) bool {{
	s = strings.ToLower(strings.TrimSpace(s))
	return strings.Contains(s, "true") || s == "1"
}}

func _ccc_parse_int(s string) int {{
	s = strings.TrimSpace(s)
	v, _ := strconv.Atoi(s)
	return v
}}

func _ccc_parse_float64(s string) float64 {{
	s = strings.TrimSpace(s)
	v, _ := strconv.ParseFloat(s, 64)
	return v
}}

func _ccc_parse_int_slice(s string) []int {{
	var out []int
	_ = json.Unmarshal([]byte(s), &out)
	return out
}}

func _ccc_parse_string_slice(s string) []string {{
	var out []string
	_ = json.Unmarshal([]byte(s), &out)
	return out
}}

func _ccc_parse_2d_int_slice(s string) [][]int {{
	var out [][]int
	_ = json.Unmarshal([]byte(s), &out)
	return out
}}

func main() {{
	defer func() {{
		if r := recover(); r != nil {{
			errMsg := fmt.Sprintf("%v", r)
			fmt.Fprintf(os.Stderr, "Runtime Panic in '{fn_name}': %s\\n", errMsg)
			fmt.Printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{{\\"status\\":\\"RUNTIME_ERROR\\",\\"error\\":%s}}\\n<<<CCC_RUNNER_RESULT>>>\\n", _ccc_escape_json(errMsg))
			os.Exit(1)
		}}
	}}()

	inputBytes, _ := io.ReadAll(os.Stdin)
	fullInput := string(inputBytes)
	lines := strings.Split(strings.TrimSpace(fullInput), "\\n")
"""
        exec_lines = "\n".join(decl_lines)
        invoke_block = f"""
	result := {fn_name}({args_str})
	resBytes, _ := json.Marshal(result)
	resStr := string(resBytes)
	fmt.Printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{{\\"status\\":\\"SUCCESS\\",\\"return_value\\":%s}}\\n<<<CCC_RUNNER_RESULT>>>\\n", resStr)
}}
"""
        return header + clean_code + "\n" + driver + exec_lines + invoke_block

    def _build_param_extraction(self, type_input: Any, ptype: str, pname: str, idx: int, orig_name: str) -> str:
        expr = f'_ccc_find_param(fullInput, "{orig_name}", {idx}, lines)'
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 2:
                    return f"\t{pname} := _ccc_parse_2d_int_slice({expr})"
                if td.base == "string":
                    return f"\t{pname} := _ccc_parse_string_slice({expr})"
                return f"\t{pname} := _ccc_parse_int_slice({expr})"
            if td.base == "string":
                return f"\t{pname} := _ccc_parse_string({expr})"
            if td.base == "boolean":
                return f"\t{pname} := _ccc_parse_bool({expr})"
            if td.base in ("float", "double"):
                return f"\t{pname} := _ccc_parse_float64({expr})"
            return f"\t{pname} := _ccc_parse_int({expr})"
        except Exception:
            return f"\t{pname} := _ccc_parse_int({expr})"
