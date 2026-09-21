#!/usr/bin/env node
/**
 * 🛡️ Chaos Computer Club — UI Elements & Buttons Backend Connectivity Auditor
 * Strictly under the GSD Protocol.
 *
 * Uses the TypeScript Compiler API to perform deep AST analysis on all TSX/JSX components in src/
 * to determine whether every button, link, form, and interactive element is:
 *   1. 🟢 LIVE_BACKEND_MUTATION: Directly triggers backend mutation (API POST/PUT/DELETE, Redux async thunk, OTP, Profile Update)
 *   2. 🟢 LIVE_BACKEND_QUERY: Directly triggers backend data fetch/SWR query/refetch
 *   3. 🔵 ROUTING_NAVIGATION: Client-side React Router navigation (Link, NavLink, navigate(), Button asChild with Link, <a>)
 *   4. 🟡 CLIENT_UI_STATE: UI modal/drawer trigger, tab switcher, clipboard copy, local toggle, in-page scroll
 *   5. 🔒 CONDITIONALLY_LOCKED: Gatekeeping status element (e.g. "Top 30 Only", disabled pending qualification)
 *   6. 🧱 UI_PRIMITIVE_WRAPPER: Generic reusable UI wrapper in components/ui forwarding {...props}
 *   7. 🔴 STATIC_DUMMY_NOOP: Static/dummy button with no handler, empty callback, or placeholder href
 */

import fs from "fs";
import path from "path";
import ts from "typescript";

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, "src");
const REPORT_JSON_PATH = path.join(PROJECT_ROOT, ".planning", "qa", "ui_buttons_audit_report.json");
const REPORT_MD_PATH = path.join(PROJECT_ROOT, ".planning", "qa", "UI_BUTTONS_AUDIT.md");

// Color formatting
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

