"""
Chaos Computer Club — Certification Harness: Multi-Language Source Code Matrix
Supplies solutions across supported languages (Python, C++, Java, JS, TS)
for Problems P through Y and expected verdicts (ACCEPTED, WRONG_ANSWER, COMPILATION_ERROR, RUNTIME_ERROR, TIME_LIMIT_EXCEEDED).
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass(frozen=True)
class SolutionCase:
    problem_index: str
    language: str
    expected_verdict: str  # ACCEPTED, WRONG_ANSWER, COMPILATION_ERROR, RUNTIME_ERROR, TIME_LIMIT_EXCEEDED
    source_code: str
    description: str


# =========================================================================
# PROBLEM P: Product of Array Except Self
# =========================================================================
SOLUTIONS_P = {
    ("python", "ACCEPTED"): """class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        n = len(nums)
        res = [1] * n
        prefix = 1
        for i in range(n):
            res[i] = prefix
            prefix *= nums[i]
        postfix = 1
        for i in range(n - 1, -1, -1):
            res[i] *= postfix
            postfix *= nums[i]
        return res
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        return [0] * len(nums)
""",
    ("python", "COMPILATION_ERROR"): """class Solution:
    def productExceptSelf(self, nums
        syntax_broken()
""",
    ("python", "RUNTIME_ERROR"): """class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        return 1 / 0
""",
    ("python", "TIME_LIMIT_EXCEEDED"): """import time
class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        time.sleep(10)
        return nums
""",
    ("cpp", "ACCEPTED"): """#include <vector>
using namespace std;
class Solution {
public:
    vector<int> productExceptSelf(vector<int>& nums) {
        int n = nums.size();
        vector<int> res(n, 1);
        int prefix = 1;
        for (int i = 0; i < n; i++) {
            res[i] = prefix;
            prefix *= nums[i];
        }
        int postfix = 1;
        for (int i = n - 1; i >= 0; i--) {
            res[i] *= postfix;
            postfix *= nums[i];
        }
        return res;
    }
};
""",
    ("javascript", "ACCEPTED"): """var productExceptSelf = function(nums) {
    const n = nums.length;
    const res = new Array(n).fill(1);
    let prefix = 1;
    for (let i = 0; i < n; i++) {
        res[i] = prefix;
        prefix *= nums[i];
    }
    let postfix = 1;
    for (let i = n - 1; i >= 0; i--) {
        res[i] *= postfix;
        postfix *= nums[i];
    }
    return res;
};
""",
}

# =========================================================================
# PROBLEM Q: Longest Consecutive Sequence
# =========================================================================
SOLUTIONS_Q = {
    ("python", "ACCEPTED"): """class Solution:
    def longestConsecutive(self, nums: list[int]) -> int:
        num_set = set(nums)
        longest = 0
        for n in num_set:
            if (n - 1) not in num_set:
                length = 1
                while (n + length) in num_set:
                    length += 1
                longest = max(longest, length)
        return longest
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def longestConsecutive(self, nums: list[int]) -> int:
        return 0
""",
    ("cpp", "ACCEPTED"): """#include <vector>
#include <unordered_set>
#include <algorithm>
using namespace std;
class Solution {
public:
    int longestConsecutive(vector<int>& nums) {
        unordered_set<int> s(nums.begin(), nums.end());
        int longest = 0;
        for (int n : s) {
            if (!s.count(n - 1)) {
                int cur = n;
                int len = 1;
                while (s.count(cur + 1)) {
                    cur++;
                    len++;
                }
                longest = max(longest, len);
            }
        }
        return longest;
    }
};
""",
    ("javascript", "ACCEPTED"): """var longestConsecutive = function(nums) {
    const set = new Set(nums);
    let longest = 0;
    for (const n of set) {
        if (!set.has(n - 1)) {
            let cur = n;
            let len = 1;
            while (set.has(cur + 1)) {
                cur++;
                len++;
            }
            longest = Math.max(longest, len);
        }
    }
    return longest;
};
""",
}

# =========================================================================
# PROBLEM R: Subarray Sum Equals K
# =========================================================================
SOLUTIONS_R = {
    ("python", "ACCEPTED"): """class Solution:
    def subarraySum(self, nums: list[int], target: int) -> int:
        count = 0
        curr_sum = 0
        prefix_sums = {0: 1}
        for x in nums:
            curr_sum += x
            count += prefix_sums.get(curr_sum - target, 0)
            prefix_sums[curr_sum] = prefix_sums.get(curr_sum, 0) + 1
        return count
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def subarraySum(self, nums: list[int], target: int) -> int:
        return -1
""",
    ("cpp", "ACCEPTED"): """#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    int subarraySum(vector<int>& nums, int target) {
        int count = 0, curr = 0;
        unordered_map<int, int> prefix;
        prefix[0] = 1;
        for (int x : nums) {
            curr += x;
            if (prefix.count(curr - target)) count += prefix[curr - target];
            prefix[curr]++;
        }
        return count;
    }
};
""",
    ("javascript", "ACCEPTED"): """var subarraySum = function(nums, target) {
    let count = 0, curr = 0;
    const map = new Map();
    map.set(0, 1);
    for (const x of nums) {
        curr += x;
        if (map.has(curr - target)) count += map.get(curr - target);
        map.set(curr, (map.get(curr) || 0) + 1);
    }
    return count;
};
""",
}

# =========================================================================
# PROBLEM S: Spiral Matrix
# =========================================================================
SOLUTIONS_S = {
    ("python", "ACCEPTED"): """class Solution:
    def spiralOrder(self, matrix: list[list[int]]) -> list[int]:
        if not matrix or not matrix[0]:
            return []
        res = []
        top, bottom = 0, len(matrix) - 1
        left, right = 0, len(matrix[0]) - 1
        while top <= bottom and left <= right:
            for c in range(left, right + 1):
                res.append(matrix[top][c])
            top += 1
            for r in range(top, bottom + 1):
                res.append(matrix[r][right])
            right -= 1
            if top <= bottom:
                for c in range(right, left - 1, -1):
                    res.append(matrix[bottom][c])
                bottom -= 1
            if left <= right:
                for r in range(bottom, top - 1, -1):
                    res.append(matrix[r][left])
                left += 1
        return res
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def spiralOrder(self, matrix: list[list[int]]) -> list[int]:
        return []
