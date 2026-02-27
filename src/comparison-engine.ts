/**
 * Design QA Comparison Engine
 * Analyzes Figma design frames and compares with screenshot pixel data.
 */

import {
  RGB, rgbToHex, compareColors, contrastRatio, relativeLuminance,
  extractDominantColors, classifyColorDiff,
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
  // Color-specific
  expected?: string;
  actual?: string;
  deltaE?: number;
  // Typography-specific
  designTypo?: Record<string, string>;
  actualTypo?: Record<string, string>;
  // Spacing-specific
  expectedValue?: number;
  actualValue?: number;
  // A11y-specific
  contrastRatio?: number;
  foreground?: string;
  background?: string;
  wcagCriteria?: string;
  // Component-specific
  componentName?: string;
  differences?: string[];
  // Suggestion
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

export interface ScreenshotData {
  width: number;
  height: number;
  data: number[];
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

async function traverseNode(node: SceneNode, tokens: DesignToken): Promise<void> {
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
        if (lh.unit === 'PIXELS') {
          lineHeightValue = lh.value;
        } else if (lh.unit === 'PERCENT') {
          lineHeightValue = fontSize * lh.value / 100;
        }
      }

      let letterSpacingValue = 0;
      if (textNode.letterSpacing !== figma.mixed) {
        const ls = textNode.letterSpacing as LetterSpacing;
        if (ls.unit === 'PIXELS') {
          letterSpacingValue = ls.value;
        } else if (ls.unit === 'PERCENT') {
          letterSpacingValue = fontSize * ls.value / 100;
        }
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
        value: frame.itemSpacing,
        direction: frame.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical',
        nodeName: node.name,
        nodeId: node.id,
      });
    }

    if (frame.paddingTop !== undefined) {
      if (frame.paddingTop > 0) tokens.spacing.push({ type: 'padding', value: frame.paddingTop, direction: 'top', nodeName: node.name, nodeId: node.id });
      if (frame.paddingRight > 0) tokens.spacing.push({ type: 'padding', value: frame.paddingRight, direction: 'right', nodeName: node.name, nodeId: node.id });
      if (frame.paddingBottom > 0) tokens.spacing.push({ type: 'padding', value: frame.paddingBottom, direction: 'bottom', nodeName: node.name, nodeId: node.id });
      if (frame.paddingLeft > 0) tokens.spacing.push({ type: 'padding', value: frame.paddingLeft, direction: 'left', nodeName: node.name, nodeId: node.id });
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
        await traverseNode(child, tokens);
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

// ===== Comparison Logic =====

export function runQAComparison(
  designTokens: DesignToken,
  screenshotColors: { color: RGB; count: number; hex: string }[],
  designMode: 'light' | 'dark'
): { issues: QAIssue[]; summary: ComparisonSummary } {
  const issues: QAIssue[] = [];

  // 1. Color checks
  issues.push(...checkColors(designTokens.colors, screenshotColors));

  // 2. Typography checks
  issues.push(...checkTypography(designTokens.typography));

  // 3. Spacing checks
  issues.push(...checkSpacing(designTokens.spacing));

  // 4. Component consistency checks
  issues.push(...checkComponents(designTokens.components));

  // 5. Accessibility checks
  issues.push(...checkAccessibility(designTokens.colors, designTokens.typography, designMode));

  // Calculate summary
  const summary: ComparisonSummary = {
    total: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    major: issues.filter(i => i.severity === 'major').length,
    minor: issues.filter(i => i.severity === 'minor').length,
    info: issues.filter(i => i.severity === 'info').length,
    passed: countPassedChecks(designTokens, issues),
  };

  return { issues, summary };
}

// ===== Color Checks =====

function checkColors(
  designColors: DesignColor[],
  screenshotColors: { color: RGB; count: number; hex: string }[]
): QAIssue[] {
  const issues: QAIssue[] = [];

  if (screenshotColors.length === 0) return issues;

  // Check each design color against screenshot colors
  for (const designColor of designColors) {
    let bestMatch = Infinity;
    let bestMatchHex = '';

    for (const sc of screenshotColors) {
      const diff = compareColors(designColor.rgb, sc.color);
      if (diff < bestMatch) {
        bestMatch = diff;
        bestMatchHex = sc.hex;
      }
    }

    const classification = classifyColorDiff(bestMatch);

    if (classification === 'significant' || classification === 'different') {
      issues.push({
        category: 'color',
        severity: classification === 'different' ? 'critical' : 'major',
        title: `Color mismatch on "${designColor.nodeName}"`,
        description: `The ${designColor.property} color doesn't match between design and implementation. Delta E: ${bestMatch.toFixed(1)}`,
        nodeName: designColor.nodeName,
        nodeId: designColor.nodeId,
        expected: designColor.hex,
        actual: bestMatchHex,
        deltaE: bestMatch,
        suggestion: `Update the ${designColor.property} color from ${bestMatchHex} to ${designColor.hex}`,
      });
    } else if (classification === 'noticeable') {
      issues.push({
        category: 'color',
        severity: 'minor',
        title: `Slight color difference on "${designColor.nodeName}"`,
        description: `The ${designColor.property} color has a noticeable but minor difference. Delta E: ${bestMatch.toFixed(1)}`,
        nodeName: designColor.nodeName,
        nodeId: designColor.nodeId,
        expected: designColor.hex,
        actual: bestMatchHex,
        deltaE: bestMatch,
        suggestion: `Consider adjusting the ${designColor.property} color to exactly match ${designColor.hex}`,
      });
    }
  }

  // Check for colors in screenshot not present in design
  const topScreenshotColors = screenshotColors.slice(0, 10);
  for (const sc of topScreenshotColors) {
    let bestMatch = Infinity;
    for (const dc of designColors) {
      const diff = compareColors(dc.rgb, sc.color);
      if (diff < bestMatch) bestMatch = diff;
    }

    if (bestMatch > 10 && designColors.length > 0) {
      issues.push({
        category: 'color',
        severity: 'info',
        title: `Unexpected color detected: ${sc.hex}`,
        description: `A prominent color in the screenshot (${sc.hex}) doesn't match any design color. This may indicate an unintended color being used.`,
        actual: sc.hex,
        suggestion: 'Verify this color is intentional or replace with a design system color.',
      });
    }
  }

  return issues;
}

// ===== Typography Checks =====

function checkTypography(typography: DesignTypography[]): QAIssue[] {
  const issues: QAIssue[] = [];

  // Check for inconsistencies within the design itself
  const fontFamilies = new Set(typography.map(t => t.fontFamily));
  if (fontFamilies.size > 3) {
    issues.push({
      category: 'typography',
      severity: 'major',
      title: 'Too many font families used',
      description: `${fontFamilies.size} different font families detected. Design systems typically use 1-2 font families.`,
      suggestion: `Consider consolidating to fewer font families. Found: ${[...fontFamilies].join(', ')}`,
    });
  }

  // Check font size consistency (look for non-standard sizes)
  const fontSizes = typography.map(t => t.fontSize).sort((a, b) => a - b);
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
        description: `"${typo.nodeName}" uses ${typo.fontSize}px which is close to the standard ${nearestStandard}px.`,
        nodeName: typo.nodeName,
        nodeId: typo.nodeId,
        designTypo: formatTypoProps(typo),
        actualTypo: formatTypoProps({ ...typo, fontSize: nearestStandard }),
        suggestion: `Consider using ${nearestStandard}px for consistency with the type scale.`,
      });
    }

    // Check line height
    if (typo.lineHeight !== null) {
      const ratio = typo.lineHeight / typo.fontSize;
      if (ratio < 1.2) {
        issues.push({
          category: 'typography',
          severity: 'major',
          title: `Tight line height on "${typo.nodeName}"`,
          description: `Line height ratio is ${ratio.toFixed(2)} (${typo.lineHeight}px / ${typo.fontSize}px). Minimum recommended is 1.2 for readability.`,
          nodeName: typo.nodeName,
          nodeId: typo.nodeId,
          designTypo: formatTypoProps(typo),
          suggestion: `Increase line height to at least ${Math.ceil(typo.fontSize * 1.2)}px (1.2x ratio).`,
        });
      }
    }
  }

  // Check for duplicate text styles that should be unified
  const styleGroups = new Map<string, DesignTypography[]>();
  for (const typo of typography) {
    const key = `${typo.fontFamily}-${typo.fontSize}-${typo.fontWeight}`;
    if (!styleGroups.has(key)) styleGroups.set(key, []);
    styleGroups.get(key)!.push(typo);
  }

  return issues;
}

