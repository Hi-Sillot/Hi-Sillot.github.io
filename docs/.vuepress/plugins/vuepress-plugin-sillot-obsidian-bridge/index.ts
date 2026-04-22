import type { Plugin, App, Page } from "@vuepress/core";
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { LABEL_MAP, BANNER_MAP, VSCODE_SVG, CEDOSS_MAP } from "../vuepress-plugin-sillot-inline/shared/component-data";
import { BuildLogger } from "../build-logger";

const TAG = "vuepress-plugin-sillot-obsidian-bridge";
const logger = new BuildLogger(TAG);

export default (): Plugin => {
  logger.log("插件加载成功");
  return {
    name: TAG,

    async onGenerated(app: App) {
      const outputDir = path.join(app.dir.dest(), "obsidian-bridge");
      await fsp.mkdir(outputDir, { recursive: true });

      await generatePathMap(app, outputDir);
      await generatePermalinkIndex(app, outputDir);
      await generatePublishStatus(app, outputDir);
      await generateBridgeCss(app, outputDir);
      await generateSyntaxDescriptors(app, outputDir);
      await generateComponentProps(app, outputDir);
      await generateAuthors(app, outputDir);
      await generateInlineComponents(outputDir);
      await generateVersion(outputDir);
      await generateVuepressConfigBundle(app, outputDir);

      logger.log("Bridge 产物已生成:", outputDir);
    },
  };
};

