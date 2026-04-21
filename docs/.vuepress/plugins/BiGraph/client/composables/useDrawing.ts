// composables/useDrawing.ts - 绘制逻辑

import type { Node, MapLink, ThemeColors, CanvasSize } from "../../types";
import { CANVAS_CONFIG, STYLE_CONFIG } from "../../constants";

/**
 * 绘制管理器
 */
export class DrawingManager {
  private context: CanvasRenderingContext2D;
  private transform: any;
  private hoveredNode: Node | null = null;
  private themeColors: ThemeColors;
  private showLabels: boolean; // 新增：控制标签显示

  constructor(
    context: CanvasRenderingContext2D,
    themeColors: ThemeColors,
    transform: any,
    showLabels: boolean = true,
  ) {
    this.context = context;
    this.themeColors = themeColors;
    this.transform = transform;
    this.showLabels = showLabels;
  }


    /**
   * 设置标签显示状态并触发重绘
   */
  setLabelsVisibility(visible: boolean): void {
    this.showLabels = visible;
  }

  setHoveredNode(node: Node | null): void {
    this.hoveredNode = node;
  }

  setTransform(transform: any): void {
    this.transform = transform;
  }

  clearCanvas(canvasSize: CanvasSize): void {
    this.context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  }

  applyTransform(): void {
    this.context.save();
    this.context.translate(this.transform.x, this.transform.y);
    this.context.scale(this.transform.k, this.transform.k);
  }

  restoreTransform(): void {
    this.context.restore();
  }

  drawLinks(links: MapLink[]): void {
    const { accent } = this.themeColors;

    links.forEach((link) => {
      this.context.beginPath();
      this.drawLink(link);

      if (
        this.hoveredNode &&
        (link.source === this.hoveredNode || link.target === this.hoveredNode)
      ) {
        this.context.strokeStyle = accent;
        this.context.globalAlpha = STYLE_CONFIG.link.highlightOpacity;
      } else {
        this.context.strokeStyle = STYLE_CONFIG.link.color;
        this.context.globalAlpha = this.hoveredNode
          ? STYLE_CONFIG.link.normalOpacity
          : STYLE_CONFIG.link.highlightOpacity;
      }

      this.context.stroke();
    });
    this.context.globalAlpha = 1;
  }

  drawNodes(nodes: Node[]): void {
    const { accent, text } = this.themeColors;
    const connectedNodes = this.getConnectedNodes();

    this.drawNormalNodes(nodes, text, connectedNodes);
    this.drawConnectedNodes(nodes, text, connectedNodes);
    this.drawHoveredNode(accent);
    this.drawCurrentNode(nodes, accent, connectedNodes);
  }

  drawLabels(nodes: Node[]): void {
    // 如果不显示标签，直接返回
    if (!this.showLabels) return;
    this.context.font = STYLE_CONFIG.text.font;
    const { text } = this.themeColors;
    const connectedNodes = this.getConnectedNodes();

    nodes.forEach((node) => {
      const opacity = this.calculateTextOpacity(node, connectedNodes);
      if (opacity > 0) {
        this.drawNodeLabel(node, text, opacity);
      }
    });
  }

  private drawLink(d: MapLink): void {
    const source = typeof d.source === "string" ? this.findNodeById(d.source) : d.source;
    const target = typeof d.target === "string" ? this.findNodeById(d.target) : d.target;
    
    if (!source || !target) return;
    
    this.context.moveTo(source.x!, source.y!);
    this.context.lineTo(target.x!, target.y!);
  }

  private drawNormalNodes(nodes: Node[], textColor: string, connectedNodes: Set<Node>): void {
    this.context.beginPath();
    nodes
      .filter((d) => !d.isCurrent && d !== this.hoveredNode)
      .forEach((d) => {
        this.drawNode(d, CANVAS_CONFIG.nodeRadius);
      });
    this.context.fillStyle = textColor;
    this.context.globalAlpha = this.hoveredNode
      ? STYLE_CONFIG.node.normalOpacity
      : STYLE_CONFIG.node.highlightOpacity;
    this.context.fill();
  }

