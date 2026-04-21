// composables/useEventHandlers.ts - 事件处理

import * as d3 from "d3";
import type { Node, MapLink, MousePosition, CanvasSize } from "../../types/";
import { CANVAS_CONFIG } from "../../constants";

/**
 * 事件处理器
 */
export class EventHandlers {
  private canvas: HTMLCanvasElement;
  private simulation: d3.Simulation<Node, MapLink>;
  private transform: d3.ZoomTransform;
  private nodes: Node[];
  private links: MapLink[];
  private canvasSize: CanvasSize;
  
  private isDragging = false;
  private draggingNode: Node | null = null;
  private mouseDownTime = 0;
  private mouseDownPosition: MousePosition = { x: 0, y: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    simulation: d3.Simulation<Node, MapLink>,
    transform: d3.ZoomTransform,
    nodes: Node[],
    links: MapLink[],
    canvasSize: CanvasSize
  ) {
    this.canvas = canvas;
    this.simulation = simulation;
    this.transform = transform;
    this.nodes = nodes;
    this.links = links;
    this.canvasSize = canvasSize;
  }

  setTransform(transform: d3.ZoomTransform): void {
    this.transform = transform;
  }

  filterZoomEvent(event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>): boolean {
    const sourceEvent = event.sourceEvent || event;

    if (sourceEvent.type === "touchstart") {
      const touch = sourceEvent.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left - this.transform.x) / this.transform.k;
      const y = (touch.clientY - rect.top - this.transform.y) / this.transform.k;
      const node = this.simulation.find(x, y, CANVAS_CONFIG.nodeClickRadius);
      return !node;
    }

    if (sourceEvent.type === "mousedown") {
      const [x, y] = this.transform.invert(d3.pointer(sourceEvent, this.canvas));
      return !this.isMouseOverNode(x, y) && !this.draggingNode;
    }

    return true;
  }

  onMouseDown(event: MouseEvent | TouchEvent): void {
    if (event.type === "touchstart") {
      event.preventDefault();
    }

    const point = (event as TouchEvent).touches
      ? (event as TouchEvent).touches[0]
      : (event as MouseEvent);
    const [x, y] = this.transform.invert(d3.pointer(point, this.canvas));
    const foundNode = this.simulation.find(x, y, CANVAS_CONFIG.nodeClickRadius);
    this.draggingNode = foundNode ?? null;

    this.mouseDownTime = Date.now();
    this.mouseDownPosition = { x: point.clientX, y: point.clientY };

    if (this.draggingNode) {
      event.stopPropagation();
      document.body.style.userSelect = "none";
      this.draggingNode.fx = x;
      this.draggingNode.fy = y;
      this.simulation.alphaTarget(0.3).restart();

      if ((event as TouchEvent).touches) {
        window.addEventListener("touchmove", this.onMouseMove.bind(this), { passive: false });
        window.addEventListener("touchend", this.onMouseUp.bind(this));
      } else {
        window.addEventListener("mousemove", this.onMouseMove.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
      }
    }
  }

  private onMouseMove(event: MouseEvent | TouchEvent): void {
    if (!this.draggingNode) return;

    let point: MouseEvent | Touch;
    if (event instanceof TouchEvent) {
      point = event.touches[0];
    } else {
      point = event;
    }

    if (!point) return;

    const moveDistance = Math.sqrt(
      Math.pow(point.clientX - this.mouseDownPosition.x, 2) +
      Math.pow(point.clientY - this.mouseDownPosition.y, 2)
    );

    if (moveDistance > 5) {
      this.isDragging = true;
      const rect = this.canvas.getBoundingClientRect();
      const x = (point.clientX - rect.left - this.transform.x) / this.transform.k;
      const y = (point.clientY - rect.top - this.transform.y) / this.transform.k;

      const boundedPosition = this.getBoundedPosition(x, y);
      this.updateDraggingNodePosition(boundedPosition);
      this.simulation.alphaTarget(0.3);
    }
    event.preventDefault();
  }

  private onMouseUp(event: MouseEvent | TouchEvent): void {
    if (this.draggingNode) {
      this.draggingNode.fx = null;
      this.draggingNode.fy = null;
      document.body.style.userSelect = "";
      this.draggingNode = null;
      this.simulation.alphaTarget(0).alpha(0.3);

      if (event instanceof TouchEvent) {
        window.removeEventListener("touchmove", this.onMouseMove.bind(this));
        window.removeEventListener("touchend", this.onMouseUp.bind(this));
      } else {
        window.removeEventListener("mousemove", this.onMouseMove.bind(this));
        window.removeEventListener("mouseup", this.onMouseUp.bind(this));
      }
    }
  }

  private isMouseOverNode(x: number, y: number): boolean {
    return this.nodes.some((node) => {
      const dx = node.x! - x;
      const dy = node.y! - y;
      return Math.sqrt(dx * dx + dy * dy) < CANVAS_CONFIG.nodeClickRadius;
    });
  }

  private getBoundedPosition(x: number, y: number): { x: number; y: number } {
    const bounds = {
      left: -this.transform.x / this.transform.k,
      top: -this.transform.y / this.transform.k,
      right: (this.canvasSize.width - this.transform.x) / this.transform.k,
      bottom: (this.canvasSize.height - this.transform.y) / this.transform.k,
    };

    return {
      x: Math.max(
        bounds.left + CANVAS_CONFIG.nodePadding,
        Math.min(bounds.right - CANVAS_CONFIG.nodePadding, x)
      ),
      y: Math.max(
        bounds.top + CANVAS_CONFIG.nodePadding,
        Math.min(bounds.bottom - CANVAS_CONFIG.nodePadding, y)
      ),
    };
  }

  private updateDraggingNodePosition({ x, y }: { x: number; y: number }): void {
    if (this.draggingNode) {
      this.draggingNode.x = x;
      this.draggingNode.y = y;
      this.draggingNode.fx = x;
      this.draggingNode.fy = y;
    }
  }
}