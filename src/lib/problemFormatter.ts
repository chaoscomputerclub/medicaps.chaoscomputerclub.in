/**
 * Chaos Computer Club — Canonical LeetCode Problem Formatter & Contract Engine
 *
 * Implements:
 * 1. Single source of truth: Dynamic derivation from function_signature.parameters
 * 2. Positional testcase mapping: parameter[i] -> input[i]
 * 3. Generic value formatter (scalars, strings with quotes, booleans, arrays, matrices, objects)
 * 4. Starter code generator adhering strictly to canonical function & parameter names
 * 5. Problem contract validator with strict argument count & parameter checks
 */

export type DataType =
  | "integer"
  | "long"
  | "float"
  | "double"
  | "boolean"
  | "string"
  | "integer[]"
  | "long[]"
  | "float[]"
  | "double[]"
  | "string[]"
  | "boolean[]"
  | "integer[][]"
  | "long[][]"
  | "string[][]"
  | "object"
  | "map"
  | string;

export interface ParameterItem {
  name: string;
  type: DataType;
}

export interface FunctionSignatureContract {
  name: string;
  parameters: ParameterItem[];
  return_type: DataType;
  class_name?: string;
}

export interface TestCaseItem {
  stdin?: string;
  input?: any;
  expected_output: any;
  explanation?: string;
  weight?: number;
  is_hidden?: boolean;
}

export interface CanonicalProblem {
  id?: string;
  contest_id?: string;
  problem_index?: string;
  title: string;
  slug?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | string;
  topic?: string;
  points?: number;
  description: string;
  constraints?: string;
  input_format?: string;
  output_format?: string;
  function_name?: string;
  function_signature?: FunctionSignatureContract | null;
  starter_codes?: Record<string, string>;
  sample_testcases?: TestCaseItem[];
  hidden_testcases?: TestCaseItem[];
  time_limit?: number;
  memory_limit?: number;
  execution_mode?: string;
}

export interface ValidationReport {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Safely parses input that could be JSON, an object, an array, or legacy line-separated text.
 */
export function safeParseJson(raw: any): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // If not valid JSON, check if it's multiple JSON lines
    if (trimmed.includes("\n")) {
      const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
      try {
        return lines.map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return line;
          }
        });
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
}

/**
 * Format a value according to LeetCode presentation rules:
 * - Integer/Number: 9
 * - String: "anagram"
 * - Boolean: true / false
 * - Array: [1,2,3]
 * - Matrix: [[1,2],[3,4]]
 * - Object: {"key":"value"}
 */
export function formatValue(val: any, paramType?: string): string {
  if (val === null || val === undefined) {
    return "null";
  }

  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }

  if (typeof val === "number") {
    return Number.isFinite(val) ? String(val) : "0";
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    // If paramType expects an array/object and the string is JSON-encoded, parse and format it
    const isArrayType =
      paramType && (paramType.includes("[]") || paramType === "list" || paramType === "array");
    const isObjectType = paramType && (paramType === "object" || paramType === "map");

    if (
      (isArrayType || isObjectType || !paramType) &&
      ((trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}")))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatValue(parsed, paramType);
      } catch {
        // Fall through to normal string handling
      }
    }

    // If paramType is integer/number/float and string is purely numeric
    if (
      paramType &&
      (paramType === "integer" || paramType === "long" || paramType === "float" || paramType === "double") &&
      /^-?\d+(\.\d+)?$/.test(trimmed)
    ) {
      return trimmed;
    }

    // If already wrapped in double quotes
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      return trimmed;
    }

    // LeetCode string convention: wrap in double quotes
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    // Determine inner element type if possible
    let innerType: string | undefined;
    if (paramType && paramType.endsWith("[]")) {
      innerType = paramType.slice(0, -2);
    }
    const formattedItems = val.map((item) => formatValue(item, innerType));
    return `[${formattedItems.join(",")}]`;
  }

  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }

  return String(val);
}

/**
 * Derives the canonical human-readable LeetCode-style example input string:
 * e.g. "nums = [2,7,11,15], target = 9"
 * Positional mapping: parameter[0] -> input[0], parameter[1] -> input[1]...
 */