  private drawConnectedNodes(nodes: Node[], textColor: string, connectedNodes: Set<Node>): void {
    if (!this.hoveredNode) return;

    this.context.beginPath();
    Array.from(connectedNodes).forEach((d) => {
      if (!d.isCurrent) {
        this.drawNode(d, CANVAS_CONFIG.nodeRadius);
      }
    });
    this.context.fillStyle = textColor;
    this.context.globalAlpha = STYLE_CONFIG.node.highlightOpacity;
    this.context.fill();
  }

  private drawHoveredNode(accentColor: string): void {
    if (this.hoveredNode && !this.hoveredNode.isCurrent) {
      this.context.beginPath();
      this.drawNode(this.hoveredNode, CANVAS_CONFIG.hoverNodeRadius);
      this.context.fillStyle = accentColor;
      this.context.globalAlpha = STYLE_CONFIG.node.highlightOpacity;
      this.context.fill();
    }
  }

  private drawCurrentNode(nodes: Node[], accentColor: string, connectedNodes: Set<Node>): void {
    const currentNode = nodes.find((d) => d.isCurrent);
    if (currentNode) {
      this.context.beginPath();
      this.drawNode(
        currentNode,
        currentNode === this.hoveredNode
          ? CANVAS_CONFIG.hoverNodeRadius
          : CANVAS_CONFIG.nodeRadius
      );
      this.context.fillStyle = accentColor;
      this.context.globalAlpha =
        this.hoveredNode &&
        currentNode !== this.hoveredNode &&
        !connectedNodes.has(currentNode)
          ? STYLE_CONFIG.node.normalOpacity
          : STYLE_CONFIG.node.highlightOpacity;
      this.context.fill();
    }
  }

  private drawNode(d: Node, baseRadius: number): void {
    const linkCountBonus = Math.max(0, d.linkCount - 1) * 0.4;
    const radius = baseRadius + linkCountBonus;
    this.context.moveTo(d.x! + radius, d.y!);
    this.context.arc(d.x!, d.y!, radius, 0, 2 * Math.PI);
  }

  private drawNodeLabel(node: Node, textColor: string, opacity: number): void {
    const visualNodeRadius = CANVAS_CONFIG.nodeRadius + Math.max(0, node.linkCount - 1) * 0.4;
    const textWidth = this.context.measureText(node.value.title).width;
    
    this.context.fillStyle = textColor;
    this.context.globalAlpha = opacity;
    this.context.fillText(
      node.value.title,
      node.x! - textWidth / 2,
      node.y! + STYLE_CONFIG.text.offset + visualNodeRadius
    );
    this.context.globalAlpha = 1;
  }

  private getConnectedNodes(): Set<Node> {
    const connectedNodes = new Set<Node>();
    if (!this.hoveredNode) return connectedNodes;

    // 这里需要访问完整的links数据，需要在外部传入
    return connectedNodes;
  }

  private calculateTextOpacity(node: Node, connectedNodes: Set<Node>): number {
    if (this.transform.k <= STYLE_CONFIG.text.minScale) return 0;

    let opacity = Math.min(
      (this.transform.k - STYLE_CONFIG.text.minScale) /
        (STYLE_CONFIG.text.maxScale - STYLE_CONFIG.text.minScale),
      1
    );

    if (this.hoveredNode) {
      if (node === this.hoveredNode || connectedNodes.has(node)) {
        // 保持原透明度
      } else {
        opacity *= STYLE_CONFIG.node.normalOpacity;
      }
    }

    return opacity;
  }

  private findNodeById(id: string): Node | undefined {
    // 这里需要访问完整的nodes数据，需要在外部传入
    console.warn("findNodeById 尚未实现")
    return undefined;
  }
}