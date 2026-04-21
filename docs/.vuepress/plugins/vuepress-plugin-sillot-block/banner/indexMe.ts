import type { App, Page, Plugin } from "@vuepress/core";
import { path } from "@vuepress/utils";
import { createPage } from "vuepress/core";

let TAG = "vuepress-plugin-sillot-block";

// 目录节点接口
export interface DirectoryNode {
  name: string;
  path: string;
  type: "file" | "directory";
  title?: string;
  children?: DirectoryNode[];
  parent?: string;
}

// 目录索引数据接口
export interface DirectoryIndex {
  [path: string]: DirectoryNode;
}

export async function initIndexMe(app: App) {
  console.log(TAG, "开始生成目录索引数据...");

  // 构建完整的目录树
  const directoryTree = buildDirectoryTree(app.pages);

  // 将树形结构转换为扁平化的索引数据
  const directoryIndex = flattenDirectoryTree(directoryTree);

  // 写入TS格式的临时文件
  await app.writeTemp(
    "directory-index.ts",
    `import type { DirectoryIndex } from '../plugins/vuepress-plugin-sillot-block/banner/indexMe';\n` +
      `export default ${
        JSON.stringify(directoryIndex, null, 2)
      } as DirectoryIndex;\n` +
      `export const directoryTree = ${JSON.stringify(directoryTree, null, 2)};`,
  );

  console.log(TAG, "目录索引数据已写入临时文件");
  console.log(TAG, `共索引 ${Object.keys(directoryIndex).length} 个目录/文件`);
}

/**
 * 构建目录树
 */
function buildDirectoryTree(pages: Page[]): DirectoryNode {
  // 根节点
  const root: DirectoryNode = {
    name: "root",
    path: "/",
    type: "directory",
    children: [],
  };

  // 处理每个页面
  pages.forEach((page) => {
    const pagePath = page.path;

    // 跳过一些特殊页面
    if (pagePath.startsWith("/404") || pagePath.startsWith("/404.html")) {
      return;
    }

    // 规范化路径：确保目录路径以斜杠结尾
    let normalizedPath = pagePath;
    if (normalizedPath.endsWith(".html")) {
      normalizedPath = normalizedPath.replace(/\.html$/, "");
    }

    // 对于索引页（如 /guide/），确保路径以斜杠结尾
    const isIndexPage = normalizedPath.endsWith("/") ||
      page.frontmatter.layout === "Layout" &&
        !normalizedPath.includes(".");

    if (isIndexPage && !normalizedPath.endsWith("/")) {
      normalizedPath += "/";
    }

    // 将路径分割为部分
    const pathParts = normalizedPath.split("/").filter((part) =>
      part && part !== "index"
    );

    let currentNode = root;
    let currentPath = "/";

    // 遍历路径的每个部分
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isLastPart = i === pathParts.length - 1;

      // 构建当前路径，确保目录路径以斜杠结尾
      if (isLastPart) {
        // 最后一部分：如果是目录索引页，添加斜杠
        const shouldBeDirectory = isIndexPage && i === pathParts.length - 1;
        currentPath = path.join(currentPath, part) +
          (shouldBeDirectory ? "/" : "");
      } else {
        currentPath = path.join(currentPath, part) + "/";
      }

      // 确定节点类型
      const nodeType = (isLastPart && !isIndexPage) ? "file" : "directory";

      // 查找是否已存在该节点
      let childNode = currentNode.children?.find((child) =>
        child.name === part && child.type === nodeType
      );

      if (!childNode) {
        // 创建新节点
        childNode = {
          name: part,
          path: currentPath,
          type: nodeType,
          title: isLastPart ? page.title : part,
          children: nodeType === "directory" ? [] : undefined,
          parent: currentNode.path,
        };

        if (!currentNode.children) {
          currentNode.children = [];
        }
        currentNode.children.push(childNode);
      } else if (isLastPart) {
        // 更新文件节点的标题
        childNode.title = page.title;
      }

      // 移动到子节点（对于目录）
      if (childNode.type === "directory") {
        currentNode = childNode;
      }
    }
  });

  // 对目录进行排序
  sortDirectoryTree(root);

  return root;
}

/**
 * 对目录树进行排序（目录在前，文件在后，按名称排序）
 */
function sortDirectoryTree(node: DirectoryNode): void {
  if (!node.children) return;

  // 分离目录和文件
  const directories: DirectoryNode[] = [];
  const files: DirectoryNode[] = [];

  node.children.forEach((child) => {
    if (child.type === "directory") {
      directories.push(child);
      // 递归排序子目录
      sortDirectoryTree(child);
    } else {
      files.push(child);
    }
  });

  // 分别排序
  directories.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  // 合并：目录在前，文件在后
  node.children = [...directories, ...files];
}

/**
 * 将树形结构扁平化为索引
 */
function flattenDirectoryTree(root: DirectoryNode): DirectoryIndex {
  const index: DirectoryIndex = {};

  function traverse(node: DirectoryNode) {
    index[node.path] = node;

    if (node.children) {
      node.children.forEach((child) => traverse(child));
    }
  }

  traverse(root);
  return index;
}
