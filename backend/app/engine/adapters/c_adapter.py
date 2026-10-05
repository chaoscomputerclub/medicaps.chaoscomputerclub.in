"""
Chaos Computer Club — C Language Execution Adapter
Generates typed C function prototypes with array size pointers and a fast trusted stdin execution driver.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature, parse_type_descriptor, TypeKind


class CAdapter(BaseLanguageAdapter):
    language_name = "c"

    @staticmethod
    def _map_c_ret_type(type_input: Any) -> str:
        try:
            td = parse_type_descriptor(type_input)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 1:
                    base = "int*" if td.base == "int" else ("double*" if td.base == "float" else ("char**" if td.base == "string" else "int*"))
                    return base
                elif td.dimensions == 2:
                    return "int**"
            if td.base == "int":
                return "int"
            elif td.base == "float":
                return "double"
            elif td.base == "boolean":
                return "bool"
            elif td.base == "string":
                return "char*"
            elif td.base == "void":
                return "void"
            return "int"
        except Exception:
            return "int"

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_c_ret_type(signature.return_type)
        ret_td = parse_type_descriptor(signature.return_type)

        params_parts: List[str] = []
        for p in signature.parameters:
            name = p.name
            td = parse_type_descriptor(p.type)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 2:
                    params_parts.append(f"int** {name}, int {name}Size, int* {name}ColSize")
                elif td.base == "string":
                    params_parts.append(f"char** {name}, int {name}Size")
                else:
                    params_parts.append(f"int* {name}, int {name}Size")
            elif td.base == "string":
                params_parts.append(f"char* {name}")
            elif td.base == "boolean":
                params_parts.append(f"bool {name}")
            elif td.base == "float":
                params_parts.append(f"double {name}")
            else:
                params_parts.append(f"int {name}")

        # Array return requires int* returnSize parameter to return array length
        if ret_td.kind == TypeKind.ARRAY or "int*" in ret_type:
            if ret_td.dimensions == 2:
                params_parts.append("int* returnSize, int** returnColumnSizes")
            else:
                params_parts.append("int* returnSize")

        params_str = ", ".join(params_parts)
        return (
            "#include <stdio.h>\n"
            "#include <stdlib.h>\n"
            "#include <stdbool.h>\n"
            "#include <string.h>\n\n"
            f"{ret_type} {fn_name}({params_str}) {{\n"
            "    \n"
            "}\n"
        )

    def generate_wrapper(self, signature: FunctionSignature, user_code: str) -> str:
        fn_name = signature.name or signature.function_name or "solution"
        ret_type = self._map_c_ret_type(signature.return_type)
        ret_td = parse_type_descriptor(signature.return_type)

        # Build parameter parsing and invocation logic
        parse_lines: List[str] = []
        call_args: List[str] = []

        for p in signature.parameters:
            name = p.name
            td = parse_type_descriptor(p.type)
            if td.kind == TypeKind.ARRAY:
                if td.dimensions == 2:
                    parse_lines.append(f"    int _{name}Size = 0;")
                    parse_lines.append(f"    int* _{name}ColSize = NULL;")
                    parse_lines.append(f'    int** _{name} = _ccc_read_int_2d_arr(&cur, "{name}", &_{name}Size, &_{name}ColSize);')
                    call_args.append(f"_{name}, _{name}Size, _{name}ColSize")
                elif td.base == "string":
                    parse_lines.append(f"    int _{name}Size = 0;")
                    parse_lines.append(f'    char** _{name} = _ccc_read_str_arr(&cur, "{name}", &_{name}Size);')
                    call_args.append(f"_{name}, _{name}Size")
                else:
                    parse_lines.append(f"    int _{name}Size = 0;")
                    parse_lines.append(f'    int* _{name} = _ccc_read_int_arr(&cur, "{name}", &_{name}Size);')
                    call_args.append(f"_{name}, _{name}Size")
            elif td.base == "string":
                parse_lines.append(f'    char* _{name} = _ccc_read_str(&cur, "{name}");')
                call_args.append(f"_{name}")
            elif td.base == "boolean":
                parse_lines.append(f'    bool _{name} = _ccc_read_bool(&cur, "{name}");')
                call_args.append(f"_{name}")
            elif td.base == "float":
                parse_lines.append(f'    double _{name} = _ccc_read_double(&cur, "{name}");')
                call_args.append(f"_{name}")
            else:
                parse_lines.append(f'    int _{name} = _ccc_read_int(&cur, "{name}");')
                call_args.append(f"_{name}")

        ret_size_decl = ""
        if ret_td.kind == TypeKind.ARRAY or "int*" in ret_type:
            ret_size_decl = "    int _returnSize = 0;\n"
            call_args.append("&_returnSize")

        parse_block = "\n".join(parse_lines)
        args_str = ", ".join(call_args)

        # Output printer & envelope
        if ret_type == "int":
            print_call = (
                '    printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{\\"status\\":\\"SUCCESS\\",\\"return_value\\":%d}\\n<<<CCC_RUNNER_RESULT>>>\\n", result);'
            )
        elif ret_type == "long long":
            print_call = (
                '    printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{\\"status\\":\\"SUCCESS\\",\\"return_value\\":%lld}\\n<<<CCC_RUNNER_RESULT>>>\\n", result);'
            )
        elif ret_type in ("double", "float"):
            print_call = (
                '    printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{\\"status\\":\\"SUCCESS\\",\\"return_value\\":%f}\\n<<<CCC_RUNNER_RESULT>>>\\n", result);'
            )
        elif ret_type == "bool":
            print_call = (
                '    printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{\\"status\\":\\"SUCCESS\\",\\"return_value\\":%s}\\n<<<CCC_RUNNER_RESULT>>>\\n", result ? "true" : "false");'
            )
        elif ret_type == "char*":
            print_call = (
                '    printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{\\"status\\":\\"SUCCESS\\",\\"return_value\\":\\"%s\\"}\\n<<<CCC_RUNNER_RESULT>>>\\n", result ? result : "");'
            )
        elif ret_td.kind == TypeKind.ARRAY:
            print_call = (
                '    printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{\\"status\\":\\"SUCCESS\\",\\"return_value\\":[");\n'
                '    for (int _i = 0; _i < _returnSize; _i++) {\n'
                '        if (_i > 0) printf(", ");\n'
                '        printf("%d", result[_i]);\n'
                '    }\n'
                '    printf("]}\\n<<<CCC_RUNNER_RESULT>>>\\n");'
            )
        else:
            print_call = (
                '    printf("\\n<<<CCC_RUNNER_RESULT>>>\\n{\\"status\\":\\"SUCCESS\\",\\"return_value\\":%d}\\n<<<CCC_RUNNER_RESULT>>>\\n", (int)result);'
            )

        driver = f"""