""",
    ("cpp", "ACCEPTED"): """#include <vector>
using namespace std;
class Solution {
public:
    vector<int> spiralOrder(vector<vector<int>>& matrix) {
        if (matrix.empty() || matrix[0].empty()) return {};
        vector<int> res;
        int top = 0, bottom = matrix.size() - 1;
        int left = 0, right = matrix[0].size() - 1;
        while (top <= bottom && left <= right) {
            for (int c = left; c <= right; c++) res.push_back(matrix[top][c]);
            top++;
            for (int r = top; r <= bottom; r++) res.push_back(matrix[r][right]);
            right--;
            if (top <= bottom) {
                for (int c = right; c >= left; c--) res.push_back(matrix[bottom][c]);
                bottom--;
            }
            if (left <= right) {
                for (int r = bottom; r >= top; r--) res.push_back(matrix[r][left]);
                left++;
            }
        }
        return res;
    }
};
""",
    ("javascript", "ACCEPTED"): """var spiralOrder = function(matrix) {
    if (!matrix.length || !matrix[0].length) return [];
    const res = [];
    let top = 0, bottom = matrix.length - 1;
    let left = 0, right = matrix[0].length - 1;
    while (top <= bottom && left <= right) {
        for (let c = left; c <= right; c++) res.push(matrix[top][c]);
        top++;
        for (let r = top; r <= bottom; r++) res.push(matrix[r][right]);
        right--;
        if (top <= bottom) {
            for (let c = right; c >= left; c--) res.push(matrix[bottom][c]);
            bottom--;
        }
        if (left <= right) {
            for (let r = bottom; r >= top; r--) res.push(matrix[r][left]);
            left++;
        }
    }
    return res;
};
""",
}

# =========================================================================
# PROBLEM T: Valid Parentheses
# =========================================================================
SOLUTIONS_T = {
    ("python", "ACCEPTED"): """class Solution:
    def isValidParentheses(self, text: str) -> bool:
        stack = []
        mapping = {')': '(', '}': '{', ']': '['}
        for char in text:
            if char in mapping:
                top = stack.pop() if stack else '#'
                if mapping[char] != top:
                    return False
            else:
                stack.append(char)
        return not stack
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def isValidParentheses(self, text: str) -> bool:
        return False
