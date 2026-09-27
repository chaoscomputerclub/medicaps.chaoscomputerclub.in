"""
Chaos Computer Club — C Language Execution Adapter
Generates typed C function prototypes with array size pointers and a fast trusted stdin execution driver.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
from app.engine.adapters.base import BaseLanguageAdapter
from app.engine.contracts import DataType, FunctionSignature


class CAdapter(BaseLanguageAdapter):
    language_name = "c"

    @staticmethod
    def _map_c_ret_type(dt: DataType) -> str:
        mapping = {
            DataType.INTEGER: "int",
            DataType.LONG: "long long",
            DataType.FLOAT: "float",
            DataType.DOUBLE: "double",
            DataType.BOOLEAN: "bool",
            DataType.STRING: "char*",
            DataType.INTEGER_ARRAY: "int*",
            DataType.LONG_ARRAY: "long long*",
            DataType.FLOAT_ARRAY: "float*",
            DataType.DOUBLE_ARRAY: "double*",
            DataType.STRING_ARRAY: "char**",
            DataType.BOOLEAN_ARRAY: "bool*",
            DataType.INTEGER_2D_ARRAY: "int**",
            DataType.LONG_2D_ARRAY: "long long**",
            DataType.STRING_2D_ARRAY: "char***",
        }
        return mapping.get(dt, "int")

    def generate_starter_code(self, signature: FunctionSignature) -> str:
        fn_name = signature.name
        ret_type = self._map_c_ret_type(signature.return_type)

        params_parts: List[str] = []
        for p in signature.parameters:
            t = p.type
            name = p.name
            if t == DataType.INTEGER:
                params_parts.append(f"int {name}")
            elif t == DataType.LONG:
                params_parts.append(f"long long {name}")
            elif t == DataType.FLOAT:
                params_parts.append(f"float {name}")
            elif t == DataType.DOUBLE:
                params_parts.append(f"double {name}")
            elif t == DataType.BOOLEAN:
                params_parts.append(f"bool {name}")
            elif t == DataType.STRING:
                params_parts.append(f"char* {name}")
            elif t == DataType.INTEGER_ARRAY:
                params_parts.append(f"int* {name}, int {name}Size")
            elif t == DataType.LONG_ARRAY:
                params_parts.append(f"long long* {name}, int {name}Size")
            elif t == DataType.STRING_ARRAY:
                params_parts.append(f"char** {name}, int {name}Size")
            elif t == DataType.INTEGER_2D_ARRAY:
                params_parts.append(f"int** {name}, int {name}Size, int* {name}ColSize")
            elif t == DataType.LONG_2D_ARRAY:
                params_parts.append(f"long long** {name}, int {name}Size, int* {name}ColSize")
            else:
                params_parts.append(f"int {name}")

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
        fn_name = signature.name
        ret_type = self._map_c_ret_type(signature.return_type)

        # Build parameter parsing and invocation logic
        parse_lines: List[str] = []
        call_args: List[str] = []

        for p in signature.parameters:
            t = p.type
            name = p.name
            if t == DataType.INTEGER:
                parse_lines.append(f'    int _{name} = _ccc_read_int(&cur, "{name}");')
                call_args.append(f"_{name}")
            elif t == DataType.LONG:
                parse_lines.append(f'    long long _{name} = _ccc_read_long(&cur, "{name}");')
                call_args.append(f"_{name}")
            elif t == DataType.FLOAT or t == DataType.DOUBLE:
                parse_lines.append(f'    double _{name} = _ccc_read_double(&cur, "{name}");')
                call_args.append(f"_{name}")
            elif t == DataType.BOOLEAN:
                parse_lines.append(f'    bool _{name} = _ccc_read_bool(&cur, "{name}");')
                call_args.append(f"_{name}")
            elif t == DataType.STRING:
                parse_lines.append(f'    char* _{name} = _ccc_read_str(&cur, "{name}");')
                call_args.append(f"_{name}")
            elif t == DataType.INTEGER_ARRAY:
                parse_lines.append(f"    int _{name}Size = 0;")
                parse_lines.append(f'    int* _{name} = _ccc_read_int_arr(&cur, "{name}", &_{name}Size);')
                call_args.append(f"_{name}, _{name}Size")
            elif t == DataType.INTEGER_2D_ARRAY:
                parse_lines.append(f"    int _{name}Size = 0;")
                parse_lines.append(f"    int* _{name}ColSize = NULL;")
                parse_lines.append(f'    int** _{name} = _ccc_read_int_2d_arr(&cur, "{name}", &_{name}Size, &_{name}ColSize);')
                call_args.append(f"_{name}, _{name}Size, _{name}ColSize")
            else:
                parse_lines.append(f'    int _{name} = _ccc_read_int(&cur, "{name}");')
                call_args.append(f"_{name}")

        parse_block = "\n".join(parse_lines)
        args_str = ", ".join(call_args)

        # Output printer
        if ret_type == "int":
            print_call = f'    printf("%d\\n", result);'
        elif ret_type == "long long":
            print_call = f'    printf("%lld\\n", result);'
        elif ret_type == "double" or ret_type == "float":
            print_call = f'    printf("%.6f\\n", result);'
        elif ret_type == "bool":
            print_call = f'    printf("%s\\n", result ? "true" : "false");'
        elif ret_type == "char*":
            print_call = f'    printf("%s\\n", result ? result : "");'
        else:
            print_call = f'    printf("%d\\n", (int)result);'

        driver = f"""

