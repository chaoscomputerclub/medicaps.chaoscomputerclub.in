/**
 * Chaos Computer Club — Author Challenge Modal
 * High-End Tab-by-Tab Modal Wizard for Authoring & Editing Contest Problems
 * Dials: DESIGN_VARIANCE: 8 | MOTION_INTENSITY: 6 | VISUAL_DENSITY: 8
 *
 * Steps:
 * 01. Specifications (Index, Title, Slug, Difficulty, Topic, Points, Sandbox Limits)
 * 02. Function Contract & Starters (Function Name, Return Type, Parameters AST, Multi-Language Starters)
 * 03. Problem Statement & Specs (Markdown Description, Constraints, Input/Output Format, Reference Solution)
 * 04. Test Suite & Vault (Visible Examples, Hidden Cryptographic Vault, Match Strategy & Evaluation)
 *
 * Production-hardening changes vs the original draft:
 * - Dialog semantics (role="dialog", aria-modal, labelled header), a Tab focus trap, and a
 *   body-scroll lock while the modal is open.
 * - Every close path (backdrop click, the X button, Escape, and the Cancel button) now funnels
 *   through requestClose(), which asks for confirmation if the form has unsaved changes instead
 *   of silently discarding a half-authored problem.
 * - Inline, per-field validation errors next to the input that's wrong, instead of validation
 *   living only in toast text the user has to remember.
 * - New problems now start with a single blank sample/hidden test case instead of 15 pre-filled
 *   "network route" example cases the author had to notice and delete by hand.
 * - Wired up two pieces of state that were collected into the payload but had no input anywhere:
 *   Reference Solution and Float Tolerance. Added the missing CUSTOM_CHECKER option and a
 *   per-hidden-testcase weight field.
 * - All interactive controls are disabled (not just the Publish button) while a save is in flight.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Code2,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Cpu,
  Layers,
  FileCode,
  Check,
  AlertCircle,
  X,
  ShieldAlert,
  Terminal,
  Hash,
  Sliders,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  | "map";

export interface ParameterItem {
  name: string;
  type: DataType;
}

export interface FunctionSignatureContract {
  name: string;
  parameters: ParameterItem[];
  return_type: DataType;
}

export interface EvaluationConfigPayload {
  match_type: "EXACT_MATCH" | "NORMALIZED_MATCH" | "FLOAT_TOLERANCE" | "CUSTOM_CHECKER";
  float_tolerance?: number;
  ignore_whitespace?: boolean;
  ignore_case?: boolean;
}

export interface SandboxConfigPayload {
  time_limit_sec: number;
  memory_limit_mb: number;
  network_enabled: boolean;
  process_limit: number;
  output_limit_kb: number;
}

export interface TestCaseItem {
  stdin: string;
  expected_output: string;
  explanation?: string | undefined;
  weight?: number | undefined;
}

export interface ProblemPayload {
  id?: string | undefined;
  problem_index: string;
  slug?: string | undefined;
  title: string;
  function_name?: string | undefined;
  function_signature?: FunctionSignatureContract | undefined;
  evaluation_config?: EvaluationConfigPayload | undefined;
  sandbox_config?: SandboxConfigPayload | undefined;
  reference_solution?: Record<string, string> | undefined;
  execution_mode?: "FUNCTION" | "STDIN_STDOUT" | undefined;
  topic?: string | undefined;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  points: number;
  description: string;
  input_format?: string | undefined;
  output_format?: string | undefined;
  constraints?: string | undefined;
  time_limit: number;
  memory_limit: number;
  starter_codes?: Record<string, string> | undefined;
  sample_testcases: TestCaseItem[];
  hidden_testcases: TestCaseItem[];
  solved_count?: number | undefined;
  target?: "contest" | "assessment" | "both" | undefined;
}

export type TabStep = "specifications" | "contract" | "statement" | "testcases";

export interface AuthorChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestSlug: string;
  editingProblem?: ProblemPayload | null;
  existingProblemsCount?: number;
  onSave: (payload: ProblemPayload) => Promise<void>;
}

export const SUPPORTED_TYPES: DataType[] = [
  "integer",
  "long",
  "float",
  "double",
  "boolean",
  "string",
  "integer[]",
  "long[]",
  "float[]",
  "double[]",
  "string[]",
  "boolean[]",
  "integer[][]",
  "long[][]",
  "string[][]",
  "object",
  "map",
];

export function generateSlug(title: string, index?: string): string {
  const clean = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (clean) return clean;
  return index ? `problem-${index.toLowerCase().trim()}` : "challenge-a";
}

export function generateFallbackFnName(title: string): string {
  const words = (title || "solve").match(/[a-zA-Z0-9]+/g) || ["solve"];
  let fnName =
    words[0].toLowerCase() +
    words
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");
  if (!/^[a-zA-Z_]/.test(fnName)) fnName = "solve" + fnName;
  return fnName.replace(/[^a-zA-Z0-9_]/g, "");
}

export function generateTypedStarterCodes(
  fnName: string,
  params: ParameterItem[],
  returnType: DataType
): Record<string, string> {
  const pyTypeMap: Record<DataType, string> = {
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

  const cppTypeMap: Record<DataType, string> = {
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

  const javaTypeMap: Record<DataType, string> = {
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

  const jsdocTypeMap: Record<DataType, string> = {
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

  const pyParams = params.map((p) => `        ${p.name}: ${pyTypeMap[p.type] || "Any"}`).join(",\n");
  const pyStarter = `class Solution:\n    def ${fnName}(\n        self,\n${pyParams}\n    ) -> ${pyTypeMap[returnType] || "Any"}:\n        pass\n`;

  const cppParams = params.map((p) => `        ${cppTypeMap[p.type] || "int"} ${p.name}`).join(",\n");
  const cppRet = (cppTypeMap[returnType] || "int").replace("&", "");
  const cppStarter = `class Solution {\npublic:\n    ${cppRet} ${fnName}(\n${cppParams}\n    ) {\n        \n    }\n};\n`;

  const javaParams = params.map((p) => `        ${javaTypeMap[p.type] || "int"} ${p.name}`).join(",\n");
  const javaRet = javaTypeMap[returnType] || "int";
  const javaStarter = `class Solution {\n    public ${javaRet} ${fnName}(\n${javaParams}\n    ) {\n        \n    }\n}\n`;

  const jsdocParams = params.map((p) => `     * @param {${jsdocTypeMap[p.type] || "any"}} ${p.name}`).join("\n");
  const jsParams = params.map((p) => p.name).join(", ");
  const jsStarter = `class Solution {\n    /**\n${jsdocParams}\n     * @return {${jsdocTypeMap[returnType] || "any"}}\n     */\n    ${fnName}(${jsParams}) {\n        \n    }\n}\n`;

  const cRetType = (cppTypeMap[returnType] || "int").replace("&", "");
  const cParams = params.map((p) => {
    if (p.type === "integer[]") return `int* ${p.name}, int ${p.name}Size`;
    if (p.type === "long[]") return `long long* ${p.name}, int ${p.name}Size`;
    if (p.type === "string[]") return `char** ${p.name}, int ${p.name}Size`;
    if (p.type === "integer[][]") return `int** ${p.name}, int ${p.name}Size, int* ${p.name}ColSize`;
    if (p.type === "long[][]") return `long long** ${p.name}, int ${p.name}Size, int* ${p.name}ColSize`;
    if (p.type === "string") return `char* ${p.name}`;
    if (p.type === "boolean") return `bool ${p.name}`;
    if (p.type === "double" || p.type === "float") return `double ${p.name}`;
    if (p.type === "long") return `long long ${p.name}`;
    return `int ${p.name}`;
  }).join(", ");
  const cStarter = `#include <stdio.h>\n#include <stdlib.h>\n#include <stdbool.h>\n#include <string.h>\n\n${cRetType} ${fnName}(${cParams}) {\n    \n}\n`;

  const tsParams = params.map((p) => `${p.name}: ${jsdocTypeMap[p.type] || "any"}`).join(", ");
  const tsRet = jsdocTypeMap[returnType] || "any";
  const tsStarter = `class Solution {\n    ${fnName}(${tsParams}): ${tsRet} {\n        \n    }\n}\n`;

  return {
    python: pyStarter,
    cpp: cppStarter,
    c: cStarter,
    java: javaStarter,
    javascript: jsStarter,
    typescript: tsStarter,
    function_name: fnName,
  };
}

