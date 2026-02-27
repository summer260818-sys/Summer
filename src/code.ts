/**
 * Design QA Inspector - Figma Plugin Main Code
 *
 * Compares Figma design guide frames with uploaded screenshots
 * to identify color, typography, spacing, component, and accessibility issues.
 *
 * Supports Light / Dark mode comparison.
 */

import { extractDominantColors, rgbToHex } from './color-utils';
import {
  extractDesignTokens,
  runQAComparison,
  QAIssue,
  ScreenshotData,
} from './comparison-engine';

// ===== Plugin Init =====

figma.showUI(__html__, {
  width: 420,
  height: 680,
  themeColors: true,
  title: 'Design QA Inspector',
});

let currentDesignMode: 'light' | 'dark' = 'light';
let selectedFrameId: string | null = null;

// ===== Selection Listener =====

figma.on('selectionchange', () => {
  // Handled via explicit user action (button click) not auto-selection
});

// ===== Message Handler =====

figma.ui.onmessage = async (msg: {
  type: string;
  designMode?: 'light' | 'dark';
  screenshot?: ScreenshotData;
  format?: string;
  issues?: QAIssue[];
  opacity?: number;
}) => {
  switch (msg.type) {
    case 'select-design-frame':
      handleFrameSelection();
      break;

    case 'set-design-mode':
      if (msg.designMode) {
        currentDesignMode = msg.designMode;
      }
      break;

    case 'run-comparison':
      if (msg.screenshot) {
        await handleComparison(msg.screenshot);
      }
      break;

    case 'export-report':
      if (msg.issues && msg.format) {
        handleExport(msg.format, msg.issues);
      }
      break;

    case 'update-overlay':
      if (msg.opacity !== undefined) {
        handleOverlayUpdate(msg.opacity);
      }
      break;
  }
};

// ===== Frame Selection =====

function handleFrameSelection(): void {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.notify('Please select a frame in Figma first.', { error: true });
    return;
  }

  const node = selection[0];
  const validTypes = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION'];
  if (!validTypes.includes(node.type)) {
    figma.notify('Please select a Frame, Component, Instance, or Group.', { error: true });
    return;
  }

  selectedFrameId = node.id;

  figma.ui.postMessage({
    type: 'frame-selected',
    frame: {
      id: node.id,
      name: node.name,
      width: ('width' in node) ? (node as any).width : 0,
      height: ('height' in node) ? (node as any).height : 0,
    },
  });

  figma.notify(`Selected: "${node.name}" (${Math.round(node.width)}x${Math.round(node.height)})`);
}

// ===== Comparison =====

