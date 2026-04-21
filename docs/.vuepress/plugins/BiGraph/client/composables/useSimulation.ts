// composables/useSimulation.ts - 力导向图模拟

import * as d3 from "d3";
import { ref, computed } from "vue";
import type { Node, MapLink, MapNodeLink, CanvasSize } from "../../types";
import { FORCE_CONFIG } from "../../constants";

const TAG = "useSimulation";

/**
 * 力导向图模拟管理
 */
export function useSimulation(canvasSize: CanvasSize, data: MapNodeLink) {
  const simulation = ref<d3.Simulation<Node, MapLink> | null>(null);

  const isStable = ref(false); // 跟踪模拟是否稳定

  /**
   * 初始化力模拟 - 修复配置应用
   */
  function initializeSimulation(nodes: Node[], links: MapLink[]): d3.Simulation<Node, MapLink> {
    console.log(TAG, "开始初始化力模拟", {
      节点数: nodes.length,
      链接数: links.length,
      画布中心: { x: canvasSize.width / 2, y: canvasSize.height / 2 }
    });

    // 创建力模拟
    const sim = d3.forceSimulation<Node>(nodes);
    
    // 配置链接力
    const linkForce = d3.forceLink<Node, MapLink>(links)
      .id(d => d.id)
      .distance(FORCE_CONFIG.link.distance)
      .strength(FORCE_CONFIG.link.strength);
    
    // 配置电荷力（节点排斥）
    const chargeForce = d3.forceManyBody<Node>()
      .strength(FORCE_CONFIG.charge.strength)
      .distanceMin(FORCE_CONFIG.charge.distanceMin)
      .distanceMax(FORCE_CONFIG.charge.distanceMax);
    
    // 配置碰撞力
    const collisionForce = d3.forceCollide<Node>()
      .radius(FORCE_CONFIG.collision.radius)
      .strength(FORCE_CONFIG.collision.strength);
    
    // 配置X轴力
    const xForce = d3.forceX(canvasSize.width / 2)
      .strength(FORCE_CONFIG.x_strength);
    
    // 配置Y轴力
    const yForce = d3.forceY(canvasSize.height / 2)
      .strength(FORCE_CONFIG.y_strength);

    // 应用所有力
    sim
      .force("link", linkForce)
      .force("charge", chargeForce)
      .force("collision", collisionForce)
      .force("x", xForce)
      .force("y", yForce)
      .alphaDecay(FORCE_CONFIG.simulation.alphaDecay)
      .alphaMin(FORCE_CONFIG.simulation.alphaMin)
      .velocityDecay(FORCE_CONFIG.simulation.velocityDecay);

    // 添加模拟状态跟踪
    sim.on("tick", () => {
      // 检查模拟是否稳定（alpha值很低）
      if (sim.alpha() < FORCE_CONFIG.simulation.alphaMin * 2 && !isStable.value) {
        isStable.value = true;
        console.log(TAG, "力模拟已稳定", { alpha: sim.alpha() });
      }
    });

    console.log(TAG, "力模拟初始化完成", {
      配置: {
        链接距离: FORCE_CONFIG.link.distance,
        电荷力: FORCE_CONFIG.charge.strength,
        碰撞半径: FORCE_CONFIG.collision.radius,
        alpha衰减: FORCE_CONFIG.simulation.alphaDecay
      }
    });

    return sim;
  }


  /**
   * 重启模拟
   */
  function restartSimulation(): void {
    // if (isStable.value === false) return // 不稳定不需要重启
    console.log(TAG, "重启模拟", isStable.value);
    if (simulation.value) {
      simulation.value
        .alpha(FORCE_CONFIG.simulation.restart.alpha)
        .alphaTarget(FORCE_CONFIG.simulation.restart.alphaTarget)
        .restart();
    }
  }

  function updateForces(): void {
    if (!simulation.value) return;
    console.log(TAG, "updateForces");

    // 配置X轴力
    const xForce = d3.forceX(canvasSize.width / 2)
      .strength(FORCE_CONFIG.x_strength);
    
    // 配置Y轴力
    const yForce = d3.forceY(canvasSize.height / 2)
      .strength(FORCE_CONFIG.y_strength);

    simulation.value
      // .force("center", centerForce)
      .force("x", xForce)
      .force("y", yForce);
  }

  return {
    simulation,
    initializeSimulation,
    restartSimulation,
    updateForces,
  };
}