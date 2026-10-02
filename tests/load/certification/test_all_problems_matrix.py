"""
Chaos Computer Club — Comprehensive Multi-Language Judge Evaluation Suite
Tests all 10 problems (P through Y) across all 6 requested languages:
JavaScript, TypeScript, Python, C++, Java, and C.
Validates exact sample + hidden testcase counts and execution verdicts.
"""

import json
import time
import httpx
from typing import Dict, Any, List

BASE_URL = "https://medicaps-api.chaoscomputerclub.in"
CONTEST_SLUG = "CCC WEEKLY 1"

with open("tests/load/data/loadtest_identities.json") as f:
    identities = json.load(f)

user_token = identities[0]["token"]
headers = {
    "Authorization": f"Bearer {user_token}",
    "Content-Type": "application/json",
}

SOLUTIONS = {
    "P": {
        "javascript": """var productExceptSelf = function(nums) {
    const result = new Array(nums.length).fill(1);
    let prefix = 1;
    for (let i = 0; i < nums.length; i++) {
        result[i] = prefix;
        prefix *= nums[i];
    }
    let suffix = 1;
    for (let i = nums.length - 1; i >= 0; i--) {
        result[i] *= suffix;
        suffix *= nums[i];
    }
    return result;
};""",
        "typescript": """function productExceptSelf(nums: number[]): number[] {
    const result: number[] = new Array(nums.length).fill(1);
    let prefix = 1;
    for (let i = 0; i < nums.length; i++) {
        result[i] = prefix;
        prefix *= nums[i];
    }
    let suffix = 1;
    for (let i = nums.length - 1; i >= 0; i--) {
        result[i] *= suffix;
        suffix *= nums[i];
    }
    return result;
}""",
        "python": """def productExceptSelf(nums):
    result = [1] * len(nums)
    prefix = 1
    for i in range(len(nums)):
        result[i] = prefix
        prefix *= nums[i]
    suffix = 1
    for i in range(len(nums) - 1, -1, -1):
        result[i] *= suffix
        suffix *= nums[i]
    return result""",
        "cpp": """#include <vector>
using namespace std;
class Solution {
public:
    vector<int> productExceptSelf(vector<int>& nums) {
        vector<int> result(nums.size(), 1);
        long long prefix = 1;
        for (int i = 0; i < nums.size(); i++) {
            result[i] = prefix;
            prefix *= nums[i];
        }
        long long suffix = 1;
        for (int i = nums.size() - 1; i >= 0; i--) {
            result[i] *= suffix;
            suffix *= nums[i];
        }
        return result;
    }
};""",
        "java": """class Solution {
    public int[] productExceptSelf(int[] nums) {
        int[] result = new int[nums.length];
        long prefix = 1;
        for (int i = 0; i < nums.length; i++) {
            result[i] = (int) prefix;
            prefix *= nums[i];
        }
        long suffix = 1;
        for (int i = nums.length - 1; i >= 0; i--) {
            result[i] = (int) (result[i] * suffix);
            suffix *= nums[i];
        }
        return result;
    }
}""",
        "c": """#include <stdlib.h>

int* productExceptSelf(int* nums, int numsSize, int* returnSize) {
    int* result = (int*)malloc(numsSize * sizeof(int));
    long long prefix = 1;
    for (int i = 0; i < numsSize; i++) {
        result[i] = (int)prefix;
        prefix *= nums[i];
    }
    long long suffix = 1;
    for (int i = numsSize - 1; i >= 0; i--) {
        result[i] = (int)(result[i] * suffix);
        suffix *= nums[i];
    }
    *returnSize = numsSize;
    return result;
}""",
    },

    "Q": {
        "javascript": """var longestConsecutive = function(nums) {
    const set = new Set(nums);
    let longest = 0;
    for (const num of set) {
        if (!set.has(num - 1)) {
            let current = num;
            let length = 1;
            while (set.has(current + 1)) {
                current++;
                length++;
            }
            longest = Math.max(longest, length);
        }
    }
    return longest;
};""",
        "typescript": """function longestConsecutive(nums: number[]): number {
    const set = new Set(nums);
    let longest = 0;
    for (const num of set) {
        if (!set.has(num - 1)) {
            let current = num;
            let length = 1;
            while (set.has(current + 1)) {
                current++;
                length++;
            }
            longest = Math.max(longest, length);
        }
    }
    return longest;
}""",
        "python": """def longestConsecutive(nums):
    if not nums:
        return 0
    nums_set = set(nums)
    longest = 0
    for num in nums_set:
        if num - 1 not in nums_set:
            current = num
            length = 1
            while current + 1 in nums_set:
                current += 1
                length += 1
            longest = max(longest, length)
    return longest""",
        "cpp": """#include <vector>
#include <algorithm>
using namespace std;
class Solution {
public:
    int longestConsecutive(vector<int>& nums) {
        if (nums.empty()) return 0;
        sort(nums.begin(), nums.end());
        int longest = 1, current = 1;
        for (size_t i = 1; i < nums.size(); i++) {
            if (nums[i] == nums[i - 1]) continue;
            if (nums[i] == nums[i - 1] + 1) current++;
            else current = 1;
            longest = max(longest, current);
        }
        return longest;
    }
};""",
        "java": """import java.util.*;
class Solution {
    public int longestConsecutive(int[] nums) {
        if (nums.length == 0) return 0;
        Arrays.sort(nums);
        int longest = 1, current = 1;
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] == nums[i - 1]) continue;
            if (nums[i] == nums[i - 1] + 1) current++;
            else current = 1;
            longest = Math.max(longest, current);
        }
        return longest;
    }
}""",
        "c": """#include <stdlib.h>

static int compare_ints(const void* a, const void* b) {
    int x = *(const int*)a;
    int y = *(const int*)b;
    return (x > y) - (x < y);
}

int longestConsecutive(int* nums, int numsSize) {
    if (numsSize == 0) return 0;
    qsort(nums, numsSize, sizeof(int), compare_ints);
    int longest = 1, current = 1;
    for (int i = 1; i < numsSize; i++) {
        if (nums[i] == nums[i - 1]) continue;
        if (nums[i] == nums[i - 1] + 1) current++;
        else current = 1;
        if (current > longest) longest = current;
    }
    return longest;
}""",
    },

    "R": {
        "javascript": """var subarraySum = function(nums, target) {
    const prefixCount = new Map();
    prefixCount.set(0, 1);
    let prefixSum = 0;
    let result = 0;
    for (const num of nums) {
        prefixSum += num;
        const required = prefixSum - target;
        if (prefixCount.has(required)) {
            result += prefixCount.get(required);
        }
        prefixCount.set(prefixSum, (prefixCount.get(prefixSum) || 0) + 1);
    }
    return result;
};""",
        "typescript": """function subarraySum(nums: number[], target: number): number {
    const prefixCount = new Map<number, number>();
    prefixCount.set(0, 1);
    let prefixSum = 0;
    let result = 0;
    for (const num of nums) {
        prefixSum += num;
        const required = prefixSum - target;
        if (prefixCount.has(required)) {
            result += prefixCount.get(required)!;
        }
        prefixCount.set(prefixSum, (prefixCount.get(prefixSum) ?? 0) + 1);
    }
    return result;
}""",
        "python": """def subarraySum(nums, target):
    prefix_count = {0: 1}
    prefix_sum = 0
    result = 0
    for num in nums:
        prefix_sum += num
        required = prefix_sum - target
        result += prefix_count.get(required, 0)
        prefix_count[prefix_sum] = prefix_count.get(prefix_sum, 0) + 1
    return result""",
        "cpp": """#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    int subarraySum(vector<int>& nums, int target) {
        unordered_map<long long, int> prefixCount;
        prefixCount[0] = 1;
        long long prefixSum = 0;
        int result = 0;
        for (int num : nums) {
            prefixSum += num;
            long long required = prefixSum - target;
            if (prefixCount.count(required)) {
                result += prefixCount[required];
            }
            prefixCount[prefixSum]++;
        }
        return result;
    }
};""",
        "java": """import java.util.*;
class Solution {
    public int subarraySum(int[] nums, int target) {
        Map<Long, Integer> prefixCount = new HashMap<>();
        prefixCount.put(0L, 1);
        long prefixSum = 0;
        int result = 0;
        for (int num : nums) {
            prefixSum += num;
            long required = prefixSum - target;
            result += prefixCount.getOrDefault(required, 0);
            prefixCount.put(prefixSum, prefixCount.getOrDefault(prefixSum, 0) + 1);
        }
        return result;
    }
}""",
        "c": """#include <stdlib.h>

typedef struct {
    long long key;
    int value;
} Entry;

static unsigned int hash_r(long long key, int capacity) {
    unsigned long long x = (unsigned long long)key;
    x ^= x >> 33;
    x *= 0xff51afd7ed558ccdULL;
    x ^= x >> 33;
    return (unsigned int)(x % capacity);
}

int subarraySum(int* nums, int numsSize, int target) {
    int capacity = numsSize * 4 + 128;
    Entry* map = (Entry*)calloc(capacity, sizeof(Entry));
    char* used = (char*)calloc(capacity, sizeof(char));
    int result = 0;
    long long prefixSum = 0;

    int index = hash_r(0, capacity);
    used[index] = 1;
    map[index].key = 0;
    map[index].value = 1;

    for (int i = 0; i < numsSize; i++) {
        prefixSum += nums[i];
        long long required = prefixSum - target;
        int pos = hash_r(required, capacity);
        while (used[pos] && map[pos].key != required) {
            pos = (pos + 1) % capacity;
        }
        if (used[pos]) {
            result += map[pos].value;
        }
        pos = hash_r(prefixSum, capacity);
        while (used[pos] && map[pos].key != prefixSum) {
            pos = (pos + 1) % capacity;
        }
        if (!used[pos]) {
            used[pos] = 1;
            map[pos].key = prefixSum;
            map[pos].value = 1;
        } else {
            map[pos].value++;
        }
    }
    free(map);
    free(used);
    return result;
}""",
    },

    "S": {
        "javascript": """var spiralOrder = function(matrix) {
    const result = [];
    let top = 0, bottom = matrix.length - 1;
    let left = 0, right = matrix[0].length - 1;
    while (top <= bottom && left <= right) {
        for (let col = left; col <= right; col++) result.push(matrix[top][col]);
        top++;
        for (let row = top; row <= bottom; row++) result.push(matrix[row][right]);
        right--;
        if (top <= bottom) {
            for (let col = right; col >= left; col--) result.push(matrix[bottom][col]);
            bottom--;
        }
        if (left <= right) {
            for (let row = bottom; row >= top; row--) result.push(matrix[row][left]);
            left++;
        }
    }
    return result;
};""",
        "typescript": """function spiralOrder(matrix: number[][]): number[] {
    const result: number[] = [];
    let top = 0, bottom = matrix.length - 1;
    let left = 0, right = matrix[0].length - 1;
    while (top <= bottom && left <= right) {
        for (let col = left; col <= right; col++) result.push(matrix[top][col]);
        top++;
        for (let row = top; row <= bottom; row++) result.push(matrix[row][right]);
        right--;
        if (top <= bottom) {
            for (let col = right; col >= left; col--) result.push(matrix[bottom][col]);
            bottom--;
        }
        if (left <= right) {
            for (let row = bottom; row >= top; row--) result.push(matrix[row][left]);
            left++;
        }
    }
    return result;
}""",
        "python": """def spiralOrder(matrix):
    result = []
    top = 0
    bottom = len(matrix) - 1
    left = 0
    right = len(matrix[0]) - 1
    while top <= bottom and left <= right:
        for col in range(left, right + 1):
            result.append(matrix[top][col])
        top += 1
        for row in range(top, bottom + 1):
            result.append(matrix[row][right])
        right -= 1
        if top <= bottom:
            for col in range(right, left - 1, -1):
                result.append(matrix[bottom][col])
            bottom -= 1
        if left <= right:
            for row in range(bottom, top - 1, -1):
                result.append(matrix[row][left])
            left += 1
    return result""",
        "cpp": """#include <vector>
using namespace std;
class Solution {
public:
    vector<int> spiralOrder(vector<vector<int>>& matrix) {
        vector<int> result;
        int top = 0, bottom = matrix.size() - 1;
        int left = 0, right = matrix[0].size() - 1;
        while (top <= bottom && left <= right) {
            for (int col = left; col <= right; col++) result.push_back(matrix[top][col]);
            top++;
            for (int row = top; row <= bottom; row++) result.push_back(matrix[row][right]);
            right--;
            if (top <= bottom) {
                for (int col = right; col >= left; col--) result.push_back(matrix[bottom][col]);
                bottom--;
            }
            if (left <= right) {
                for (int row = bottom; row >= top; row--) result.push_back(matrix[row][left]);
                left++;
            }
        }
        return result;
    }
};""",
        "java": """class Solution {
    public int[] spiralOrder(int[][] matrix) {
        int rows = matrix.length, cols = matrix[0].length;
        int[] result = new int[rows * cols];
        int top = 0, bottom = rows - 1, left = 0, right = cols - 1, idx = 0;
        while (top <= bottom && left <= right) {
            for (int col = left; col <= right; col++) result[idx++] = matrix[top][col];
            top++;
            for (int row = top; row <= bottom; row++) result[idx++] = matrix[row][right];
            right--;
            if (top <= bottom) {
                for (int col = right; col >= left; col--) result[idx++] = matrix[bottom][col];
                bottom--;
            }
            if (left <= right) {
                for (int row = bottom; row >= top; row--) result[idx++] = matrix[row][left];
                left++;
            }
        }
        return result;
    }
}""",
        "c": """#include <stdlib.h>

int* spiralOrder(int** matrix, int matrixSize, int* matrixColSize, int* returnSize) {
    int total = matrixSize * matrixColSize[0];
    int* result = (int*)malloc(total * sizeof(int));
    int top = 0, bottom = matrixSize - 1, left = 0, right = matrixColSize[0] - 1;
    int index = 0;
    while (top <= bottom && left <= right) {
        for (int col = left; col <= right; col++) result[index++] = matrix[top][col];
        top++;
        for (int row = top; row <= bottom; row++) result[index++] = matrix[row][right];
        right--;
        if (top <= bottom) {
            for (int col = right; col >= left; col--) result[index++] = matrix[bottom][col];
            bottom--;
        }
        if (left <= right) {
            for (int row = bottom; row >= top; row--) result[index++] = matrix[row][left];
            left++;
        }
    }
    *returnSize = index;
    return result;
}""",
    },

    "T": {
        "javascript": """var isValidParentheses = function(text) {
    const stack = [];
    const pairs = { ')': '(', ']': '[', '}': '{' };
    for (const char of text) {
        if (char === '(' || char === '[' || char === '{') {
            stack.push(char);
        } else {
            if (stack.length === 0 || stack.pop() !== pairs[char]) return false;
        }
    }
    return stack.length === 0;
};""",
        "typescript": """function isValidParentheses(text: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    for (const char of text) {
        if (char === '(' || char === '[' || char === '{') {
            stack.push(char);
        } else {
            if (stack.length === 0 || stack.pop() !== pairs[char]) return false;
        }
    }
    return stack.length === 0;
}""",
        "python": """def isValidParentheses(text):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for char in text:
        if char in "([{":
            stack.append(char)
        else:
            if not stack or stack.pop() != pairs.get(char):
                return False
    return len(stack) == 0""",
        "cpp": """#include <string>
#include <vector>
using namespace std;
class Solution {
public:
    bool isValidParentheses(string text) {
        vector<char> stack;
        for (char c : text) {
            if (c == '(' || c == '[' || c == '{') stack.push_back(c);
            else {
                if (stack.empty()) return false;
                char open = stack.back(); stack.pop_back();
                if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) return false;
            }
        }
        return stack.empty();
    }
};""",
        "java": """import java.util.*;
class Solution {
    public boolean isValidParentheses(String text) {
        Stack<Character> stack = new Stack<>();
        for (char c : text.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') stack.push(c);
            else {
                if (stack.isEmpty()) return false;
                char open = stack.pop();
                if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) return false;
            }
        }
        return stack.isEmpty();
    }
}""",
        "c": """#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool isValidParentheses(char* text) {
    int n = strlen(text);
    char* stack = (char*)malloc((n + 1) * sizeof(char));
    int top = 0;
    for (int i = 0; i < n; i++) {
        char c = text[i];
        if (c == '(' || c == '[' || c == '{') {
            stack[top++] = c;
        } else {
            if (top == 0) { free(stack); return false; }
            char open = stack[--top];
            if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) {
                free(stack);
                return false;
            }
        }
    }
    bool result = (top == 0);
    free(stack);
    return result;
}""",
    },

    "U": {
        "javascript": """var searchMatrix = function(matrix, target) {
    const rows = matrix.length, cols = matrix[0].length;
    let left = 0, right = rows * cols - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const val = matrix[Math.floor(mid / cols)][mid % cols];
        if (val === target) return true;
        if (val < target) left = mid + 1;
        else right = mid - 1;
    }
    return false;
};""",
        "typescript": """function searchMatrix(matrix: number[][], target: number): boolean {
    const rows = matrix.length, cols = matrix[0].length;
    let left = 0, right = rows * cols - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const val = matrix[Math.floor(mid / cols)][mid % cols];
        if (val === target) return true;
        if (val < target) left = mid + 1;
        else right = mid - 1;
    }
    return false;
}""",
        "python": """def searchMatrix(matrix, target):
    rows = len(matrix)
    cols = len(matrix[0])
    left = 0
    right = rows * cols - 1
    while left <= right:
        mid = (left + right) // 2
        val = matrix[mid // cols][mid % cols]
        if val == target:
            return True
        if val < target:
            left = mid + 1
        else:
            right = mid - 1
    return False""",
        "cpp": """#include <vector>
using namespace std;
class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        int rows = matrix.size(), cols = matrix[0].size();
        int left = 0, right = rows * cols - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            int val = matrix[mid / cols][mid % cols];
            if (val == target) return true;
            if (val < target) left = mid + 1;
            else right = mid - 1;
        }
        return false;
    }
};""",
        "java": """class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int rows = matrix.length, cols = matrix[0].length;
        int left = 0, right = rows * cols - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            int val = matrix[mid / cols][mid % cols];
            if (val == target) return true;
            if (val < target) left = mid + 1;
            else right = mid - 1;
        }
        return false;
    }
}""",
        "c": """#include <stdbool.h>

bool searchMatrix(int** matrix, int matrixSize, int* matrixColSize, int target) {
    int rows = matrixSize, cols = matrixColSize[0];
    int left = 0, right = rows * cols - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        int val = matrix[mid / cols][mid % cols];
        if (val == target) return true;
        if (val < target) left = mid + 1;
        else right = mid - 1;
    }
    return false;
}""",
    },

    "V": {
        "javascript": """var dailyTemperatures = function(temperatures) {
    const result = new Array(temperatures.length).fill(0);
    const stack = [];
    for (let i = 0; i < temperatures.length; i++) {
        while (stack.length > 0 && temperatures[i] > temperatures[stack[stack.length - 1]]) {
            const prev = stack.pop();
            result[prev] = i - prev;
        }
        stack.push(i);
    }
    return result;
};""",
        "typescript": """function dailyTemperatures(temperatures: number[]): number[] {
    const result: number[] = new Array(temperatures.length).fill(0);
    const stack: number[] = [];
    for (let i = 0; i < temperatures.length; i++) {
        while (stack.length > 0 && temperatures[i] > temperatures[stack[stack.length - 1]]) {
            const prev = stack.pop()!;
            result[prev] = i - prev;
        }
        stack.push(i);
    }
    return result;
}""",
        "python": """def dailyTemperatures(temperatures):
    result = [0] * len(temperatures)
    stack = []
    for i, temperature in enumerate(temperatures):
        while stack and temperature > temperatures[stack[-1]]:
            prev = stack.pop()
            result[prev] = i - prev
        stack.append(i)
    return result""",
        "cpp": """#include <vector>
using namespace std;
class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        vector<int> result(temperatures.size(), 0);
        vector<int> stack;
        for (int i = 0; i < (int)temperatures.size(); i++) {
            while (!stack.empty() && temperatures[i] > temperatures[stack.back()]) {
                int prev = stack.back(); stack.pop_back();
                result[prev] = i - prev;
            }
            stack.push_back(i);
        }
        return result;
    }
};""",
        "java": """import java.util.*;
class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int[] result = new int[temperatures.length];
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < temperatures.length; i++) {
            while (!stack.isEmpty() && temperatures[i] > temperatures[stack.peek()]) {
                int prev = stack.pop();
                result[prev] = i - prev;
            }
            stack.push(i);
        }
        return result;
    }
}""",
        "c": """#include <stdlib.h>

int* dailyTemperatures(int* temperatures, int temperaturesSize, int* returnSize) {
    int* result = (int*)calloc(temperaturesSize, sizeof(int));
    int* stack = (int*)malloc(temperaturesSize * sizeof(int));
    int top = 0;
    for (int i = 0; i < temperaturesSize; i++) {
        while (top > 0 && temperatures[i] > temperatures[stack[top - 1]]) {
            int prev = stack[--top];
            result[prev] = i - prev;
        }
        stack[top++] = i;
    }
    free(stack);
    *returnSize = temperaturesSize;
    return result;
}""",
    },

    "W": {
        "javascript": """var minWindow = function(source, target) {
    if (target.length === 0 || source.length === 0) return "";
    const required = new Map();
    for (const char of target) required.set(char, (required.get(char) || 0) + 1);
    const window = new Map();
    let left = 0, formed = 0, bestStart = 0, bestLength = Infinity;
    for (let right = 0; right < source.length; right++) {
        const char = source[right];
        window.set(char, (window.get(char) || 0) + 1);
        if (required.has(char) && window.get(char) === required.get(char)) formed++;
        while (formed === required.size) {
            const length = right - left + 1;
            if (length < bestLength) { bestLength = length; bestStart = left; }
            const leftChar = source[left];
            window.set(leftChar, window.get(leftChar) - 1);
            if (required.has(leftChar) && window.get(leftChar) < required.get(leftChar)) formed--;
            left++;
        }
    }
    return bestLength === Infinity ? "" : source.substring(bestStart, bestStart + bestLength);
};""",
        "typescript": """function minWindow(source: string, target: string): string {
    if (target.length === 0 || source.length === 0) return "";
    const required = new Map<string, number>();
    for (const char of target) required.set(char, (required.get(char) ?? 0) + 1);
    const window = new Map<string, number>();
    let left = 0, formed = 0, bestStart = 0, bestLength = Infinity;
    for (let right = 0; right < source.length; right++) {
        const char = source[right];
        window.set(char, (window.get(char) ?? 0) + 1);
        if (required.has(char) && window.get(char) === required.get(char)) formed++;
        while (formed === required.size) {
            const length = right - left + 1;
            if (length < bestLength) { bestLength = length; bestStart = left; }
            const leftChar = source[left];
            window.set(leftChar, window.get(leftChar)! - 1);
            if (required.has(leftChar) && window.get(leftChar)! < required.get(leftChar)!) formed--;
            left++;
        }
    }
    return bestLength === Infinity ? "" : source.substring(bestStart, bestStart + bestLength);
}""",
        "python": """def minWindow(source, target):
    if not source or not target: return ""
    required = {}
    for char in target: required[char] = required.get(char, 0) + 1
    window = {}
    left = 0
    formed = 0
    best_start = 0
    best_length = float("inf")
    for right, char in enumerate(source):
        window[char] = window.get(char, 0) + 1
        if char in required and window[char] == required[char]: formed += 1
        while formed == len(required):
            length = right - left + 1
            if length < best_length: best_length = length; best_start = left
            left_char = source[left]
            window[left_char] -= 1
            if left_char in required and window[left_char] < required[left_char]: formed -= 1
            left += 1
    return "" if best_length == float("inf") else source[best_start:best_start + best_length]""",
        "cpp": """#include <string>
#include <vector>
#include <climits>
using namespace std;
class Solution {
public:
    string minWindow(string source, string target) {
        if (source.empty() || target.empty()) return "";
        vector<int> required(256, 0), window(256, 0);
        for (char c : target) required[(unsigned char)c]++;
        int requiredCount = 0;
        for (int c : required) if (c > 0) requiredCount++;
        int formed = 0, left = 0, bestStart = 0, bestLength = INT_MAX;
        for (int right = 0; right < (int)source.size(); right++) {
            unsigned char c = source[right];
            window[c]++;
            if (required[c] > 0 && window[c] == required[c]) formed++;
            while (formed == requiredCount) {
                int len = right - left + 1;
                if (len < bestLength) { bestLength = len; bestStart = left; }
                unsigned char leftChar = source[left];
                window[leftChar]--;
                if (required[leftChar] > 0 && window[leftChar] < required[leftChar]) formed--;
                left++;
            }
        }
        return (bestLength == INT_MAX) ? "" : source.substr(bestStart, bestLength);
    }
};""",
        "java": """class Solution {
    public String minWindow(String source, String target) {
        if (source.length() == 0 || target.length() == 0) return "";
        int[] required = new int[256], window = new int[256];
        for (char c : target.toCharArray()) required[c]++;
        int requiredCount = 0;
        for (int c : required) if (c > 0) requiredCount++;
        int formed = 0, left = 0, bestStart = 0, bestLength = Integer.MAX_VALUE;
        for (int right = 0; right < source.length(); right++) {
            char c = source.charAt(right);
            window[c]++;
            if (required[c] > 0 && window[c] == required[c]) formed++;
            while (formed == requiredCount) {
                int len = right - left + 1;
                if (len < bestLength) { bestLength = len; bestStart = left; }
                char leftChar = source.charAt(left);
                window[leftChar]--;
                if (required[leftChar] > 0 && window[leftChar] < required[leftChar]) formed--;
                left++;
            }
        }
        return (bestLength == Integer.MAX_VALUE) ? "" : source.substring(bestStart, bestStart + bestLength);
    }
}""",
        "c": """#include <stdlib.h>
#include <string.h>
#include <limits.h>

char* minWindow(char* source, char* target) {
    int sourceLen = strlen(source);
    int targetLen = strlen(target);
    if (sourceLen == 0 || targetLen == 0) {
        char* res = (char*)malloc(1);
        res[0] = 0;
        return res;
    }
    int required[256] = {0};
    int window[256] = {0};
    for (int i = 0; i < targetLen; i++) required[(unsigned char)target[i]]++;
    int requiredCount = 0;
    for (int i = 0; i < 256; i++) { if (required[i] > 0) requiredCount++; }
    int formed = 0, left = 0, bestStart = 0, bestLength = INT_MAX;
    for (int right = 0; right < sourceLen; right++) {
        unsigned char c = source[right];
        window[c]++;
        if (required[c] > 0 && window[c] == required[c]) formed++;
        while (formed == requiredCount) {
            int len = right - left + 1;
            if (len < bestLength) { bestLength = len; bestStart = left; }
            unsigned char leftChar = source[left];
            window[leftChar]--;
            if (required[leftChar] > 0 && window[leftChar] < required[leftChar]) formed--;
            left++;
        }
    }
    if (bestLength == INT_MAX) {
        char* res = (char*)malloc(1);
        res[0] = 0;
        return res;
    }
    char* result = (char*)malloc((bestLength + 1) * sizeof(char));
    memcpy(result, source + bestStart, bestLength);
    result[bestLength] = 0;
    return result;
}""",
    },

    "X": {
        "javascript": """var canFinish = function(courseCount, prerequisites) {
    const graph = Array.from({ length: courseCount }, () => []);
    const indegree = new Array(courseCount).fill(0);
    for (const [course, prerequisite] of prerequisites) {
        graph[prerequisite].push(course);
        indegree[course]++;
    }
    const queue = [];
    for (let i = 0; i < courseCount; i++) if (indegree[i] === 0) queue.push(i);
    let completed = 0, head = 0;
    while (head < queue.length) {
        const course = queue[head++];
        completed++;
        for (const next of graph[course]) {
            indegree[next]--;
            if (indegree[next] === 0) queue.push(next);
        }
    }
    return completed === courseCount;
};""",
        "typescript": """function canFinish(courseCount: number, prerequisites: number[][]): boolean {
    const graph: number[][] = Array.from({ length: courseCount }, () => []);
    const indegree: number[] = new Array(courseCount).fill(0);
    for (const [course, prerequisite] of prerequisites) {
        graph[prerequisite].push(course);
        indegree[course]++;
    }
    const queue: number[] = [];
    for (let i = 0; i < courseCount; i++) if (indegree[i] === 0) queue.push(i);
    let completed = 0, head = 0;
    while (head < queue.length) {
        const course = queue[head++];
        completed++;
        for (const next of graph[course]) {
            indegree[next]--;
            if (indegree[next] === 0) queue.push(next);
        }
    }
    return completed === courseCount;
}""",
        "python": """from collections import deque
def canFinish(courseCount, prerequisites):
    graph = [[] for _ in range(courseCount)]
    indegree = [0] * courseCount
    for course, prerequisite in prerequisites:
        graph[prerequisite].append(course)
        indegree[course] += 1
    queue = deque()
    for i in range(courseCount):
        if indegree[i] == 0: queue.append(i)
    completed = 0
    while queue:
        course = queue.popleft()
        completed += 1
        for next_course in graph[course]:
            indegree[next_course] -= 1
            if indegree[next_course] == 0: queue.append(next_course)
    return completed == courseCount""",
        "cpp": """#include <vector>
#include <queue>
using namespace std;
class Solution {
public:
    bool canFinish(int courseCount, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(courseCount);
        vector<int> indegree(courseCount, 0);
        for (auto& edge : prerequisites) {
            graph[edge[1]].push_back(edge[0]);
            indegree[edge[0]]++;
        }
        queue<int> q;
        for (int i = 0; i < courseCount; i++) if (indegree[i] == 0) q.push(i);
        int completed = 0;
        while (!q.empty()) {
            int course = q.front(); q.pop();
            completed++;
            for (int next : graph[course]) {
                indegree[next]--;
                if (indegree[next] == 0) q.push(next);
            }
        }
        return completed == courseCount;
    }
};""",
        "java": """import java.util.*;
class Solution {
    public boolean canFinish(int courseCount, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < courseCount; i++) graph.add(new ArrayList<>());
        int[] indegree = new int[courseCount];
        for (int[] edge : prerequisites) {
            graph.get(edge[1]).add(edge[0]);
            indegree[edge[0]]++;
        }
        Queue<Integer> queue = new ArrayDeque<>();
        for (int i = 0; i < courseCount; i++) if (indegree[i] == 0) queue.offer(i);
        int completed = 0;
        while (!queue.isEmpty()) {
            int course = queue.poll();
            completed++;
            for (int next : graph.get(course)) {
                indegree[next]--;
                if (indegree[next] == 0) queue.offer(next);
            }
        }
        return completed == courseCount;
    }
}""",
        "c": """#include <stdbool.h>
#include <stdlib.h>

bool canFinish(int courseCount, int** prerequisites, int prerequisitesSize, int* prerequisitesColSize) {
    int** graph = (int**)malloc(courseCount * sizeof(int*));
    int* graphSize = (int*)calloc(courseCount, sizeof(int));
    int* indegree = (int*)calloc(courseCount, sizeof(int));
    for (int i = 0; i < courseCount; i++) graph[i] = (int*)malloc(courseCount * sizeof(int));
    for (int i = 0; i < prerequisitesSize; i++) {
        int course = prerequisites[i][0];
        int prerequisite = prerequisites[i][1];
        graph[prerequisite][graphSize[prerequisite]++] = course;
        indegree[course]++;
    }
    int* queue = (int*)malloc(courseCount * sizeof(int));
    int head = 0, tail = 0;
    for (int i = 0; i < courseCount; i++) if (indegree[i] == 0) queue[tail++] = i;
    int completed = 0;
    while (head < tail) {
        int course = queue[head++];
        completed++;
        for (int i = 0; i < graphSize[course]; i++) {
            int next = graph[course][i];
            indegree[next]--;
            if (indegree[next] == 0) queue[tail++] = next;
        }
    }
    for (int i = 0; i < courseCount; i++) free(graph[i]);
    free(graph); free(graphSize); free(indegree); free(queue);
    return completed == courseCount;
}""",
    },

    "Y": {
        "javascript": """var findKthLargest = function(nums, k) {
    nums.sort((a, b) => b - a);
    return nums[k - 1];
};""",
        "typescript": """function findKthLargest(nums: number[], k: number): number {
    nums.sort((a, b) => b - a);
    return nums[k - 1];
}""",
        "python": """def findKthLargest(nums, k):
    nums.sort(reverse=True)
    return nums[k - 1]""",
        "cpp": """#include <vector>
#include <algorithm>
using namespace std;
class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        sort(nums.begin(), nums.end(), greater<int>());
        return nums[k - 1];
    }
};""",
        "java": """import java.util.*;
class Solution {
    public int findKthLargest(int[] nums, int k) {
        Arrays.sort(nums);
        return nums[nums.length - k];
    }
}""",
        "c": """#include <stdlib.h>

static int compareDesc(const void* a, const void* b) {
    int x = *(const int*)a;
    int y = *(const int*)b;
    return (y > x) - (y < x);
}

int findKthLargest(int* nums, int numsSize, int k) {
    qsort(nums, numsSize, sizeof(int), compareDesc);
    return nums[k - 1];
}""",
    }
}


