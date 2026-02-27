/**
 * Design QA Comparison Engine
 * Compares Figma design frames with implementation frames.
 */

import {
  RGB, rgbToHex, compareColors, contrastRatio, relativeLuminance,
  classifyColorDiff,
} from './color-utils';

// ===== Types =====

export interface DesignToken {
  colors: DesignColor[];
  typography: DesignTypography[];
  spacing: DesignSpacing[];
  components: DesignComponent[];
}

export interface DesignColor {
  hex: string;
  rgb: RGB;
  nodeName: string;
  nodeId: string;
  property: 'fill' | 'stroke' | 'effect';
  opacity: number;
}

export interface DesignTypography {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  letterSpacing: number;
  textContent: string;
  nodeName: string;
  nodeId: string;
}

export interface DesignSpacing {
  type: 'padding' | 'gap' | 'margin' | 'auto-layout';
  value: number;
  direction: 'top' | 'right' | 'bottom' | 'left' | 'horizontal' | 'vertical' | 'all';
  nodeName: string;
  nodeId: string;
}

export interface DesignComponent {
  name: string;
  nodeId: string;
  mainComponentId: string | null;
  variantProperties: Record<string, string> | null;
  width: number;
  height: number;
  childCount: number;
}

export interface QAIssue {
  category: 'color' | 'typography' | 'spacing' | 'component' | 'a11y';
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  description: string;
  nodeName?: string;
  nodeId?: string;
  expected?: string;
  actual?: string;
  deltaE?: number;
  designTypo?: Record<string, string>;
  actualTypo?: Record<string, string>;
  expectedValue?: number;
  actualValue?: number;
  contrastRatio?: number;
  foreground?: string;
  background?: string;
  wcagCriteria?: string;
  componentName?: string;
  differences?: string[];
  suggestion?: string;
}

export interface ComparisonSummary {
  total: number;
  critical: number;
  major: number;
  minor: number;
  info: number;
  passed: number;
}

// ===== Design Token Extraction =====

export async function extractDesignTokens(node: SceneNode): Promise<DesignToken> {
  const tokens: DesignToken = {
    colors: [],
    typography: [],
    spacing: [],
    components: [],
  };

  await traverseNode(node, tokens);
  return tokens;
}