""",
    ("cpp", "ACCEPTED"): """#include <string>
#include <stack>
using namespace std;
class Solution {
public:
    bool isValidParentheses(string text) {
        stack<char> st;
        for (char c : text) {
            if (c == '(' || c == '{' || c == '[') st.push(c);
            else {
                if (st.empty()) return false;
                char top = st.top(); st.pop();
                if (c == ')' && top != '(') return false;
                if (c == '}' && top != '{') return false;
                if (c == ']' && top != '[') return false;
            }
        }
        return st.empty();
    }
};
""",
    ("javascript", "ACCEPTED"): """var isValidParentheses = function(text) {
    const stack = [];
    const map = {')': '(', '}': '{', ']': '['};
    for (const c of text) {
        if (c in map) {
            const top = stack.length ? stack.pop() : '#';
            if (top !== map[c]) return false;
        } else {
            stack.push(c);
        }
    }
    return stack.length === 0;
};
""",
}

# =========================================================================
# PROBLEM U: Search in Sorted Matrix
# =========================================================================
SOLUTIONS_U = {
    ("python", "ACCEPTED"): """class Solution:
    def searchMatrix(self, matrix: list[list[int]], target: int) -> bool:
        if not matrix or not matrix[0]:
            return False
        m, n = len(matrix), len(matrix[0])
        r, c = 0, n - 1
        while r < m and c >= 0:
            if matrix[r][c] == target:
                return True
            elif matrix[r][c] > target:
                c -= 1
            else:
                r += 1
        return False
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def searchMatrix(self, matrix: list[list[int]], target: int) -> bool:
        return False
""",
    ("cpp", "ACCEPTED"): """#include <vector>
using namespace std;
class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        if (matrix.empty() || matrix[0].empty()) return false;
        int m = matrix.size(), n = matrix[0].size();
        int r = 0, c = n - 1;
        while (r < m && c >= 0) {
            if (matrix[r][c] == target) return true;
            else if (matrix[r][c] > target) c--;
            else r++;
        }
        return false;
    }
};
""",
    ("javascript", "ACCEPTED"): """var searchMatrix = function(matrix, target) {
    if (!matrix.length || !matrix[0].length) return false;
    let r = 0, c = matrix[0].length - 1;
    while (r < matrix.length && c >= 0) {
        if (matrix[r][c] === target) return true;
        else if (matrix[r][c] > target) c--;
        else r++;
    }
    return false;
};
""",
}

# =========================================================================
# PROBLEM V: Daily Temperatures
# =========================================================================
SOLUTIONS_V = {
    ("python", "ACCEPTED"): """class Solution:
    def dailyTemperatures(self, temperatures: list[int]) -> list[int]:
        res = [0] * len(temperatures)
        stack = []
        for i, t in enumerate(temperatures):
            while stack and temperatures[stack[-1]] < t:
                prev_idx = stack.pop()
                res[prev_idx] = i - prev_idx
            stack.append(i)
        return res
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def dailyTemperatures(self, temperatures: list[int]) -> list[int]:
        return [0] * len(temperatures)
""",
    ("cpp", "ACCEPTED"): """#include <vector>
#include <stack>
using namespace std;
class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        int n = temperatures.size();
        vector<int> res(n, 0);
        stack<int> st;
        for (int i = 0; i < n; i++) {
            while (!st.empty() && temperatures[st.top()] < temperatures[i]) {
                int prev = st.top(); st.pop();
                res[prev] = i - prev;
            }
            st.push(i);
        }
        return res;
    }
};
""",
    ("javascript", "ACCEPTED"): """var dailyTemperatures = function(temperatures) {
    const res = new Array(temperatures.length).fill(0);
    const stack = [];
    for (let i = 0; i < temperatures.length; i++) {
        while (stack.length && temperatures[stack[stack.length - 1]] < temperatures[i]) {
            const prev = stack.pop();
            res[prev] = i - prev;
        }
        stack.push(i);
    }
    return res;
};
""",
}

# =========================================================================
# PROBLEM W: Minimum Window Substring
# =========================================================================
SOLUTIONS_W = {
    ("python", "ACCEPTED"): """from collections import Counter