export function formatExampleInput(
  functionSignature?: FunctionSignatureContract | null,
  rawInput?: any
): string {
  if (rawInput === undefined || rawInput === null || rawInput === "") {
    return "";
  }

  const parameters = functionSignature?.parameters || [];
  const parsed = safeParseJson(rawInput);

  // If no parameters are defined, format raw value directly
  if (parameters.length === 0) {
    return formatValue(parsed);
  }

  // Case 1: parsed is a Dictionary / Object (mapping parameter names -> values)
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    // If it has a "raw" field
    if ("raw" in parsed && typeof parsed.raw === "string") {
      return formatExampleInput(functionSignature, parsed.raw);
    }

    const segments: string[] = [];
    for (const p of parameters) {
      if (p.name in parsed) {
        segments.push(`${p.name} = ${formatValue(parsed[p.name], p.type)}`);
      }
    }
    if (segments.length > 0) {
      return segments.join(", ");
    }
    // Fallback: iterate object entries
    return Object.entries(parsed)
      .map(([k, v]) => `${k} = ${formatValue(v)}`)
      .join(", ");
  }

  // Case 2: parsed is an Array of arguments
  if (Array.isArray(parsed)) {
    const firstParam = parameters[0];
    // Sub-case: function has exactly 1 parameter of array type, but parsed is the array itself (e.g. [1,2,3,4] instead of [[1,2,3,4]])
    if (
      parameters.length === 1 &&
      firstParam &&
      parsed.length > 0 &&
      firstParam.type.includes("[]") &&
      !Array.isArray(parsed[0]) &&
      typeof parsed[0] !== "object"
    ) {
      return `${firstParam.name} = ${formatValue(parsed, firstParam.type)}`;
    }

    // Standard positional mapping:
    const segments: string[] = [];
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i];
      if (!p) continue;
      const argVal = i < parsed.length ? parsed[i] : undefined;
      segments.push(`${p.name} = ${formatValue(argVal, p.type)}`);
    }
    return segments.join(", ");
  }

  // Case 3: Single scalar input mapped to a single parameter
  if (parameters.length === 1 && parameters[0]) {
    const firstParam = parameters[0];
    return `${firstParam.name} = ${formatValue(parsed, firstParam.type)}`;
  }

  // Legacy fallback: return raw string
  return typeof rawInput === "string" ? rawInput.trim() : formatValue(parsed);
}

/**
 * Formats example expected output value without parameter name prefix:
 * e.g. "[0,1]", "true", "42"
 */
export function formatExampleOutput(rawOutput?: any, returnType?: string): string {
  if (rawOutput === undefined || rawOutput === null) {
    return "";
  }
  const parsed = safeParseJson(rawOutput);
  return formatValue(parsed, returnType);
}

/**
 * Maps contract types to language-specific type strings
 */
const PY_TYPE_MAP: Record<string, string> = {
  integer: "int",
  long: "int",
  float: "float",
  double: "float",
  boolean: "bool",
  string: "str",
  "integer[]": "list[int]",
  "long[]": "list[int]",
  "float[]": "list[float]",
  "double[]": "list[float]",
  "string[]": "list[str]",
  "boolean[]": "list[bool]",
  "integer[][]": "list[list[int]]",
  "long[][]": "list[list[int]]",
  "string[][]": "list[list[str]]",
  object: "dict",
  map: "dict",
};

const CPP_TYPE_MAP: Record<string, string> = {
  integer: "int",
  long: "long long",
  float: "float",
  double: "double",
  boolean: "bool",
  string: "string&",
  "integer[]": "vector<int>&",
  "long[]": "vector<long long>&",
  "float[]": "vector<float>&",
  "double[]": "vector<double>&",
  "string[]": "vector<string>&",
  "boolean[]": "vector<bool>&",
  "integer[][]": "vector<vector<int>>&",
  "long[][]": "vector<vector<long long>>&",
  "string[][]": "vector<vector<string>>&",
  object: "unordered_map<string, string>&",
  map: "unordered_map<string, string>&",
};

const JAVA_TYPE_MAP: Record<string, string> = {
  integer: "int",
  long: "long",
  float: "float",
  double: "double",
  boolean: "boolean",
  string: "String",
  "integer[]": "int[]",
  "long[]": "long[]",
  "float[]": "float[]",
  "double[]": "double[]",
  "string[]": "String[]",
  "boolean[]": "boolean[]",
  "integer[][]": "int[][]",
  "long[][]": "long[][]",
  "string[][]": "String[][]",
  object: "Map<String, Object>",
  map: "Map<String, Object>",
};

const JSDOC_TYPE_MAP: Record<string, string> = {
  integer: "number",
  long: "number",
  float: "number",
  double: "number",
  boolean: "boolean",
  string: "string",
  "integer[]": "number[]",
  "long[]": "number[]",
  "float[]": "number[]",
  "double[]": "number[]",
  "string[]": "string[]",
  "boolean[]": "boolean[]",
  "integer[][]": "number[][]",
  "long[][]": "number[][]",
  "string[][]": "string[][]",
  object: "Object",
  map: "Object",
};

