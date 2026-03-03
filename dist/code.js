"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

  // src/color-utils.ts
  function rgbToHex(color) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  }
  function relativeLuminance(color) {
    const linearize = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
  }
  function contrastRatio(color1, color2) {
    const l1 = relativeLuminance(color1);
    const l2 = relativeLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // src/comparison-engine.ts
  async function extractDesignTokens(node) {
    const tokens = {
      colors: [],
      typography: [],
      spacing: [],
      components: []
    };
    await traverseNode(node, tokens);
    return tokens;
  }
  async function traverseNode(node, tokens) {
    var _a, _b, _c;
    if ("fills" in node && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === "SOLID" && fill.visible !== false) {
          tokens.colors.push({
            hex: rgbToHex(fill.color),
            rgb: __spreadValues({}, fill.color),
            nodeName: node.name,
            nodeId: node.id,
            property: "fill",
            opacity: (_a = fill.opacity) != null ? _a : 1
          });
        }
      }
    }
    if ("strokes" in node && Array.isArray(node.strokes)) {
      for (const stroke of node.strokes) {
        if (stroke.type === "SOLID" && stroke.visible !== false) {
          tokens.colors.push({
            hex: rgbToHex(stroke.color),
            rgb: __spreadValues({}, stroke.color),
            nodeName: node.name,
            nodeId: node.id,
            property: "stroke",
            opacity: (_b = stroke.opacity) != null ? _b : 1
          });
        }
      }
    }
    if (node.type === "TEXT") {
      const textNode = node;
      const fontSize = textNode.fontSize;
      const fontName = textNode.fontName;
      if (typeof fontSize === "number" && fontName !== figma.mixed) {
        let lineHeightValue = null;
        if (textNode.lineHeight !== figma.mixed) {
          const lh = textNode.lineHeight;
          if (lh.unit === "PIXELS")
            lineHeightValue = lh.value;
          else if (lh.unit === "PERCENT")
            lineHeightValue = fontSize * lh.value / 100;
        }
        let letterSpacingValue = 0;
        if (textNode.letterSpacing !== figma.mixed) {
          const ls = textNode.letterSpacing;
          if (ls.unit === "PIXELS")
            letterSpacingValue = ls.value;
          else if (ls.unit === "PERCENT")
            letterSpacingValue = fontSize * ls.value / 100;
        }
        tokens.typography.push({
          fontFamily: fontName.family,
          fontSize,
          fontWeight: getFontWeight(fontName.style),
          lineHeight: lineHeightValue,
          letterSpacing: letterSpacingValue,
          textContent: textNode.characters.substring(0, 50),
          nodeName: node.name,
          nodeId: node.id
        });
      }
    }
    if ("layoutMode" in node && node.layoutMode !== "NONE") {
      const frame = node;
      if (frame.itemSpacing !== void 0) {
        tokens.spacing.push({
          type: "gap",
          value: Math.round(frame.itemSpacing),
          direction: frame.layoutMode === "HORIZONTAL" ? "horizontal" : "vertical",
          nodeName: node.name,
          nodeId: node.id
        });
      }
      if (frame.paddingTop !== void 0) {
        if (Math.round(frame.paddingTop) > 0)
          tokens.spacing.push({ type: "padding", value: Math.round(frame.paddingTop), direction: "top", nodeName: node.name, nodeId: node.id });
        if (Math.round(frame.paddingRight) > 0)
          tokens.spacing.push({ type: "padding", value: Math.round(frame.paddingRight), direction: "right", nodeName: node.name, nodeId: node.id });
        if (Math.round(frame.paddingBottom) > 0)
          tokens.spacing.push({ type: "padding", value: Math.round(frame.paddingBottom), direction: "bottom", nodeName: node.name, nodeId: node.id });
        if (Math.round(frame.paddingLeft) > 0)
          tokens.spacing.push({ type: "padding", value: Math.round(frame.paddingLeft), direction: "left", nodeName: node.name, nodeId: node.id });
      }
    }
    if (node.type === "INSTANCE") {
      const instance = node;
      const mainComp = await instance.getMainComponentAsync();
      tokens.components.push({
        name: node.name,
        nodeId: node.id,
        mainComponentId: (_c = mainComp == null ? void 0 : mainComp.id) != null ? _c : null,
        variantProperties: instance.variantProperties,
        width: node.width,
        height: node.height,
        childCount: "children" in node ? node.children.length : 0
      });
    }
    if ("children" in node) {
      for (const child of node.children) {
        if (child.visible !== false) {
          await traverseNode(child, tokens);
        }
      }
    }
  }
  function getFontWeight(style) {
    const weights = {
      "Thin": 100,
      "Hairline": 100,
      "ExtraLight": 200,
      "Ultra Light": 200,
      "Light": 300,
      "Regular": 400,
      "Normal": 400,
      "Medium": 500,
      "SemiBold": 600,
      "Semi Bold": 600,
      "Demi Bold": 600,
      "Bold": 700,
      "ExtraBold": 800,
      "Extra Bold": 800,
      "Ultra Bold": 800,
      "Black": 900,
      "Heavy": 900
    };
    for (const [name, weight] of Object.entries(weights)) {
      if (style.toLowerCase().includes(name.toLowerCase()))
        return weight;
    }
    return 400;
  }
  function runSelfChecks(implTokens, designMode) {
    const issues = [];
    issues.push(...checkTypography(implTokens.typography));
    issues.push(...checkSpacing(implTokens.spacing));
    issues.push(...checkComponents(implTokens.components));
    issues.push(...checkAccessibility(implTokens.colors, implTokens.typography, designMode));
    const seen = /* @__PURE__ */ new Set();
    return issues.filter((issue) => {
      const key = `${issue.category}:${issue.title}`;
      if (seen.has(key))
        return false;
      seen.add(key);
      return true;
    });
  }
  function checkTypography(typography) {
    const issues = [];
    const fontFamilies = new Set(typography.map((t) => t.fontFamily));
    if (fontFamilies.size > 3) {
      issues.push({
        category: "typography",
        severity: "major",
        title: "Too many font families used",
        description: `${fontFamilies.size} different font families detected.`,
        suggestion: `Consolidate fonts. Found: ${[...fontFamilies].join(", ")}`
      });
    }
    for (const typo of typography) {
      if (typo.lineHeight !== null) {
        const ratio = typo.lineHeight / typo.fontSize;
        if (ratio < 1.2) {
          issues.push({
            category: "typography",
            severity: "major",
            title: `Tight line height: "${typo.nodeName}"`,
            description: `Line height ratio ${ratio.toFixed(2)}. Minimum 1.2 recommended.`,
            nodeName: typo.nodeName,
            nodeId: typo.nodeId,
            suggestion: `Increase line height to at least ${Math.ceil(typo.fontSize * 1.2)}px.`
          });
        }
      }
    }
    return issues;
  }
  function checkSpacing(spacing) {
    const issues = [];
    const spacingScale = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96];
    for (const sp of spacing) {
      if (!spacingScale.includes(sp.value) && sp.value > 0) {
        const nearest = spacingScale.reduce(
          (prev, curr) => Math.abs(curr - sp.value) < Math.abs(prev - sp.value) ? curr : prev
        );
        if (Math.abs(sp.value - nearest) <= 3 && Math.abs(sp.value - nearest) >= 1) {
          issues.push({
            category: "spacing",
            severity: "minor",
            title: `Off-scale ${sp.type}: "${sp.nodeName}"`,
            description: `${sp.direction} ${sp.type} is ${sp.value}px, nearest scale: ${nearest}px.`,
            nodeName: sp.nodeName,
            nodeId: sp.nodeId,
            expectedValue: nearest,
            actualValue: sp.value,
            suggestion: `Adjust to ${nearest}px.`
          });
        }
      }
    }
    return issues;
  }
  function checkComponents(components) {
    const issues = [];
    const groups = /* @__PURE__ */ new Map();
    for (const comp of components) {
      if (comp.mainComponentId) {
        if (!groups.has(comp.mainComponentId))
          groups.set(comp.mainComponentId, []);
        groups.get(comp.mainComponentId).push(comp);
      }
    }
    for (const [, instances] of groups) {
      if (instances.length < 2)
        continue;
      const widths = new Set(instances.map((i) => Math.round(i.width)));
      const heights = new Set(instances.map((i) => Math.round(i.height)));
      if (widths.size > 1 || heights.size > 1) {
        const diffs = [];
        if (widths.size > 1)
          diffs.push(`widths: ${[...widths].join(", ")}px`);
        if (heights.size > 1)
          diffs.push(`heights: ${[...heights].join(", ")}px`);
        issues.push({
          category: "component",
          severity: "major",
          title: `Inconsistent sizes: "${instances[0].name}"`,
          description: `${instances.length} instances have different sizes.`,
          componentName: instances[0].name,
          differences: diffs,
          suggestion: "Ensure all instances use consistent sizing."
        });
      }
    }
    return issues;
  }
  function checkAccessibility(colors, typography, designMode) {
    const issues = [];
    const textColors = colors.filter((c) => {
      const n = c.nodeName.toLowerCase();
      return n.includes("text") || n.includes("label") || n.includes("title") || n.includes("body") || n.includes("heading") || n.includes("caption");
    });
    const bgColors = colors.filter((c) => {
      const n = c.nodeName.toLowerCase();
      return n.includes("background") || n.includes("bg") || n.includes("surface") || n.includes("card") || n.includes("container") || n.includes("frame");
    });
    const defaultBg = designMode === "dark" ? { r: 0.1, g: 0.1, b: 0.1 } : { r: 1, g: 1, b: 1 };
    const backgrounds = bgColors.length > 0 ? bgColors.map((c) => c.rgb) : [defaultBg];
    for (const tc of textColors) {
      for (const bg of backgrounds) {
        const ratio = contrastRatio(tc.rgb, bg);
        const textHex = rgbToHex(tc.rgb);
        const bgHex = rgbToHex(bg);
        const relTypo = typography.find((t) => t.nodeName === tc.nodeName || t.nodeId === tc.nodeId);
        const isLarge = relTypo && (relTypo.fontSize >= 18 || relTypo.fontSize >= 14 && relTypo.fontWeight >= 700);
        const aaT = isLarge ? 3 : 4.5;
        if (ratio < aaT) {
          issues.push({
            category: "a11y",
            severity: "critical",
            title: `Insufficient contrast: "${tc.nodeName}"`,
            description: `Contrast ${ratio.toFixed(2)}:1 fails WCAG AA (needs ${aaT}:1).`,
            nodeName: tc.nodeName,
            nodeId: tc.nodeId,
            contrastRatio: ratio,
            foreground: textHex,
            background: bgHex,
            wcagCriteria: "WCAG 2.1 - 1.4.3",
            suggestion: `Increase contrast to at least ${aaT}:1.`
          });
        }
      }
    }
    for (const typo of typography) {
      if (typo.fontSize < 12) {
        issues.push({
          category: "a11y",
          severity: "major",
          title: `Text too small: "${typo.nodeName}"`,
          description: `Font size ${typo.fontSize}px is below minimum 12px.`,
          nodeName: typo.nodeName,
          nodeId: typo.nodeId,
          suggestion: "Increase font size to at least 12px."
        });
      }
    }
    return issues;
  }

  // src/code.ts
  figma.showUI(__html__, {
    width: 420,
    height: 720,
    themeColors: true,
    title: "Design QA Inspector"
  });
  var currentDesignMode = "light";
  var selectedDesignFrameId = null;
  var selectedImplFrameId = null;
  var tempHighlightId = null;
  var VALID_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP", "SECTION"];
  var SEVERITY_COLORS = {
    critical: { r: 0.95, g: 0.28, b: 0.13 },
    major: { r: 0.95, g: 0.64, b: 0.05 },
    minor: { r: 0.05, g: 0.6, b: 1 },
    info: { r: 0.6, g: 0.6, b: 0.6 }
  };
  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case "select-design-frame":
        handleFrameSelection("design");
        break;
      case "select-impl-frame":
        handleFrameSelection("impl");
        break;
      case "set-design-mode":
        if (msg.designMode)
          currentDesignMode = msg.designMode;
        break;
      case "run-comparison":
        await handleComparison();
        break;
      case "highlight-on-canvas":
        if (msg.nodeId)
          await highlightOnCanvas(msg.nodeId, msg.severity || "info");
        break;
      case "highlight-region":
        await highlightRegion(
          msg.regionX || 0,
          msg.regionY || 0,
          msg.regionWidth || 0,
          msg.regionHeight || 0,
          msg.severity || "critical"
        );
        break;
      case "clear-highlight":
        await clearTempHighlight();
        break;
      case "mark-on-canvas":
        if (msg.nodeId)
          await markOnCanvas(msg.nodeId, msg.severity || "info", msg.title || "");
        break;
      case "mark-region":
        await markRegion(
          msg.regionX || 0,
          msg.regionY || 0,
          msg.regionWidth || 0,
          msg.regionHeight || 0,
          msg.severity || "critical",
          msg.title || ""
        );
        break;
      case "export-report":
        if (msg.issues && msg.format)
          handleExport(msg.format, msg.issues);
        break;
    }
  };
  function handleFrameSelection(target) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("Figma\uC5D0\uC11C \uD504\uB808\uC784\uC744 \uBA3C\uC800 \uC120\uD0DD\uD558\uC138\uC694.", { error: true });
      return;
    }
    const node = selection[0];
    if (!VALID_TYPES.includes(node.type)) {
      figma.notify("Frame, Component, Instance \uB610\uB294 Group\uC744 \uC120\uD0DD\uD558\uC138\uC694.", { error: true });
      return;
    }
    if (target === "design") {
      selectedDesignFrameId = node.id;
    } else {
      selectedImplFrameId = node.id;
    }
    figma.ui.postMessage({
      type: target === "design" ? "design-frame-selected" : "impl-frame-selected",
      frame: {
        id: node.id,
        name: node.name,
        width: "width" in node ? node.width : 0,
        height: "height" in node ? node.height : 0
      }
    });
    const label = target === "design" ? "Design" : "Implementation";
    figma.notify(`${label}: "${node.name}" (${Math.round(node.width)}x${Math.round(node.height)})`);
  }
  async function handleComparison() {
    try {
      if (!selectedDesignFrameId || !selectedImplFrameId) {
        figma.ui.postMessage({
          type: "comparison-error",
          error: "Design\uACFC Implementation \uD504\uB808\uC784\uC744 \uBAA8\uB450 \uC120\uD0DD\uD558\uC138\uC694."
        });
        return;
      }
      if (selectedDesignFrameId === selectedImplFrameId) {
        figma.ui.postMessage({
          type: "comparison-error",
          error: "\uAC19\uC740 \uD504\uB808\uC784\uC785\uB2C8\uB2E4. \uC11C\uB85C \uB2E4\uB978 \uD504\uB808\uC784\uC744 \uC120\uD0DD\uD558\uC138\uC694."
        });
        return;
      }
      await clearTempHighlight();
      const designNode = await figma.getNodeByIdAsync(selectedDesignFrameId);
      const implNode = await figma.getNodeByIdAsync(selectedImplFrameId);
      if (!designNode || !VALID_TYPES.includes(designNode.type)) {
        figma.ui.postMessage({ type: "comparison-error", error: "Design \uD504\uB808\uC784\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." });
        return;
      }
      if (!implNode || !VALID_TYPES.includes(implNode.type)) {
        figma.ui.postMessage({ type: "comparison-error", error: "Implementation \uD504\uB808\uC784\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." });
        return;
      }
      const implTokens = await extractDesignTokens(implNode);
      const selfCheckIssues = runSelfChecks(implTokens, currentDesignMode);
      const exportSettings = {
        format: "PNG",
        constraint: { type: "SCALE", value: 1 }
      };
      const designBytes = await designNode.exportAsync(exportSettings);
      const implBytes = await implNode.exportAsync(exportSettings);
      const designBase64 = figma.base64Encode(designBytes);
      const implBase64 = figma.base64Encode(implBytes);
      const implAbsX = "absoluteTransform" in implNode ? implNode.absoluteTransform[0][2] : 0;
      const implAbsY = "absoluteTransform" in implNode ? implNode.absoluteTransform[1][2] : 0;
      figma.ui.postMessage({
        type: "comparison-data",
        selfCheckIssues,
        designImage: designBase64,
        implImage: implBase64,
        designWidth: designNode.width,
        designHeight: designNode.height,
        implWidth: implNode.width,
        implHeight: implNode.height,
        implAbsX: Math.round(implAbsX),
        implAbsY: Math.round(implAbsY)
      });
      figma.notify("\uD504\uB808\uC784 \uBD84\uC11D \uC911...", { timeout: 2e3 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      figma.ui.postMessage({ type: "comparison-error", error: errorMessage });
      figma.notify("\uBE44\uAD50 \uC2E4\uD328: " + errorMessage, { error: true });
    }
  }
  async function highlightOnCanvas(nodeId, severity) {
    await clearTempHighlight();
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || !("absoluteTransform" in node))
      return;
    const sceneNode = node;
    const absX = sceneNode.absoluteTransform[0][2];
    const absY = sceneNode.absoluteTransform[1][2];
    const w = "width" in sceneNode ? sceneNode.width : 0;
    const h = "height" in sceneNode ? sceneNode.height : 0;
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
    const rect = figma.createRectangle();
    rect.name = "__QA_TEMP_HIGHLIGHT__";
    rect.x = absX - 2;
    rect.y = absY - 2;
    rect.resize(w + 4, h + 4);
    rect.fills = [{ type: "SOLID", color, opacity: 0.12 }];
    rect.strokes = [{ type: "SOLID", color }];
    rect.strokeWeight = 2;
    rect.cornerRadius = 2;
    tempHighlightId = rect.id;
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
  }
  async function highlightRegion(regionX, regionY, regionWidth, regionHeight, severity) {
    await clearTempHighlight();
    if (!selectedImplFrameId)
      return;
    const implNode = await figma.getNodeByIdAsync(selectedImplFrameId);
    if (!implNode || !("absoluteTransform" in implNode))
      return;
    const implAbsX = implNode.absoluteTransform[0][2];
    const implAbsY = implNode.absoluteTransform[1][2];
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.critical;
    const rect = figma.createRectangle();
    rect.name = "__QA_TEMP_HIGHLIGHT__";
    rect.x = implAbsX + regionX - 4;
    rect.y = implAbsY + regionY - 4;
    rect.resize(regionWidth + 8, regionHeight + 8);
    rect.fills = [{ type: "SOLID", color, opacity: 0.15 }];
    rect.strokes = [{ type: "SOLID", color }];
    rect.strokeWeight = 2;
    rect.cornerRadius = 3;
    tempHighlightId = rect.id;
    figma.viewport.scrollAndZoomIntoView([rect]);
  }
  async function clearTempHighlight() {
    if (tempHighlightId) {
      const node = await figma.getNodeByIdAsync(tempHighlightId);
      if (node)
        node.remove();
      tempHighlightId = null;
    }
  }
  async function markOnCanvas(nodeId, severity, title) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || !("absoluteTransform" in node)) {
      figma.notify("\uB178\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", { error: true });
      return;
    }
    const sceneNode = node;
    const absX = sceneNode.absoluteTransform[0][2];
    const absY = sceneNode.absoluteTransform[1][2];
    const w = "width" in sceneNode ? sceneNode.width : 0;
    const h = "height" in sceneNode ? sceneNode.height : 0;
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
    const rect = figma.createRectangle();
    rect.name = `QA: [${severity.toUpperCase()}] ${title}`;
    rect.x = absX - 3;
    rect.y = absY - 3;
    rect.resize(w + 6, h + 6);
    rect.fills = [{ type: "SOLID", color, opacity: 0.08 }];
    rect.strokes = [{ type: "SOLID", color }];
    rect.strokeWeight = 2;
    rect.dashPattern = [6, 3];
    rect.cornerRadius = 3;
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
    figma.notify(`Marked: ${title}`);
    figma.ui.postMessage({ type: "mark-complete", nodeId });
  }
  async function markRegion(regionX, regionY, regionWidth, regionHeight, severity, title) {
    if (!selectedImplFrameId)
      return;
    const implNode = await figma.getNodeByIdAsync(selectedImplFrameId);
    if (!implNode || !("absoluteTransform" in implNode))
      return;
    const implAbsX = implNode.absoluteTransform[0][2];
    const implAbsY = implNode.absoluteTransform[1][2];
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.critical;
    const rect = figma.createRectangle();
    rect.name = `QA: [${severity.toUpperCase()}] ${title}`;
    rect.x = implAbsX + regionX - 4;
    rect.y = implAbsY + regionY - 4;
    rect.resize(regionWidth + 8, regionHeight + 8);
    rect.fills = [{ type: "SOLID", color, opacity: 0.1 }];
    rect.strokes = [{ type: "SOLID", color }];
    rect.strokeWeight = 2;
    rect.dashPattern = [6, 3];
    rect.cornerRadius = 3;
    figma.viewport.scrollAndZoomIntoView([rect]);
    figma.notify(`Marked: ${title}`);
    figma.ui.postMessage({ type: "mark-region-complete", regionX, regionY });
  }
  function handleExport(format, issues) {
    switch (format) {
      case "json":
        exportJSON(issues);
        break;
      case "csv":
        exportCSV(issues);
        break;
      case "figma":
        createFigmaAnnotations(issues);
        break;
    }
  }
  function exportJSON(issues) {
    const report = {
      plugin: "Design QA Inspector",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      designMode: currentDesignMode,
      totalIssues: issues.length,
      issues: issues.map((i) => ({
        category: i.category,
        severity: i.severity,
        title: i.title,
        description: i.description,
        nodeName: i.nodeName,
        expected: i.expected,
        actual: i.actual,
        suggestion: i.suggestion
      }))
    };
    const jsonStr = JSON.stringify(report, null, 2);
    figma.notify("JSON report generated. Check console.", { timeout: 5e3 });
    console.log("=== Design QA Report (JSON) ===");
    console.log(jsonStr);
    figma.ui.postMessage({ type: "export-complete", format: "json", data: jsonStr });
  }
  function exportCSV(issues) {
    const headers = ["Category", "Severity", "Title", "Description", "Element", "Expected", "Actual", "Suggestion"];
    const rows = issues.map((i) => [
      i.category,
      i.severity,
      `"${(i.title || "").replace(/"/g, '""')}"`,
      `"${(i.description || "").replace(/"/g, '""')}"`,
      i.nodeName || "",
      i.expected || "",
      i.actual || "",
      `"${(i.suggestion || "").replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    figma.notify("CSV report generated. Check console.", { timeout: 5e3 });
    console.log("=== Design QA Report (CSV) ===");
    console.log(csv);
    figma.ui.postMessage({ type: "export-complete", format: "csv", data: csv });
  }
  async function createFigmaAnnotations(issues) {
    const frameId = selectedImplFrameId || selectedDesignFrameId;
    if (!frameId) {
      figma.notify("No frame selected for annotations.", { error: true });
      return;
    }
    const frame = await figma.getNodeByIdAsync(frameId);
    if (!frame || !("absoluteTransform" in frame))
      return;
    const parentFrame = frame;
    const annotationFrame = figma.createFrame();
    annotationFrame.name = `QA Annotations - ${parentFrame.name} (${currentDesignMode} mode)`;
    annotationFrame.x = parentFrame.x + parentFrame.width + 40;
    annotationFrame.y = parentFrame.y;
    annotationFrame.resize(360, Math.max(400, issues.length * 60 + 80));
    annotationFrame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
    annotationFrame.cornerRadius = 12;
    annotationFrame.layoutMode = "VERTICAL";
    annotationFrame.paddingTop = 20;
    annotationFrame.paddingBottom = 20;
    annotationFrame.paddingLeft = 20;
    annotationFrame.paddingRight = 20;
    annotationFrame.itemSpacing = 12;
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    const title = figma.createText();
    title.fontName = { family: "Inter", style: "Bold" };
    title.characters = `Design QA Report - ${currentDesignMode.toUpperCase()} Mode`;
    title.fontSize = 16;
    title.fills = [{ type: "SOLID", color: { r: 0.13, g: 0.13, b: 0.13 } }];
    annotationFrame.appendChild(title);
    const summaryText = figma.createText();
    summaryText.fontName = { family: "Inter", style: "Regular" };
    const critCount = issues.filter((i) => i.severity === "critical").length;
    const majCount = issues.filter((i) => i.severity === "major").length;
    summaryText.characters = `Total: ${issues.length} | Critical: ${critCount} | Major: ${majCount}`;
    summaryText.fontSize = 12;
    summaryText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
    annotationFrame.appendChild(summaryText);
    const sep = figma.createRectangle();
    sep.resize(320, 1);
    sep.fills = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
    annotationFrame.appendChild(sep);
    for (const issue of issues.slice(0, 30)) {
      const issueFrame = figma.createFrame();
      issueFrame.name = `Issue: ${issue.title}`;
      issueFrame.layoutMode = "VERTICAL";
      issueFrame.itemSpacing = 4;
      issueFrame.paddingTop = 8;
      issueFrame.paddingBottom = 8;
      issueFrame.paddingLeft = 10;
      issueFrame.paddingRight = 10;
      issueFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      issueFrame.cornerRadius = 6;
      issueFrame.strokeWeight = 1;
      issueFrame.strokes = [{ type: "SOLID", color: SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info }];
      issueFrame.layoutSizingHorizontal = "FILL";
      const issueSeverity = figma.createText();
      issueSeverity.fontName = { family: "Inter", style: "Bold" };
      issueSeverity.characters = `[${issue.severity.toUpperCase()}] ${issue.category.toUpperCase()}`;
      issueSeverity.fontSize = 10;
      issueSeverity.fills = [{ type: "SOLID", color: SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info }];
      issueFrame.appendChild(issueSeverity);
      const issueTitle = figma.createText();
      issueTitle.fontName = { family: "Inter", style: "Medium" };
      issueTitle.characters = issue.title;
      issueTitle.fontSize = 12;
      issueTitle.fills = [{ type: "SOLID", color: { r: 0.13, g: 0.13, b: 0.13 } }];
      issueTitle.layoutSizingHorizontal = "FILL";
      issueFrame.appendChild(issueTitle);
      if (issue.suggestion) {
        const suggestionText = figma.createText();
        suggestionText.fontName = { family: "Inter", style: "Regular" };
        suggestionText.characters = issue.suggestion;
        suggestionText.fontSize = 11;
        suggestionText.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.6, b: 1 } }];
        suggestionText.layoutSizingHorizontal = "FILL";
        issueFrame.appendChild(suggestionText);
      }
      annotationFrame.appendChild(issueFrame);
    }
    annotationFrame.layoutSizingVertical = "HUG";
    figma.viewport.scrollAndZoomIntoView([annotationFrame]);
    figma.notify(`${issues.length}\uAC1C \uC5B4\uB178\uD14C\uC774\uC158 \uC0DD\uC131 \uC644\uB8CC.`, { timeout: 5e3 });
    figma.ui.postMessage({ type: "export-complete", format: "figma" });
  }
})();