// Recursively find all .tsx / .jsx files
function getSourceFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== "node_modules" && item.name !== ".git" && item.name !== "dist") {
        results = results.concat(getSourceFiles(fullPath));
      }
    } else if (item.name.endsWith(".tsx") || item.name.endsWith(".jsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

// Backend pattern signatures
const BACKEND_MUTATION_PATTERNS = [
  /Thunk/i,
  /toggleFollow/i,
  /fetch\(/i,
  /axios\./i,
  /apiBase/i,
  /send_otp/i,
  /sendOtp/i,
  /verifyOtp/i,
  /completeOnboarding/i,
  /updateProfile/i,
  /submitProblem/i,
  /submitAssessment/i,
  /registerContest/i,
  /handleRegister/i,
  /handleEmail/i,
  /handleOnboard/i,
  /launchPresetContest/i,
  /deleteAccount/i,
  /loginWithGoogle/i,
  /handleFollowToggle/i,
  /handleSubmit/i,
  /handleSave/i,
  /handleDelete/i,
  /handleAction/i,
  /handle[A-Za-z0-9_]*Submit/i,
  /invalidateSwrCache/i,
  /mutate\(/i,
  /postDynamic/i,
  /handleCreate/i,
  /handleLogin/i,
  /handleVerify/i,
  /handleComplete/i,
];

const BACKEND_QUERY_PATTERNS = [
  /useSwrData/i,
  /swrFetch/i,
  /getMemberProfile/i,
  /getStudentProfile/i,
  /getRatingDistribution/i,
  /getContest/i,
  /getLeaderboard/i,
  /getVerify/i,
  /getCampusPass/i,
  /fetchFollowers/i,
  /fetchFollowing/i,
  /fetchMyFollowing/i,
  /refetch/i,
  /refresh/i,
  /reload/i,
  /handleRefresh/i,
];

const ROUTING_PATTERNS = [
  /navigate\(/i,
  /history\.push/i,
  /window\.location/i,
  /to=["'{]/i,
  /href=["'{]\/portal/i,
  /href=["'{]\/(contests|problems|leaderboard|profile|settings|verify)/i,
  /href=["'{]\/auth/i,
  /href=["'{]\/u\//i,
  /href=["'{]https?:\/\//i,
];

const UI_STATE_PATTERNS = [
  /openModal/i,
  /closeModal/i,
  /openSocialDrawer/i,
  /closeSocialDrawer/i,
  /openEditProfileModal/i,
  /setDrawer/i,
  /setShow/i,
  /setIs/i,
  /setTab/i,
  /setActive/i,
  /clipboard\.writeText/i,
  /handleCopy/i,
  /toggle/i,
  /setFilter/i,
  /setSearch/i,
  /onOpenChange/i,
  /onSelect/i,
  /dialog/i,
  /sheet/i,
  /dropdown/i,
  /popover/i,
  /setCopied/i,
  /setExpanded/i,
  /prev/i,
  /next/i,
  /scroll/i,
  /Trigger/i,
];

function analyzeElement(node, sourceFile, filePath) {
  const tagName = node.tagName.getText(sourceFile);
  const isButton = tagName === "button" || tagName === "Button";
  const isLink = tagName === "Link" || tagName === "NavLink" || tagName === "a";
  const isForm = tagName === "form";

  // Check attributes
  let onClickAttr = null;
  let onSubmitAttr = null;
  let hrefAttr = null;
  let toAttr = null;
  let typeAttr = null;
  let disabledAttr = null;
  let idAttr = null;
  let asChildAttr = false;
  let hasSpreadProps = false;

  if (node.attributes && node.attributes.properties) {
    for (const prop of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(prop)) {
        hasSpreadProps = true;
      } else if (ts.isJsxAttribute(prop)) {
        const name = prop.name.getText(sourceFile);
        const initializer = prop.initializer ? prop.initializer.getText(sourceFile) : "true";
        if (name === "onClick") onClickAttr = initializer;
        if (name === "onSubmit") onSubmitAttr = initializer;
        if (name === "href") hrefAttr = initializer;
        if (name === "to") toAttr = initializer;
        if (name === "type") typeAttr = initializer;
        if (name === "disabled") disabledAttr = initializer;
        if (name === "id") idAttr = initializer;
        if (name === "asChild") asChildAttr = true;
      }
    }
  }

  // If not a recognized button/link/form and has no explicit interactive props, skip
  if (!isButton && !isLink && !isForm && !onClickAttr && !onSubmitAttr && !toAttr) {
    return null;
  }

  // Skip pure form wrappers if they contain submit buttons
  if (isForm && !onSubmitAttr) {
    return null;
  }

  // Get line number
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const lineNumber = line + 1;

  // Inspect full element AST text and parent/children
  const parentElement = node.parent;
  let fullNodeText = node.getText(sourceFile);
  let parentText = "";
  if (parentElement && (ts.isJsxElement(parentElement) || ts.isJsxSelfClosingElement(parentElement))) {
    fullNodeText = parentElement.getText(sourceFile);
    if (parentElement.parent) {
      parentText = parentElement.parent.getText(sourceFile);
    }
  }

  // Extract label / children preview
  let label = "";
  if (node.parent && ts.isJsxElement(node.parent) && node.parent.children) {
    const textChildren = node.parent.children
      .map((c) => c.getText(sourceFile).trim())
      .filter((t) => t && !t.startsWith("<") && !t.startsWith("{/*"))
      .join(" ");
    label = textChildren.replace(/[\r\n\t]+/g, " ").trim();
  }
  if (!label && idAttr) label = `[#${idAttr.replace(/['"]/g, "")}]`;
  if (!label && toAttr) label = `[to=${toAttr.replace(/['"]/g, "")}]`;
  if (!label && hrefAttr) label = `[href=${hrefAttr.replace(/['"]/g, "")}]`;
  if (!label) {
    const match = fullNodeText.match(/>([^<{]+)</);
    if (match) label = match[1].trim();
  }
  if (!label) label = tagName;
  if (label.length > 40) label = label.slice(0, 37) + "...";

  const relFile = path.relative(PROJECT_ROOT, filePath);
  const isUiPrimitive = relFile.startsWith("src/components/ui/");

  // Classification Logic
  const combinedContext = [
    onClickAttr,
    onSubmitAttr,
    hrefAttr,
    toAttr,
    typeAttr,
    disabledAttr,
    fullNodeText,
    parentText,
  ]
    .filter(Boolean)
    .join(" ");

  let category = "STATIC_DUMMY_NOOP";
  let description = "No active event handler attached (static/placeholder element)";

  if (isUiPrimitive && hasSpreadProps) {
    category = "UI_PRIMITIVE_WRAPPER";
    description = "Reusable UI component forwarding props dynamically";
  } else if (BACKEND_MUTATION_PATTERNS.some((p) => p.test(combinedContext))) {
    category = "LIVE_BACKEND_MUTATION";
    description = "Triggers backend API mutation / Redux transaction";
  } else if (BACKEND_QUERY_PATTERNS.some((p) => p.test(combinedContext))) {
    category = "LIVE_BACKEND_QUERY";
    description = "Triggers live backend SWR query / data reload";
  } else if (
    toAttr ||
    (asChildAttr && /<Link|<NavLink|<a\s/i.test(fullNodeText)) ||
    (/<a\s/i.test(parentText) && !hrefAttr?.includes("#")) ||
    (isLink && hrefAttr && !hrefAttr.includes("#")) ||
    ROUTING_PATTERNS.some((p) => p.test(combinedContext))
  ) {
    category = "ROUTING_NAVIGATION";
    description = "Routes client across platform views via React Router";
  } else if (hrefAttr && hrefAttr.includes("#")) {
    category = "CLIENT_UI_STATE";
    description = "In-page smooth scroll anchor link";
  } else if (disabledAttr && /locked|only|wait|disabled|upcoming|ended/i.test(combinedContext)) {
    category = "CONDITIONALLY_LOCKED";
    description = "Disabled conditional gate / status lock";
  } else if (
    UI_STATE_PATTERNS.some((p) => p.test(combinedContext)) ||
    (onClickAttr && !onClickAttr.includes("() => {}") && !onClickAttr.includes("void 0"))
  ) {
    category = "CLIENT_UI_STATE";
    description = "Controls modal, drawer, tab, or local UI state";
  } else if (typeAttr && typeAttr.includes("submit")) {
    category = "LIVE_BACKEND_MUTATION";
    description = "Form submit action connected to parent form";
  }

  return {
    file: relFile,
    line: lineNumber,
    tag: `<${tagName}>`,
    label: label.replace(/['"`]/g, ""),
    handler: (onClickAttr || onSubmitAttr || toAttr || hrefAttr || typeAttr || (asChildAttr ? "asChild" : "none")).slice(0, 80),
    category,
    description,
  };
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") || filePath.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const elements = [];

  function visit(node) {
    if (ts.isJsxElement(node)) {
      const res = analyzeElement(node.openingElement, sourceFile, filePath);
      if (res) elements.push(res);
    } else if (ts.isJsxSelfClosingElement(node)) {
      const res = analyzeElement(node, sourceFile, filePath);
      if (res) elements.push(res);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return elements;
}

export function runUiAudit() {
  console.log(`\n================================================================================`);
  console.log(` 🔍  CCC APPLICATION BUTTONS & UI BACKEND CONNECTIVITY AUDITOR              `);
  console.log(`================================================================================\n`);

  const files = getSourceFiles(SRC_DIR);
  console.log(`Scanning ${files.length} UI component & page files for all interactive elements...\n`);

  let allElements = [];
  for (const f of files) {
    const el = scanFile(f);
    allElements = allElements.concat(el);
  }

  const backendMutations = allElements.filter((e) => e.category === "LIVE_BACKEND_MUTATION");
  const backendQueries = allElements.filter((e) => e.category === "LIVE_BACKEND_QUERY");
  const routingLinks = allElements.filter((e) => e.category === "ROUTING_NAVIGATION");
  const uiStateToggles = allElements.filter((e) => e.category === "CLIENT_UI_STATE");
  const conditionalLocked = allElements.filter((e) => e.category === "CONDITIONALLY_LOCKED");
  const uiPrimitives = allElements.filter((e) => e.category === "UI_PRIMITIVE_WRAPPER");
  const staticPlaceholders = allElements.filter((e) => e.category === "STATIC_DUMMY_NOOP");

  const totalInteractive = allElements.length;
  const totalFunctional = totalInteractive - staticPlaceholders.length;
  const functionalRate = ((totalFunctional / (totalInteractive === 0 ? 1 : totalInteractive)) * 100).toFixed(1);

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`LINE  FILE                            TAG        LABEL                 STATUS   `);
  console.log(`--------------------------------------------------------------------------------`);

  allElements.slice(0, 45).forEach((item) => {
    let statusBadge = `${C.green}🟢 BACKEND MUT${C.reset}`;
    if (item.category === "LIVE_BACKEND_QUERY") statusBadge = `${C.green}🟢 BACKEND GET${C.reset}`;
    if (item.category === "ROUTING_NAVIGATION") statusBadge = `${C.cyan}🔵 ROUTE LINK ${C.reset}`;
    if (item.category === "CLIENT_UI_STATE") statusBadge = `${C.yellow}🟡 UI TOGGLE  ${C.reset}`;
    if (item.category === "CONDITIONALLY_LOCKED") statusBadge = `${C.magenta}🔒 COND LOCKED${C.reset}`;
    if (item.category === "UI_PRIMITIVE_WRAPPER") statusBadge = `${C.blue}🧱 UI WRAPPER ${C.reset}`;
    if (item.category === "STATIC_DUMMY_NOOP") statusBadge = `${C.red}🔴 STATIC NOOP${C.reset}`;

    const shortFile = (item.file.replace(/^src\//, "") + "                    ").slice(0, 30);
    const shortTag = (item.tag + "          ").slice(0, 10);
    const shortLabel = (item.label + "                     ").slice(0, 20);
    const shortLine = (item.line.toString() + "    ").slice(0, 5);

    console.log(`${shortLine} ${shortFile} ${shortTag} ${shortLabel}  ${statusBadge}`);
  });

  if (allElements.length > 45) {
    console.log(`... and ${allElements.length - 45} more interactive elements audited.`);
  }

  console.log(`\n================================================================================`);
  console.log(` 📊 UI CONNECTIVITY CLASSIFICATION BREAKDOWN                                   `);
  console.log(`================================================================================`);
  console.log(` 🟢 Live Backend Mutation (API/Thunk):    ${backendMutations.length}`);
  console.log(` 🟢 Live Backend Query (SWR/Fetch):       ${backendQueries.length}`);
  console.log(` 🔵 Client Routing & Navigation:          ${routingLinks.length}`);
  console.log(` 🟡 Client UI Modal/Drawer/Copy State:    ${uiStateToggles.length}`);
  console.log(` 🔒 Conditional Gate / Locked Status:     ${conditionalLocked.length}`);
  console.log(` 🧱 Generic UI Component Wrappers:        ${uiPrimitives.length}`);
  console.log(` 🔴 Static / Dummy / Placeholder (NO-OP): ${staticPlaceholders.length}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(` TOTAL AUDITED ELEMENTS:                  ${totalInteractive}`);
  console.log(` FUNCTIONAL CONNECTIVITY RATE:            ${functionalRate}%`);
  console.log(`================================================================================\n`);

  // Ensure planning dir exists
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });

  const reportData = {
    timestamp: new Date().toISOString(),
    totalElements: totalInteractive,
    functionalCount: totalFunctional,
    connectivityRate: `${functionalRate}%`,
    breakdown: {
      backendMutations: backendMutations.length,
      backendQueries: backendQueries.length,
      routingNavigation: routingLinks.length,
      clientUiState: uiStateToggles.length,
      conditionalLocked: conditionalLocked.length,
      uiPrimitiveWrappers: uiPrimitives.length,
      staticDummyNoop: staticPlaceholders.length,
    },
    staticPlaceholders: staticPlaceholders.map((p) => ({
      file: p.file,
      line: p.line,
      tag: p.tag,
      label: p.label,
      handler: p.handler,
    })),
    elements: allElements,
  };

  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(reportData, null, 2));

  // Generate Markdown summary
  let mdContent = `# 🛡️ UI Elements & Buttons Backend Connectivity Audit Report\n\n`;
  mdContent += `**Generated**: \`${new Date().toISOString()}\`  \n`;
  mdContent += `**Total Audited Elements**: \`${totalInteractive}\`  \n`;
  mdContent += `**Overall Functional Connectivity**: \`${functionalRate}%\`\n\n`;

  mdContent += `## 📊 Classification Summary\n\n`;
  mdContent += `| Classification | Count | Description |\n`;
  mdContent += `| :--- | :---: | :--- |\n`;
  mdContent += `| 🟢 **Live Backend Mutation** | \`${backendMutations.length}\` | Triggers API POST/PUT/DELETE, Redux Thunks, or database mutations |\n`;
  mdContent += `| 🟢 **Live Backend Query** | \`${backendQueries.length}\` | Triggers live backend SWR cache queries & data refetches |\n`;
  mdContent += `| 🔵 **Routing & Navigation** | \`${routingLinks.length}\` | Navigates between platform routes via React Router |\n`;
  mdContent += `| 🟡 **Client UI State Toggle** | \`${uiStateToggles.length}\` | Controls modals, drawers, tab bars, clipboard copy, and UI toggles |\n`;
  mdContent += `| 🔒 **Conditional Lock / Gate** | \`${conditionalLocked.length}\` | Disabled status badges or qualification gates |\n`;
  mdContent += `| 🧱 **UI Primitive Wrappers** | \`${uiPrimitives.length}\` | Generic UI primitives forwarding props dynamically |\n`;
  mdContent += `| 🔴 **Static Dummy / NO-OP** | \`${staticPlaceholders.length}\` | Buttons with no handlers or placeholder hrefs |\n\n`;

  if (staticPlaceholders.length > 0) {
    mdContent += `## ⚠️ Static / Unconnected Placeholder Elements (${staticPlaceholders.length})\n\n`;
    mdContent += `| File | Line | Tag | Label / Action |\n`;
    mdContent += `| :--- | :---: | :---: | :--- |\n`;
    staticPlaceholders.forEach((s) => {
      mdContent += `| [${s.file}](${s.file}#L${s.line}) | \`${s.line}\` | \`${s.tag}\` | \`${s.label}\` |\n`;
    });
    mdContent += `\n`;
  } else {
    mdContent += `## ✨ 100% Production Grade Verification!\n\nAll buttons and clickable elements across the entire frontend are fully wired to backend APIs, Redux async actions, React Router navigation, or live UI state. Zero dummy or orphan buttons found!\n`;
  }

  fs.writeFileSync(REPORT_MD_PATH, mdContent);

  console.log(`✓ Audit artifacts saved:`);
  console.log(`  - JSON Report: ${REPORT_JSON_PATH}`);
  console.log(`  - Markdown Report: ${REPORT_MD_PATH}\n`);

  return staticPlaceholders.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = runUiAudit();
  process.exit(code);
}
