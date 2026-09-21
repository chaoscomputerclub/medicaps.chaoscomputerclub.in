import { useState, useEffect } from "react";
import { X, Plus, Trash2, Code2, FileText, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ProblemPayload, TestCaseItem } from "../api/adminContestApi";

interface ProblemEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (problem: ProblemPayload, target: "contest" | "assessment" | "both") => Promise<void>;
  initialProblem?: Partial<ProblemPayload> | null;
  defaultTarget?: "contest" | "assessment" | "both";
}

const DEFAULT_PY_STARTER = `class Solution:
    def solve(self) -> int:
        # Write your solution here
        pass
`;

const DEFAULT_CPP_STARTER = `#include <vector>
#include <string>
#include <algorithm>

using namespace std;

class Solution {
public:
    int solve() {
        // Write your solution here
        return 0;
    }
};
`;

const DEFAULT_JS_STARTER = `/**
 * @return {number}
 */
var solve = function() {
    // Write your solution here
};
`;

const DEFAULT_JAVA_STARTER = `class Solution {
    public int solve() {
        // Write your solution here
        return 0;
    }
}
`;

export function ProblemEditorModal({
  isOpen,
  onClose,
  onSave,
  initialProblem,
  defaultTarget = "both",
}: ProblemEditorModalProps) {
  const [problemIndex, setProblemIndex] = useState("A");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("Algorithms");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [points, setPoints] = useState(100);
  const [timeLimit, setTimeLimit] = useState(2.0);
  const [memoryLimit, setMemoryLimit] = useState(256);
  const [description, setDescription] = useState("");
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [constraints, setConstraints] = useState("");
  const [target, setTarget] = useState<"contest" | "assessment" | "both">(defaultTarget);

  const [activeCodeLang, setActiveCodeLang] = useState<"python" | "cpp" | "javascript" | "java">("python");
  const [starterCodes, setStarterCodes] = useState<Record<string, string>>({
    python: DEFAULT_PY_STARTER,
    cpp: DEFAULT_CPP_STARTER,
    javascript: DEFAULT_JS_STARTER,
    java: DEFAULT_JAVA_STARTER,
  });

  const [sampleTestcases, setSampleTestcases] = useState<TestCaseItem[]>([
    { stdin: "4\n1 2 3 4", expected_output: "10", explanation: "Sum of elements is 10" },
  ]);
  const [hiddenTestcases, setHiddenTestcases] = useState<TestCaseItem[]>([
    { stdin: "1\n100", expected_output: "100", weight: 1.0 },
    { stdin: "5\n-1 -2 -3 -4 -5", expected_output: "-15", weight: 1.0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"statement" | "starters" | "samples" | "hidden">("statement");

  useEffect(() => {
    if (initialProblem) {
      setProblemIndex(initialProblem.problem_index || "A");
      setTitle(initialProblem.title || "");
      setTopic(initialProblem.topic || "Algorithms");
      setDifficulty(initialProblem.difficulty || "MEDIUM");
      setPoints(initialProblem.points ?? 100);
      setTimeLimit(initialProblem.time_limit ?? 2.0);
      setMemoryLimit(initialProblem.memory_limit ?? 256);
      setDescription(initialProblem.description || "");
      setInputFormat(initialProblem.input_format || "");
      setOutputFormat(initialProblem.output_format || "");
      setConstraints(initialProblem.constraints || "");
      if (initialProblem.starter_codes && Object.keys(initialProblem.starter_codes).length > 0) {
        setStarterCodes((prev) => ({ ...prev, ...initialProblem.starter_codes }));
      }
      if (initialProblem.sample_testcases && initialProblem.sample_testcases.length > 0) {
        setSampleTestcases(initialProblem.sample_testcases);
      }
      if (initialProblem.hidden_testcases && initialProblem.hidden_testcases.length > 0) {
        setHiddenTestcases(initialProblem.hidden_testcases);
      }
      if (initialProblem.target) {
        setTarget(initialProblem.target);
      } else {
        setTarget(defaultTarget);
      }
    } else {
      // Reset defaults
      setProblemIndex("A");
      setTitle("");
      setTopic("Algorithms");
      setDifficulty("MEDIUM");
      setPoints(100);
      setTimeLimit(2.0);
      setMemoryLimit(256);
      setDescription("");
      setInputFormat("");
      setOutputFormat("");
      setConstraints("");
      setTarget(defaultTarget);
      setSampleTestcases([{ stdin: "", expected_output: "", explanation: "" }]);
      setHiddenTestcases([{ stdin: "", expected_output: "", weight: 1.0 }]);
    }
  }, [initialProblem, defaultTarget, isOpen]);

  if (!isOpen) return null;

  const handleAddSample = () => {
    setSampleTestcases((prev) => [...prev, { stdin: "", expected_output: "", explanation: "" }]);
  };

  const handleRemoveSample = (index: number) => {
    setSampleTestcases((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddHidden = () => {
    setHiddenTestcases((prev) => [...prev, { stdin: "", expected_output: "", weight: 1.0 }]);
  };

  const handleRemoveHidden = (index: number) => {
    setHiddenTestcases((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Problem title is required.");
      return;
    }
    if (!description.trim()) {
      toast.error("Problem description statement is required.");
      return;
    }
    if (sampleTestcases.length === 0 || !sampleTestcases[0].expected_output.trim()) {
      toast.error("At least one sample test case with expected output is required.");
      return;
    }

    const payload: ProblemPayload = {
      problem_index: problemIndex.trim().toUpperCase(),
      title: title.trim(),
      topic: topic.trim(),
      difficulty,
      points: Number(points),
      time_limit: Number(timeLimit),
      memory_limit: Number(memoryLimit),
      description: description.trim(),
      input_format: inputFormat.trim() || undefined,
      output_format: outputFormat.trim() || undefined,
      constraints: constraints.trim() || undefined,
      starter_codes: starterCodes,
      sample_testcases: sampleTestcases.filter((tc) => tc.expected_output.trim() !== ""),
      hidden_testcases: hiddenTestcases.filter((tc) => tc.expected_output.trim() !== ""),
      target,
    };

    setIsSubmitting(true);
    try {
      await onSave(payload, target);
      toast.success(`Problem ${payload.problem_index} saved successfully!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save problem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto font-mono">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-white/15 rounded-none shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center bg-lime-400 font-mono font-black text-black text-xs">
              {problemIndex || "A"}
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                {initialProblem ? `Edit Problem ${problemIndex}` : "New Challenge Problem"}
              </h2>
              <p className="text-[10px] text-zinc-400">
                Author testcases, limits, and multi-language starter boilerplate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-zinc-400 hover:text-white p-1 rounded-none hover:bg-white/5 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-white/10 bg-zinc-900/30 px-6 gap-1 pt-2">
          {[
            { id: "statement", label: "1. Statement & Meta", icon: FileText },
            { id: "starters", label: "2. Starter Codes", icon: Code2 },
            { id: "samples", label: `3. Samples (${sampleTestcases.length})`, icon: CheckCircle2 },
            { id: "hidden", label: `4. Hidden Evaluation (${hiddenTestcases.length})`, icon: ShieldAlert },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSubTab(id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                activeSubTab === id
                  ? "border-lime-400 text-lime-400 bg-white/5"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Statement & Meta */}
          {activeSubTab === "statement" && (
            <div className="space-y-4">
              {/* Row 1: Index, Title, Points, Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Index Letter:
                  </label>
                  <Input
                    value={problemIndex}
                    onChange={(e) => setProblemIndex(e.target.value.toUpperCase())}
                    placeholder="A, B, C..."
                    maxLength={3}
                    className="bg-black border-white/15 text-xs text-white rounded-none h-9 text-center font-bold"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Challenge Title:
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Subnet Packet Collision Minimizer"
                    className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Points:
                  </label>
                  <Input
                    type="number"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    min={10}
                    max={1000}
                    step={10}
                    className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Topic, Difficulty, Time Limit, Memory Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Topic / Category:
                  </label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Graph, DP, Greedy"
                    className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Difficulty:
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full bg-black border border-white/15 text-xs text-white rounded-none h-9 px-2.5 focus-visible:ring-2 focus-visible:ring-lime-400"
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Time Limit (sec):
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10.0"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Memory Limit (MB):
                  </label>
                  <Input
                    type="number"
                    min="32"
                    max="1024"
                    step="32"
                    value={memoryLimit}
                    onChange={(e) => setMemoryLimit(Number(e.target.value))}
                    className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
                  />
                </div>
              </div>

              {/* Target Selector */}
              <div className="p-3 bg-zinc-900/60 border border-white/10 space-y-2">
                <span className="block text-[10px] uppercase font-bold text-zinc-400">
                  Target Destination:
                </span>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-white">
                    <input
                      type="radio"
                      name="target_dest"
                      value="both"
                      checked={target === "both"}
                      onChange={() => setTarget("both")}
                      className="accent-lime-400"
                    />
                    <span>Both (Contest Arena & Screening Assessment)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="radio"
                      name="target_dest"
                      value="contest"
                      checked={target === "contest"}
                      onChange={() => setTarget("contest")}
                      className="accent-lime-400"
                    />
                    <span>Contest Arena Only (Phase 2)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="radio"
                      name="target_dest"
                      value="assessment"
                      checked={target === "assessment"}
                      onChange={() => setTarget("assessment")}
                      className="accent-lime-400"
                    />
                    <span>Screening Assessment Only (Phase 1)</span>
                  </label>
                </div>
              </div>

              {/* Description Statement */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                  Problem Description (Markdown):
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the background problem story, objective, and mathematical definition..."
                  rows={7}
                  className="bg-black border-white/15 text-xs text-white rounded-none font-mono leading-relaxed"
                  required
                />
              </div>

              {/* Formats and constraints */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Input Format:
                  </label>
                  <Textarea
                    value={inputFormat}
                    onChange={(e) => setInputFormat(e.target.value)}
                    placeholder="First line contains T testcases..."
                    rows={3}
                    className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Output Format:
                  </label>
                  <Textarea
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    placeholder="Output single integer representing..."
                    rows={3}
                    className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Constraints:
                  </label>
                  <Textarea
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="1 <= N <= 10^5&#10;1 <= Ai <= 10^9"
                    rows={3}
                    className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Starter Codes */}
          {activeSubTab === "starters" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Select programming language to customize boilerplate starter template:
                </span>
                <div className="flex gap-1">
                  {(["python", "cpp", "javascript", "java"] as const).map((lang) => (
                    <Button
                      key={lang}
                      type="button"
                      variant={activeCodeLang === lang ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveCodeLang(lang)}
                      className={`h-7 rounded-none text-[10px] font-mono uppercase font-bold ${
                        activeCodeLang === lang ? "bg-lime-400 text-black" : "border-white/10 text-zinc-400"
                      }`}
                    >
                      {lang}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                  {activeCodeLang.toUpperCase()} Starter Boilerplate:
                </label>
                <Textarea
                  value={starterCodes[activeCodeLang] || ""}
                  onChange={(e) =>
                    setStarterCodes((prev) => ({ ...prev, [activeCodeLang]: e.target.value }))
                  }
                  rows={14}
                  className="bg-black border-white/15 text-xs text-lime-400 font-mono leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Sample Test Cases */}
          {activeSubTab === "samples" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Visible sample test cases shown in the arena problem statement:
                </span>
                <Button
                  type="button"
                  onClick={handleAddSample}
                  size="sm"
                  className="h-8 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-bold"
                >
                  <Plus className="size-3.5 mr-1" /> Add Sample Testcase
                </Button>
              </div>

              {sampleTestcases.map((tc, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-zinc-900/50 border border-white/10 rounded-none space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-lime-400">Sample #{idx + 1}</span>
                    {sampleTestcases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSample(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        title="Delete testcase"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">
                        Standard Input (stdin):
                      </label>
                      <Textarea
                        value={tc.stdin}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSampleTestcases((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, stdin: val } : item))
                          );
                        }}
                        rows={3}
                        placeholder="4&#10;1 2 3 4"
                        className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">
                        Expected Output (stdout):
                      </label>
                      <Textarea
                        value={tc.expected_output}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSampleTestcases((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, expected_output: val } : item))
                          );
                        }}
                        rows={3}
                        placeholder="10"
                        className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">
                      Explanation (optional):
                    </label>
                    <Input
                      value={tc.explanation || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSampleTestcases((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, explanation: val } : item))
                        );
                      }}
                      placeholder="e.g. 1 + 2 + 3 + 4 = 10"
                      className="bg-black border-white/15 text-xs text-zinc-300 rounded-none h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Hidden Evaluation Testcases */}
          {activeSubTab === "hidden" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block">
                    Strict hidden test cases used by CodeBox for official score computation:
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Candidates never see these test inputs during contest or screening.
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={handleAddHidden}
                  size="sm"
                  className="h-8 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-bold"
                >
                  <Plus className="size-3.5 mr-1" /> Add Hidden Testcase
                </Button>
              </div>

              {hiddenTestcases.map((tc, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-zinc-900/50 border border-white/10 rounded-none space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400">
                      Hidden Evaluation Testcase #{idx + 1}
                    </span>
                    {hiddenTestcases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveHidden(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        title="Delete testcase"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">
                        Hidden Standard Input (stdin):
                      </label>
                      <Textarea
                        value={tc.stdin}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHiddenTestcases((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, stdin: val } : item))
                          );
                        }}
                        rows={3}
                        placeholder="Comprehensive boundary testcase input..."
                        className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-1">
                        Expected Output (exact match):
                      </label>
                      <Textarea
                        value={tc.expected_output}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHiddenTestcases((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, expected_output: val } : item))
                          );
                        }}
                        rows={3}
                        placeholder="Expected output..."
                        className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Bar Footer */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6">
            <div className="text-[10px] text-zinc-400">
              Saving to: <strong className="text-lime-400 uppercase font-bold">{target}</strong>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-10 rounded-none border-white/15 text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-black uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                {isSubmitting ? "Saving Problem..." : "Save Problem"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