// CCC Trusted Judge Execution Driver (C)
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <ctype.h>

static void _ccc_skip_ws(const char** p) {{
    while (**p && (isspace((unsigned char)**p) || **p == ',' || **p == ':')) (*p)++;
}}

static const char* _ccc_find_key(const char* src, const char* key) {{
    char pat[64];
    snprintf(pat, sizeof(pat), "\\"%s\\"", key);
    const char* found = strstr(src, pat);
    if (!found) return NULL;
    found += strlen(pat);
    while (*found && (*found == ':' || isspace((unsigned char)*found))) found++;
    return found;
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

static char* _ccc_read_str(const char** p, const char* key) {{
    const char* k = _ccc_find_key(*p, key);
    if (!k) return strdup("");
    if (*k == '"') k++;
    const char* end = strchr(k, '"');
    if (!end) return strdup(k);
    int len = (int)(end - k);
    char* s = (char*)malloc(len + 1);
    strncpy(s, k, len);
    s[len] = '\\0';
    return s;
}}

static int* _ccc_read_int_arr(const char** p, const char* key, int* size) {{
    const char* k = _ccc_find_key(*p, key);
    *size = 0;
    if (!k || *k != '[') return NULL;
    k++;
    int cap = 128;
    int* arr = (int*)malloc(cap * sizeof(int));
    while (*k && *k != ']') {{
        while (*k && (isspace((unsigned char)*k) || *k == ',')) k++;
        if (*k == ']') break;
        char* next_p;
        long val = strtol(k, &next_p, 10);
        if (next_p == k) break;
        k = next_p;
        if (*size >= cap) {{
            cap *= 2;
            arr = (int*)realloc(arr, cap * sizeof(int));
        }}
        arr[(*size)++] = (int)val;
    }}
    return arr;
}}

static int** _ccc_read_int_2d_arr(const char** p, const char* key, int* size, int** col_size) {{
    const char* k = _ccc_find_key(*p, key);
    *size = 0;
    if (!k || *k != '[') return NULL;
    k++;
    int cap = 128;
    int** rows = (int**)malloc(cap * sizeof(int*));
    *col_size = (int*)malloc(cap * sizeof(int));
    while (*k && *k != ']') {{
        while (*k && (isspace((unsigned char)*k) || *k == ',')) k++;
        if (*k == '[') {{
            k++;
            int row_cap = 16, row_size = 0;
            int* row = (int*)malloc(row_cap * sizeof(int));
            while (*k && *k != ']') {{
                while (*k && (isspace((unsigned char)*k) || *k == ',')) k++;
                if (*k == ']') break;
                char* next_p;
                long val = strtol(k, &next_p, 10);
                if (next_p == k) break;
                k = next_p;
                if (row_size >= row_cap) {{
                    row_cap *= 2;
                    row = (int*)realloc(row, row_cap * sizeof(int));
                }}
                row[row_size++] = (int)val;
            }}
            if (*k == ']') k++;
            if (*size >= cap) {{
                cap *= 2;
                rows = (int**)realloc(rows, cap * sizeof(int*));
                *col_size = (int*)realloc(*col_size, cap * sizeof(int));
            }}
            rows[*size] = row;
            (*col_size)[*size] = row_size;
            (*size)++;
        }} else {{
            k++;
        }}
    }}
    return rows;
}}

int main(void) {{
    static char buf[1048576];
    size_t total = 0;
    int c;
    while ((c = getchar()) != EOF && total < sizeof(buf) - 1) {{
        buf[total++] = (char)c;
    }}
    buf[total] = '\\0';
    if (total == 0) return 0;

    const char* cur = buf;
{parse_block}

    {ret_type} result = {fn_name}({args_str});
{print_call}

    return 0;
}}
"""
        return user_code + "\n" + driver
