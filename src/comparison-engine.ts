/**
 * Design QA Comparison Engine
 * Self-checks on implementation tokens.
 * Visual pixel diff is handled in the UI.
 */

import {
  RGB, rgbToHex, contrastRatio,
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
  category: 'color' | 'typography' | 'spacing' | 'component' | 'a11y' | 'visual';
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
  // Visual diff region (pixel comparison)
  regionX?: number;
  regionY?: number;
  regionWidth?: number;
  regionHeight?: number;
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

async function traverseNode(node: SceneNode, tokens: DesignToken): Promise<void> {
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
    'Thin': 100, 'Hairline': 100, 'ExtraLight': 200, 'Ultra Light': 200,
    'Light': 300, 'Regular': 400, 'Normal': 400, 'Medium': 500,
    'SemiBold': 600, 'Semi Bold': 600, 'Demi Bold': 600, 'Bold': 700,
    'ExtraBold': 800, 'Extra Bold': 800, 'Ultra Bold': 800, 'Black': 900, 'Heavy': 900,
  };
  for (const [name, weight] of Object.entries(weights)) {
    if (style.toLowerCase().includes(name.toLowerCase())) return weight;
  }
  return 400;
}

// ===== Self-Checks on Implementation =====

export function runSelfChecks(
  implTokens: DesignToken,
  designMode: 'light' | 'dark'
): QAIssue[] {
  const issues: QAIssue[] = [];
  issues.push(...checkTypography(implTokens.typography));
  issues.push(...checkSpacing(implTokens.spacing));
  issues.push(...checkComponents(implTokens.components));
  issues.push(...checkAccessibility(implTokens.colors, implTokens.typography, designMode));

  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = `${issue.category}:${issue.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function checkTypography(typography: DesignTypography[]): QAIssue[] {
  const issues: QAIssue[] = [];
  const fontFamilies = new Set(typography.map(t => t.fontFamily));
  if (fontFamilies.size > 3) {
    issues.push({
      category: 'typography', severity: 'major',
      title: 'Too many font families used',
      description: `${fontFamilies.size} different font families detected.`,
      suggestion: `Consolidate fonts. Found: ${[...fontFamilies].join(', ')}`,
    });
  }

  for (const typo of typography) {
    if (typo.lineHeight !== null) {
      const ratio = typo.lineHeight / typo.fontSize;
      if (ratio < 1.2) {
        issues.push({
          category: 'typography', severity: 'major',
          title: `Tight line height: "${typo.nodeName}"`,
          description: `Line height ratio ${ratio.toFixed(2)}. Minimum 1.2 recommended.`,
          nodeName: typo.nodeName, nodeId: typo.nodeId,
          suggestion: `Increase line height to at least ${Math.ceil(typo.fontSize * 1.2)}px.`,
        });
      }
    }
  }
  return issues;
}

function checkSpacing(spacing: DesignSpacing[]): QAIssue[] {
  const issues: QAIssue[] = [];
  const spacingScale = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96];

  for (const sp of spacing) {
    if (!spacingScale.includes(sp.value) && sp.value > 0) {
      const nearest = spacingScale.reduce((prev, curr) =>
        Math.abs(curr - sp.value) < Math.abs(prev - sp.value) ? curr : prev
      );
      if (Math.abs(sp.value - nearest) <= 3 && Math.abs(sp.value - nearest) >= 1) {
        issues.push({
          category: 'spacing', severity: 'minor',
          title: `Off-scale ${sp.type}: "${sp.nodeName}"`,
          description: `${sp.direction} ${sp.type} is ${sp.value}px, nearest scale: ${nearest}px.`,
          nodeName: sp.nodeName, nodeId: sp.nodeId,
          expectedValue: nearest, actualValue: sp.value,
          suggestion: `Adjust to ${nearest}px.`,
        });
      }
    }
  }
  return issues;
}

function checkComponents(components: DesignComponent[]): QAIssue[] {
  const issues: QAIssue[] = [];
  const groups = new Map<string, DesignComponent[]>();
  for (const comp of components) {
    if (comp.mainComponentId) {
      if (!groups.has(comp.mainComponentId)) groups.set(comp.mainComponentId, []);
      groups.get(comp.mainComponentId)!.push(comp);
    }
  }
  for (const [, instances] of groups) {
    if (instances.length < 2) continue;
    const widths = new Set(instances.map(i => Math.round(i.width)));
    const heights = new Set(instances.map(i => Math.round(i.height)));
    if (widths.size > 1 || heights.size > 1) {
      const diffs: string[] = [];
      if (widths.size > 1) diffs.push(`widths: ${[...widths].join(', ')}px`);
      if (heights.size > 1) diffs.push(`heights: ${[...heights].join(', ')}px`);
      issues.push({
        category: 'component', severity: 'major',
        title: `Inconsistent sizes: "${instances[0].name}"`,
        description: `${instances.length} instances have different sizes.`,
        componentName: instances[0].name, differences: diffs,
        suggestion: 'Ensure all instances use consistent sizing.',
      });
    }
  }
  return issues;
}

function checkAccessibility(
  colors: DesignColor[], typography: DesignTypography[], designMode: 'light' | 'dark'
): QAIssue[] {
  const issues: QAIssue[] = [];
  const textColors = colors.filter(c => {
    const n = c.nodeName.toLowerCase();
    return n.includes('text') || n.includes('label') || n.includes('title') ||
           n.includes('body') || n.includes('heading') || n.includes('caption');
  });
  const bgColors = colors.filter(c => {
    const n = c.nodeName.toLowerCase();
    return n.includes('background') || n.includes('bg') || n.includes('surface') ||
           n.includes('card') || n.includes('container') || n.includes('frame');
  });
  const defaultBg: RGB = designMode === 'dark' ? { r: 0.1, g: 0.1, b: 0.1 } : { r: 1, g: 1, b: 1 };
  const backgrounds = bgColors.length > 0 ? bgColors.map(c => c.rgb) : [defaultBg];

  for (const tc of textColors) {
    for (const bg of backgrounds) {
      const ratio = contrastRatio(tc.rgb, bg);
      const textHex = rgbToHex(tc.rgb);
      const bgHex = rgbToHex(bg);
      const relTypo = typography.find(t => t.nodeName === tc.nodeName || t.nodeId === tc.nodeId);
      const isLarge = relTypo && (relTypo.fontSize >= 18 || (relTypo.fontSize >= 14 && relTypo.fontWeight >= 700));
      const aaT = isLarge ? 3 : 4.5;
      if (ratio < aaT) {
        issues.push({
          category: 'a11y', severity: 'critical',
          title: `Insufficient contrast: "${tc.nodeName}"`,
          description: `Contrast ${ratio.toFixed(2)}:1 fails WCAG AA (needs ${aaT}:1).`,
          nodeName: tc.nodeName, nodeId: tc.nodeId,
          contrastRatio: ratio, foreground: textHex, background: bgHex,
          wcagCriteria: 'WCAG 2.1 - 1.4.3',
          suggestion: `Increase contrast to at least ${aaT}:1.`,
        });
      }
    }
  }

  for (const typo of typography) {
    if (typo.fontSize < 12) {
      issues.push({
        category: 'a11y', severity: 'major',
        title: `Text too small: "${typo.nodeName}"`,
        description: `Font size ${typo.fontSize}px is below minimum 12px.`,
        nodeName: typo.nodeName, nodeId: typo.nodeId,
        suggestion: 'Increase font size to at least 12px.',
      });
    }
  }
  return issues;
}