async function writeJSON(filePath: string, data: any) {
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function generatePathMap(app: App, outputDir: string) {
  const entries = app.pages
    .filter((p: Page) => !p.path.startsWith("/404"))
    .map((p: Page) => {
      const vuepressPath = p.path.replace(/[^/]*$/, "");
      const sourceRelPath = p.filePathRelative || "";
      return { vuepressPath, sourceRelPath, title: p.title };
    });

  const dedupedMap = new Map<string, { vuepressPath: string; sourceRelPath: string; title: string }>();
  for (const entry of entries) {
    if (!dedupedMap.has(entry.vuepressPath)) {
      dedupedMap.set(entry.vuepressPath, entry);
    }
  }

  await writeJSON(path.join(outputDir, "path-map.json"), {
    version: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
    entries: Array.from(dedupedMap.values()),
  });
}

async function generatePermalinkIndex(app: App, outputDir: string) {
  const entries: { permalink: string; filePath: string; title: string; collection: string }[] = [];

  for (const page of app.pages) {
    if (page.path.startsWith("/404")) continue;

    const frontmatter = page.frontmatter as { permalink?: string };
    const permalink = frontmatter.permalink || page.path;
    const filePath = page.filePathRelative || "";

    if (!filePath) continue;

    entries.push({
      permalink,
      filePath,
      title: page.title || "",
      collection: extractCollection(filePath),
    });
  }

  await writeJSON(path.join(outputDir, "permalink-index.json"), {
    version: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
    count: entries.length,
    entries,
  });
}

function extractCollection(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length > 1 ? parts[0] : "";
}

async function generatePublishStatus(app: App, outputDir: string) {
  const statusMap: Record<string, { mtime: number; hash: string; publishId?: string }> = {};
  const publishIdIndex: Record<string, string> = {};
  const sourceDir = app.dir.source();

  for (const page of app.pages) {
    if (page.path.startsWith("/404")) continue;

    const filePath = page.filePathRelative || "";
    if (!filePath) continue;

    const fullPath = path.join(sourceDir, filePath);
    try {
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const hash = hashContent(content);
      const publishId = extractFrontmatterField(content, "publishId");
      const entry: { mtime: number; hash: string; publishId?: string } = { mtime: stat.mtimeMs, hash };
      if (publishId) {
        entry.publishId = publishId;
        publishIdIndex[publishId] = filePath;
      }
      statusMap[filePath] = entry;
    } catch {
      statusMap[filePath] = { mtime: Date.now(), hash: "" };
    }
  }

  await writeJSON(path.join(outputDir, "publish-status.json"), {
    version: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
    count: Object.keys(statusMap).length,
    entries: statusMap,
    publishIdIndex,
  });
}

function extractFrontmatterField(content: string, field: string): string | null {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return null;
  const endIdx = lines.indexOf("---", 1);
  if (endIdx === -1) return null;

  for (let i = 1; i < endIdx; i++) {
    const line = lines[i];
    if (line.startsWith(`${field}:`) || line.startsWith(`${field} :`)) {
      const value = line.substring(line.indexOf(":") + 1).trim().replace(/^['"]|['"]$/g, "");
      return value || null;
    }
  }
  return null;
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

async function generateBridgeCss(app: App, outputDir: string) {
  const cssDir = path.join(app.dir.dest(), "assets");
  const cssVars = new Map<string, string>();

  try {
    const files = await fsp.readdir(cssDir);
    const cssFiles = files.filter((f: string) => f.endsWith(".css"));

    for (const file of cssFiles) {
      const content = await fsp.readFile(path.join(cssDir, file), "utf-8");
      const varRegex = /--([\w-]+)\s*:\s*([^;{}]+)/g;
      let match;
      while ((match = varRegex.exec(content)) !== null) {
        const varName = `--${match[1]}`;
        const varValue = match[2].trim();
        if (varName.startsWith("--vp-") && !cssVars.has(varName)) {
          cssVars.set(varName, varValue);
        }
      }
    }
  } catch {
    logger.warn("无法读取 CSS 产物，生成空桥接文件");
  }

  const vpToObsidian: Record<string, string> = {
    "--vp-c-brand-1": "var(--interactive-accent)",
    "--vp-c-brand-2": "var(--interactive-accent-hover)",
    "--vp-c-brand-3": "var(--interactive-accent)",
    "--vp-c-bg": "var(--background-primary)",
    "--vp-c-bg-soft": "var(--background-secondary)",
    "--vp-c-bg-mute": "var(--background-secondary-alt)",
    "--vp-c-text-1": "var(--text-normal)",
    "--vp-c-text-2": "var(--text-muted)",
    "--vp-c-text-3": "var(--text-faint)",
    "--vp-c-border": "var(--background-modifier-border)",
    "--vp-c-divider": "var(--background-modifier-border-hover)",
    "--vp-c-danger-1": "var(--text-error)",
    "--vp-c-warning-1": "var(--text-warning)",
    "--vp-c-success-1": "var(--text-success)",
  };

  let css = "/* Auto-generated by vuepress-plugin-sillot-obsidian-bridge */\n";
  css += "/* VuePress CSS variables → Obsidian CSS variables mapping */\n\n";
  css += ":root {\n";
  for (const [vpVar, obsVar] of Object.entries(vpToObsidian)) {
    css += `  ${vpVar}: ${obsVar};\n`;
  }
  css += "}\n\n";

  css += "/* VuePress original CSS variable values (extracted from build) */\n";
  css += "body.theme-light {\n";
  for (const [varName, varValue] of cssVars) {
    if (!varName.startsWith("--vp-c-brand") && !vpToObsidian[varName]) {
      css += `  ${varName}: ${varValue};\n`;
    }
  }
  css += "}\n";

  await fsp.writeFile(path.join(outputDir, "bridge-vars.css"), css, "utf-8");
}

async function generateSyntaxDescriptors(app: App, outputDir: string) {
  const syntaxes = [
    {
      id: "container-info",
      pattern: "^::: info[\\s\\S]*?^:::",
      handler: "containerProcessor",
      fallbackRender: "div.hint-container.hint-container-info",
      props: { type: "info" },
    },
    {
      id: "container-tip",
      pattern: "^::: tip[\\s\\S]*?^:::",
      handler: "containerProcessor",
      fallbackRender: "div.hint-container.hint-container-tip",
      props: { type: "tip" },
    },
    {
      id: "container-warning",
      pattern: "^::: warning[\\s\\S]*?^:::",
      handler: "containerProcessor",
      fallbackRender: "div.hint-container.hint-container-warning",
      props: { type: "warning" },
    },
    {
      id: "container-danger",
      pattern: "^::: danger[\\s\\S]*?^:::",
      handler: "containerProcessor",
      fallbackRender: "div.hint-container.hint-container-danger",
      props: { type: "danger" },
    },
    {
      id: "container-details",
      pattern: "^::: details[\\s\\S]*?^:::",
      handler: "detailsProcessor",
      fallbackRender: "details.hint-container.hint-container-details",
      props: { type: "details" },
    },
    {
      id: "tabs",
      pattern: "^::: tabs[\\s\\S]*?^:::",
      handler: "tabsProcessor",
      fallbackRender: "div.vp-tabs",
    },
    {
      id: "code-tabs",
      pattern: "^::: code-tabs[\\s\\S]*?^:::",
      handler: "codeTabsProcessor",
      fallbackRender: "div.vp-code-tabs",
    },
    {
      id: "cedoss",
      pattern: "^::: cedoss[\\s\\S]*?^:::",
      handler: "cedossProcessor",
      fallbackRender: "div.sillot-cedoss",
    },
    {
      id: "video-tabs",
      pattern: "<!--\\s*sillot-video-tabs[\\s\\S]*?-->",
      handler: "videoTabsProcessor",
      fallbackRender: "div.sillot-video-tabs",
    },
    {
      id: "github-label",
      pattern: "<GithubLabel[^>]*>",
      handler: "githubLabelProcessor",
      fallbackRender: "span.sillot-github-label",
    },
    {
      id: "vscode-settings-link",
      pattern: "<VSCodeSettingsLink[^>]*>",
      handler: "vscodeSettingsLinkProcessor",
      fallbackRender: "a.sillot-vscode-link",
    },
  ];

  await writeJSON(path.join(outputDir, "syntax-descriptors.json"), {
    version: "1.0.0",
    syntaxes,
  });
}

async function generateComponentProps(app: App, outputDir: string) {
  const components = [
    {
      name: "GithubLabel",
      tag: "<GithubLabel",
      props: [
        { name: "name", type: "string", required: true, description: "标签简写名称" },
      ],
      fallback: {
        tag: "span",
        class: "IssueLabel hx_IssueLabel IssueLabel--big lh-condensed js-label-link d-inline-block v-align-middle",
        styleFrom: "name",
      },
    },
    {
      name: "VSCodeSettingsLink",
      tag: "<VSCodeSettingsLink",
      props: [
        { name: "id", type: "string", required: true, description: "VSCode 设置项 ID" },
      ],
      fallback: {
        tag: "a",
        class: "vscode-settings-link inline",
        hrefPrefix: "vscode://settings/",
        hrefFrom: "id",
      },
    },
    {
      name: "BannerTopArchived",
      tag: "<BannerTopArchived",
      props: [],
      fallback: {
        tag: "div",
        class: "sillot-banner-archived",
        staticContent: "📦 此项目已归档",
      },
    },
    {
      name: "WebsiteCard",
      tag: "<WebsiteCard",
      props: [
        { name: "url", type: "string", required: true, description: "网站 URL" },
        { name: "title", type: "string", required: false, description: "网站标题" },
        { name: "desc", type: "string", required: false, description: "网站描述" },
      ],
      fallback: {
        tag: "a",
        class: "sillot-website-card",
        hrefFrom: "url",
      },
    },
    {
      name: "DirectoryLevel",
      tag: "<DirectoryLevel",
      props: [],
      fallback: {
        tag: "div",
        class: "sillot-directory-level",
      },
    },
    {
      name: "IndexMe",
      tag: "<IndexMe",
      props: [],
      fallback: {
        tag: "div",
        class: "sillot-index-me",
      },
    },
    {
      name: "C",
      tag: "<C",
      props: [
        { name: "id", type: "string", required: true, description: "Cedoss 组件 ID" },
      ],
      fallback: {
        tag: "span",
        class: "sillot-cedoss-ref",
        contentFrom: "id",
      },
    },
  ];

  await writeJSON(path.join(outputDir, "component-props.json"), {
    version: "1.0.0",
    components,
  });
}

async function generateAuthors(app: App, outputDir: string) {
  const authorMap = new Map<string, { name: string; slug: string; avatar?: string; verified?: boolean }>();

  for (const page of app.pages) {
    const frontmatter = page.frontmatter as { author?: unknown };
    if (!frontmatter.author) continue;

    const authors = Array.isArray(frontmatter.author) ? frontmatter.author : [frontmatter.author];
    for (const a of authors) {
      if (typeof a !== "object" || a === null) continue;
      const author = a as { name: string; slug?: string; avatar?: string; verified?: boolean };
      if (!author.name) continue;
      const slug = author.slug || author.name.toLowerCase().replace(/\s+/g, "-");
      if (!authorMap.has(slug)) {
        authorMap.set(slug, {
          name: author.name,
          slug,
          avatar: author.avatar,
          verified: author.verified,
        });
      }
    }
  }

  await writeJSON(path.join(outputDir, "authors.json"), {
    version: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
    authors: Object.fromEntries(authorMap),
  });
}

async function generateVersion(outputDir: string) {
  await writeJSON(path.join(outputDir, "version.json"), {
    version: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
    buildTime: new Date().toISOString(),
    pluginVersion: "1.0.0",
  });
}

async function generateInlineComponents(outputDir: string) {
  await writeJSON(path.join(outputDir, "inline-components.json"), {
    version: "1.0.0",
    labels: LABEL_MAP,
    banners: BANNER_MAP,
    vscodeSvg: VSCODE_SVG,
    cedossMap: CEDOSS_MAP,
  });
}

interface ConfigFileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  content?: string;
  children?: ConfigFileEntry[];
}

async function generateVuepressConfigBundle(app: App, outputDir: string) {
  const vuepressDir = path.join(app.dir.source(), ".vuepress");
  const excludePatterns = ["node_modules", ".cache", ".temp", "dist", "plugins", "components", "layouts", "styles", "utils", "modules"];

  const entries: ConfigFileEntry[] = [];

  try {
    const items = await fsp.readdir(vuepressDir, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith(".") || excludePatterns.includes(item.name)) continue;
      if (!item.isFile()) continue;

      const ext = path.extname(item.name);
      if ([".ts", ".js", ".json", ".yaml", ".yml"].includes(ext)) {
        const itemFullPath = path.join(vuepressDir, item.name);
        const stat = await fsp.stat(itemFullPath);
        const content = await fsp.readFile(itemFullPath, "utf-8");
        entries.push({
          name: item.name,
          path: item.name,
          type: "file",
          size: stat.size,
          content,
        });
      }
    }
  } catch (err) {
    logger.warn(`无法读取目录 ${vuepressDir}: ${err}`);
  }

  const bundle = {
    version: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14),
    buildTime: new Date().toISOString(),
    docsRepo: "Hi-Sillot/Hi-Sillot.github.io",
    docsBranch: "main",
    vuepressDir: ".vuepress",
    files: entries,
  };

  await writeJSON(path.join(outputDir, "vuepress-config-bundle.json"), bundle);
  logger.log(`VuePress 配置包已生成，共 ${entries.length} 个配置项`);
}