/**
 * Generates canonical starter code for all 6 supported arena languages
 * strictly adhering to canonical function_signature.name and function_signature.parameters[i].name.
 */
export function generateCanonicalStarterCodes(
  signature: FunctionSignatureContract
): Record<string, string> {
  const fnName = signature.name || "solve";
  const params = signature.parameters || [];
  const returnType = signature.return_type || "integer";

  // 1. JavaScript (LeetCode style: var <fnName> = function(...) { };)
  const jsdocParams = params.map((p) => ` * @param {${JSDOC_TYPE_MAP[p.type] || "any"}} ${p.name}`).join("\n");
  const jsParams = params.map((p) => p.name).join(", ");
  const jsRetType = JSDOC_TYPE_MAP[returnType] || "any";
  const jsDocBlock = jsdocParams ? `/**\n${jsdocParams}\n * @return {${jsRetType}}\n */` : `/**\n * @return {${jsRetType}}\n */`;
  const jsStarter = `${jsDocBlock}\nvar ${fnName} = function(${jsParams}) {\n    \n};\n`;

  // 2. Python (class Solution: def <fnName>(self, ...) -> ...:)
  const pyParams = params.map((p) => `${p.name}: ${PY_TYPE_MAP[p.type] || "Any"}`).join(", ");
  const pyRetType = PY_TYPE_MAP[returnType] || "Any";
  const pySig = pyParams ? `self, ${pyParams}` : `self`;
  const pyStarter = `class Solution:\n    def ${fnName}(${pySig}) -> ${pyRetType}:\n        pass\n`;

  // 3. Java (class Solution { public <ret> <fnName>(...) { } })
  const javaParams = params.map((p) => `${JAVA_TYPE_MAP[p.type] || "int"} ${p.name}`).join(", ");
  const javaRetType = JAVA_TYPE_MAP[returnType] || "int";
  const javaStarter = `class Solution {\n    public ${javaRetType} ${fnName}(${javaParams}) {\n        \n    }\n}\n`;

  // 4. C++ (class Solution { public: <ret> <fnName>(...) { } };)
  const cppParams = params.map((p) => `${CPP_TYPE_MAP[p.type] || "int"} ${p.name}`).join(", ");
  const cppRetType = (CPP_TYPE_MAP[returnType] || "int").replace("&", "");
  const cppStarter = `class Solution {\npublic:\n    ${cppRetType} ${fnName}(${cppParams}) {\n        \n    }\n};\n`;

  // 5. C (LeetCode style with size pointers)
  let cRetType = "int";
  if (returnType === "integer[]" || returnType === "long[]") cRetType = "int*";
  else if (returnType === "integer[][]" || returnType === "long[][]") cRetType = "int**";
  else if (returnType === "string") cRetType = "char*";
  else if (returnType === "string[]") cRetType = "char**";
  else if (returnType === "boolean") cRetType = "bool";
  else if (returnType === "double" || returnType === "float") cRetType = "double";
  else if (returnType === "long") cRetType = "long long";
  else if (returnType === "void") cRetType = "void";

  const cParamsParts: string[] = [];
  for (const p of params) {
    if (p.type === "integer[]") cParamsParts.push(`int* ${p.name}, int ${p.name}Size`);
    else if (p.type === "long[]") cParamsParts.push(`long long* ${p.name}, int ${p.name}Size`);
    else if (p.type === "string[]") cParamsParts.push(`char** ${p.name}, int ${p.name}Size`);
    else if (p.type === "integer[][]") cParamsParts.push(`int** ${p.name}, int ${p.name}Size, int* ${p.name}ColSize`);
    else if (p.type === "string") cParamsParts.push(`char* ${p.name}`);
    else if (p.type === "boolean") cParamsParts.push(`bool ${p.name}`);
    else if (p.type === "double" || p.type === "float") cParamsParts.push(`double ${p.name}`);
    else if (p.type === "long") cParamsParts.push(`long long ${p.name}`);
    else cParamsParts.push(`int ${p.name}`);
  }
  if (returnType.includes("[]") || returnType.includes("*")) {
    if (returnType.includes("[][]")) {
      cParamsParts.push("int* returnSize, int** returnColumnSizes");
    } else {
      cParamsParts.push("int* returnSize");
    }
  }
  const cParamsStr = cParamsParts.join(", ");
  const cStarter = `#include <stdio.h>\n#include <stdlib.h>\n#include <stdbool.h>\n#include <string.h>\n\n${cRetType} ${fnName}(${cParamsStr}) {\n    \n}\n`;

  // 6. TypeScript (function <fnName>(...): <ret> { })
  const tsParams = params.map((p) => `${p.name}: ${JSDOC_TYPE_MAP[p.type] || "any"}`).join(", ");
  const tsRetType = JSDOC_TYPE_MAP[returnType] || "any";
  const tsStarter = `function ${fnName}(${tsParams}): ${tsRetType} {\n    \n}\n`;

  return {
    javascript: jsStarter,
    python: pyStarter,
    java: javaStarter,
    cpp: cppStarter,
    c: cStarter,
    typescript: tsStarter,
    function_name: fnName,
  };
}

