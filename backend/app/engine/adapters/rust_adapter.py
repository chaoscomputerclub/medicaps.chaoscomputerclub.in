"""
Chaos Computer Club — Rust Language Execution Adapter
Generates typed Rust starter templates and trusted driver harnesses for FUNCTION mode.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class RustAdapter(BaseLanguageAdapter):
    language_name = "rust"

    @staticmethod
    def _map_type(type_input: Any) -> str:
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 1:
                    base = "i32" if td.base == "int" else ("f64" if td.base == "float" else ("String" if td.base == "string" else ("bool" if td.base == "boolean" else "i32")))
                    return f"Vec<{base}>"
                elif td.dimensions == 2:
                    return "Vec<Vec<i32>>"
            if td.base == "int":
                return "i32"
            elif td.base == "float":
                return "f64"
            elif td.base == "boolean":
                return "bool"
            elif td.base == "string":
                return "String"
            return "i32"
        except Exception:
            return "i32"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name or signature.function_name or "solution"
        # Convert camelCase to snake_case for Rust idiomatic naming if desired, but support both
        ret_type = self._map_type(signature.return_type)

        params_list = [f"{p.name}: {self._map_type(p.type)}" for p in signature.parameters]
        params_str = ", ".join(params_list)

        return (
            "impl Solution {\n"
            f"    pub fn {fn_name}({params_str}) -> {ret_type} {{\n"
            "        \n"
            "    }\n"
            "}\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        if "fn main()" in user_code:
            return user_code

        fn_name = signature.name or signature.function_name or "solution"
        snake_fn_name = re.sub(r'(?<!^)(?=[A-Z])', '_', fn_name).lower()
        ret_type = self._map_type(signature.return_type)

        decl_lines = []
        call_args = []
        for idx, p in enumerate(signature.parameters):
            pname = f"_arg_{p.name}"
            call_args.append(pname)
            ptype = self._map_type(p.type)
            decl_lines.append(self._build_param_extraction(p.type, ptype, pname, idx, p.name))

        args_str = ", ".join(call_args)

        struct_def = ""
        if "struct Solution" not in user_code:
            struct_def = "struct Solution;\n"

        driver = r"""
fn _ccc_find_param(raw: &str, name: &str, fallback_idx: usize, lines: &[&str]) -> String {
    let prefix = format!("{} =", name);
    let prefix2 = format!("{}=", name);
    for line in lines {
        let trimmed = line.trim();
        if trimmed.starts_with(&prefix) {
            return trimmed[prefix.len()..].trim().to_string();
        }
        if trimmed.starts_with(&prefix2) {
            return trimmed[prefix2.len()..].trim().to_string();
        }
    }
    if fallback_idx < lines.len() {
        return lines[fallback_idx].trim().to_string();
    }
    raw.trim().to_string()
}

fn _ccc_parse_string(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        trimmed[1..trimmed.len()-1].to_string()
    } else {
        trimmed.to_string()
    }
}

fn _ccc_parse_bool(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    lower.contains("true") || lower == "1"
}

fn _ccc_parse_int(s: &str) -> i32 {
    s.trim().parse::<i32>().unwrap_or(0)
}

fn _ccc_parse_float(s: &str) -> f64 {
    s.trim().parse::<f64>().unwrap_or(0.0)
}

fn _ccc_parse_int_vec(s: &str) -> Vec<i32> {
    let clean = s.replace('[', "").replace(']', "").replace(',', " ");
    clean.split_whitespace().filter_map(|w| w.parse::<i32>().ok()).collect()
}

fn main() {
    use std::io::Read;
    let mut full_input = String::new();
    let _ = std::io::stdin().read_to_string(&mut full_input);
    let lines: Vec<&str> = full_input.lines().collect();
"""
        exec_lines = "\n".join(decl_lines)
        invoke_block = f"""
    let result = {{
        // Invoke Solution method (support both original name and snake_case)
        Solution::{fn_name}({args_str})
    }};

    let serialized = format!("{{:?}}", &result);
    println!("\\n<<<CCC_RUNNER_RESULT>>>\\n{{{{\\"status\\":\\"SUCCESS\\",\\"return_value\\":{{}}}}}}\\n<<<CCC_RUNNER_RESULT>>>", serialized);
}}
"""
        return struct_def + user_code + "\n" + driver + exec_lines + invoke_block

    def _build_param_extraction(self, type_input: Any, ptype: str, pname: str, idx: int, orig_name: str) -> str:
        expr = f'_ccc_find_param(&full_input, "{orig_name}", {idx}, &lines)'
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                return f"    let {pname} = _ccc_parse_int_vec(&{expr});"
            if td.base == "string":
                return f"    let {pname} = _ccc_parse_string(&{expr});"
            if td.base == "boolean":
                return f"    let {pname} = _ccc_parse_bool(&{expr});"
            if td.base in ("float", "double"):
                return f"    let {pname} = _ccc_parse_float(&{expr});"
            return f"    let {pname} = _ccc_parse_int(&{expr});"
        except Exception:
            return f"    let {pname} = _ccc_parse_int(&{expr});"