const STEPS: {
  id: TabStep;
  number: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "specifications", number: "01", label: "Specifications", icon: Hash },
  { id: "contract", number: "02", label: "Function Contract", icon: Sliders },
  { id: "statement", number: "03", label: "Problem Statement", icon: FileText },
  { id: "testcases", number: "04", label: "Test Suite & Vault", icon: Layers },
];

const BLANK_SAMPLE_TESTCASE: TestCaseItem = { stdin: "", expected_output: "", explanation: "" };
const BLANK_HIDDEN_TESTCASE: TestCaseItem = { stdin: "", expected_output: "", weight: 1.0 };

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-400">
      <AlertCircle className="size-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function AuthorChallengeModal({
  isOpen,
  onClose,
  contestSlug,
  editingProblem,
  existingProblemsCount = 0,
  onSave,
}: AuthorChallengeModalProps) {
  const [activeTab, setActiveTab] = useState<TabStep>("specifications");
  const [isSaving, setIsSaving] = useState(false);
  const [validationReport, setValidationReport] = useState<{ is_valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const justSeededRef = useRef(false);

  // Form State
  const [index, setIndex] = useState("A");
  const [slug, setSlug] = useState("");
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [title, setTitle] = useState("");
  const [functionName, setFunctionName] = useState("");
  const [isFunctionManual, setIsFunctionManual] = useState(false);
  const [parameters, setParameters] = useState<ParameterItem[]>([{ name: "", type: "integer" }]);
  const [returnType, setReturnType] = useState<DataType>("integer");
  const [matchType, setMatchType] = useState<
    "EXACT_MATCH" | "NORMALIZED_MATCH" | "FLOAT_TOLERANCE" | "CUSTOM_CHECKER"
  >("EXACT_MATCH");
  const [floatTolerance, setFloatTolerance] = useState(0.000001);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);

  const [topic, setTopic] = useState("Algorithms & Data Structures");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [points, setPoints] = useState(100);
  const [timeLimit, setTimeLimit] = useState(2.0);
  const [memoryLimit, setMemoryLimit] = useState(256);
  const [description, setDescription] = useState("");
  const [constraints, setConstraints] = useState("");
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [referenceSolution, setReferenceSolution] = useState("");

  const [sampleTestcases, setSampleTestcases] = useState<TestCaseItem[]>([{ ...BLANK_SAMPLE_TESTCASE }]);
  const [hiddenTestcases, setHiddenTestcases] = useState<TestCaseItem[]>([{ ...BLANK_HIDDEN_TESTCASE }]);

  const [activeTestTab, setActiveTestTab] = useState<"sample" | "hidden">("sample");
  const [activeCodeLang, setActiveCodeLang] = useState<"python" | "cpp" | "c" | "java" | "javascript" | "typescript">("python");

  // ── Re-seed form when opened or editingProblem changes ─────────────
  const prevIsOpenRef = useRef(false);
  const prevEditingProblemIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const editingId = editingProblem ? (editingProblem.id || editingProblem.problem_index) : undefined;
    const problemChanged = editingId !== prevEditingProblemIdRef.current;
    prevIsOpenRef.current = isOpen;
    prevEditingProblemIdRef.current = editingId;

    if (!isOpen) return;
    if (!justOpened && !problemChanged) return;

    setActiveTab("specifications");
    setValidationReport(null);
    setFieldErrors({});
    setShowDiscardConfirm(false);

    if (editingProblem) {
      setIndex(editingProblem.problem_index);
      setTitle(editingProblem.title);
      const existingSlug = editingProblem.slug || (editingProblem.starter_codes as any)?.slug || generateSlug(editingProblem.title, editingProblem.problem_index);
      setSlug(existingSlug);
      setIsSlugManual(Boolean(editingProblem.slug || (editingProblem.starter_codes as any)?.slug));

      const existingFn = editingProblem.function_name || editingProblem.function_signature?.name || (editingProblem.starter_codes as any)?.function_name || generateFallbackFnName(editingProblem.title);
      setFunctionName(existingFn);
      setIsFunctionManual(Boolean(editingProblem.function_name || editingProblem.function_signature?.name));

      if (editingProblem.function_signature?.parameters && editingProblem.function_signature.parameters.length > 0) {
        setParameters(editingProblem.function_signature.parameters);
        setReturnType(editingProblem.function_signature.return_type || "integer");
      } else {
        setParameters([{ name: "n", type: "integer" }]);
        setReturnType("integer");
      }

      if (editingProblem.evaluation_config?.match_type) {
        setMatchType(editingProblem.evaluation_config.match_type);
        setFloatTolerance(editingProblem.evaluation_config.float_tolerance || 0.000001);
        setIgnoreWhitespace(editingProblem.evaluation_config.ignore_whitespace !== false);
      } else {
        setMatchType("EXACT_MATCH");
        setFloatTolerance(0.000001);
        setIgnoreWhitespace(true);
      }

      setTopic(editingProblem.topic || "Algorithms");
      setDifficulty(editingProblem.difficulty);
      setPoints(editingProblem.points);
      setTimeLimit(editingProblem.time_limit || 2.0);
      setMemoryLimit(editingProblem.memory_limit || 256);
      setDescription(editingProblem.description);
      setConstraints(editingProblem.constraints || "");
      setInputFormat(editingProblem.input_format || "");
      setOutputFormat(editingProblem.output_format || "");
      setReferenceSolution((editingProblem.reference_solution as any)?.python || "");

      setSampleTestcases(
        editingProblem.sample_testcases && editingProblem.sample_testcases.length > 0
          ? editingProblem.sample_testcases
          : [{ ...BLANK_SAMPLE_TESTCASE }]
      );
      setHiddenTestcases(
        editingProblem.hidden_testcases && editingProblem.hidden_testcases.length > 0
          ? editingProblem.hidden_testcases
          : [{ ...BLANK_HIDDEN_TESTCASE }]
      );
    } else {
      // Blank slate for a brand-new problem — no pre-filled example content
      // that the author would otherwise have to notice and delete.
      const nextChar = String.fromCharCode(65 + existingProblemsCount);
      setIndex(nextChar);
      setTitle("");
      setSlug("");
      setIsSlugManual(false);
      setFunctionName("");
      setIsFunctionManual(false);
      setParameters([{ name: "n", type: "integer" }]);
      setReturnType("integer");
      setMatchType("EXACT_MATCH");
      setFloatTolerance(0.000001);
      setIgnoreWhitespace(true);
      setTopic("Algorithms & Data Structures");
      setDifficulty(existingProblemsCount === 0 ? "EASY" : existingProblemsCount === 1 ? "MEDIUM" : "HARD");
      setPoints((existingProblemsCount + 1) * 100);
      setTimeLimit(2.0);
      setMemoryLimit(256);
      setDescription("Given an array of integers, return the optimal solution satisfying all problem constraints.");
      setConstraints("1 <= n <= 10^5");
      setInputFormat("A single integer n representing the size of the network.");
      setOutputFormat("Return the calculated integer result.");
      setReferenceSolution("");
      setSampleTestcases([{ ...BLANK_SAMPLE_TESTCASE }]);
      setHiddenTestcases([{ ...BLANK_HIDDEN_TESTCASE }]);
    }

    // Any state changes fired by this effect itself shouldn't mark the form dirty.
    justSeededRef.current = true;
    setIsDirty(false);
  }, [isOpen, editingProblem, existingProblemsCount]);

  // ── Dirty tracking (skips the seed effect's own writes) ─────────────
  useEffect(() => {
    if (justSeededRef.current) {
      justSeededRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [
    index, slug, title, functionName, parameters, returnType, matchType, floatTolerance,
    ignoreWhitespace, topic, difficulty, points, timeLimit, memoryLimit, description,
    constraints, inputFormat, outputFormat, referenceSolution, sampleTestcases, hiddenTestcases,
  ]);

  // ── Close handling: confirm before discarding unsaved work ─────────
  function requestClose() {
    if (isSaving) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }

  function confirmDiscard() {
    setShowDiscardConfirm(false);
    onClose();
  }

  // ── Escape to close + Tab focus trap ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          requestClose();
        }
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (first && last) {
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDirty, isSaving, showDiscardConfirm]);

  // ── Body scroll lock while the modal is open ────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // ── Initial focus when the modal opens ──────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const id = window.requestAnimationFrame(() => modalRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  // Live generated starter code
  const generatedCodes = useMemo(() => {
    return generateTypedStarterCodes(functionName || "solve", parameters, returnType);
  }, [functionName, parameters, returnType]);

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const handleTitleChange = (val: string) => {
    setTitle(val);
    clearFieldError("title");
    if (!isSlugManual) {
      setSlug(generateSlug(val, index));
      clearFieldError("slug");
    }
    if (!isFunctionManual) {
      setFunctionName(generateFallbackFnName(val));
      clearFieldError("functionName");
    }
  };

  const handleAddParameter = () => {
    if (parameters.length >= 16) {
      toast.error("Maximum 16 parameters allowed per function contract.");
      return;
    }
    const newName = `param${parameters.length + 1}`;
    setParameters([...parameters, { name: newName, type: "integer" }]);
  };

  const handleRemoveParameter = (idx: number) => {
    if (parameters.length <= 1) {
      toast.error("At least 1 function parameter required.");
      return;
    }
    setParameters(parameters.filter((_, i) => i !== idx));
    clearFieldError(`param_${idx}`);
  };

  const handleUpdateParameter = (idx: number, field: keyof ParameterItem, value: any) => {
    const updated = [...parameters];
    const current = updated[idx];
    if (current) {
      updated[idx] = { ...current, [field]: value };
      setParameters(updated);
      if (field === "name") clearFieldError(`param_${idx}`);
    }
  };

  function validateSpecifications(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 3) errs["title"] = "Title must be at least 3 characters.";
    if (!slug.trim()) errs["slug"] = "Slug is required.";
    if (points < 10) errs["points"] = "Points must be at least 10.";
    return errs;
  }

  function validateContract(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!functionName.trim() || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName.trim())) {
      errs["functionName"] = "Must be a legal identifier — letters, numbers, underscore, no spaces.";
    }
    const seen = new Set<string>();
    parameters.forEach((p, idx) => {
      const pName = p.name.trim();
      if (!pName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(pName)) {
        errs[`param_${idx}`] = "Invalid identifier.";
      } else if (seen.has(pName)) {
        errs[`param_${idx}`] = `Duplicate of another parameter named '${pName}'.`;
      }
      seen.add(pName);
    });
    return errs;
  }

  function validateStatement(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!description.trim() || description.trim().length < 20) {
      errs["description"] = "Description must be at least 20 characters.";
    }
    return errs;
  }

  const runClientValidation = () => {
    const specErrs = validateSpecifications();
    const contractErrs = validateContract();
    const statementErrs = validateStatement();
    const errs: string[] = [
      ...Object.values(specErrs),
      ...Object.values(contractErrs),
      ...Object.values(statementErrs),
    ];
    const warns: string[] = [];

    if (!constraints.trim()) {
      warns.push("Constraints are empty. Define time/memory limits and bounds.");
    }

    const validSamples = sampleTestcases.filter((tc) => tc.expected_output.trim() !== "");
    if (validSamples.length < 1) {
      errs.push("At least 1 visible sample testcase required.");
    } else if (validSamples.length < 3) {
      warns.push(`Collegiate standard recommends 3 visible sample cases (currently ${validSamples.length}).`);
    }

    const validHidden = hiddenTestcases.filter((tc) => tc.expected_output.trim() !== "");
    if (validHidden.length < 1) {
      errs.push("At least 1 hidden edge-case required in Cryptographic Vault.");
    } else if (validHidden.length < 15) {
      warns.push(`Collegiate standard recommends 15 hidden testcases for robust grading (currently ${validHidden.length}).`);
    }

    setFieldErrors({ ...specErrs, ...contractErrs, ...statementErrs });

    const report = {
      is_valid: errs.length === 0,
      errors: errs,
      warnings: warns,
    };
    setValidationReport(report);
    return report;
  };

  const isStepCompleted = (step: TabStep): boolean => {
    if (step === "specifications") {
      return Boolean(title.trim().length >= 3 && slug.trim().length >= 1 && points >= 10);
    }
    if (step === "contract") {
      return Boolean(functionName.trim().length >= 1 && parameters.length >= 1 && parameters.every((p) => p.name.trim().length > 0));
    }
    if (step === "statement") {
      return Boolean(description.trim().length >= 20);
    }
    if (step === "testcases") {
      return Boolean(
        sampleTestcases.some((tc) => tc.expected_output.trim() !== "") &&
        hiddenTestcases.some((tc) => tc.expected_output.trim() !== "")
      );
    }
    return false;
  };

  const handleValidateClick = () => {
    const report = runClientValidation();
    if (report.is_valid) {
      toast.success("Validation passed — ready to publish.");
    } else {
      toast.error(`${report.errors.length} issue${report.errors.length === 1 ? "" : "s"} found. See highlighted fields.`);
    }
  };

  // Step advancement handler for "Save & Continue"
  const handleSaveAndContinue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (activeTab === "specifications") {
      const errs = validateSpecifications();
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      if (Object.keys(errs).length > 0) {
        if (!errs["title"]) clearFieldError("title");
        if (!errs["slug"]) clearFieldError("slug");
        if (!errs["points"]) clearFieldError("points");
        toast.error("Please fix the highlighted fields before continuing.");
        return;
      }
      setActiveTab("contract");
    } else if (activeTab === "contract") {
      const errs = validateContract();
      console.log("[DEBUG handleSaveAndContinue] activeTab:", activeTab, "errs:", JSON.stringify(errs));
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      if (Object.keys(errs).length > 0) {
        toast.error("Please fix the highlighted fields before continuing.");
        return;
      }
      setActiveTab("statement");
    } else if (activeTab === "statement") {
      const errs = validateStatement();
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      if (Object.keys(errs).length > 0) {
        toast.error("Please fix the highlighted fields before continuing.");
        return;
      }
      setActiveTab("testcases");
    }
  };

  const handlePrevTab = () => {
    if (activeTab === "testcases") setActiveTab("statement");
    else if (activeTab === "statement") setActiveTab("contract");
    else if (activeTab === "contract") setActiveTab("specifications");
  };

  // Direct backend save on final step
  const handlePublish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!contestSlug) return;

    const report = runClientValidation();
    if (!report.is_valid) {
      toast.error(`Cannot save: ${report.errors[0]}`);
      if (fieldErrors["title"] || fieldErrors["slug"] || fieldErrors["points"]) {
        setActiveTab("specifications");
      } else if (fieldErrors["functionName"] || Object.keys(fieldErrors).some((k) => k.startsWith("param_"))) {
        setActiveTab("contract");
      } else if (fieldErrors["description"]) {
        setActiveTab("statement");
      } else {
        setActiveTab("testcases");
      }
      return;
    }

    try {
      setIsSaving(true);
      const cleanSlug = (slug.trim() || generateSlug(title, index)).toLowerCase();
      const cleanFn = functionName.trim() || generateFallbackFnName(title);

      const starterCodes = generateTypedStarterCodes(cleanFn, parameters, returnType);
      starterCodes["slug"] = cleanSlug;
      starterCodes["function_name"] = cleanFn;

      const fnSignature: FunctionSignatureContract = {
        name: cleanFn,
        parameters,
        return_type: returnType,
      };

      const evalConfig: EvaluationConfigPayload = {
        match_type: matchType,
        float_tolerance: Number(floatTolerance) || 0.000001,
        ignore_whitespace: ignoreWhitespace,
      };

      const payload: ProblemPayload = {
        problem_index: index.trim().toUpperCase(),
        title: title.trim(),
        slug: cleanSlug,
        function_name: cleanFn,
        function_signature: fnSignature,
        evaluation_config: evalConfig,
        sandbox_config: {
          time_limit_sec: Number(timeLimit),
          memory_limit_mb: Number(memoryLimit),
          network_enabled: false,
          process_limit: 16,
          output_limit_kb: 1024,
        },
        reference_solution: referenceSolution.trim() ? { python: referenceSolution } : undefined,
        execution_mode: "FUNCTION",
        topic: topic.trim(),
        difficulty,
        points: Number(points),
        time_limit: Number(timeLimit),
        memory_limit: Number(memoryLimit),
        description: description.trim(),
        starter_codes: starterCodes,
        sample_testcases: sampleTestcases.filter((tc) => tc.expected_output.trim() !== ""),
        hidden_testcases: hiddenTestcases.filter((tc) => tc.expected_output.trim() !== ""),
        target: "both",
        ...(constraints.trim() ? { constraints: constraints.trim() } : {}),
        ...(inputFormat.trim() ? { input_format: inputFormat.trim() } : {}),
        ...(outputFormat.trim() ? { output_format: outputFormat.trim() } : {}),
      };

      await onSave(payload);
      toast.success(editingProblem ? "Challenge updated." : "Challenge published.");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish challenge");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="author-modal-title"
        tabIndex={-1}
        className="w-full max-w-4xl rounded-2xl bg-white/[0.03] border border-white/12 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[92vh] outline-none"
      >
        <div className="bg-black border border-white/8 rounded-2xl flex flex-col h-full overflow-hidden">
          {/* Tactical Header */}
          <div className="p-4 sm:p-5 border-b border-white/8 flex items-center justify-between bg-white/[0.015] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-lime-400/10 border border-lime-400/25 flex items-center justify-center text-lime-400 shrink-0">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h3 id="author-modal-title" className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <span>{editingProblem ? `Edit Challenge ${editingProblem.problem_index}` : "Author Challenge"}</span>
                  <span className="text-[10px] font-mono font-normal text-lime-400 bg-lime-400/10 px-2 py-0.5 rounded border border-lime-400/20">
                    Step {STEPS.findIndex((s) => s.id === activeTab) + 1} of 4
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Contest: <span className="font-mono text-lime-400">{contestSlug}</span> · LeetCode-style Typed AST Execution Contract
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={isSaving}
              aria-label="Close"
              className="w-7 h-7 rounded-md border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/[0.04] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab by Tab Stepper Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2 bg-white/[0.02] border-b border-white/8 shrink-0">
            {STEPS.map((step) => {
              const isActive = activeTab === step.id;
              const isCompleted = isStepCompleted(step.id);
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveTab(step.id)}
                  disabled={isSaving}
                  className={cn(
                    "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed",
                    isActive
                      ? "bg-lime-400/10 border border-lime-400/30 text-lime-400"
                      : "hover:bg-white/[0.04] text-zinc-400 border border-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded text-[11px] font-mono font-bold shrink-0",
                      isActive
                        ? "bg-lime-400 text-black shadow-sm"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/5 text-zinc-500 border border-white/10"
                    )}
                  >
                    {isCompleted && !isActive ? <Check className="w-3.5 h-3.5" /> : step.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold truncate",
                          isActive ? "text-white font-bold" : "text-zinc-300"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block truncate">
                      {step.id === "contract"
                        ? `${parameters.length} param${parameters.length !== 1 ? "s" : ""}`
                        : step.id === "testcases"
                        ? `${sampleTestcases.length + hiddenTestcases.length} cases`
                        : step.id === "specifications"
                        ? `${difficulty} · ${points} pts`
                        : "Markdown & I/O"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 no-scrollbar">
            {/* ── TAB 1: SPECIFICATIONS ── */}
            {activeTab === "specifications" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 pb-1 border-b border-white/8">
                  <Hash className="w-3.5 h-3.5 text-lime-400" />
                  <h4 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                    1. Problem Metadata & Difficulty
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="spec-index" className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Index
                    </label>
                    <Input
                      id="spec-index"
                      value={index}
                      onChange={(e) => setIndex(e.target.value.toUpperCase())}
                      maxLength={2}
                      required
                      placeholder="A"
                      className="h-9 bg-black border-white/12 text-white font-mono text-center font-bold text-sm focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1.5">
                    <label htmlFor="spec-title" className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Challenge Title *
                    </label>
                    <Input
                      id="spec-title"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g. Network Route Analyzer"
                      required
                      aria-invalid={Boolean(fieldErrors["title"])}
                      className={cn(
                        "h-9 bg-black text-white font-sans text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md",
                        fieldErrors["title"] ? "border-rose-500/60 focus-visible:ring-rose-500" : "border-white/12"
                      )}
                    />
                    <FieldError message={fieldErrors["title"]} />
                  </div>

                  <div className="sm:col-span-4 space-y-1.5">
                    <label htmlFor="spec-slug" className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Problem Slug / ID *
                    </label>
                    <Input
                      id="spec-slug"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setIsSlugManual(true);
                        clearFieldError("slug");
                      }}
                      placeholder="network-route-analyzer"
                      required
                      aria-invalid={Boolean(fieldErrors["slug"])}
                      className={cn(
                        "h-9 bg-black text-lime-400 font-mono text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md",
                        fieldErrors["slug"] ? "border-rose-500/60 focus-visible:ring-rose-500" : "border-white/12"
                      )}
                    />
                    <FieldError message={fieldErrors["slug"]} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["EASY", "MEDIUM", "HARD"] as const).map((lvl) => {
                        const selected = difficulty === lvl;
                        const badgeColor =
                          lvl === "EASY"
                            ? selected
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500 font-bold shadow-sm"
                              : "text-zinc-400 border-white/10 hover:border-emerald-500/40"
                            : lvl === "MEDIUM"
                            ? selected
                              ? "bg-amber-500/20 text-amber-400 border-amber-500 font-bold shadow-sm"
                              : "text-zinc-400 border-white/10 hover:border-amber-500/40"
                            : selected
                            ? "bg-rose-500/20 text-rose-400 border-rose-500 font-bold shadow-sm"
                            : "text-zinc-400 border-white/10 hover:border-rose-500/40";
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setDifficulty(lvl)}
                            aria-pressed={selected}
                            className={cn(
                              "h-9 rounded-md border text-xs font-mono uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer",
                              badgeColor
                            )}
                          >
                            {lvl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sm:col-span-4 space-y-1.5">
                    <label htmlFor="spec-topic" className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Topic Category
                    </label>
                    <Input
                      id="spec-topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Graph Algorithms"
                      className="h-9 bg-black border-white/12 text-white font-sans text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1.5">
                    <label htmlFor="spec-points" className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Points Awarded
                    </label>
                    <Input
                      id="spec-points"
                      type="number"
                      value={points}
                      onChange={(e) => {
                        setPoints(Number(e.target.value));
                        clearFieldError("points");
                      }}
                      onBlur={(e) => setPoints(Math.min(1000, Math.max(10, Number(e.target.value) || 10)))}
                      min={10}
                      max={1000}
                      step={10}
                      aria-invalid={Boolean(fieldErrors["points"])}
                      className={cn(
                        "h-9 bg-black text-lime-400 font-mono text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md",
                        fieldErrors["points"] ? "border-rose-500/60 focus-visible:ring-rose-500" : "border-white/12"
                      )}
                    />
                    <FieldError message={fieldErrors["points"]} />
                  </div>
                </div>

                {/* Execution Sandbox Limits */}
                <div className="p-4 rounded-xl bg-white/[0.015] border border-white/8 space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/8">
                    <Cpu className="w-3.5 h-3.5 text-lime-400" />
                    <h4 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                      Execution Sandbox Limits
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                        Time Limit (Seconds)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={timeLimit}
                          onChange={(e) => setTimeLimit(Number(e.target.value))}
                          onBlur={(e) => setTimeLimit(Math.min(10, Math.max(0.1, Number(e.target.value) || 2)))}
                          step={0.5}
                          min={0.1}
                          max={10}
                          className="h-9 bg-black border-white/12 text-xs font-mono text-white rounded"
                        />
                        <span className="text-xs font-mono text-zinc-400">sec</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                        Memory Limit (Megabytes)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={memoryLimit}
                          onChange={(e) => setMemoryLimit(Number(e.target.value))}
                          onBlur={(e) => setMemoryLimit(Math.min(1024, Math.max(16, Number(e.target.value) || 256)))}
                          step={64}
                          min={16}
                          max={1024}
                          className="h-9 bg-black border-white/12 text-xs font-mono text-white rounded"
                        />
                        <span className="text-xs font-mono text-zinc-400">MB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: FUNCTION CONTRACT & STARTERS ── */}
            {activeTab === "contract" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="space-y-3 p-4 rounded-xl bg-white/[0.015] border border-white/8">
                  <div className="flex items-center justify-between pb-1 border-b border-white/8">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <h4 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                        2. Function Execution Contract (LeetCode Style)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      Typed AST
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="contract-fn-name" className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                        Target Function Name *
                      </label>
                      <Input
                        id="contract-fn-name"
                        value={functionName}
                        onChange={(e) => {
                          setFunctionName(e.target.value);
                          setIsFunctionManual(true);
                          clearFieldError("functionName");
                        }}
                        placeholder="e.g. networkRoute"
                        required
                        aria-invalid={Boolean(fieldErrors["functionName"])}
                        className={cn(
                          "h-9 bg-black text-cyan-400 font-mono font-bold text-xs focus-visible:ring-1 focus-visible:ring-cyan-400 rounded-md",
                          fieldErrors["functionName"] ? "border-rose-500/60 focus-visible:ring-rose-500" : "border-white/12"
                        )}
                      />
                      <FieldError message={fieldErrors["functionName"]} />
                      <span className="text-[10px] text-zinc-500 font-sans block">
                        Method name called inside student Solution class
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                        Return Data Type *
                      </label>
                      <select
                        value={returnType}
                        onChange={(e) => setReturnType(e.target.value as DataType)}
                        className="w-full h-9 rounded-md bg-black border border-white/12 text-xs font-mono text-cyan-400 px-3 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                      >
                        {SUPPORTED_TYPES.map((t) => (
                          <option key={t} value={t} className="bg-black text-white">
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-zinc-500 font-sans block">
                        Expected return value type verified by automated judge
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Parameters Table */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                        Function Parameters ({parameters.length}/16)
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddParameter}
                        className="h-7 text-[10px] font-mono border-white/10 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        <span>Add Parameter</span>
                      </Button>
                    </div>

                    <div className="border border-white/8 rounded-lg overflow-hidden divide-y divide-white/6 bg-black">
                      <div className="grid grid-cols-12 px-3 py-1.5 bg-white/[0.02] text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                        <span className="col-span-5">Name</span>
                        <span className="col-span-5">Data Type</span>
                        <span className="col-span-2 text-right">Action</span>
                      </div>

                      {parameters.map((p, idx) => (
                        <div key={idx} className="grid grid-cols-12 items-start px-3 py-2 gap-2">
                          <div className="col-span-5">
                            <Input
                              value={p.name}
                              onChange={(e) => handleUpdateParameter(idx, "name", e.target.value)}
                              placeholder="n"
                              aria-invalid={Boolean(fieldErrors[`param_${idx}`])}
                              className={cn(
                                "h-8 bg-black text-xs font-mono text-white rounded",
                                fieldErrors[`param_${idx}`] ? "border-rose-500/60" : "border-white/12"
                              )}
                            />
                            <FieldError message={fieldErrors[`param_${idx}`]} />
                          </div>
                          <div className="col-span-5">
                            <select
                              value={p.type}
                              onChange={(e) => handleUpdateParameter(idx, "type", e.target.value as DataType)}
                              className="w-full h-8 rounded bg-black border border-white/12 text-xs font-mono text-zinc-200 px-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-400"
                            >
                              {SUPPORTED_TYPES.map((t) => (
                                <option key={t} value={t} className="bg-black text-white">
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveParameter(idx)}
                              disabled={parameters.length <= 1}
                              aria-label={`Remove parameter ${p.name || idx + 1}`}
                              className="w-7 h-7 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                              title="Remove parameter"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generated Starter Code Preview */}
                <div className="space-y-2.5 p-4 rounded-xl bg-white/[0.015] border border-white/8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-white/8">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-lime-400" />
                      <h4 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                        Language Starter Code (Auto-Compiled AST)
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {([
                        { id: "python", label: "Python 3" },
                        { id: "cpp", label: "C++" },
                        { id: "c", label: "C" },
                        { id: "java", label: "Java" },
                        { id: "javascript", label: "JavaScript" },
                        { id: "typescript", label: "TypeScript" },
                      ] as const).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveCodeLang(id)}
                          className={cn(
                            "px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer",
                            activeCodeLang === id
                              ? "bg-lime-400 text-black font-bold"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <pre className="p-3.5 rounded-lg bg-black border border-white/10 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48 leading-relaxed">
                      {generatedCodes[activeCodeLang]}
                    </pre>
                    <span className="absolute top-2 right-2 text-[9px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                      Live Compiled Preview
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: PROBLEM STATEMENT & I/O ── */}
            {activeTab === "statement" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-white/8">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-lime-400" />
                      <h4 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                        3. Detailed Problem Statement (Markdown Supported) *
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">Min 20 characters</span>
                  </div>
                  <Textarea
                    id="statement-description"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      clearFieldError("description");
                    }}
                    rows={6}
                    required
                    placeholder="Given an air-gapped university computer network, compute the minimum packet transit time between source and destination nodes..."
                    aria-invalid={Boolean(fieldErrors["description"])}
                    className={cn(
                      "bg-black text-zinc-200 font-sans text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md leading-relaxed",
                      fieldErrors["description"] ? "border-rose-500/60 focus-visible:ring-rose-500" : "border-white/12"
                    )}
                  />
                  <FieldError message={fieldErrors["description"]} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Constraints
                    </label>
                    <Textarea
                      value={constraints}
                      onChange={(e) => setConstraints(e.target.value)}
                      rows={4}
                      placeholder={"1 <= n <= 10^5\n0 <= edges.length <= 10^5\nTime limit: 2.0s\nMemory limit: 256 MB"}
                      className="bg-black border-white/12 text-zinc-200 font-mono text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Input Format Specification
                    </label>
                    <Textarea
                      value={inputFormat}
                      onChange={(e) => setInputFormat(e.target.value)}
                      rows={4}
                      placeholder="Function receives parameters n (integer), edges (2D array), source, destination."
                      className="bg-black border-white/12 text-zinc-200 font-sans text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Output Format Specification
                    </label>
                    <Textarea
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      rows={4}
                      placeholder="Return integer shortest transit hops or -1 if unreachable."
                      className="bg-black border-white/12 text-zinc-200 font-sans text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
                      Reference Solution (Python) — optional
                    </label>
                    <span className="text-[10px] text-zinc-500">Used to auto-verify sample cases</span>
                  </div>
                  <Textarea
                    value={referenceSolution}
                    onChange={(e) => setReferenceSolution(e.target.value)}
                    rows={6}
                    placeholder={"class Solution:\n    def " + (functionName || "solve") + "(self, ...):\n        # your reference implementation\n        pass"}
                    className="bg-black border-white/12 text-zinc-200 font-mono text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded-md"
                  />
                </div>
              </div>
            )}

            {/* ── TAB 4: TEST SUITE & VAULT ── */}
            {activeTab === "testcases" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Evaluation Rules */}
                <div className="p-4 rounded-xl bg-white/[0.015] border border-white/8 space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/8">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-lime-400" />
                    <h4 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                      Evaluation Strategy & Precision
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                        Match Strategy
                      </label>
                      <select
                        value={matchType}
                        onChange={(e) => setMatchType(e.target.value as any)}
                        className="w-full h-8 rounded bg-black border border-white/12 text-xs font-mono text-white px-2 cursor-pointer"
                      >
                        <option value="EXACT_MATCH">EXACT_MATCH (Deterministic)</option>
                        <option value="NORMALIZED_MATCH">NORMALIZED_MATCH (Whitespace Trimmed)</option>
                        <option value="FLOAT_TOLERANCE">FLOAT_TOLERANCE (Epsilon)</option>
                        <option value="CUSTOM_CHECKER">CUSTOM_CHECKER (Server-side script)</option>
                      </select>
                      {matchType === "CUSTOM_CHECKER" && (
                        <p className="text-[10px] text-amber-400/90 leading-relaxed">
                          Requires a checker script configured on the backend for this problem's slug.
                        </p>
                      )}
                    </div>

                    {matchType === "FLOAT_TOLERANCE" ? (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                          Float Tolerance (Epsilon)
                        </label>
                        <Input
                          type="number"
                          value={floatTolerance}
                          onChange={(e) => setFloatTolerance(Number(e.target.value))}
                          step={0.0000001}
                          min={0}
                          className="h-8 bg-black border-white/12 text-xs font-mono text-white rounded"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 pt-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-zinc-300">
                          <input
                            type="checkbox"
                            checked={ignoreWhitespace}
                            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                            className="rounded border-white/20 bg-black text-lime-400 focus:ring-lime-400"
                          />
                          <span>Trim Trailing Whitespace</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Testcases Suite */}
                <div className="space-y-3 p-4 rounded-xl bg-white/[0.015] border border-white/8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/8">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-lime-400" />
                      <h4 className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                        Testcase Suite ({sampleTestcases.length} Visible, {hiddenTestcases.length} Hidden Vault)
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg bg-black border border-white/10 p-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveTestTab("sample")}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer",
                            activeTestTab === "sample"
                              ? "bg-lime-400 text-black font-bold"
                              : "text-zinc-400 hover:text-white"
                          )}
                        >
                          Visible ({sampleTestcases.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTestTab("hidden")}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5",
                            activeTestTab === "hidden"
                              ? "bg-rose-500 text-white font-bold"
                              : "text-zinc-400 hover:text-white"
                          )}
                        >
                          <ShieldAlert className="w-3 h-3 text-rose-300" />
                          <span>Hidden Vault ({hiddenTestcases.length})</span>
                        </button>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (activeTestTab === "sample") {
                            setSampleTestcases([...sampleTestcases, { ...BLANK_SAMPLE_TESTCASE }]);
                          } else {
                            setHiddenTestcases([...hiddenTestcases, { ...BLANK_HIDDEN_TESTCASE }]);
                          }
                        }}
                        className="h-7 text-xs font-mono border-white/12 text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        <span>Add Case</span>
                      </Button>
                    </div>
                  </div>

                  {/* Testcase items */}
                  <div className="space-y-3">
                    {(activeTestTab === "sample" ? sampleTestcases : hiddenTestcases).map((tc, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-3.5 rounded-lg border bg-black/60 space-y-2.5",
                          activeTestTab === "hidden" ? "border-rose-500/20" : "border-white/8"
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className={activeTestTab === "hidden" ? "text-rose-400 font-bold" : "text-lime-400 font-bold"}>
                            {activeTestTab === "sample" ? `Visible Example #${idx + 1}` : `Hidden Edge-Case #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (activeTestTab === "sample") {
                                setSampleTestcases(sampleTestcases.filter((_, i) => i !== idx));
                              } else {
                                setHiddenTestcases(hiddenTestcases.filter((_, i) => i !== idx));
                              }
                            }}
                            aria-label={`Delete testcase ${idx + 1}`}
                            className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete testcase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                              Input JSON Values
                            </label>
                            <Textarea
                              value={tc.stdin}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (activeTestTab === "sample") {
                                  const arr = [...sampleTestcases];
                                  const current = arr[idx];
                                  if (current) {
                                    arr[idx] = { ...current, stdin: val };
                                    setSampleTestcases(arr);
                                  }
                                } else {
                                  const arr = [...hiddenTestcases];
                                  const current = arr[idx];
                                  if (current) {
                                    arr[idx] = { ...current, stdin: val };
                                    setHiddenTestcases(arr);
                                  }
                                }
                              }}
                              rows={3}
                              placeholder='{"n": 5, "edges": [[0,1]]}'
                              className="bg-black border-white/12 text-zinc-200 font-mono text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                              Expected Output
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={tc.expected_output}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (activeTestTab === "sample") {
                                    const arr = [...sampleTestcases];
                                    const current = arr[idx];
                                    if (current) {
                                      arr[idx] = { ...current, expected_output: val };
                                      setSampleTestcases(arr);
                                    }
                                  } else {
                                    const arr = [...hiddenTestcases];
                                    const current = arr[idx];
                                    if (current) {
                                      arr[idx] = { ...current, expected_output: val };
                                      setHiddenTestcases(arr);
                                    }
                                  }
                                }}
                                placeholder="2"
                                className="h-8 flex-1 bg-black border-white/12 text-zinc-200 font-mono text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded"
                              />
                              {activeTestTab === "hidden" && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] font-mono text-zinc-500">wt</span>
                                  <Input
                                    type="number"
                                    value={tc.weight ?? 1.0}
                                    onChange={(e) => {
                                      const arr = [...hiddenTestcases];
                                      const current = arr[idx];
                                      if (current) {
                                        arr[idx] = { ...current, weight: Number(e.target.value) };
                                        setHiddenTestcases(arr);
                                      }
                                    }}
                                    step={0.5}
                                    min={0}
                                    className="h-8 w-16 bg-black border-white/12 text-zinc-200 font-mono text-xs rounded"
                                  />
                                </div>
                              )}
                            </div>

                            {activeTestTab === "sample" && (
                              <Input
                                value={tc.explanation || ""}
                                onChange={(e) => {
                                  const arr = [...sampleTestcases];
                                  const current = arr[idx];
                                  if (current) {
                                    arr[idx] = { ...current, explanation: e.target.value };
                                    setSampleTestcases(arr);
                                  }
                                }}
                                placeholder="Explanation for students..."
                                className="h-8 bg-black border-white/12 text-zinc-400 font-sans text-xs focus-visible:ring-1 focus-visible:ring-lime-400 rounded mt-1"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation Report Banner */}
                {validationReport && (
                  <div
                    className={cn(
                      "p-3.5 rounded-lg border text-xs font-mono space-y-1.5 animate-in fade-in duration-150",
                      validationReport.is_valid
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    )}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {validationReport.is_valid ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      <span>{validationReport.is_valid ? "All Validation Gates Passed" : "Blocking Validation Errors"}</span>
                    </div>
                    {validationReport.errors.length > 0 && (
                      <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                        {validationReport.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                    {validationReport.warnings.length > 0 && (
                      <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-300/80">
                        {validationReport.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Actions Footer */}
          <div className="p-4 border-t border-white/8 bg-black/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              {activeTab !== "specifications" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrevTab}
                  disabled={isSaving}
                  className="h-9 px-3.5 text-xs font-mono border-white/12 text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Back</span>
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={requestClose}
                disabled={isSaving}
                className="text-xs font-mono text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleValidateClick}
                disabled={isSaving}
                className="h-9 text-xs font-mono border-white/12 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                <span>Validate</span>
              </Button>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              {activeTab !== "testcases" ? (
                <Button
                  id="author-save-continue-btn"
                  data-testid="author-save-continue-btn"
                  type="button"
                  onClick={() => handleSaveAndContinue()}
                  disabled={isSaving}
                  className="w-full sm:w-auto h-9 px-5 text-xs font-mono font-bold uppercase tracking-wider bg-lime-400 hover:bg-lime-300 text-black rounded-md cursor-pointer shadow-[0_0_20px_rgba(163,230,53,0.15)] flex items-center justify-center gap-2"
                >
                  <span>Save & Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => handlePublish()}
                  disabled={isSaving}
                  className="w-full sm:w-auto h-9 px-6 text-xs font-mono font-bold uppercase tracking-wider bg-lime-400 hover:bg-lime-300 text-black rounded-md cursor-pointer shadow-[0_0_25px_rgba(163,230,53,0.25)] flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing Challenge…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{editingProblem ? "Update Challenge" : "Publish Challenge Direct"}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discard-changes confirmation */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-100"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDiscardConfirm(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-confirm-title"
            className="w-full max-w-sm rounded-xl border border-white/12 bg-[#0c0c0e] p-5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h4 id="discard-confirm-title" className="text-sm font-semibold text-white">
                Discard unsaved changes?
              </h4>
            </div>
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">
              You have unsaved edits to this challenge. Closing now will discard them.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscardConfirm(false)}
                className="text-xs font-mono text-zinc-300 hover:text-white cursor-pointer"
              >
                Keep editing
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmDiscard}
                className="h-8 px-4 text-xs font-mono font-bold uppercase tracking-wider bg-rose-500 hover:bg-rose-400 text-white rounded-md cursor-pointer"
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}