function formatTypoProps(typo: DesignTypography | (Omit<DesignTypography, 'fontSize'> & { fontSize: number })): Record<string, string> {
  return {
    fontFamily: typo.fontFamily,
    fontSize: `${typo.fontSize}px`,
    fontWeight: String(typo.fontWeight),
    lineHeight: typo.lineHeight ? `${typo.lineHeight}px` : 'auto',
    letterSpacing: `${typo.letterSpacing}px`,
  };
}

// ===== Spacing Checks =====

function checkSpacing(spacing: DesignSpacing[]): QAIssue[] {
  const issues: QAIssue[] = [];
  const spacingScale = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96];

  for (const sp of spacing) {
    // Check if spacing follows a consistent scale
    const isOnScale = spacingScale.includes(sp.value);
    if (!isOnScale && sp.value > 0) {
      const nearest = spacingScale.reduce((prev, curr) =>
        Math.abs(curr - sp.value) < Math.abs(prev - sp.value) ? curr : prev
      );

      if (Math.abs(sp.value - nearest) <= 3) {
        issues.push({
          category: 'spacing',
          severity: 'minor',
          title: `Off-scale ${sp.type} on "${sp.nodeName}"`,
          description: `${sp.direction} ${sp.type} is ${sp.value}px, nearest scale value is ${nearest}px.`,
          nodeName: sp.nodeName,
          nodeId: sp.nodeId,
          expectedValue: nearest,
          actualValue: sp.value,
          suggestion: `Adjust ${sp.type} to ${nearest}px to align with the spacing scale.`,
        });
      }
    }

    // Check for asymmetric padding
    if (sp.type === 'padding') {
      const siblingPaddings = spacing.filter(
        s => s.nodeId === sp.nodeId && s.type === 'padding'
      );

      const horizontal = siblingPaddings.filter(s => s.direction === 'left' || s.direction === 'right');
      if (horizontal.length === 2 && horizontal[0].value !== horizontal[1].value) {
        const existing = issues.find(i =>
          i.nodeId === sp.nodeId && i.title.includes('Asymmetric horizontal padding')
        );
        if (!existing) {
          issues.push({
            category: 'spacing',
            severity: 'minor',
            title: `Asymmetric horizontal padding on "${sp.nodeName}"`,
            description: `Left padding (${horizontal.find(h => h.direction === 'left')?.value}px) differs from right (${horizontal.find(h => h.direction === 'right')?.value}px).`,
            nodeName: sp.nodeName,
            nodeId: sp.nodeId,
            expectedValue: Math.max(horizontal[0].value, horizontal[1].value),
            actualValue: Math.min(horizontal[0].value, horizontal[1].value),
            suggestion: 'Consider using symmetric horizontal padding for consistency.',
          });
        }
      }
    }
  }

  return issues;
}

