/**
 * Unit Test Suite for LeetCode-Style Problem Formatter & Architecture
 */

import assert from "node:assert/strict";

// Dynamic import or replicate functions to test ESM
import {
  formatExampleInput,
  formatExampleOutput,
  formatValue,
  generateCanonicalStarterCodes,
  validateProblemContract,
} from "../src/lib/problemFormatter.ts";

console.log("=== RUNNING LEETCODE ARCHITECTURE UNIT TESTS ===");

// 1. Single Parameter Test
{
  const sig = {
    name: "rearrangeArray",
    parameters: [{ name: "nums", type: "integer[]" }],
    return_type: "integer[]",
  };
  const rendered = formatExampleInput(sig, "[[3,1,3,2,1,3]]");
  assert.equal(rendered, "nums = [3,1,3,2,1,3]");
  console.log("✔ 1 parameter (outer list):", rendered);

  const renderedFlat = formatExampleInput(sig, "[1,2,3,4]");
  assert.equal(renderedFlat, "nums = [1,2,3,4]");
  console.log("✔ 1 parameter (flat array fallback):", renderedFlat);
}

// 2. Two Parameters Test (Two Sum)
{
  const sig = {
    name: "twoSum",
    parameters: [
      { name: "nums", type: "integer[]" },
      { name: "target", type: "integer" },
    ],
    return_type: "integer[]",
  };
  const rendered = formatExampleInput(sig, "[[2,7,11,15],9]");
  assert.equal(rendered, "nums = [2,7,11,15], target = 9");
  console.log("✔ 2 parameters:", rendered);

  const out = formatExampleOutput("[0,1]");
  assert.equal(out, "[0,1]");
  console.log("✔ 2 parameters output:", out);
}

// 3. Three Parameters Test (Graph)
{
  const sig = {
    name: "minCost",
    parameters: [
      { name: "nodeCount", type: "integer" },
      { name: "edges", type: "integer[][]" },
      { name: "source", type: "integer" },
    ],
    return_type: "integer",
  };
  const rendered = formatExampleInput(sig, "[4, [[0,1,2],[0,2,5]], 0]");
  assert.equal(rendered, "nodeCount = 4, edges = [[0,1,2],[0,2,5]], source = 0");
  console.log("✔ 3 parameters (matrix + integers):", rendered);
}

// 4. String & Boolean & Object Formatter Test
{
  const sig = {
    name: "checkWord",
    parameters: [
      { name: "s", type: "string" },
      { name: "isActive", type: "boolean" },
    ],
    return_type: "boolean",
  };
  const rendered = formatExampleInput(sig, '["anagram", true]');
  assert.equal(rendered, 's = "anagram", isActive = true');
  console.log("✔ Strings with quotes & booleans:", rendered);
}

// 5. Dictionary Input Test (Backward compatibility)
{
  const sig = {
    name: "twoSum",
    parameters: [
      { name: "nums", type: "integer[]" },
      { name: "target", type: "integer" },
    ],
    return_type: "integer[]",
  };
  const rendered = formatExampleInput(sig, { nums: [3, 2, 4], target: 6 });
  assert.equal(rendered, "nums = [3,2,4], target = 6");
  console.log("✔ Dictionary input compatibility:", rendered);
}

// 6. Canonical Starter Code Generation
{
  const sig = {
    name: "twoSum",
    parameters: [
      { name: "nums", type: "integer[]" },
      { name: "target", type: "integer" },
    ],
    return_type: "integer[]",
  };
  const starters = generateCanonicalStarterCodes(sig);

  assert.ok(starters.javascript.includes("var twoSum = function(nums, target)"));
  assert.ok(starters.javascript.includes("@param {number[]} nums"));
  assert.ok(starters.javascript.includes("@param {number} target"));
  console.log("✔ JavaScript starter code matches LeetCode format");

  assert.ok(starters.python.includes("def twoSum(self, nums: list[int], target: int) -> list[int]:"));
  console.log("✔ Python starter code matches LeetCode format");

  assert.ok(starters.java.includes("public int[] twoSum(int[] nums, int target)"));
  console.log("✔ Java starter code matches LeetCode format");

  assert.ok(starters.cpp.includes("vector<int> twoSum(vector<int>& nums, int target)"));
  console.log("✔ C++ starter code matches LeetCode format");

  assert.ok(starters.c.includes("int* twoSum(int* nums, int numsSize, int target, int* returnSize)"));
  console.log("✔ C starter code matches LeetCode format");

  assert.ok(starters.typescript.includes("function twoSum(nums: number[], target: number): number[]"));
  console.log("✔ TypeScript starter code matches LeetCode format");
}

// 7. Validation Test
{
  // Test case argument count mismatch: expected 2, received 3
  const badProblem = {
    title: "Two Sum",
    function_name: "twoSum",
    function_signature: {
      name: "twoSum",
      parameters: [
        { name: "nums", type: "integer[]" },
        { name: "target", type: "integer" },
      ],
      return_type: "integer[]",
    },
    sample_testcases: [
      { stdin: "[[1,2], 3, 999]", expected_output: "[0,1]" }, // 3 arguments!
    ],
  };

  const report = validateProblemContract(badProblem);
  assert.equal(report.is_valid, false);
  assert.ok(report.errors.some((e) => e.includes("Expected 2 argument(s)")));
  console.log("✔ Validation detected argument count mismatch:", report.errors[0]);

  // Test function_name mismatch with function_signature.name
  const mismatchProblem = {
    title: "Two Sum",
    function_name: "solve",
    function_signature: {
      name: "twoSum",
      parameters: [{ name: "nums", type: "integer[]" }],
      return_type: "integer[]",
    },
  };
  const reportMismatch = validateProblemContract(mismatchProblem);
  assert.equal(reportMismatch.is_valid, false);
  assert.ok(reportMismatch.errors.some((e) => e.includes("must match function signature name")));
  console.log("✔ Validation detected function name mismatch:", reportMismatch.errors[0]);
}

console.log("ALL LEETCODE ARCHITECTURE TESTS PASSED SUCCESSFULLY! 🎉");