async function handleComparison(screenshot: ScreenshotData): Promise<void> {
  try {
    if (!selectedFrameId) {
      figma.ui.postMessage({
        type: 'comparison-error',
        error: 'No design frame selected.',
      });
      return;
    }

    const node = await figma.getNodeByIdAsync(selectedFrameId);
    const validTypes = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION'];
    if (!node || !validTypes.includes(node.type)) {
      figma.ui.postMessage({
        type: 'comparison-error',
        error: 'Selected frame no longer exists. Please select again.',
      });
      return;
    }

    // Extract design tokens from the selected frame
    const designTokens = extractDesignTokens(node as FrameNode);

    // Extract dominant colors from screenshot
    const screenshotColors = extractDominantColors(
      screenshot.data,
      screenshot.width,
      screenshot.height,
      Math.max(1, Math.floor(Math.min(screenshot.width, screenshot.height) / 100))
    );

    // Run comparison
    const { issues, summary } = runQAComparison(
      designTokens,
      screenshotColors,
      currentDesignMode
    );

    // Sort issues by severity
    const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    figma.ui.postMessage({
      type: 'comparison-results',
      issues,
      summary,
    });

    // Summary notification
    const notifMsg = summary.critical > 0
      ? `Found ${summary.total} issues (${summary.critical} critical)`
      : summary.total > 0
        ? `Found ${summary.total} issues`
        : 'All checks passed!';

    figma.notify(notifMsg, {
      timeout: 3000,
      error: summary.critical > 0,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    figma.ui.postMessage({
      type: 'comparison-error',
      error: errorMessage,
    });
    figma.notify('Comparison failed: ' + errorMessage, { error: true });
  }
}

// ===== Overlay =====

let overlayNode: RectangleNode | null = null;

async function handleOverlayUpdate(opacity: number): Promise<void> {
  // Create or update an overlay rectangle for visual comparison
  if (!selectedFrameId) return;

  const frame = await figma.getNodeByIdAsync(selectedFrameId);
  if (!frame || !('absoluteTransform' in frame)) return;

  if (overlayNode) {
    overlayNode.opacity = opacity;
  }
}

// ===== Export =====

function handleExport(format: string, issues: QAIssue[]): void {
  switch (format) {
    case 'json':
      exportJSON(issues);
      break;
    case 'csv':
      exportCSV(issues);
      break;
    case 'figma':
      createFigmaAnnotations(issues);
      break;
  }
}

function exportJSON(issues: QAIssue[]): void {
  const report = {
    plugin: 'Design QA Inspector',
    timestamp: new Date().toISOString(),
    designMode: currentDesignMode,
    totalIssues: issues.length,
    issues: issues.map(i => ({
      category: i.category,
      severity: i.severity,
      title: i.title,
      description: i.description,
      nodeName: i.nodeName,
      expected: i.expected,
      actual: i.actual,
      suggestion: i.suggestion,
    })),
  };

  // Copy to clipboard via notification (Figma doesn't have clipboard API in plugin sandbox)
  const jsonStr = JSON.stringify(report, null, 2);
  figma.notify('JSON report generated. Check console (Developer > Open Console).', { timeout: 5000 });
  console.log('=== Design QA Report (JSON) ===');
  console.log(jsonStr);

  figma.ui.postMessage({ type: 'export-complete', format: 'json', data: jsonStr });
}

function exportCSV(issues: QAIssue[]): void {
  const headers = ['Category', 'Severity', 'Title', 'Description', 'Element', 'Expected', 'Actual', 'Suggestion'];
  const rows = issues.map(i => [
    i.category,
    i.severity,
    `"${(i.title || '').replace(/"/g, '""')}"`,
    `"${(i.description || '').replace(/"/g, '""')}"`,
    i.nodeName || '',
    i.expected || '',
    i.actual || '',
    `"${(i.suggestion || '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  figma.notify('CSV report generated. Check console (Developer > Open Console).', { timeout: 5000 });
  console.log('=== Design QA Report (CSV) ===');
  console.log(csv);

  figma.ui.postMessage({ type: 'export-complete', format: 'csv', data: csv });
}

async function createFigmaAnnotations(issues: QAIssue[]): Promise<void> {
  if (!selectedFrameId) {
    figma.notify('No frame selected for annotations.', { error: true });
    return;
  }

  const frame = await figma.getNodeByIdAsync(selectedFrameId);
  if (!frame || !('absoluteTransform' in frame)) return;

  const parentFrame = frame as FrameNode;
  const parentPage = figma.currentPage;

  // Create annotation frame next to the design
  const annotationFrame = figma.createFrame();
  annotationFrame.name = `QA Annotations - ${parentFrame.name} (${currentDesignMode} mode)`;
  annotationFrame.x = parentFrame.x + parentFrame.width + 40;
  annotationFrame.y = parentFrame.y;
  annotationFrame.resize(360, Math.max(400, issues.length * 60 + 80));
  annotationFrame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  annotationFrame.cornerRadius = 12;
  annotationFrame.layoutMode = 'VERTICAL';
  annotationFrame.paddingTop = 20;
  annotationFrame.paddingBottom = 20;
  annotationFrame.paddingLeft = 20;
  annotationFrame.paddingRight = 20;
  annotationFrame.itemSpacing = 12;

  // Title
  const title = figma.createText();
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

  title.fontName = { family: 'Inter', style: 'Bold' };
  title.characters = `Design QA Report - ${currentDesignMode.toUpperCase()} Mode`;
  title.fontSize = 16;
  title.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.13, b: 0.13 } }];
  annotationFrame.appendChild(title);

  // Summary line
  const summaryText = figma.createText();
  summaryText.fontName = { family: 'Inter', style: 'Regular' };
  const critCount = issues.filter(i => i.severity === 'critical').length;
  const majCount = issues.filter(i => i.severity === 'major').length;
  summaryText.characters = `Total: ${issues.length} issues | Critical: ${critCount} | Major: ${majCount}`;
  summaryText.fontSize = 12;
  summaryText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
  annotationFrame.appendChild(summaryText);

  // Separator
  const sep = figma.createRectangle();
  sep.resize(320, 1);
  sep.fills = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
  annotationFrame.appendChild(sep);

  // Issues
  const severityColors: Record<string, { r: number; g: number; b: number }> = {
    critical: { r: 0.95, g: 0.28, b: 0.13 },
    major: { r: 0.95, g: 0.64, b: 0.05 },
    minor: { r: 0.05, g: 0.6, b: 1 },
    info: { r: 0.6, g: 0.6, b: 0.6 },
  };

  for (const issue of issues.slice(0, 30)) { // Limit to prevent huge annotation frames
    const issueFrame = figma.createFrame();
    issueFrame.name = `Issue: ${issue.title}`;
    issueFrame.layoutMode = 'VERTICAL';
    issueFrame.itemSpacing = 4;
    issueFrame.paddingTop = 8;
    issueFrame.paddingBottom = 8;
    issueFrame.paddingLeft = 10;
    issueFrame.paddingRight = 10;
    issueFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    issueFrame.cornerRadius = 6;
    issueFrame.strokeWeight = 1;
    issueFrame.strokes = [{
      type: 'SOLID',
      color: severityColors[issue.severity] || severityColors.info,
    }];
    issueFrame.layoutSizingHorizontal = 'FILL';

    const issueSeverity = figma.createText();
    issueSeverity.fontName = { family: 'Inter', style: 'Bold' };
    issueSeverity.characters = `[${issue.severity.toUpperCase()}] ${issue.category.toUpperCase()}`;
    issueSeverity.fontSize = 10;
    issueSeverity.fills = [{ type: 'SOLID', color: severityColors[issue.severity] || severityColors.info }];
    issueFrame.appendChild(issueSeverity);

    const issueTitle = figma.createText();
    issueTitle.fontName = { family: 'Inter', style: 'Medium' };
    issueTitle.characters = issue.title;
    issueTitle.fontSize = 12;
    issueTitle.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.13, b: 0.13 } }];
    issueTitle.layoutSizingHorizontal = 'FILL';
    issueFrame.appendChild(issueTitle);

    if (issue.suggestion) {
      const suggestionText = figma.createText();
      suggestionText.fontName = { family: 'Inter', style: 'Regular' };
      suggestionText.characters = issue.suggestion;
      suggestionText.fontSize = 11;
      suggestionText.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.6, b: 1 } }];
      suggestionText.layoutSizingHorizontal = 'FILL';
      issueFrame.appendChild(suggestionText);
    }

    annotationFrame.appendChild(issueFrame);
  }

  // Resize to fit content
  annotationFrame.layoutSizingVertical = 'HUG';

  // Also add visual markers on the original frame for issues with node references
  for (const issue of issues.filter(i => i.nodeId && (i.severity === 'critical' || i.severity === 'major'))) {
    const targetNode = await figma.getNodeByIdAsync(issue.nodeId!);
    if (targetNode && 'absoluteTransform' in targetNode) {
      const marker = figma.createEllipse();
      marker.name = `QA: ${issue.severity} - ${issue.title}`;
      const absX = (targetNode as SceneNode).absoluteTransform[0][2];
      const absY = (targetNode as SceneNode).absoluteTransform[1][2];
      marker.x = absX - 6;
      marker.y = absY - 6;
      marker.resize(12, 12);
      marker.fills = [{
        type: 'SOLID',
        color: severityColors[issue.severity],
      }];
      marker.opacity = 0.8;
      marker.strokeWeight = 2;
      marker.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    }
  }

  figma.viewport.scrollAndZoomIntoView([annotationFrame]);
  figma.notify(`Created ${issues.length} annotations next to the design frame.`, { timeout: 5000 });
  figma.ui.postMessage({ type: 'export-complete', format: 'figma' });
}