async function traverseNode(
  node: SceneNode,
  tokens: DesignToken,
): Promise<void> {
  // Extract colors from fills
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills as Paint[]) {
      if (fill.type === 'SOLID' && fill.visible !== false) {
        tokens.colors.push({
          hex: rgbToHex(fill.color),
          rgb: { ...fill.color },
          nodeName: node.name,
          nodeId: node.id,
          property: 'fill',
          opacity: fill.opacity ?? 1,
        });
      }
    }
  }

  // Extract colors from strokes
  if ('strokes' in node && Array.isArray(node.strokes)) {
    for (const stroke of node.strokes as Paint[]) {
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        tokens.colors.push({
          hex: rgbToHex(stroke.color),
          rgb: { ...stroke.color },
          nodeName: node.name,
          nodeId: node.id,
          property: 'stroke',
          opacity: stroke.opacity ?? 1,
        });
      }
    }
  }

  // Extract typography
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    const fontSize = textNode.fontSize;
    const fontName = textNode.fontName;

    if (typeof fontSize === 'number' && fontName !== figma.mixed) {
      let lineHeightValue: number | null = null;
      if (textNode.lineHeight !== figma.mixed) {
        const lh = textNode.lineHeight as LineHeight;
        if (lh.unit === 'PIXELS') lineHeightValue = lh.value;
        else if (lh.unit === 'PERCENT') lineHeightValue = fontSize * lh.value / 100;
      }

      let letterSpacingValue = 0;
      if (textNode.letterSpacing !== figma.mixed) {
        const ls = textNode.letterSpacing as LetterSpacing;
        if (ls.unit === 'PIXELS') letterSpacingValue = ls.value;
        else if (ls.unit === 'PERCENT') letterSpacingValue = fontSize * ls.value / 100;
      }

      tokens.typography.push({
        fontFamily: fontName.family,
        fontSize,
        fontWeight: getFontWeight(fontName.style),
        lineHeight: lineHeightValue,
        letterSpacing: letterSpacingValue,
        textContent: textNode.characters.substring(0, 50),
        nodeName: node.name,
        nodeId: node.id,
      });
    }
  }

  // Extract spacing from auto-layout
  if ('layoutMode' in node && (node as FrameNode).layoutMode !== 'NONE') {
    const frame = node as FrameNode;

    if (frame.itemSpacing !== undefined) {
      tokens.spacing.push({
        type: 'gap',
        value: Math.round(frame.itemSpacing),
        direction: frame.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical',
        nodeName: node.name,
        nodeId: node.id,
      });
    }

    if (frame.paddingTop !== undefined) {
      if (Math.round(frame.paddingTop) > 0) tokens.spacing.push({ type: 'padding', value: Math.round(frame.paddingTop), direction: 'top', nodeName: node.name, nodeId: node.id });
      if (Math.round(frame.paddingRight) > 0) tokens.spacing.push({ type: 'padding', value: Math.round(frame.paddingRight), direction: 'right', nodeName: node.name, nodeId: node.id });
      if (Math.round(frame.paddingBottom) > 0) tokens.spacing.push({ type: 'padding', value: Math.round(frame.paddingBottom), direction: 'bottom', nodeName: node.name, nodeId: node.id });
      if (Math.round(frame.paddingLeft) > 0) tokens.spacing.push({ type: 'padding', value: Math.round(frame.paddingLeft), direction: 'left', nodeName: node.name, nodeId: node.id });
    }
  }

  // Extract component info
  if (node.type === 'INSTANCE') {
    const instance = node as InstanceNode;
    const mainComp = await instance.getMainComponentAsync();
    tokens.components.push({
      name: node.name,
      nodeId: node.id,
      mainComponentId: mainComp?.id ?? null,
      variantProperties: instance.variantProperties,
      width: node.width,
      height: node.height,
      childCount: 'children' in node ? (node as FrameNode).children.length : 0,
    });
  }

  // Recurse into children
  if ('children' in node) {
    for (const child of (node as FrameNode).children) {
      if (child.visible !== false) {
        await traverseNode(child, tokens, nodeRects, rootX, rootY);
      }
    }
  }
}

function getFontWeight(style: string): number {
  const weights: Record<string, number> = {
    'Thin': 100, 'Hairline': 100,
    'ExtraLight': 200, 'Ultra Light': 200,
    'Light': 300,
    'Regular': 400, 'Normal': 400,
    'Medium': 500,
    'SemiBold': 600, 'Semi Bold': 600, 'Demi Bold': 600,
    'Bold': 700,
    'ExtraBold': 800, 'Extra Bold': 800, 'Ultra Bold': 800,
    'Black': 900, 'Heavy': 900,
  };

  for (const [name, weight] of Object.entries(weights)) {
    if (style.toLowerCase().includes(name.toLowerCase())) {
      return weight;
    }
  }
  return 400;
}

function formatTypoProps(typo: DesignTypography): Record<string, string> {
  return {
    fontFamily: typo.fontFamily,
    fontSize: `${typo.fontSize}px`,
    fontWeight: String(typo.fontWeight),
    lineHeight: typo.lineHeight ? `${typo.lineHeight}px` : 'auto',
    letterSpacing: `${typo.letterSpacing}px`,
  };
}

// ===== Frame-to-Frame Comparison =====

