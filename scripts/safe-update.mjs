import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "../package.json");

/**
 * 受保护包列表 - 这些包禁止降级，且自动升级到最新 rc
 * key: 包名, value: 当前最低允许版本（脚本会自动查询并升级到最新 rc）
 */
const PROTECTED_PACKAGES = {
  vuepress: "2.0.0-rc.26",
  "@vuepress/bundler-vite": "2.0.0-rc.26",
  "@vuepress/plugin-comment": "2.0.0-rc.120",
  "@vuepress/plugin-links-check": "2.0.0-rc.120",
  "@vuepress/plugin-llms": "2.0.0-rc.120",
  "@vuepress/plugin-revealjs": "2.0.0-rc.120",
  "@vuepress/plugin-slimsearch": "2.0.0-rc.120",
  vue: "3.5.25",
  "vuepress-theme-plume": "1.0.0-rc.181",
};

/**
 * 比较两个 semver 版本
 * 返回正数表示 a > b，负数表示 a < b，0 表示相等
 * 注意：预发布版本（如 rc）优先级低于同版本的正式版
 */
function compareSemver(a, b) {
  const parseVersion = (v) => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) return null;
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      prerelease: match[4] || null,
    };
  };

  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return 0;

  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;

  // 正式版 > 预发布版（semver 规范）
  if (!va.prerelease && vb.prerelease) return 1;
  if (va.prerelease && !vb.prerelease) return -1;
  if (!va.prerelease && !vb.prerelease) return 0;

  // 两个都是预发布版，按字符串比较
  return va.prerelease.localeCompare(vb.prerelease);
}

/**
 * 判断是否为降级操作
 */
function isDowngrade(minVersion, newVersion) {
  return compareSemver(newVersion, minVersion) < 0;
}

/**
 * 从 npm registry 获取包的所有版本
 */
function getAllVersions(packageName) {
  try {
    const output = execSync(`npm view ${packageName} versions --json`, {
      encoding: "utf-8",
      timeout: 15000,
    });
    return JSON.parse(output);
  } catch {
    return [];
  }
}

/**
 * 获取指定 major.minor 范围内的最新 rc 版本
 */
function getLatestRcInRange(packageName, currentVersion) {
  const match = currentVersion.match(/^(\d+)\.(\d+)/);
  if (!match) return null;
  const [, major, minor] = match;

  const versions = getAllVersions(packageName);
  const rcVersions = versions.filter((v) => {
    const vMatch = v.match(/^(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/);
    if (!vMatch) return false;
    return vMatch[1] === major && vMatch[2] === minor;
  });

  if (rcVersions.length === 0) return null;
  return rcVersions[rcVersions.length - 1];
}

/**
 * 获取非 rc 包的最新正式版本（用于 vue 等非 rc 包）
 */
function getLatestStableVersion(packageName, currentVersion) {
  const match = currentVersion.match(/^(\d+)\.(\d+)/);
  if (!match) return null;
  const [, major, minor] = match;

  const versions = getAllVersions(packageName);
  const stableVersions = versions.filter((v) => {
    const vMatch = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!vMatch) return false;
    return vMatch[1] === major && vMatch[2] === minor;
  });

  if (stableVersions.length === 0) return null;
  return stableVersions[stableVersions.length - 1];
}

// 读取当前 package.json
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

console.log("🔒 安全更新模式启动\n");
console.log("📋 受保护包列表：");
Object.entries(PROTECTED_PACKAGES).forEach(([name, version]) => {
  console.log(`   ${name} >= ${version}`);
});
console.log();

// ========== 第一步：查询受保护包的最新版本并自动升级 ==========
console.log("📡 查询受保护包的最新版本...\n");

const upgradePlan = [];

for (const [name, minVersion] of Object.entries(PROTECTED_PACKAGES)) {
  const currentInPkg = pkg.devDependencies?.[name] || pkg.dependencies?.[name];
  const currentClean = (currentInPkg || minVersion).replace(/^[\^~]/, "");

  let latestVersion = null;

  if (currentClean.includes("-rc.")) {
    latestVersion = getLatestRcInRange(name, currentClean);
  } else {
    latestVersion = getLatestStableVersion(name, currentClean);
  }

  if (latestVersion && latestVersion !== currentClean) {
    console.log(`   🆕 ${name}: ${currentClean} → ${latestVersion}`);
    upgradePlan.push({ name, current: currentClean, latest: latestVersion });
  } else if (latestVersion === currentClean) {
    console.log(`   ✅ ${name}: ${currentClean} (已是最新)`);
  } else {
    console.log(`   ⚠️ ${name}: ${currentClean} (无法查询最新版本)`);
  }
}