// CCC Trusted Judge Execution Driver (C)
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <ctype.h>

// Skip whitespace, commas, colons
static void _ccc_skip_ws(const char** p) {{
    while (**p && (isspace((unsigned char)**p) || **p == ',' || **p == ':')) (*p)++;
}}

// Find a value by JSON key ("key": ...) or LeetCode assignment (key = ...)
// Returns pointer to start of value, or NULL if not found.
static const char* _ccc_find_key(const char* src, const char* key) {{
    // Strategy 1: JSON format: "key": value
    char pat[128];
    snprintf(pat, sizeof(pat), "\\"%s\\"", key);
    const char* found = strstr(src, pat);
    if (found) {{
        found += strlen(pat);
        while (*found && (*found == ':' || isspace((unsigned char)*found))) found++;
        return found;
    }}
    // Strategy 2: LeetCode assignment format: key = value  (key on its own line)
    // Search for newline-delimited "key = " or "key= "
    char assign_pat[128];
    snprintf(assign_pat, sizeof(assign_pat), "%s ", key);
    const char* p = src;
    while (*p) {{
        // Check at start of line
        if (p == src || *(p-1) == '\\n') {{
            // Skip leading whitespace on line
            const char* lp = p;
            while (*lp == ' ' || *lp == '\\t') lp++;
            size_t klen = strlen(key);
            if (strncmp(lp, key, klen) == 0) {{
                const char* after_key = lp + klen;
                // Skip optional whitespace before '='
                while (*after_key == ' ' || *after_key == '\\t') after_key++;
                if (*after_key == '=') {{
                    after_key++;
                    // Skip whitespace after '='
                    while (*after_key == ' ' || *after_key == '\\t') after_key++;
                    return after_key;
                }}
            }}
        }}
        p++;
    }}
    return NULL;
}}

static int _ccc_read_int(const char** p, const char* key) {{
    const char* k = _ccc_find_key(*p, key);
    if (!k) return 0;
    return atoi(k);
}}

static long long _ccc_read_long(const char** p, const char* key) {{
    const char* k = _ccc_find_key(*p, key);
    if (!k) return 0LL;
    return atoll(k);
}}

static double _ccc_read_double(const char** p, const char* key) {{
    const char* k = _ccc_find_key(*p, key);
    if (!k) return 0.0;
    return atof(k);
}}

static bool _ccc_read_bool(const char** p, const char* key) {{
    const char* k = _ccc_find_key(*p, key);
    if (!k) return false;
    return (strncmp(k, "true", 4) == 0 || *k == '1');
}}