// ===== Component Consistency Checks =====

function checkComponents(components: DesignComponent[]): QAIssue[] {
  const issues: QAIssue[] = [];

  // Group instances by main component
  const componentGroups = new Map<string, DesignComponent[]>();
  for (const comp of components) {
    if (comp.mainComponentId) {
      if (!componentGroups.has(comp.mainComponentId)) {
        componentGroups.set(comp.mainComponentId, []);
      }
      componentGroups.get(comp.mainComponentId)!.push(comp);
    }
  }

  // Check for size inconsistencies among same component instances
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
        title: `Inconsistent sizes for "${instances[0].name}"`,
        description: `${instances.length} instances of this component have different sizes.`,
        componentName: instances[0].name,
        differences: diffs,
        suggestion: 'Ensure all instances use consistent sizing, or use explicit variant properties for different sizes.',
      });
    }
  }

  // Check for detached instances (components without mainComponentId)
  for (const comp of components) {
    if (!comp.mainComponentId) {
      issues.push({
        category: 'component',
        severity: 'info',
        title: `Potentially detached component: "${comp.name}"`,
        description: 'This component instance may have been detached from its main component.',
        componentName: comp.name,
        nodeId: comp.nodeId,
        suggestion: 'Reconnect to main component to maintain design consistency.',
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

  // Find text colors and background colors
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

  // If we don't have explicit bg colors, use a default based on mode
  const defaultBg: RGB = designMode === 'dark'
    ? { r: 0.1, g: 0.1, b: 0.1 }
    : { r: 1, g: 1, b: 1 };

  const backgrounds = bgColors.length > 0
    ? bgColors.map(c => c.rgb)
    : [defaultBg];

  // Check contrast for each text-like color against backgrounds
  for (const textColor of textColors) {
    for (const bg of backgrounds) {
      const ratio = contrastRatio(textColor.rgb, bg);
      const textHex = rgbToHex(textColor.rgb);
      const bgHex = rgbToHex(bg);

      // Normal text needs 4.5:1 (AA), 7:1 (AAA)
      // Large text (18px+ or 14px bold) needs 3:1 (AA), 4.5:1 (AAA)
      const relatedTypo = typography.find(t => {
        return t.nodeName === textColor.nodeName ||
               t.nodeId === textColor.nodeId;
      });

      const isLargeText = relatedTypo && (
        relatedTypo.fontSize >= 18 ||
        (relatedTypo.fontSize >= 14 && relatedTypo.fontWeight >= 700)
      );

      const aaThreshold = isLargeText ? 3 : 4.5;
      const aaaThreshold = isLargeText ? 4.5 : 7;

      if (ratio < aaThreshold) {
        issues.push({
          category: 'a11y',
          severity: 'critical',
          title: `Insufficient contrast: "${textColor.nodeName}"`,
          description: `Contrast ratio ${ratio.toFixed(2)}:1 fails WCAG AA (requires ${aaThreshold}:1${isLargeText ? ' for large text' : ''}).`,
          nodeName: textColor.nodeName,
          nodeId: textColor.nodeId,
          contrastRatio: ratio,
          foreground: textHex,
          background: bgHex,
          wcagCriteria: 'WCAG 2.1 - 1.4.3 Contrast (Minimum)',
          suggestion: `Increase contrast to at least ${aaThreshold}:1. Current: ${ratio.toFixed(2)}:1`,
        });
      } else if (ratio < aaaThreshold) {
        issues.push({
          category: 'a11y',
          severity: 'minor',
          title: `Contrast below AAA: "${textColor.nodeName}"`,
          description: `Contrast ratio ${ratio.toFixed(2)}:1 passes AA but fails AAA (requires ${aaaThreshold}:1).`,
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

  // Check touch target sizes
  const interactiveNames = ['button', 'btn', 'link', 'input', 'toggle', 'switch', 'checkbox', 'radio', 'tab', 'icon-button'];
  const smallComponents = colors.filter(c => {
    const name = c.nodeName.toLowerCase();
    return interactiveNames.some(n => name.includes(n));
  });

  // Check text size accessibility
  for (const typo of typography) {
    if (typo.fontSize < 12) {
      issues.push({
        category: 'a11y',
        severity: 'major',
        title: `Text too small: "${typo.nodeName}"`,
        description: `Font size ${typo.fontSize}px is below the minimum recommended 12px for readability.`,
        nodeName: typo.nodeName,
        nodeId: typo.nodeId,
        wcagCriteria: 'WCAG 2.1 - 1.4.4 Resize Text',
        suggestion: `Increase font size to at least 12px.`,
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