// 应用升级到 package.json
if (upgradePlan.length > 0) {
  console.log(`\n⬆️ 将升级 ${upgradePlan.length} 个受保护包...\n`);

  for (const { name, latest } of upgradePlan) {
    if (pkg.devDependencies?.[name] !== undefined) {
      pkg.devDependencies[name] = latest;
      console.log(`   📝 devDependencies.${name} = ${latest}`);
    } else if (pkg.dependencies?.[name] !== undefined) {
      pkg.dependencies[name] = latest;
      console.log(`   📝 dependencies.${name} = ${latest}`);
    }
  }

  // 同步更新 overrides 中对应的版本
  if (pkg.overrides) {
    for (const { name, latest } of upgradePlan) {
      if (pkg.overrides[name] !== undefined) {
        pkg.overrides[name] = latest;
        console.log(`   📝 overrides.${name} = ${latest}`);
      }
    }
  }

  // 同步更新 PROTECTED_PACKAGES 中的最低版本记录
  for (const { name, latest } of upgradePlan) {
    PROTECTED_PACKAGES[name] = latest;
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log("\n✅ package.json 已更新");
}

// ========== 第二步：执行 bun update 更新非受保护的包 ==========
console.log("\n🔄 执行 bun update（更新非受保护包）...\n");
try {
  execSync("bun update", { stdio: "inherit" });
  console.log("\n✅ bun update 完成");
} catch {
  console.log("\n⚠️ bun update 执行出错");
}

// ========== 第三步：验证受保护包没有被 bun 降级 ==========
const updatedPkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
let hasFixes = false;

console.log("\n🔍 验证受保护包版本完整性...\n");

for (const [name, minVersion] of Object.entries(PROTECTED_PACKAGES)) {
  const currentVersion =
    updatedPkg.devDependencies?.[name] || updatedPkg.dependencies?.[name];

  if (!currentVersion) {
    console.log(`   ❌ ${name}: 缺失！恢复为 ${minVersion}`);
    if (updatedPkg.devDependencies?.[name] !== undefined) {
      updatedPkg.devDependencies[name] = minVersion;
    } else {
      updatedPkg.dependencies[name] = minVersion;
    }
    hasFixes = true;
    continue;
  }

  const cleanVersion = currentVersion.replace(/^[\^~]/, "");

  if (isDowngrade(minVersion, cleanVersion)) {
    console.log(
      `   ⚠️ ${name}: ${minVersion} → ${cleanVersion} (降级！已恢复为 ${minVersion})`
    );
    if (updatedPkg.devDependencies?.[name] !== undefined) {
      updatedPkg.devDependencies[name] = minVersion;
    } else {
      updatedPkg.dependencies[name] = minVersion;
    }
    hasFixes = true;
  } else {
    console.log(`   ✅ ${name}: ${cleanVersion}`);
  }
}

// 同步 overrides 防降级
if (updatedPkg.overrides) {
  for (const key of Object.keys(updatedPkg.overrides)) {
    if (PROTECTED_PACKAGES[key]) {
      const overrideVersion = updatedPkg.overrides[key].replace(/^[\^~]/, "");
      if (isDowngrade(PROTECTED_PACKAGES[key], overrideVersion)) {
        console.log(
          `   ⚠️ overrides.${key}: ${PROTECTED_PACKAGES[key]} → ${overrideVersion} (已恢复)`
        );
        updatedPkg.overrides[key] = PROTECTED_PACKAGES[key];
        hasFixes = true;
      }
    }
  }
}

if (hasFixes) {
  writeFileSync(pkgPath, JSON.stringify(updatedPkg, null, 2) + "\n", "utf-8");
  console.log("\n📝 package.json 已修复，重新安装依赖...");
  try {
    execSync("bun install", { stdio: "inherit" });
    console.log("\n✅ 依赖重新安装完成");
  } catch {
    console.log("\n❌ 依赖重新安装失败，请手动运行 bun install");
  }
} else if (upgradePlan.length > 0) {
  // 有升级但没有降级修复，也需要重新安装
  console.log("\n📦 安装升级后的依赖...");
  try {
    execSync("bun install", { stdio: "inherit" });
    console.log("\n✅ 依赖安装完成");
  } catch {
    console.log("\n❌ 依赖安装失败，请手动运行 bun install");
  }
} else {
  console.log("\n✅ 所有受保护包版本正常，无需修复");
}

console.log("\n🎉 安全更新完成！");