// Read a string value — handles both JSON format ("value") and bare value
static char* _ccc_read_str(const char** p, const char* key) {{
    const char* k = _ccc_find_key(*p, key);
    if (!k) return strdup("");
    // Skip leading whitespace
    while (*k && isspace((unsigned char)*k)) k++;
    if (*k == '"') {{
        // JSON string with quotes
        const char* start = k + 1;
        // Find closing quote, handling escape sequences
        const char* end = start;
        while (*end && *end != '"') {{
            if (*end == '\\\\' && *(end+1)) end++;
            end++;
        }}
        int len = (int)(end - start);
        char* buf = (char*)malloc(len + 1);
        strncpy(buf, start, len);
        buf[len] = '\\0';
        return buf;
    }}
    // Bare string value (no quotes) — read until newline or end
    const char* end = k;
    while (*end && *end != '\\n' && *end != '\\r') end++;
    // Trim trailing whitespace
    while (end > k && isspace((unsigned char)*(end-1))) end--;
    int len = (int)(end - k);
    char* buf = (char*)malloc(len + 1);
    strncpy(buf, k, len);
    buf[len] = '\\0';
    return buf;
}}

static int* _ccc_read_int_arr(const char** p, const char* key, int* size) {{
    *size = 0;
    const char* k = _ccc_find_key(*p, key);
    if (!k) return NULL;
    const char* start = strchr(k, '[');
    if (!start) return NULL;
    start++;
    int cap = 16;
    int* arr = (int*)malloc(cap * sizeof(int));
    const char* cur = start;
    while (*cur && *cur != ']') {{
        while (*cur && (*cur == ',' || isspace((unsigned char)*cur))) cur++;
        if (*cur == ']' || !*cur) break;
        if (*size >= cap) {{
            cap *= 2;
            arr = (int*)realloc(arr, cap * sizeof(int));
        }}
        arr[(*size)++] = atoi(cur);
        while (*cur && *cur != ',' && *cur != ']' && !isspace((unsigned char)*cur)) cur++;
    }}
    return arr;
}}

static char** _ccc_read_str_arr(const char** p, const char* key, int* size) {{
    *size = 0;
    const char* k = _ccc_find_key(*p, key);
    if (!k) return NULL;
    const char* start = strchr(k, '[');
    if (!start) return NULL;
    start++;
    int cap = 8;
    char** arr = (char**)malloc(cap * sizeof(char*));
    const char* cur = start;
    while (*cur && *cur != ']') {{
        while (*cur && (*cur == ',' || isspace((unsigned char)*cur))) cur++;
        if (*cur == ']' || !*cur) break;
        if (*cur == '"') {{
            cur++;
            const char* end = strchr(cur, '"');
            if (!end) break;
            int len = (int)(end - cur);
            char* s = (char*)malloc(len + 1);
            strncpy(s, cur, len);
            s[len] = '\\0';
            if (*size >= cap) {{
                cap *= 2;
                arr = (char**)realloc(arr, cap * sizeof(char*));
            }}
            arr[(*size)++] = s;
            cur = end + 1;
        }} else {{
            cur++;
        }}
    }}
    return arr;
}}

static int** _ccc_read_int_2d_arr(const char** p, const char* key, int* rows, int** colSizes) {{
    *rows = 0;
    *colSizes = NULL;
    const char* k = _ccc_find_key(*p, key);
    if (!k) return NULL;
    const char* start = strstr(k, "[[");
    if (!start) return NULL;
    start++;
    int cap = 8;
    int** arr = (int**)malloc(cap * sizeof(int*));
    *colSizes = (int*)malloc(cap * sizeof(int));
    const char* cur = start;
    while (*cur && *cur != ']') {{
        while (*cur && (*cur == ',' || isspace((unsigned char)*cur))) cur++;
        if (*cur == '[') {{
            int r_size = 0;
            int r_cap = 8;
            int* r_arr = (int*)malloc(r_cap * sizeof(int));
            cur++;
            while (*cur && *cur != ']') {{
                while (*cur && (*cur == ',' || isspace((unsigned char)*cur))) cur++;
                if (*cur == ']' || !*cur) break;
                if (r_size >= r_cap) {{
                    r_cap *= 2;
                    r_arr = (int*)realloc(r_arr, r_cap * sizeof(int));
                }}
                r_arr[r_size++] = atoi(cur);
                while (*cur && *cur != ',' && *cur != ']' && !isspace((unsigned char)*cur)) cur++;
            }}
            if (*cur == ']') cur++;
            if (*rows >= cap) {{
                cap *= 2;
                arr = (int**)realloc(arr, cap * sizeof(int*));
                *colSizes = (int*)realloc(*colSizes, cap * sizeof(int));
            }}
            (*colSizes)[*rows] = r_size;
            arr[(*rows)++] = r_arr;
        }} else {{
            cur++;
        }}
    }}
    return arr;
}}

int main(void) {{
    char* buf = (char*)malloc(1024 * 1024);
    size_t n = fread(buf, 1, 1024 * 1024 - 1, stdin);
    buf[n] = '\\0';
    const char* cur = buf;

{parse_block}
{ret_size_decl}
    {ret_type} result = {fn_name}({args_str});
{print_call}
    free(buf);
    return 0;
}}
"""
        header = "// CCC Trusted Judge Execution Driver (C)\n#include <stdio.h>\n#include <stdlib.h>\n#include <stdbool.h>\n#include <string.h>\n#include <ctype.h>\n\n"
        return header + user_code + "\n" + driver