class Solution:
    def minWindow(self, source: str, target: str) -> str:
        if not source or not target:
            return ""
        dict_t = Counter(target)
        required = len(dict_t)
        l, r = 0, 0
        formed = 0
        window_counts = {}
        ans = float("inf"), None, None
        while r < len(source):
            char = source[r]
            window_counts[char] = window_counts.get(char, 0) + 1
            if char in dict_t and window_counts[char] == dict_t[char]:
                formed += 1
            while l <= r and formed == required:
                char = source[l]
                if r - l + 1 < ans[0]:
                    ans = (r - l + 1, l, r)
                window_counts[char] -= 1
                if char in dict_t and window_counts[char] < dict_t[char]:
                    formed -= 1
                l += 1
            r += 1
        return "" if ans[0] == float("inf") else source[ans[1] : ans[2] + 1]
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def minWindow(self, source: str, target: str) -> str:
        return ""
""",
    ("cpp", "ACCEPTED"): """#include <string>
#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    string minWindow(string source, string target) {
        if (source.empty() || target.empty()) return "";
        unordered_map<char, int> target_map;
        for (char c : target) target_map[c]++;
        int required = target_map.size();
        int l = 0, r = 0, formed = 0;
        unordered_map<char, int> window_counts;
        int min_len = -1, ans_l = 0;
        while (r < source.size()) {
            char c = source[r];
            window_counts[c]++;
            if (target_map.count(c) && window_counts[c] == target_map[c]) formed++;
            while (l <= r && formed == required) {
                if (min_len == -1 || r - l + 1 < min_len) {
                    min_len = r - l + 1;
                    ans_l = l;
                }
                char left_c = source[l];
                window_counts[left_c]--;
                if (target_map.count(left_c) && window_counts[left_c] < target_map[left_c]) formed--;
                l++;
            }
            r++;
        }
        return min_len == -1 ? "" : source.substr(ans_l, min_len);
    }
};
""",
    ("javascript", "ACCEPTED"): """var minWindow = function(source, target) {
    if (!source || !target) return "";
    const map = {};
    for (const c of target) map[c] = (map[c] || 0) + 1;
    let required = Object.keys(map).length;
    let l = 0, r = 0, formed = 0;
    const window = {};
    let minLen = Infinity, start = 0;
    while (r < source.length) {
        const c = source[r];
        window[c] = (window[c] || 0) + 1;
        if (map[c] && window[c] === map[c]) formed++;
        while (l <= r && formed === required) {
            if (r - l + 1 < minLen) {
                minLen = r - l + 1;
                start = l;
            }
            const leftC = source[l];
            window[leftC]--;
            if (map[leftC] && window[leftC] < map[leftC]) formed--;
            l++;
        }
        r++;
    }
    return minLen === Infinity ? "" : source.substring(start, start + minLen);
};
""",
}

# =========================================================================
# PROBLEM X: Course Schedule
# =========================================================================
SOLUTIONS_X = {
    ("python", "ACCEPTED"): """from collections import defaultdict, deque

class Solution:
    def canFinish(self, courseCount: int, prerequisites: list[list[int]]) -> bool:
        adj = defaultdict(list)
        indegree = [0] * courseCount
        for u, v in prerequisites:
            adj[v].append(u)
            indegree[u] += 1
        q = deque([i for i in range(courseCount) if indegree[i] == 0])
        visited = 0
        while q:
            node = q.popleft()
            visited += 1
            for neighbor in adj[node]:
                indegree[neighbor] -= 1
                if indegree[neighbor] == 0:
                    q.append(neighbor)
        return visited == courseCount
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def canFinish(self, courseCount: int, prerequisites: list[list[int]]) -> bool:
        return False
""",
    ("cpp", "ACCEPTED"): """#include <vector>
