/**
 * Design QA Inspector - Figma Plugin Main Code
 *
 * Compares Figma design frames with implementation frames
 * to identify color, typography, spacing, component, and accessibility issues.
 */

import {
  extractDesignTokens,
  runFrameComparison,
  QAIssue,
} from './comparison-engine';

// ===== Plugin Init =====

figma.showUI(__html__, {
  width: 420,
  height: 720,
  themeColors: true,
  title: 'Design QA Inspector',
});

let currentDesignMode: 'light' | 'dark' = 'light';
let selectedDesignFrameId: string | null = null;
let selectedImplFrameId: string | null = null;

const VALID_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION'];

// ===== Message Handler =====

figma.ui.onmessage = async (msg: {
  type: string;
  designMode?: 'light' | 'dark';
  format?: string;
  issues?: QAIssue[];
  nodeId?: string;
}) => {
  switch (msg.type) {
    case 'select-design-frame':
      handleFrameSelection('design');
      break;
    case 'select-impl-frame':
      handleFrameSelection('impl');
      break;
    case 'set-design-mode':
      if (msg.designMode) currentDesignMode = msg.designMode;
      break;
    case 'run-comparison':
      await handleComparison();
      break;
    case 'highlight-node':
      if (msg.nodeId) await highlightNode(msg.nodeId);
      break;
    case 'export-report':
      if (msg.issues && msg.format) handleExport(msg.format, msg.issues);
      break;
  }
};

// ===== Frame Selection =====

function handleFrameSelection(target: 'design' | 'impl'): void {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.notify('Figma에서 프레임을 먼저 선택하세요.', { error: true });
    return;
  }

  const node = selection[0];
  if (!VALID_TYPES.includes(node.type)) {
    figma.notify('Frame, Component, Instance 또는 Group을 선택하세요.', { error: true });
    return;
  }

  if (target === 'design') {
    selectedDesignFrameId = node.id;
  } else {
    selectedImplFrameId = node.id;
  }

  figma.ui.postMessage({
    type: target === 'design' ? 'design-frame-selected' : 'impl-frame-selected',
    frame: {
      id: node.id,
      name: node.name,
      width: ('width' in node) ? (node as any).width : 0,
      height: ('height' in node) ? (node as any).height : 0,
    },
  });

  const label = target === 'design' ? 'Design' : 'Implementation';
  figma.notify(`${label}: "${node.name}" (${Math.round((node as any).width)}x${Math.round((node as any).height)})`);
}

// ===== Comparison =====