def run_all_tests():
    print("=" * 75)
    print("   CHAOS COMPUTER CLUB — ALL PROBLEMS (P–Y) MULTI-LANGUAGE EVALUATION")
    print("=" * 75)

    arena_url = f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena"
    arena_resp = httpx.get(arena_url, headers=headers, timeout=20.0)
    if arena_resp.status_code != 200:
        print(f"Error fetching arena: {arena_resp.status_code} - {arena_resp.text}")
        return

    problems = arena_resp.json().get("problems", [])
    p_map = {p["problem_index"]: p["id"] for p in problems}
    print(f"Discovered {len(p_map)} problems in contest arena: {sorted(list(p_map.keys()))}\n")

    summary_table = []
    overall_passed = 0
    overall_total = 0

    languages_order = ["javascript", "typescript", "python", "cpp", "java", "c"]

    for p_idx in ["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y"]:
        p_id = p_map.get(p_idx)
        if not p_id:
            print(f"Problem {p_idx} not found in arena, skipping.")
            continue

        p_solutions = SOLUTIONS.get(p_idx, {})

        for lang in languages_order:
            code = p_solutions.get(lang)
            if not code:
                continue

            overall_total += 1
            payload = {
                "problem_id": p_id,
                "language": lang,
                "code": code,
            }

            try:
                sub_url = f"{BASE_URL}/api/contests/{CONTEST_SLUG}/arena/submit"
                resp = httpx.post(sub_url, headers=headers, json=payload, timeout=60.0)

                if resp.status_code in (200, 201):
                    data = resp.json()
                    verdict = data.get("verdict")
                    passed_tc = data.get("passed_testcases", 0)
                    total_tc = data.get("total_testcases", 0)
                    time_ms = round(float(data.get("execution_time", 0.0)) * 1000, 1)

                    is_ok = (verdict == "ACCEPTED" and passed_tc == total_tc and total_tc > 0)
                    if is_ok:
                        overall_passed += 1

                    status_sym = "✅" if is_ok else "❌"
                    print(f"[{status_sym}] Problem {p_idx} | {lang:10s} | Verdict: {verdict:16s} | Passed: {passed_tc:2d}/{total_tc:2d} | Time: {time_ms:6.1f}ms")

                    if not is_ok and data.get("stderr"):
                        first_line = data.get("stderr").strip().splitlines()[0][:100]
                        print(f"     └─ Stderr: {first_line}")

                    summary_table.append({
                        "problem": p_idx,
                        "language": lang,
                        "verdict": verdict,
                        "passed_tc": passed_tc,
                        "total_tc": total_tc,
                        "time_ms": time_ms,
                        "success": is_ok,
                    })
                else:
                    print(f"[❌] Problem {p_idx} | {lang:10s} | HTTP {resp.status_code}: {resp.text[:100]}")
                    summary_table.append({
                        "problem": p_idx,
                        "language": lang,
                        "verdict": f"HTTP_{resp.status_code}",
                        "passed_tc": 0,
                        "total_tc": 0,
                        "time_ms": 0.0,
                        "success": False,
                    })

            except Exception as e:
                print(f"[❌] Problem {p_idx} | {lang:10s} | Exception: {e}")
                summary_table.append({
                    "problem": p_idx,
                    "language": lang,
                    "verdict": "ERROR",
                    "passed_tc": 0,
                    "total_tc": 0,
                    "time_ms": 0.0,
                    "success": False,
                })

            # Small 300ms pause between sequential tests
            time.sleep(0.3)

    print("\n" + "=" * 75)
    print(f"TEST RESULTS SUMMARY: {overall_passed}/{overall_total} TESTS PASSED")
    print("=" * 75)

    with open("tests/load/reports/matrix_results.json", "w") as f:
        json.dump(summary_table, f, indent=2)


if __name__ == "__main__":
    run_all_tests()