export function runFrameComparison(
  designTokens: DesignToken,
  implTokens: DesignToken,
  designMode: 'light' | 'dark'
): { issues: QAIssue[]; summary: ComparisonSummary } {
  const issues: QAIssue[] = [];

  // Cross-frame comparisons (design vs implementation)
  issues.push(...crossCompareColors(designTokens.colors, implTokens.colors));
  issues.push(...crossCompareTypography(designTokens.typography, implTokens.typography));
  issues.push(...crossCompareSpacing(designTokens.spacing, implTokens.spacing));

  // Self-checks on implementation
  issues.push(...checkTypography(implTokens.typography));
  issues.push(...checkSpacing(implTokens.spacing));
  issues.push(...checkComponents(implTokens.components));
  issues.push(...checkAccessibility(implTokens.colors, implTokens.typography, designMode));

  // Deduplicate
  const seen = new Set<string>();
  const deduped = issues.filter(issue => {
    const key = `${issue.category}:${issue.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary: ComparisonSummary = {
    total: deduped.length,
    critical: deduped.filter(i => i.severity === 'critical').length,
    major: deduped.filter(i => i.severity === 'major').length,
    minor: deduped.filter(i => i.severity === 'minor').length,
    info: deduped.filter(i => i.severity === 'info').length,
    passed: countPassedChecks(implTokens, deduped),
  };

  return { issues: deduped, summary };
}

// ===== Cross-Frame Color Comparison =====

function crossCompareColors(designColors: DesignColor[], implColors: DesignColor[]): QAIssue[] {
  const issues: QAIssue[] = [];

  // Index impl colors by normalized node name + property
  const implMap = new Map<string, DesignColor[]>();
  for (const ic of implColors) {
    const key = ic.nodeName.toLowerCase().trim();
    if (!implMap.has(key)) implMap.set(key, []);
    implMap.get(key)!.push(ic);
  }

  const checked = new Set<string>();

  for (const dc of designColors) {
    const key = dc.nodeName.toLowerCase().trim();
    const implMatches = implMap.get(key);
    if (!implMatches) continue;

    // Find matching property type
    const ic = implMatches.find(c => c.property === dc.property) || implMatches[0];
    const checkKey = `${key}:${dc.property}`;
    if (checked.has(checkKey)) continue;
    checked.add(checkKey);

    const diff = compareColors(dc.rgb, ic.rgb);
    const classification = classifyColorDiff(diff);

    if (classification === 'significant' || classification === 'different') {
      issues.push({
        category: 'color',
        severity: classification === 'different' ? 'critical' : 'major',
        title: `Color mismatch: "${dc.nodeName}"`,
        description: `${dc.property} color differs between design and implementation. Delta E: ${diff.toFixed(1)}`,
        nodeName: ic.nodeName,
        nodeId: ic.nodeId,
        expected: dc.hex,
        actual: ic.hex,
        deltaE: diff,
        suggestion: `Change ${dc.property} from ${ic.hex} to ${dc.hex}`,
      });
    } else if (classification === 'noticeable') {
      issues.push({
        category: 'color',
        severity: 'minor',
        title: `Slight color diff: "${dc.nodeName}"`,
        description: `${dc.property} has a minor color difference. Delta E: ${diff.toFixed(1)}`,
        nodeName: ic.nodeName,
        nodeId: ic.nodeId,
        expected: dc.hex,
        actual: ic.hex,
        deltaE: diff,
        suggestion: `Consider adjusting ${dc.property} to exactly ${dc.hex}`,
      });
    }
  }

  // Check for impl colors not in design palette
  const designHexSet = new Set(designColors.map(dc => dc.hex.toLowerCase()));
  const reportedHex = new Set<string>();

  for (const ic of implColors) {
    if (designHexSet.has(ic.hex.toLowerCase()) || reportedHex.has(ic.hex.toLowerCase())) continue;

    let closestDiff = Infinity;
    for (const dc of designColors) {
      const diff = compareColors(dc.rgb, ic.rgb);
      if (diff < closestDiff) closestDiff = diff;
    }

    if (closestDiff > 10 && designColors.length > 0) {
      issues.push({
        category: 'color',
        severity: 'info',
        title: `Non-design color: "${ic.nodeName}"`,
        description: `Color ${ic.hex} on ${ic.property} is not in the design palette.`,
        nodeName: ic.nodeName,
        nodeId: ic.nodeId,
        actual: ic.hex,
        suggestion: 'Verify this color is intentional or use a design system color.',
      });
      reportedHex.add(ic.hex.toLowerCase());
    }
  }

  return issues;
}

// ===== Cross-Frame Typography Comparison =====

function crossCompareTypography(designTypo: DesignTypography[], implTypo: DesignTypography[]): QAIssue[] {
  const issues: QAIssue[] = [];

  const implMap = new Map<string, DesignTypography>();
  for (const it of implTypo) {
    implMap.set(it.nodeName.toLowerCase().trim(), it);
  }

  for (const dt of designTypo) {
    const key = dt.nodeName.toLowerCase().trim();
    const it = implMap.get(key);
    if (!it) continue;

    const diffs: string[] = [];

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
      const severity = diffs.some(d => d.startsWith('font:') || d.startsWith('size:')) ? 'major' : 'minor';
      issues.push({
        category: 'typography',
        severity,
        title: `Typography mismatch: "${dt.nodeName}"`,
        description: diffs.join(', '),
        nodeName: it.nodeName,
        nodeId: it.nodeId,
        designTypo: formatTypoProps(dt),
        actualTypo: formatTypoProps(it),
        suggestion: `Update typography to match design: ${diffs.join('; ')}`,
      });
    }
  }

  return issues;
}

// ===== Cross-Frame Spacing Comparison =====

function crossCompareSpacing(designSpacing: DesignSpacing[], implSpacing: DesignSpacing[]): QAIssue[] {
  const issues: QAIssue[] = [];

  const implMap = new Map<string, DesignSpacing[]>();
  for (const is_ of implSpacing) {
    const key = is_.nodeName.toLowerCase().trim();
    if (!implMap.has(key)) implMap.set(key, []);
    implMap.get(key)!.push(is_);
  }

  for (const ds of designSpacing) {
    const key = ds.nodeName.toLowerCase().trim();
    const implSps = implMap.get(key);
    if (!implSps) continue;

    const match = implSps.find(is_ => is_.type === ds.type && is_.direction === ds.direction);
    if (!match) continue;

    const diff = Math.abs(ds.value - match.value);
    if (diff >= 1) {
      issues.push({
        category: 'spacing',
        severity: diff > 4 ? 'major' : 'minor',
        title: `Spacing mismatch: "${ds.nodeName}" ${ds.direction} ${ds.type}`,
        description: `${ds.direction} ${ds.type}: design ${ds.value}px vs impl ${match.value}px`,
        nodeName: match.nodeName,
        nodeId: match.nodeId,
        expectedValue: ds.value,
        actualValue: match.value,
        suggestion: `Change ${ds.type} ${ds.direction} from ${match.value}px to ${ds.value}px`,
      });
    }
  }

  return issues;
}

// ===== Typography Self-Checks =====

function checkTypography(typography: DesignTypography[]): QAIssue[] {
  const issues: QAIssue[] = [];

  const fontFamilies = new Set(typography.map(t => t.fontFamily));
  if (fontFamilies.size > 3) {
    issues.push({
      category: 'typography',
      severity: 'major',
      title: 'Too many font families used',
      description: `${fontFamilies.size} different font families detected. Design systems typically use 1-2.`,
      suggestion: `Consolidate fonts. Found: ${[...fontFamilies].join(', ')}`,
    });
  }

  const standardScales = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72];

  for (const typo of typography) {
    const nearestStandard = standardScales.reduce((prev, curr) =>
      Math.abs(curr - typo.fontSize) < Math.abs(prev - typo.fontSize) ? curr : prev
    );

    if (Math.abs(typo.fontSize - nearestStandard) > 0 && Math.abs(typo.fontSize - nearestStandard) <= 2) {
      issues.push({
        category: 'typography',
        severity: 'minor',
        title: `Non-standard font size: ${typo.fontSize}px`,
        description: `"${typo.nodeName}" uses ${typo.fontSize}px, close to standard ${nearestStandard}px.`,
        nodeName: typo.nodeName,
        nodeId: typo.nodeId,
        suggestion: `Consider using ${nearestStandard}px for consistency.`,
      });
    }

    if (typo.lineHeight !== null) {
      const ratio = typo.lineHeight / typo.fontSize;
      if (ratio < 1.2) {
        issues.push({
          category: 'typography',
          severity: 'major',
          title: `Tight line height: "${typo.nodeName}"`,
          description: `Line height ratio ${ratio.toFixed(2)} (${typo.lineHeight}px / ${typo.fontSize}px). Minimum 1.2 recommended.`,
          nodeName: typo.nodeName,
          nodeId: typo.nodeId,
          suggestion: `Increase line height to at least ${Math.ceil(typo.fontSize * 1.2)}px.`,
        });
      }
    }
  }

  return issues;
}

// ===== Spacing Self-Checks =====

function checkSpacing(spacing: DesignSpacing[]): QAIssue[] {
  const issues: QAIssue[] = [];
  const spacingScale = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96];

  for (const sp of spacing) {
    const isOnScale = spacingScale.includes(sp.value);
    if (!isOnScale && sp.value > 0) {
      const nearest = spacingScale.reduce((prev, curr) =>
        Math.abs(curr - sp.value) < Math.abs(prev - sp.value) ? curr : prev
      );

      if (Math.abs(sp.value - nearest) <= 3) {
        issues.push({
          category: 'spacing',
          severity: 'minor',
          title: `Off-scale ${sp.type}: "${sp.nodeName}"`,
          description: `${sp.direction} ${sp.type} is ${sp.value}px, nearest scale value is ${nearest}px.`,
          nodeName: sp.nodeName,
          nodeId: sp.nodeId,
          expectedValue: nearest,
          actualValue: sp.value,
          suggestion: `Adjust ${sp.type} to ${nearest}px to align with spacing scale.`,
        });
      }
    }

    if (sp.type === 'padding') {
      const siblings = spacing.filter(s => s.nodeId === sp.nodeId && s.type === 'padding');
      const horizontal = siblings.filter(s => s.direction === 'left' || s.direction === 'right');
      if (horizontal.length === 2 && horizontal[0].value !== horizontal[1].value) {
        const existing = issues.find(i => i.nodeId === sp.nodeId && i.title.includes('Asymmetric horizontal'));
        if (!existing) {
          issues.push({
            category: 'spacing',
            severity: 'minor',
            title: `Asymmetric horizontal padding: "${sp.nodeName}"`,
            description: `Left (${horizontal.find(h => h.direction === 'left')?.value}px) differs from right (${horizontal.find(h => h.direction === 'right')?.value}px).`,
            nodeName: sp.nodeName,
            nodeId: sp.nodeId,
            suggestion: 'Consider using symmetric horizontal padding.',
          });
        }
      }
    }
  }

  return issues;
}

// ===== Component Checks =====

function checkComponents(components: DesignComponent[]): QAIssue[] {
  const issues: QAIssue[] = [];

  const componentGroups = new Map<string, DesignComponent[]>();
  for (const comp of components) {
    if (comp.mainComponentId) {
      if (!componentGroups.has(comp.mainComponentId)) componentGroups.set(comp.mainComponentId, []);
      componentGroups.get(comp.mainComponentId)!.push(comp);
    }
  }

  for (const [, instances] of componentGroups) {
    if (instances.length < 2) continue;
    const widths = new Set(instances.map(i => Math.round(i.width)));
    const heights = new Set(instances.map(i => Math.round(i.height)));

    if (widths.size > 1 || heights.size > 1) {
      const diffs: string[] = [];
      if (widths.size > 1) diffs.push(`widths: ${[...widths].join(', ')}px`);
      if (heights.size > 1) diffs.push(`heights: ${[...heights].join(', ')}px`);

      issues.push({
        category: 'component',
        severity: 'major',
        title: `Inconsistent sizes: "${instances[0].name}"`,
        description: `${instances.length} instances have different sizes.`,
        componentName: instances[0].name,
        differences: diffs,
        suggestion: 'Ensure all instances use consistent sizing.',
      });
    }
  }

  for (const comp of components) {
    if (!comp.mainComponentId) {
      issues.push({
        category: 'component',
        severity: 'info',
        title: `Detached component: "${comp.name}"`,
        description: 'This instance may be detached from its main component.',
        componentName: comp.name,
        nodeId: comp.nodeId,
        suggestion: 'Reconnect to main component for consistency.',
      });
    }
  }

  return issues;
}

// ===== Accessibility Checks =====

function checkAccessibility(
  colors: DesignColor[],
  typography: DesignTypography[],
  designMode: 'light' | 'dark'
): QAIssue[] {
  const issues: QAIssue[] = [];

  const textColors = colors.filter(c => {
    const name = c.nodeName.toLowerCase();
    return name.includes('text') || name.includes('label') || name.includes('title') ||
           name.includes('body') || name.includes('heading') || name.includes('caption');
  });

  const bgColors = colors.filter(c => {
    const name = c.nodeName.toLowerCase();
    return name.includes('background') || name.includes('bg') || name.includes('surface') ||
           name.includes('card') || name.includes('container') || name.includes('frame');
  });

  const defaultBg: RGB = designMode === 'dark'
    ? { r: 0.1, g: 0.1, b: 0.1 }
    : { r: 1, g: 1, b: 1 };

  const backgrounds = bgColors.length > 0 ? bgColors.map(c => c.rgb) : [defaultBg];

  for (const textColor of textColors) {
    for (const bg of backgrounds) {
      const ratio = contrastRatio(textColor.rgb, bg);
      const textHex = rgbToHex(textColor.rgb);
      const bgHex = rgbToHex(bg);

      const relatedTypo = typography.find(t => t.nodeName === textColor.nodeName || t.nodeId === textColor.nodeId);
      const isLargeText = relatedTypo && (relatedTypo.fontSize >= 18 || (relatedTypo.fontSize >= 14 && relatedTypo.fontWeight >= 700));
      const aaThreshold = isLargeText ? 3 : 4.5;
      const aaaThreshold = isLargeText ? 4.5 : 7;

      if (ratio < aaThreshold) {
        issues.push({
          category: 'a11y',
          severity: 'critical',
          title: `Insufficient contrast: "${textColor.nodeName}"`,
          description: `Contrast ${ratio.toFixed(2)}:1 fails WCAG AA (needs ${aaThreshold}:1).`,
          nodeName: textColor.nodeName,
          nodeId: textColor.nodeId,
          contrastRatio: ratio,
          foreground: textHex,
          background: bgHex,
          wcagCriteria: 'WCAG 2.1 - 1.4.3 Contrast (Minimum)',
          suggestion: `Increase contrast to at least ${aaThreshold}:1.`,
        });
      } else if (ratio < aaaThreshold) {
        issues.push({
          category: 'a11y',
          severity: 'minor',
          title: `Contrast below AAA: "${textColor.nodeName}"`,
          description: `Contrast ${ratio.toFixed(2)}:1 passes AA but fails AAA (needs ${aaaThreshold}:1).`,
          nodeName: textColor.nodeName,
          nodeId: textColor.nodeId,
          contrastRatio: ratio,
          foreground: textHex,
          background: bgHex,
          wcagCriteria: 'WCAG 2.1 - 1.4.6 Contrast (Enhanced)',
          suggestion: `For AAA compliance, increase contrast to ${aaaThreshold}:1.`,
        });
      }
    }
  }

  for (const typo of typography) {
    if (typo.fontSize < 12) {
      issues.push({
        category: 'a11y',
        severity: 'major',
        title: `Text too small: "${typo.nodeName}"`,
        description: `Font size ${typo.fontSize}px is below minimum 12px.`,
        nodeName: typo.nodeName,
        nodeId: typo.nodeId,
        wcagCriteria: 'WCAG 2.1 - 1.4.4 Resize Text',
        suggestion: 'Increase font size to at least 12px.',
      });
    }
  }

  return issues;
}

// ===== Helper =====

function countPassedChecks(tokens: DesignToken, issues: QAIssue[]): number {
  const totalChecks = tokens.colors.length + tokens.typography.length +
    tokens.spacing.length + tokens.components.length;
  return Math.max(0, totalChecks - issues.length);
}