async function handleComparison(): Promise<void> {
  try {
    if (!selectedDesignFrameId || !selectedImplFrameId) {
      figma.ui.postMessage({
        type: 'comparison-error',
        error: 'Design과 Implementation 프레임을 모두 선택하세요.',
      });
      return;
    }

    if (selectedDesignFrameId === selectedImplFrameId) {
      figma.ui.postMessage({
        type: 'comparison-error',
        error: '같은 프레임입니다. 서로 다른 프레임을 선택하세요.',
      });
      return;
    }

    const designNode = await figma.getNodeByIdAsync(selectedDesignFrameId);
    const implNode = await figma.getNodeByIdAsync(selectedImplFrameId);

    if (!designNode || !VALID_TYPES.includes(designNode.type)) {
      figma.ui.postMessage({ type: 'comparison-error', error: 'Design 프레임을 찾을 수 없습니다.' });
      return;
    }
    if (!implNode || !VALID_TYPES.includes(implNode.type)) {
      figma.ui.postMessage({ type: 'comparison-error', error: 'Implementation 프레임을 찾을 수 없습니다.' });
      return;
    }

    // Extract tokens from both frames
    const designResult = await extractDesignTokens(designNode);
    const implResult = await extractDesignTokens(implNode);

    // Export impl frame as image for preview
    let frameImageBase64 = '';
    try {
      const imageBytes = await (implNode as any).exportAsync({
        format: 'PNG',
        constraint: { type: 'WIDTH', value: 600 },
      });
      frameImageBase64 = figma.base64Encode(imageBytes);
    } catch (_e) {
      // Export failed, continue without image
    }

    // Run comparison
    const { issues, summary } = runFrameComparison(
      designResult.tokens,
      implResult.tokens,
      currentDesignMode
    );

    // Sort by severity
    const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    figma.ui.postMessage({
      type: 'comparison-results',
      issues,
      summary,
      nodeRects: implResult.nodeRects,
      frameImage: frameImageBase64,
      frameWidth: ('width' in implNode) ? (implNode as any).width : 0,
      frameHeight: ('height' in implNode) ? (implNode as any).height : 0,
    });

    const notifMsg = summary.critical > 0
      ? `${summary.total}개 이슈 (${summary.critical}개 심각)`
      : summary.total > 0
        ? `${summary.total}개 이슈 발견`
        : '모든 검사 통과!';

    figma.notify(notifMsg, { timeout: 3000, error: summary.critical > 0 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    figma.ui.postMessage({ type: 'comparison-error', error: errorMessage });
    figma.notify('비교 실패: ' + errorMessage, { error: true });
  }
}

// ===== Highlight Node =====

async function highlightNode(nodeId: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (node) {
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
  }
}

// ===== Export =====

function handleExport(format: string, issues: QAIssue[]): void {
  switch (format) {
    case 'json': exportJSON(issues); break;
    case 'csv': exportCSV(issues); break;
    case 'figma': createFigmaAnnotations(issues); break;
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

  const jsonStr = JSON.stringify(report, null, 2);
  figma.notify('JSON report generated. Check console.', { timeout: 5000 });
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
  figma.notify('CSV report generated. Check console.', { timeout: 5000 });
  console.log('=== Design QA Report (CSV) ===');
  console.log(csv);
  figma.ui.postMessage({ type: 'export-complete', format: 'csv', data: csv });
}

async function createFigmaAnnotations(issues: QAIssue[]): Promise<void> {
  const frameId = selectedImplFrameId || selectedDesignFrameId;
  if (!frameId) {
    figma.notify('No frame selected for annotations.', { error: true });
    return;
  }

  const frame = await figma.getNodeByIdAsync(frameId);
  if (!frame || !('absoluteTransform' in frame)) return;

  const parentFrame = frame as FrameNode;

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

  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

  const title = figma.createText();
  title.fontName = { family: 'Inter', style: 'Bold' };
  title.characters = `Design QA Report - ${currentDesignMode.toUpperCase()} Mode`;
  title.fontSize = 16;
  title.fills = [{ type: 'SOLID', color: { r: 0.13, g: 0.13, b: 0.13 } }];
  annotationFrame.appendChild(title);

  const summaryText = figma.createText();
  summaryText.fontName = { family: 'Inter', style: 'Regular' };
  const critCount = issues.filter(i => i.severity === 'critical').length;
  const majCount = issues.filter(i => i.severity === 'major').length;
  summaryText.characters = `Total: ${issues.length} | Critical: ${critCount} | Major: ${majCount}`;
  summaryText.fontSize = 12;
  summaryText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
  annotationFrame.appendChild(summaryText);

  const sep = figma.createRectangle();
  sep.resize(320, 1);
  sep.fills = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 } }];
  annotationFrame.appendChild(sep);

  const severityColors: Record<string, { r: number; g: number; b: number }> = {
    critical: { r: 0.95, g: 0.28, b: 0.13 },
    major: { r: 0.95, g: 0.64, b: 0.05 },
    minor: { r: 0.05, g: 0.6, b: 1 },
    info: { r: 0.6, g: 0.6, b: 0.6 },
  };

  for (const issue of issues.slice(0, 30)) {
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
    issueFrame.strokes = [{ type: 'SOLID', color: severityColors[issue.severity] || severityColors.info }];
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

  annotationFrame.layoutSizingVertical = 'HUG';

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
      marker.fills = [{ type: 'SOLID', color: severityColors[issue.severity] }];
      marker.opacity = 0.8;
      marker.strokeWeight = 2;
      marker.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    }
  }

  figma.viewport.scrollAndZoomIntoView([annotationFrame]);
  figma.notify(`${issues.length}개 어노테이션 생성 완료.`, { timeout: 5000 });
  figma.ui.postMessage({ type: 'export-complete', format: 'figma' });
}