#include <queue>
using namespace std;
class Solution {
public:
    bool canFinish(int courseCount, vector<vector<int>>& prerequisites) {
        vector<vector<int>> adj(courseCount);
        vector<int> indegree(courseCount, 0);
        for (auto& p : prerequisites) {
            adj[p[1]].push_back(p[0]);
            indegree[p[0]]++;
        }
        queue<int> q;
        for (int i = 0; i < courseCount; i++) {
            if (indegree[i] == 0) q.push(i);
        }
        int visited = 0;
        while (!q.empty()) {
            int node = q.front(); q.pop();
            visited++;
            for (int neighbor : adj[node]) {
                if (--indegree[neighbor] == 0) q.push(neighbor);
            }
        }
        return visited == courseCount;
    }
};
""",
    ("javascript", "ACCEPTED"): """var canFinish = function(courseCount, prerequisites) {
    const adj = Array.from({ length: courseCount }, () => []);
    const indegree = new Array(courseCount).fill(0);
    for (const [u, v] of prerequisites) {
        adj[v].push(u);
        indegree[u]++;
    }
    const q = [];
    for (let i = 0; i < courseCount; i++) {
        if (indegree[i] === 0) q.push(i);
    }
    let visited = 0;
    while (q.length) {
        const node = q.shift();
        visited++;
        for (const neighbor of adj[node]) {
            if (--indegree[neighbor] === 0) q.push(neighbor);
        }
    }
    return visited === courseCount;
};
""",
}

# =========================================================================
# PROBLEM Y: Kth Largest Element
# =========================================================================
SOLUTIONS_Y = {
    ("python", "ACCEPTED"): """import heapq

class Solution:
    def findKthLargest(self, nums: list[int], k: int) -> int:
        return heapq.nlargest(k, nums)[-1]
""",
    ("python", "WRONG_ANSWER"): """class Solution:
    def findKthLargest(self, nums: list[int], k: int) -> int:
        return 0
""",
    ("cpp", "ACCEPTED"): """#include <vector>
#include <queue>
using namespace std;
class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        priority_queue<int, vector<int>, greater<int>> pq;
        for (int x : nums) {
            pq.push(x);
            if (pq.size() > k) pq.pop();
        }
        return pq.top();
    }
};
""",
    ("javascript", "ACCEPTED"): """var findKthLargest = function(nums, k) {
    nums.sort((a, b) => b - a);
    return nums[k - 1];
};
""",
}

PROBLEM_CATALOG_MAP = {
    "P": SOLUTIONS_P,
    "Q": SOLUTIONS_Q,
    "R": SOLUTIONS_R,
    "S": SOLUTIONS_S,
    "T": SOLUTIONS_T,
    "U": SOLUTIONS_U,
    "V": SOLUTIONS_V,
    "W": SOLUTIONS_W,
    "X": SOLUTIONS_X,
    "Y": SOLUTIONS_Y,
}


class SourceCodeCatalog:
    """Provides test cases for problem index, language, and expected verdict."""

    @staticmethod
    def get_solution(
        problem_index: str,
        language: str = "python",
        verdict: str = "ACCEPTED",
    ) -> Optional[SolutionCase]:
        p = problem_index.upper()
        lang = language.lower()
        verd = verdict.upper()

        lookup = PROBLEM_CATALOG_MAP.get(p)
        if not lookup:
            return None

        code = lookup.get((lang, verd))
        if code:
            return SolutionCase(
                problem_index=p,
                language=lang,
                expected_verdict=verd,
                source_code=code,
                description=f"Problem {p} in {lang} expected {verd}",
            )

        # Fallback to JavaScript if available for ACCEPTED
        js_code = lookup.get(("javascript", verd))
        if js_code and lang in ("javascript", "typescript", "js", "ts"):
            return SolutionCase(
                problem_index=p,
                language=lang,
                expected_verdict=verd,
                source_code=js_code,
                description=f"Problem {p} in {lang} (via JS) expected {verd}",
            )

        # Fallback to Python if other language not explicitly provided
        py_code = lookup.get(("python", verd))
        if py_code:
            return SolutionCase(
                problem_index=p,
                language="python",
                expected_verdict=verd,
                source_code=py_code,
                description=f"Problem {p} in python fallback for {verd}",
            )

        return None
