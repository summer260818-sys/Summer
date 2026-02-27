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
  function rgbToLab(color) {
    let r = color.r > 0.04045 ? Math.pow((color.r + 0.055) / 1.055, 2.4) : color.r / 12.92;
    let g = color.g > 0.04045 ? Math.pow((color.g + 0.055) / 1.055, 2.4) : color.g / 12.92;
    let b = color.b > 0.04045 ? Math.pow((color.b + 0.055) / 1.055, 2.4) : color.b / 12.92;
    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
    let z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
    const epsilon = 8856e-6;
    const kappa = 903.3;
    x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
    y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
    z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;
    return {
      L: 116 * y - 16,
      a: 500 * (x - y),
      b: 200 * (y - z)
    };
  }
  function deltaE2000(lab1, lab2) {
    const { L: L1, a: a1, b: b1 } = lab1;
    const { L: L2, a: a2, b: b2 } = lab2;
    const avgL = (L1 + L2) / 2;
    const c1 = Math.sqrt(a1 * a1 + b1 * b1);
    const c2 = Math.sqrt(a2 * a2 + b2 * b2);
    const avgC = (c1 + c2) / 2;
    const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
    const a1p = a1 * (1 + g);
    const a2p = a2 * (1 + g);
    const c1p = Math.sqrt(a1p * a1p + b1 * b1);
    const c2p = Math.sqrt(a2p * a2p + b2 * b2);
    let h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
    if (h1p < 0)
      h1p += 360;
    let h2p = Math.atan2(b2, a2p) * 180 / Math.PI;
    if (h2p < 0)
      h2p += 360;
    const dLp = L2 - L1;
    const dCp = c2p - c1p;
    let dhp;
    if (c1p * c2p === 0) {
      dhp = 0;
    } else if (Math.abs(h2p - h1p) <= 180) {
      dhp = h2p - h1p;
    } else if (h2p - h1p > 180) {
      dhp = h2p - h1p - 360;
    } else {
      dhp = h2p - h1p + 360;
    }
    const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(dhp * Math.PI / 360);
    const avgLp = (L1 + L2) / 2;
    const avgCp = (c1p + c2p) / 2;
    let avgHp;
    if (c1p * c2p === 0) {
      avgHp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
      avgHp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      avgHp = (h1p + h2p + 360) / 2;
    } else {
      avgHp = (h1p + h2p - 360) / 2;
    }
    const T = 1 - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * avgHp * Math.PI / 180) + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180) - 0.2 * Math.cos((4 * avgHp - 63) * Math.PI / 180);
    const sL = 1 + 0.015 * Math.pow(avgLp - 50, 2) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
    const sC = 1 + 0.045 * avgCp;
    const sH = 1 + 0.015 * avgCp * T;
    const rT = -2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7))) * Math.sin(60 * Math.exp(-Math.pow((avgHp - 275) / 25, 2)) * Math.PI / 180);
    return Math.sqrt(
      Math.pow(dLp / sL, 2) + Math.pow(dCp / sC, 2) + Math.pow(dHp / sH, 2) + rT * (dCp / sC) * (dHp / sH)
    );
  }
  function compareColors(color1, color2) {
    const lab1 = rgbToLab(color1);
    const lab2 = rgbToLab(color2);
    return deltaE2000(lab1, lab2);
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
  function classifyColorDiff(deltaE) {
    if (deltaE < 1)
      return "identical";
    if (deltaE < 2)
      return "imperceptible";
    if (deltaE < 3.5)
      return "noticeable";
    if (deltaE < 5)
      return "significant";
    return "different";
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
      if (style.toLowerCase().includes(name.toLowerCase())) {
        return weight;
      }
    }
    return 400;
  }
  function formatTypoProps(typo) {
    return {
      fontFamily: typo.fontFamily,
      fontSize: `${typo.fontSize}px`,
      fontWeight: String(typo.fontWeight),
      lineHeight: typo.lineHeight ? `${typo.lineHeight}px` : "auto",
      letterSpacing: `${typo.letterSpacing}px`
    };
  }
  function runFrameComparison(designTokens, implTokens, designMode) {
    const issues = [];
    issues.push(...crossCompareColors(designTokens.colors, implTokens.colors));
    issues.push(...crossCompareTypography(designTokens.typography, implTokens.typography));
    issues.push(...crossCompareSpacing(designTokens.spacing, implTokens.spacing));
    issues.push(...checkTypography(implTokens.typography));
    issues.push(...checkSpacing(implTokens.spacing));
    issues.push(...checkComponents(implTokens.components));
    issues.push(...checkAccessibility(implTokens.colors, implTokens.typography, designMode));
    const seen = /* @__PURE__ */ new Set();
    const deduped = issues.filter((issue) => {
      const key = `${issue.category}:${issue.title}`;
      if (seen.has(key))
        return false;
      seen.add(key);
      return true;
    });
    const summary = {
      total: deduped.length,
      critical: deduped.filter((i) => i.severity === "critical").length,
      major: deduped.filter((i) => i.severity === "major").length,
      minor: deduped.filter((i) => i.severity === "minor").length,
      info: deduped.filter((i) => i.severity === "info").length,
      passed: countPassedChecks(implTokens, deduped)
    };
    return { issues: deduped, summary };
  }
  function crossCompareColors(designColors, implColors) {
    const issues = [];
    const implMap = /* @__PURE__ */ new Map();
    for (const ic of implColors) {
      const key = ic.nodeName.toLowerCase().trim();
      if (!implMap.has(key))
        implMap.set(key, []);
      implMap.get(key).push(ic);
    }
    const checked = /* @__PURE__ */ new Set();
    for (const dc of designColors) {
      const key = dc.nodeName.toLowerCase().trim();
      const implMatches = implMap.get(key);
      if (!implMatches)
        continue;
      const ic = implMatches.find((c) => c.property === dc.property) || implMatches[0];
      const checkKey = `${key}:${dc.property}`;
      if (checked.has(checkKey))
        continue;
      checked.add(checkKey);
      const diff = compareColors(dc.rgb, ic.rgb);
      const classification = classifyColorDiff(diff);
      if (classification === "significant" || classification === "different") {
        issues.push({
          category: "color",
          severity: classification === "different" ? "critical" : "major",
          title: `Color mismatch: "${dc.nodeName}"`,
          description: `${dc.property} color differs between design and implementation. Delta E: ${diff.toFixed(1)}`,
          nodeName: ic.nodeName,
          nodeId: ic.nodeId,
          expected: dc.hex,
          actual: ic.hex,
          deltaE: diff,
          suggestion: `Change ${dc.property} from ${ic.hex} to ${dc.hex}`
        });
      } else if (classification === "noticeable") {
        issues.push({
          category: "color",
          severity: "minor",
          title: `Slight color diff: "${dc.nodeName}"`,
          description: `${dc.property} has a minor color difference. Delta E: ${diff.toFixed(1)}`,
          nodeName: ic.nodeName,
          nodeId: ic.nodeId,
          expected: dc.hex,
          actual: ic.hex,
          deltaE: diff,
          suggestion: `Consider adjusting ${dc.property} to exactly ${dc.hex}`
        });
      }
    }
    const designHexSet = new Set(designColors.map((dc) => dc.hex.toLowerCase()));
    const reportedHex = /* @__PURE__ */ new Set();
    for (const ic of implColors) {
      if (designHexSet.has(ic.hex.toLowerCase()) || reportedHex.has(ic.hex.toLowerCase()))
        continue;
      let closestDiff = Infinity;
      for (const dc of designColors) {
        const diff = compareColors(dc.rgb, ic.rgb);
        if (diff < closestDiff)
          closestDiff = diff;
      }
      if (closestDiff > 10 && designColors.length > 0) {
        issues.push({
          category: "color",
          severity: "info",
          title: `Non-design color: "${ic.nodeName}"`,
          description: `Color ${ic.hex} on ${ic.property} is not in the design palette.`,
          nodeName: ic.nodeName,
          nodeId: ic.nodeId,
          actual: ic.hex,
          suggestion: "Verify this color is intentional or use a design system color."
        });
        reportedHex.add(ic.hex.toLowerCase());
      }
    }
    return issues;
  }
  function crossCompareTypography(designTypo, implTypo) {
    const issues = [];
    const implMap = /* @__PURE__ */ new Map();
    for (const it of implTypo) {
      implMap.set(it.nodeName.toLowerCase().trim(), it);
    }
    for (const dt of designTypo) {
      const key = dt.nodeName.toLowerCase().trim();
      const it = implMap.get(key);
      if (!it)
        continue;
      const diffs = [];
      if (dt.fontFamily !== it.fontFamily) {
        diffs.push(`font: ${dt.fontFamily} \u2192 ${it.fontFamily}`);
      }
      if (Math.round(dt.fontSize) !== Math.round(it.fontSize)) {
        diffs.push(`size: ${dt.fontSize}px \u2192 ${it.fontSize}px`);
      }
      if (dt.fontWeight !== it.fontWeight) {
        diffs.push(`weight: ${dt.fontWeight} \u2192 ${it.fontWeight}`);
      }
      if (dt.lineHeight !== null && it.lineHeight !== null && Math.abs(Math.round(dt.lineHeight) - Math.round(it.lineHeight)) >= 1) {
        diffs.push(`line-height: ${Math.round(dt.lineHeight)}px \u2192 ${Math.round(it.lineHeight)}px`);
      }
      if (diffs.length > 0) {
        const severity = diffs.some((d) => d.startsWith("font:") || d.startsWith("size:")) ? "major" : "minor";
        issues.push({
          category: "typography",
          severity,
          title: `Typography mismatch: "${dt.nodeName}"`,
          description: diffs.join(", "),
          nodeName: it.nodeName,
          nodeId: it.nodeId,
          designTypo: formatTypoProps(dt),
          actualTypo: formatTypoProps(it),
          suggestion: `Update typography to match design: ${diffs.join("; ")}`
        });
      }
    }
    return issues;
  }
  function crossCompareSpacing(designSpacing, implSpacing) {
    const issues = [];
    const implMap = /* @__PURE__ */ new Map();
    for (const is_ of implSpacing) {
      const key = is_.nodeName.toLowerCase().trim();
      if (!implMap.has(key))
        implMap.set(key, []);
      implMap.get(key).push(is_);
    }
    for (const ds of designSpacing) {
      const key = ds.nodeName.toLowerCase().trim();
      const implSps = implMap.get(key);
      if (!implSps)
        continue;
      const match = implSps.find((is_) => is_.type === ds.type && is_.direction === ds.direction);
      if (!match)
        continue;
      const diff = Math.abs(ds.value - match.value);
      if (diff >= 1) {
        issues.push({
          category: "spacing",
          severity: diff > 4 ? "major" : "minor",
          title: `Spacing mismatch: "${ds.nodeName}" ${ds.direction} ${ds.type}`,
          description: `${ds.direction} ${ds.type}: design ${ds.value}px vs impl ${match.value}px`,
          nodeName: match.nodeName,
          nodeId: match.nodeId,
          expectedValue: ds.value,
          actualValue: match.value,
          suggestion: `Change ${ds.type} ${ds.direction} from ${match.value}px to ${ds.value}px`
        });
      }
    }
    return issues;
  }
  function checkTypography(typography) {
    const issues = [];
    const fontFamilies = new Set(typography.map((t) => t.fontFamily));
    if (fontFamilies.size > 3) {
      issues.push({
        category: "typography",
        severity: "major",
        title: "Too many font families used",
        description: `${fontFamilies.size} different font families detected. Design systems typically use 1-2.`,
        suggestion: `Consolidate fonts. Found: ${[...fontFamilies].join(", ")}`
      });
    }
    const standardScales = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72];
    for (const typo of typography) {
      const nearestStandard = standardScales.reduce(
        (prev, curr) => Math.abs(curr - typo.fontSize) < Math.abs(prev - typo.fontSize) ? curr : prev
      );
      if (Math.abs(typo.fontSize - nearestStandard) > 0 && Math.abs(typo.fontSize - nearestStandard) <= 2) {
        issues.push({
          category: "typography",
          severity: "minor",
          title: `Non-standard font size: ${typo.fontSize}px`,
          description: `"${typo.nodeName}" uses ${typo.fontSize}px, close to standard ${nearestStandard}px.`,
          nodeName: typo.nodeName,
          nodeId: typo.nodeId,
          suggestion: `Consider using ${nearestStandard}px for consistency.`
        });
      }
      if (typo.lineHeight !== null) {
        const ratio = typo.lineHeight / typo.fontSize;
        if (ratio < 1.2) {
          issues.push({
            category: "typography",
            severity: "major",
            title: `Tight line height: "${typo.nodeName}"`,
            description: `Line height ratio ${ratio.toFixed(2)} (${typo.lineHeight}px / ${typo.fontSize}px). Minimum 1.2 recommended.`,
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
    var _a, _b;
    const issues = [];
    const spacingScale = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96];
    for (const sp of spacing) {
      const isOnScale = spacingScale.includes(sp.value);
      if (!isOnScale && sp.value > 0) {
        const nearest = spacingScale.reduce(
          (prev, curr) => Math.abs(curr - sp.value) < Math.abs(prev - sp.value) ? curr : prev
        );
        if (Math.abs(sp.value - nearest) <= 3) {
          issues.push({
            category: "spacing",
            severity: "minor",
            title: `Off-scale ${sp.type}: "${sp.nodeName}"`,
            description: `${sp.direction} ${sp.type} is ${sp.value}px, nearest scale value is ${nearest}px.`,
            nodeName: sp.nodeName,
            nodeId: sp.nodeId,
            expectedValue: nearest,
            actualValue: sp.value,
            suggestion: `Adjust ${sp.type} to ${nearest}px to align with spacing scale.`
          });
        }
      }
      if (sp.type === "padding") {
        const siblings = spacing.filter((s) => s.nodeId === sp.nodeId && s.type === "padding");
        const horizontal = siblings.filter((s) => s.direction === "left" || s.direction === "right");
        if (horizontal.length === 2 && horizontal[0].value !== horizontal[1].value) {
          const existing = issues.find((i) => i.nodeId === sp.nodeId && i.title.includes("Asymmetric horizontal"));
          if (!existing) {
            issues.push({
              category: "spacing",
              severity: "minor",
              title: `Asymmetric horizontal padding: "${sp.nodeName}"`,
              description: `Left (${(_a = horizontal.find((h) => h.direction === "left")) == null ? void 0 : _a.value}px) differs from right (${(_b = horizontal.find((h) => h.direction === "right")) == null ? void 0 : _b.value}px).`,
              nodeName: sp.nodeName,
              nodeId: sp.nodeId,
              suggestion: "Consider using symmetric horizontal padding."
            });
          }
        }
      }
    }
    return issues;
  }
  function checkComponents(components) {
    const issues = [];
    const componentGroups = /* @__PURE__ */ new Map();
    for (const comp of components) {
      if (comp.mainComponentId) {
        if (!componentGroups.has(comp.mainComponentId))
          componentGroups.set(comp.mainComponentId, []);
        componentGroups.get(comp.mainComponentId).push(comp);
      }
    }
    for (const [, instances] of componentGroups) {
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
    for (const comp of components) {
      if (!comp.mainComponentId) {
        issues.push({
          category: "component",
          severity: "info",
          title: `Detached component: "${comp.name}"`,
          description: "This instance may be detached from its main component.",
          componentName: comp.name,
          nodeId: comp.nodeId,
          suggestion: "Reconnect to main component for consistency."
        });
      }
    }
    return issues;
  }
  function checkAccessibility(colors, typography, designMode) {
    const issues = [];
    const textColors = colors.filter((c) => {
      const name = c.nodeName.toLowerCase();
      return name.includes("text") || name.includes("label") || name.includes("title") || name.includes("body") || name.includes("heading") || name.includes("caption");
    });
    const bgColors = colors.filter((c) => {
      const name = c.nodeName.toLowerCase();
      return name.includes("background") || name.includes("bg") || name.includes("surface") || name.includes("card") || name.includes("container") || name.includes("frame");
    });
    const defaultBg = designMode === "dark" ? { r: 0.1, g: 0.1, b: 0.1 } : { r: 1, g: 1, b: 1 };
    const backgrounds = bgColors.length > 0 ? bgColors.map((c) => c.rgb) : [defaultBg];
    for (const textColor of textColors) {
      for (const bg of backgrounds) {
        const ratio = contrastRatio(textColor.rgb, bg);
        const textHex = rgbToHex(textColor.rgb);
        const bgHex = rgbToHex(bg);
        const relatedTypo = typography.find((t) => t.nodeName === textColor.nodeName || t.nodeId === textColor.nodeId);
        const isLargeText = relatedTypo && (relatedTypo.fontSize >= 18 || relatedTypo.fontSize >= 14 && relatedTypo.fontWeight >= 700);
        const aaThreshold = isLargeText ? 3 : 4.5;
        const aaaThreshold = isLargeText ? 4.5 : 7;
        if (ratio < aaThreshold) {
          issues.push({
            category: "a11y",
            severity: "critical",
            title: `Insufficient contrast: "${textColor.nodeName}"`,
            description: `Contrast ${ratio.toFixed(2)}:1 fails WCAG AA (needs ${aaThreshold}:1).`,
            nodeName: textColor.nodeName,
            nodeId: textColor.nodeId,
            contrastRatio: ratio,
            foreground: textHex,
            background: bgHex,
            wcagCriteria: "WCAG 2.1 - 1.4.3 Contrast (Minimum)",
            suggestion: `Increase contrast to at least ${aaThreshold}:1.`
          });
        } else if (ratio < aaaThreshold) {
          issues.push({
            category: "a11y",
            severity: "minor",
            title: `Contrast below AAA: "${textColor.nodeName}"`,
            description: `Contrast ${ratio.toFixed(2)}:1 passes AA but fails AAA (needs ${aaaThreshold}:1).`,
            nodeName: textColor.nodeName,
            nodeId: textColor.nodeId,
            contrastRatio: ratio,
            foreground: textHex,
            background: bgHex,
            wcagCriteria: "WCAG 2.1 - 1.4.6 Contrast (Enhanced)",
            suggestion: `For AAA compliance, increase contrast to ${aaaThreshold}:1.`
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
          wcagCriteria: "WCAG 2.1 - 1.4.4 Resize Text",
          suggestion: "Increase font size to at least 12px."
        });
      }
    }
    return issues;
  }
  function countPassedChecks(tokens, issues) {
    const totalChecks = tokens.colors.length + tokens.typography.length + tokens.spacing.length + tokens.components.length;
    return Math.max(0, totalChecks - issues.length);
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
      case "clear-highlight":
        await clearTempHighlight();
        break;
      case "mark-on-canvas":
        if (msg.nodeId)
          await markOnCanvas(msg.nodeId, msg.severity || "info", msg.title || "");
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
      const designTokens = await extractDesignTokens(designNode);
      const implTokens = await extractDesignTokens(implNode);
      const { issues, summary } = runFrameComparison(
        designTokens,
        implTokens,
        currentDesignMode
      );
      const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
      issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
      figma.ui.postMessage({
        type: "comparison-results",
        issues,
        summary
      });
      const notifMsg = summary.critical > 0 ? `${summary.total}\uAC1C \uC774\uC288 (${summary.critical}\uAC1C \uC2EC\uAC01)` : summary.total > 0 ? `${summary.total}\uAC1C \uC774\uC288 \uBC1C\uACAC` : "\uBAA8\uB4E0 \uAC80\uC0AC \uD1B5\uACFC!";
      figma.notify(notifMsg, { timeout: 3e3, error: summary.critical > 0 });
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
    for (const issue of issues.filter((i) => i.nodeId && (i.severity === "critical" || i.severity === "major"))) {
      const targetNode = await figma.getNodeByIdAsync(issue.nodeId);
      if (targetNode && "absoluteTransform" in targetNode) {
        const marker = figma.createEllipse();
        marker.name = `QA: ${issue.severity} - ${issue.title}`;
        const absX = targetNode.absoluteTransform[0][2];
        const absY = targetNode.absoluteTransform[1][2];
        marker.x = absX - 6;
        marker.y = absY - 6;
        marker.resize(12, 12);
        marker.fills = [{ type: "SOLID", color: SEVERITY_COLORS[issue.severity] }];
        marker.opacity = 0.8;
        marker.strokeWeight = 2;
        marker.strokes = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      }
    }
    figma.viewport.scrollAndZoomIntoView([annotationFrame]);
    figma.notify(`${issues.length}\uAC1C \uC5B4\uB178\uD14C\uC774\uC158 \uC0DD\uC131 \uC644\uB8CC.`, { timeout: 5e3 });
    figma.ui.postMessage({ type: "export-complete", format: "figma" });
  }
})();
