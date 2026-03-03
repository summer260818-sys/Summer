/**
 * Design QA Inspector - Figma Plugin Main Code
 *
 * Compares Figma design frames with implementation frames.
 * Exports both frames as PNG for pixel-level diff in the UI.
 * Highlights issues directly on the Figma canvas.
 */

import {
  extractDesignTokens,
  runSelfChecks,
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
let tempHighlightId: string | null = null;

const VALID_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION'];

const SEVERITY_COLORS: Record<string, { r: number; g: number; b: number }> = {
  critical: { r: 0.95, g: 0.28, b: 0.13 },
  major: { r: 0.95, g: 0.64, b: 0.05 },
  minor: { r: 0.05, g: 0.6, b: 1 },
  info: { r: 0.6, g: 0.6, b: 0.6 },
};

// ===== Message Handler =====

figma.ui.onmessage = async (msg: {
  type: string;
  designMode?: 'light' | 'dark';
  format?: string;
  issues?: QAIssue[];
  nodeId?: string;
  severity?: string;
  title?: string;
  regionX?: number;
  regionY?: number;
  regionWidth?: number;
  regionHeight?: number;
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
    case 'highlight-on-canvas':
      if (msg.nodeId) await highlightOnCanvas(msg.nodeId, msg.severity || 'info');
      break;
    case 'highlight-region':
      await highlightRegion(
        msg.regionX || 0, msg.regionY || 0,
        msg.regionWidth || 0, msg.regionHeight || 0,
        msg.severity || 'critical'
      );
      break;
    case 'clear-highlight':
      await clearTempHighlight();
      break;
    case 'mark-on-canvas':
      if (msg.nodeId) await markOnCanvas(msg.nodeId, msg.severity || 'info', msg.title || '');
      break;
    case 'mark-region':
      await markRegion(
        msg.regionX || 0, msg.regionY || 0,
        msg.regionWidth || 0, msg.regionHeight || 0,
        msg.severity || 'critical',
        msg.title || ''
      );
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

    await clearTempHighlight();

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

    // Extract tokens from implementation frame for self-checks
    const implTokens = await extractDesignTokens(implNode);

    // Run self-checks on implementation tokens
    const selfCheckIssues = runSelfChecks(implTokens, currentDesignMode);

    // Export both frames as PNG at 1x scale for pixel comparison
    const exportSettings: ExportSettings = {
      format: 'PNG',
      constraint: { type: 'SCALE', value: 1 },
    };

    const designBytes = await (designNode as SceneNode).exportAsync(exportSettings);
    const implBytes = await (implNode as SceneNode).exportAsync(exportSettings);

    // Convert to base64
    const designBase64 = figma.base64Encode(designBytes);
    const implBase64 = figma.base64Encode(implBytes);

    // Get implementation frame absolute position (for region highlighting)
    const implAbsX = 'absoluteTransform' in implNode
      ? (implNode as SceneNode).absoluteTransform[0][2] : 0;
    const implAbsY = 'absoluteTransform' in implNode
      ? (implNode as SceneNode).absoluteTransform[1][2] : 0;

    figma.ui.postMessage({
      type: 'comparison-data',
      selfCheckIssues,
      designImage: designBase64,
      implImage: implBase64,
      designWidth: (designNode as any).width,
      designHeight: (designNode as any).height,
      implWidth: (implNode as any).width,
      implHeight: (implNode as any).height,
      implAbsX: Math.round(implAbsX),
      implAbsY: Math.round(implAbsY),
    });

    figma.notify('프레임 분석 중...', { timeout: 2000 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    figma.ui.postMessage({ type: 'comparison-error', error: errorMessage });
    figma.notify('비교 실패: ' + errorMessage, { error: true });
  }
}

// ===== Canvas Highlighting =====

async function highlightOnCanvas(nodeId: string, severity: string): Promise<void> {
  await clearTempHighlight();

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || !('absoluteTransform' in node)) return;

  const sceneNode = node as SceneNode;
  const absX = sceneNode.absoluteTransform[0][2];
  const absY = sceneNode.absoluteTransform[1][2];
  const w = ('width' in sceneNode) ? (sceneNode as any).width : 0;
  const h = ('height' in sceneNode) ? (sceneNode as any).height : 0;

  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;

  const rect = figma.createRectangle();
  rect.name = '__QA_TEMP_HIGHLIGHT__';
  rect.x = absX - 2;
  rect.y = absY - 2;
  rect.resize(w + 4, h + 4);
  rect.fills = [{ type: 'SOLID', color, opacity: 0.12 }];
  rect.strokes = [{ type: 'SOLID', color }];
  rect.strokeWeight = 2;
  rect.cornerRadius = 2;

  tempHighlightId = rect.id;

  figma.viewport.scrollAndZoomIntoView([sceneNode]);
}

// Region highlight for pixel-diff issues (on the impl frame)
async function highlightRegion(
  regionX: number, regionY: number,
  regionWidth: number, regionHeight: number,
  severity: string
): Promise<void> {
  await clearTempHighlight();

  if (!selectedImplFrameId) return;
  const implNode = await figma.getNodeByIdAsync(selectedImplFrameId);
  if (!implNode || !('absoluteTransform' in implNode)) return;

  const implAbsX = (implNode as SceneNode).absoluteTransform[0][2];
  const implAbsY = (implNode as SceneNode).absoluteTransform[1][2];

  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.critical;

  const rect = figma.createRectangle();
  rect.name = '__QA_TEMP_HIGHLIGHT__';
  rect.x = implAbsX + regionX - 4;
  rect.y = implAbsY + regionY - 4;
  rect.resize(regionWidth + 8, regionHeight + 8);
  rect.fills = [{ type: 'SOLID', color, opacity: 0.15 }];
  rect.strokes = [{ type: 'SOLID', color }];
  rect.strokeWeight = 2;
  rect.cornerRadius = 3;

  tempHighlightId = rect.id;

  figma.viewport.scrollAndZoomIntoView([rect]);
}

async function clearTempHighlight(): Promise<void> {
  if (tempHighlightId) {
    const node = await figma.getNodeByIdAsync(tempHighlightId);
    if (node) node.remove();
    tempHighlightId = null;
  }
}

// ===== Mark on Canvas (Persistent) =====

async function markOnCanvas(nodeId: string, severity: string, title: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || !('absoluteTransform' in node)) {
    figma.notify('노드를 찾을 수 없습니다.', { error: true });
    return;
  }

  const sceneNode = node as SceneNode;
  const absX = sceneNode.absoluteTransform[0][2];
  const absY = sceneNode.absoluteTransform[1][2];
  const w = ('width' in sceneNode) ? (sceneNode as any).width : 0;
  const h = ('height' in sceneNode) ? (sceneNode as any).height : 0;

  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;

  const rect = figma.createRectangle();
  rect.name = `QA: [${severity.toUpperCase()}] ${title}`;
  rect.x = absX - 3;
  rect.y = absY - 3;
  rect.resize(w + 6, h + 6);
  rect.fills = [{ type: 'SOLID', color, opacity: 0.08 }];
  rect.strokes = [{ type: 'SOLID', color }];
  rect.strokeWeight = 2;
  rect.dashPattern = [6, 3];
  rect.cornerRadius = 3;

  figma.viewport.scrollAndZoomIntoView([sceneNode]);
  figma.notify(`Marked: ${title}`);
  figma.ui.postMessage({ type: 'mark-complete', nodeId });
}

// Mark a pixel-diff region (persistent)
async function markRegion(
  regionX: number, regionY: number,
  regionWidth: number, regionHeight: number,
  severity: string, title: string
): Promise<void> {
  if (!selectedImplFrameId) return;
  const implNode = await figma.getNodeByIdAsync(selectedImplFrameId);
  if (!implNode || !('absoluteTransform' in implNode)) return;

  const implAbsX = (implNode as SceneNode).absoluteTransform[0][2];
  const implAbsY = (implNode as SceneNode).absoluteTransform[1][2];

  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.critical;

  const rect = figma.createRectangle();
  rect.name = `QA: [${severity.toUpperCase()}] ${title}`;
  rect.x = implAbsX + regionX - 4;
  rect.y = implAbsY + regionY - 4;
  rect.resize(regionWidth + 8, regionHeight + 8);
  rect.fills = [{ type: 'SOLID', color, opacity: 0.1 }];
  rect.strokes = [{ type: 'SOLID', color }];
  rect.strokeWeight = 2;
  rect.dashPattern = [6, 3];
  rect.cornerRadius = 3;

  figma.viewport.scrollAndZoomIntoView([rect]);
  figma.notify(`Marked: ${title}`);
  figma.ui.postMessage({ type: 'mark-region-complete', regionX, regionY });
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
    issueFrame.strokes = [{ type: 'SOLID', color: SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info }];
    issueFrame.layoutSizingHorizontal = 'FILL';

    const issueSeverity = figma.createText();
    issueSeverity.fontName = { family: 'Inter', style: 'Bold' };
    issueSeverity.characters = `[${issue.severity.toUpperCase()}] ${issue.category.toUpperCase()}`;
    issueSeverity.fontSize = 10;
    issueSeverity.fills = [{ type: 'SOLID', color: SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info }];
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

  figma.viewport.scrollAndZoomIntoView([annotationFrame]);
  figma.notify(`${issues.length}개 어노테이션 생성 완료.`, { timeout: 5000 });
  figma.ui.postMessage({ type: 'export-complete', format: 'figma' });
}
