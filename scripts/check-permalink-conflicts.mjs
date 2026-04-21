import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline';

const DOCS_DIR = join(import.meta.dirname, '..', 'docs');
const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

function extractPermalink(filePath) {
	try {
		const content = readFileSync(filePath, 'utf-8');
		const lines = content.split(/\r?\n/);
		if (lines[0] !== '---') return null;
		const endIdx = lines.indexOf('---', 1);
		if (endIdx === -1) return null;
		const fmLines = lines.slice(1, endIdx);
		const pl = fmLines.find(l => l.startsWith('permalink:'));
		if (!pl) return null;
		return pl.replace(/^permalink:\s*/, '').trim();
	} catch {
		return null;
	}
}

function removePermalink(filePath) {
	const content = readFileSync(filePath, 'utf-8');
	const lines = content.split(/\r?\n/);
	if (lines[0] !== '---') return false;
	const endIdx = lines.indexOf('---', 1);
	if (endIdx === -1) return false;

	const newLines = [];
	for (let i = 0; i < lines.length; i++) {
		if (i > 0 && i < endIdx && lines[i].startsWith('permalink:')) continue;
		newLines.push(lines[i]);
	}

	writeFileSync(filePath, newLines.join('\n'), 'utf-8');
	return true;
}

function getPublishDirs() {
	try {
		const collectionsPath = join(DOCS_DIR, '.vuepress', 'collections.ts');
		const content = readFileSync(collectionsPath, 'utf-8');
		const dirs = [];
		const blocks = content.split(/defineCollection\s*\(\s*\{/);
		for (const block of blocks) {
			const dirMatch = block.match(/dir:\s*'([^']+)'/);
			const linkMatch = block.match(/linkPrefix:\s*'([^']+)'/);
			if (dirMatch && linkMatch && linkMatch[1] === '/publish') {
				dirs.push(dirMatch[1]);
			}
		}
		return dirs;
	} catch {
		return [];
	}
}

function getAllMdFiles(dir) {
	const results = [];
	if (!existsSync(dir)) return results;

	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			if (entry === '.vuepress' || entry === 'node_modules') continue;
			results.push(...getAllMdFiles(fullPath));
		} else if (entry.endsWith('.md')) {
			results.push(fullPath);
		}
	}
	return results;
}

function findPermalinkConflicts() {
	const publishDirs = getPublishDirs();
	const allFiles = getAllMdFiles(DOCS_DIR);
	const permalinkMap = new Map();

	for (const filePath of allFiles) {
		const permalink = extractPermalink(filePath);
		if (!permalink) continue;

		const relPath = relative(DOCS_DIR, filePath).replace(/\\/g, '/');
		const isPublishDir = publishDirs.some(d => relPath.startsWith(d));

		const entries = permalinkMap.get(permalink) || [];
		entries.push({ permalink, filePath, isPublishDir });
		permalinkMap.set(permalink, entries);
	}

	const conflicts = new Map();
	for (const [permalink, entries] of permalinkMap) {
		if (entries.length > 1) {
			conflicts.set(permalink, entries);
		}
	}
	return conflicts;
}

function prompt(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

async function resolveConflictsInteractively(conflicts) {
	const actions = [];

	for (const [permalink, entries] of conflicts) {
		console.log(`\n${'='.repeat(60)}`);
		console.log(`冲突 permalink: ${permalink}`);
		console.log(`${'='.repeat(60)}`);

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const relPath = relative(DOCS_DIR, entry.filePath);
			const tag = entry.isPublishDir ? '[发布目录]' : '[正式目录]';
			console.log(`  ${i + 1}. ${tag} ${relPath}`);
		}

		console.log('\n选项:');
		console.log('  r - 去掉发布目录中重复文件的 permalink (推荐，构建时会自动重新生成)');
		console.log('  d - 删除发布目录中的重复文件');
		console.log('  k - 保留所有文件 (可能导致构建失败)');
		console.log('  s - 跳过此冲突');

		const answer = await prompt('\n请选择 (r/d/k/s): ');

		if (answer === 'r' || answer === '') {
			for (const entry of entries) {
				if (entry.isPublishDir) {
					actions.push({ type: 'remove-permalink', filePath: entry.filePath });
					console.log(`  将去掉 permalink: ${relative(DOCS_DIR, entry.filePath)}`);
				}
			}
		} else if (answer === 'd') {
			for (const entry of entries) {
				if (entry.isPublishDir) {
					actions.push({ type: 'delete', filePath: entry.filePath });
					console.log(`  将删除: ${relative(DOCS_DIR, entry.filePath)}`);
				}
			}
		} else if (answer === 'k') {
			console.log('  保留所有文件，构建可能会失败。');
		} else {
			console.log('  跳过。');
		}
	}

	return actions;
}

function resolveConflictsForCI(conflicts) {
	const actions = [];

	for (const [permalink, entries] of conflicts) {
		const publishEntries = entries.filter(e => e.isPublishDir);
		if (publishEntries.length > 0) {
			for (const entry of publishEntries) {
				actions.push({ type: 'remove-permalink', filePath: entry.filePath });
				console.log(`[CI] 去掉发布目录中重复文件的 permalink: ${relative(DOCS_DIR, entry.filePath)} (permalink: ${permalink})`);
			}
		} else {
			console.warn(`[CI] 警告: permalink ${permalink} 存在冲突但均不在发布目录中，去掉后续文件的 permalink`);
			for (let i = 1; i < entries.length; i++) {
				actions.push({ type: 'remove-permalink', filePath: entries[i].filePath });
				console.log(`[CI] 去掉重复文件的 permalink: ${relative(DOCS_DIR, entries[i].filePath)}`);
			}
		}
	}

	return actions;
}

async function main() {
	console.log('检查 permalink 冲突...');
	const conflicts = findPermalinkConflicts();

	if (conflicts.size === 0) {
		console.log('未发现 permalink 冲突。');
		return;
	}

	console.log(`发现 ${conflicts.size} 个 permalink 冲突！`);

	let actions;

	if (IS_CI) {
		actions = resolveConflictsForCI(conflicts);
	} else {
		actions = await resolveConflictsInteractively(conflicts);
	}

	if (actions.length > 0) {
		const deleteActions = actions.filter(a => a.type === 'delete');
		const removePlActions = actions.filter(a => a.type === 'remove-permalink');

		if (deleteActions.length > 0) {
			console.log(`\n将删除 ${deleteActions.length} 个文件:`);
			for (const a of deleteActions) {
				console.log(`  - ${relative(DOCS_DIR, a.filePath)}`);
			}
		}

		if (removePlActions.length > 0) {
			console.log(`\n将去掉 ${removePlActions.length} 个文件的 permalink:`);
			for (const a of removePlActions) {
				console.log(`  - ${relative(DOCS_DIR, a.filePath)}`);
			}
		}

		if (!IS_CI) {
			const confirm = await prompt('\n确认执行? (y/N): ');
			if (confirm !== 'y') {
				console.log('已取消。');
				return;
			}
		}

		for (const a of deleteActions) {
			unlinkSync(a.filePath);
			console.log(`已删除: ${relative(DOCS_DIR, a.filePath)}`);
		}

		for (const a of removePlActions) {
			removePermalink(a.filePath);
			console.log(`已去掉 permalink: ${relative(DOCS_DIR, a.filePath)}`);
		}
	}
}

main().catch(err => {
	console.error('检查 permalink 冲突时出错:', err);
	process.exit(1);
});
