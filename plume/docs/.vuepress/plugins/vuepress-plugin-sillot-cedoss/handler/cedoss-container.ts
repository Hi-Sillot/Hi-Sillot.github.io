// handler/cedoss-container.ts
import type { Markdown } from "vuepress/markdown";

export interface CedossContainerOptions {
  debug?: boolean;
  removeContainerMarkers?: boolean;
}

/**
 * 修复嵌套容器问题的处理器
 */
export function createFixedCedossContainerHandler(
  options: CedossContainerOptions = {},
) {
  const {
    debug = false,
    removeContainerMarkers = true,
  } = options;

  return (md: Markdown) => {
    md.core.ruler.after("normalize", "fixed-cedoss-container", (state) => {
      if (debug) {
        console.log(
          `[CedossContainer] 开始修复版本处理，原文长度: ${state.src.length}`,
        );
      }

      // 使用迭代方法处理嵌套容器
      let processedSrc = state.src;
      let previousSrc = "";
      let iteration = 0;
      const maxIterations = 10; // 防止无限循环

      // 匹配最内层的容器（不包含其他容器的容器）
      const innermostContainerRegex =
        /(^|\n)(:{3,})\s*cedoss\s*\n((?:(?!:{3,}\s*cedoss)[\s\S])*?)\n\2(?=\n|$)/g;

      while (processedSrc !== previousSrc && iteration < maxIterations) {
        previousSrc = processedSrc;
        iteration++;

        processedSrc = processedSrc.replace(
          innermostContainerRegex,
          (match, lineStart, colons, content) => {
            if (debug) {
              console.log(
                `[CedossContainer] 迭代 ${iteration}，处理容器，内容长度: ${content.length}`,
              );
            }

            // 处理内容中的 [[testid]] 语法
            const processedContent = content.replace(
              /\[\[([^\]]+)\]\]/g,
              (_: any, id: string) => `<C id="${id.trim()}"/>`,
            );

            if (removeContainerMarkers) {
              // 移除容器标记，只保留处理后的内容
              return lineStart + processedContent;
            } else {
              // 保留容器标记
              return lineStart + colons + " cedoss\n" + processedContent +
                "\n" + colons;
            }
          },
        );

        if (debug && processedSrc !== previousSrc) {
          console.log(
            `[CedossContainer] 迭代 ${iteration} 处理了容器，新长度: ${processedSrc.length}`,
          );
        }
      }

      if (debug) {
        console.log(`[CedossContainer] 处理完成，总共迭代 ${iteration} 次`);
      }

      state.src = processedSrc;
      return true;
    });
  };
}

/**
 * 使用栈处理嵌套容器的版本
 */
export function createStackBasedCedossContainerHandler(
  options: CedossContainerOptions = {},
) {
  const {
    debug = false,
    removeContainerMarkers = true,
  } = options;

  return (md: Markdown) => {
    md.core.ruler.after("normalize", "stack-cedoss-container", (state) => {
      if (debug) {
        console.log(
          `[CedossContainer] 开始栈式处理，原文长度: ${state.src.length}`,
        );
      }

      // 使用栈来处理嵌套容器
      const lines = state.src.split("\n");
      const stack: { lineIndex: number; colonCount: number }[] = []; // 存储容器开始行的索引和冒号数量
      const processedLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 检查是否是容器开始
        const startMatch = line.match(/^\s*({:3,})\s*cedoss\s*$/);
        if (startMatch) {
          const colonCount = startMatch[1].length;
          stack.push({ lineIndex: i, colonCount });
          processedLines.push(line);
          if (debug) {
            console.log(
              `[CedossContainer] 找到容器开始，冒号数量: ${colonCount}，行: ${i}`,
            );
          }
          continue;
        }

        // 检查是否是容器结束
        const endMatch = line.match(/^\s*({:3,})\s*$/);
        if (endMatch && stack.length > 0) {
          const colonCount = endMatch[1].length;
          const startInfo = stack[stack.length - 1];

          // 检查结束标记的冒号数量是否与开始标记匹配
          if (colonCount === startInfo.colonCount) {
            stack.pop();

            if (debug) {
              console.log(
                `[CedossContainer] 找到匹配的容器结束，冒号数量: ${colonCount}，匹配开始行: ${startInfo.lineIndex}`,
              );
            }

            // 处理容器内容
            const containerContent = processedLines.slice(
              startInfo.lineIndex + 1,
            );
            const processedContent = containerContent.join("\n").replace(
              /\[\[([^\]]+)\]\]/g,
              (_, id) => `<C id="${id.trim()}"/>`,
            );

            // 替换容器内容
            processedLines.splice(
              startInfo.lineIndex + 1,
              containerContent.length,
            );

            if (removeContainerMarkers) {
              // 移除容器标记，只保留处理后的内容
              processedLines.splice(startInfo.lineIndex, 1); // 移除开始标记
              processedLines.push(...processedContent.split("\n"));
            } else {
              // 保留容器标记
              processedLines.push(...processedContent.split("\n"));
              processedLines.push(line); // 添加结束标记
            }

            continue;
          }
        }

        processedLines.push(line);
      }

      state.src = processedLines.join("\n");

      if (debug) {
        console.log(
          `[CedossContainer] 栈式处理完成，新文长度: ${state.src.length}`,
        );
      }

      return true;
    });
  };
}

/**
 * 主导出函数 - 使用修复版本
 */
export function handleCedossContainer(
  md: Markdown,
  options: CedossContainerOptions = {},
) {
  const { debug = false } = options;

  if (debug) {
    console.log(`[CedossContainer] 初始化修复处理器，选项:`, options);
  }

  // 使用修复版本
  const fixedHandler = createFixedCedossContainerHandler(options);
  fixedHandler(md);
}