/**
 * Validates a problem contract before publishing:
 * - function_name matches function_signature.name
 * - Valid parameter identifiers and uniqueness
 * - Testcase input argument counts match expected parameter counts
 */
export function validateProblemContract(problem: {
  title?: string;
  slug?: string;
  function_name?: string;
  function_signature?: FunctionSignatureContract | null;
  sample_testcases?: Array<TestCaseItem>;
  hidden_testcases?: Array<TestCaseItem>;
  starter_codes?: Record<string, string>;
}): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = (problem.title || "").trim();
  if (!title || title.length < 3) {
    errors.push("Title must be at least 3 characters.");
  }

  const fnName = (problem.function_name || "").trim();
  const sigName = (problem.function_signature?.name || "").trim();

  if (!fnName) {
    errors.push("Function name is required.");
  } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fnName)) {
    errors.push(`Function name '${fnName}' must be a valid identifier (alphanumeric and underscores only).`);
  }

  if (sigName && fnName && fnName !== sigName) {
    errors.push(`Function name '${fnName}' must match function signature name '${sigName}'.`);
  }

  const parameters = problem.function_signature?.parameters || [];
  if (parameters.length === 0) {
    errors.push("At least 1 parameter is required in the function signature.");
  }

  const seenParams = new Set<string>();
  for (const p of parameters) {
    const pName = (p.name || "").trim();
    if (!pName) {
      errors.push("Parameter name cannot be blank.");
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(pName)) {
      errors.push(`Parameter '${pName}' must be a valid identifier.`);
    } else if (seenParams.has(pName)) {
      errors.push(`Duplicate parameter '${pName}' detected in signature.`);
    }
    seenParams.add(pName);
  }

  // Validate testcase argument counts
  const validateTestcaseSuite = (cases: TestCaseItem[] | undefined, label: string) => {
    if (!cases) return;
    cases.forEach((tc, idx) => {
      const raw = tc.stdin || tc.input;
      if (raw === undefined || raw === null || raw === "") return;

      const parsed = safeParseJson(raw);
      if (Array.isArray(parsed)) {
        // Special case: single array parameter where array is passed directly
        const firstParam = parameters[0];
        if (
          parameters.length === 1 &&
          firstParam &&
          firstParam.type.includes("[]") &&
          !Array.isArray(parsed[0]) &&
          typeof parsed[0] !== "object"
        ) {
          return;
        }

        if (parsed.length !== parameters.length) {
          errors.push(
            `${label} #${idx + 1}: Expected ${parameters.length} argument(s) (${parameters.map((p) => p.name).join(", ")}), but received ${parsed.length} argument(s).`
          );
        }
      } else if (parsed && typeof parsed === "object") {
        for (const p of parameters) {
          if (!(p.name in parsed)) {
            warnings.push(
              `${label} #${idx + 1}: Input object does not contain parameter '${p.name}'.`
            );
          }
        }
      }
    });
  };

  validateTestcaseSuite(problem.sample_testcases, "Sample Testcase");
  validateTestcaseSuite(problem.hidden_testcases, "Hidden Vault Testcase");

  // Check starter codes parameter names consistency
  if (problem.starter_codes && parameters.length > 0) {
    for (const [lang, code] of Object.entries(problem.starter_codes)) {
      if (["javascript", "python", "java", "cpp", "typescript"].includes(lang)) {
        for (const p of parameters) {
          if (!code.includes(p.name)) {
            warnings.push(`Starter code for ${lang} does not contain parameter '${p.name}'.`);
          }
        }
        if (fnName && !code.includes(fnName)) {
          warnings.push(`Starter code for ${lang} does not contain function '${fnName}'.`);
        }
      }
    }
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
  };
}
