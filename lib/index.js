import z from "schemastery";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
/** Kebab-case skill name grammar the harness accepts. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
* Whether a string is a valid kebab-case skill name.
* @param name - candidate skill name.
* @returns whether the name matches the harness grammar.
*/
function isSkillName(name) {
	return SKILL_NAME.test(name);
}
/**
* Whether one absolute path lies inside a root directory (or is that root).
* @param root - absolute root directory.
* @param path - absolute path to test.
* @returns whether the path is the root itself or one of its descendants.
*/
function isInside(root, path) {
	const child = relative(root, path);
	if (child.length === 0) return true;
	return child !== ".." && !child.startsWith(`..${sep}`);
}
/**
* Scan every managed root for skill documents.
* @param roots - managed roots in report order.
* @param signal - caller cancellation.
* @returns one parsed entry per discovered document.
*/
async function scanRoots(roots, signal) {
	const scanned = [];
	for (const root of roots) {
		signal?.throwIfAborted();
		scanned.push(...await scanRoot(root, signal));
	}
	return scanned;
}
/**
* Scan one managed root for skill documents.
* @param root - the root to scan; a missing directory yields no entries.
* @param signal - caller cancellation.
* @returns parsed entries for this root in name order.
*/
async function scanRoot(root, signal) {
	const scanned = [];
	for (const entry of await listRootEntries(root.path, signal)) {
		signal?.throwIfAborted();
		const path = entry.kind === "directory" ? join(entry.path, "SKILL.md") : entry.path;
		const content = await readText(path, signal);
		if (content === void 0) continue;
		scanned.push(parseEntry({
			root,
			path,
			fallback: entry.name,
			content
		}));
	}
	return scanned;
}
/**
* Read one skill document and its concurrency token.
* @param path - absolute document path.
* @param signal - caller cancellation.
* @returns the document text and version, or `undefined` when it is absent.
*/
async function readDocument(path, signal) {
	const content = await readText(path, signal);
	return content === void 0 ? void 0 : {
		content,
		version: documentVersion(content)
	};
}
/**
* Content-addressed freshness token for one document.
* @param content - complete document text.
* @returns stable hex digest of the content.
*/
function documentVersion(content) {
	return createHash("sha256").update(content, "utf8").digest("hex");
}
/**
* Parse one document's frontmatter without rejecting the entry.
* @param content - complete document text.
* @returns the parsed frontmatter (absent when the document has none) and the body, or the parse error.
*/
function parseSkillDocument(content) {
	const normalized = content.startsWith("﻿") ? content.slice(1) : content;
	const firstLineEnd = normalized.indexOf("\n");
	if (firstLineEnd < 0 || normalized.slice(0, firstLineEnd).replace(/\r$/, "") !== "---") return {
		kind: "parsed",
		data: void 0,
		body: normalized
	};
	const end = findFrontmatterEnd(normalized, firstLineEnd + 1);
	if (end === void 0) return {
		kind: "unusable",
		error: "frontmatter has no closing \"---\" line"
	};
	let parsed;
	try {
		parsed = parse(normalized.slice(firstLineEnd + 1, end.fenceStart));
	} catch (error) {
		return {
			kind: "unusable",
			error: `frontmatter is not valid YAML: ${String(error)}`
		};
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {
		kind: "unusable",
		error: "frontmatter must be a YAML object"
	};
	return {
		kind: "parsed",
		data: parsed,
		body: normalized.slice(end.bodyStart)
	};
}
/**
* Derive a kebab-case skill name from a file or directory name.
* @param value - the entry name, with or without a `.md` extension.
* @returns a valid skill name, or `undefined` when nothing usable remains.
*/
function skillNameFromEntry(value) {
	const candidate = stripMarkdownExtension(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	return isSkillName(candidate) ? candidate : void 0;
}
/**
* Derive a routing description from the first meaningful line of a body.
* @param body - document body without frontmatter.
* @returns one trimmed line, truncated to a routing-sized description.
*/
function descriptionFromBody(body) {
	for (const line of body.split("\n")) {
		const text = line.replace(/^[\s>*#-]+/, "").trim();
		if (text.length === 0) continue;
		return text.length > 400 ? `${text.slice(0, 399)}…` : text;
	}
	return "";
}
async function listRootEntries(root, signal) {
	let dirents;
	try {
		dirents = await readdir(root, {
			withFileTypes: true,
			encoding: "utf8"
		});
	} catch (error) {
		if (isAbsentPathError$1(error)) return [];
		throw error;
	}
	signal?.throwIfAborted();
	const entries = [];
	for (const dirent of [...dirents].sort((left, right) => left.name.localeCompare(right.name))) {
		if (dirent.name.startsWith(".")) continue;
		const path = join(root, dirent.name);
		const kind = await entryKind(path, dirent, signal);
		if (kind !== void 0) entries.push({
			name: dirent.name,
			path,
			kind
		});
	}
	return entries;
}
async function entryKind(path, dirent, signal) {
	if (dirent.isDirectory()) return "directory";
	if (dirent.isFile()) return markdownKind(path);
	if (!dirent.isSymbolicLink()) return void 0;
	try {
		const info = await stat(path);
		signal?.throwIfAborted();
		if (info.isDirectory()) return "directory";
		return info.isFile() ? markdownKind(path) : void 0;
	} catch {
		return;
	}
}
function markdownKind(path) {
	return path.toLowerCase().endsWith(".md") ? "file" : void 0;
}
function parseEntry(input) {
	const document = parseSkillDocument(input.content);
	const base = {
		source: input.root.source,
		rank: input.root.rank,
		root: input.root.path,
		path: input.path
	};
	if (document.kind === "unusable") return {
		...base,
		name: fallbackName(input.fallback),
		description: "",
		state: "invalid",
		error: document.error,
		invocation: FULL_INVOCATION
	};
	const invocation = invocationPolicy(document.data);
	const name = stringField$2(document.data, "name");
	if (name === void 0 || !isSkillName(name)) return {
		...base,
		name: fallbackName(input.fallback),
		description: stringField$2(document.data, "description") ?? "",
		state: "invalid",
		error: name === void 0 ? "frontmatter requires a kebab-case \"name\"" : `frontmatter name "${name}" is not kebab-case`,
		invocation
	};
	const description = stringField$2(document.data, "description");
	if (description === void 0) return {
		...base,
		name,
		description: "",
		state: "invalid",
		error: "frontmatter requires a non-empty \"description\"",
		invocation
	};
	return {
		...base,
		name,
		description,
		state: "ready",
		invocation
	};
}
function fallbackName(fallback) {
	return skillNameFromEntry(fallback) ?? fallback;
}
/** Invocation controls used for an entry whose frontmatter could not be read at all. */
const FULL_INVOCATION = {
	modelInvocable: true,
	userInvocable: true
};
/** Values the harness reads as `true` for the invocation keys. */
const TRUE_FLAGS = /* @__PURE__ */ new Set([
	true,
	1,
	"1",
	"true",
	"yes",
	"on"
]);
/** Values the harness reads as `false` for the invocation keys. */
const FALSE_FLAGS = /* @__PURE__ */ new Set([
	false,
	0,
	"0",
	"false",
	"no",
	"off"
]);
function invocationPolicy(data) {
	return {
		modelInvocable: flagValue(data?.["disable-model-invocation"]) !== true,
		userInvocable: flagValue(data?.["user-invocable"]) !== false
	};
}
function flagValue(value) {
	const normalized = typeof value === "string" ? value.toLowerCase() : value;
	if (TRUE_FLAGS.has(normalized)) return true;
	if (FALSE_FLAGS.has(normalized)) return false;
}
function findFrontmatterEnd(raw, start) {
	let lineStart = start;
	while (true) {
		const newline = raw.indexOf("\n", lineStart);
		if (newline < 0) return raw.slice(lineStart).replace(/\r$/, "") === "---" ? {
			fenceStart: lineStart,
			bodyStart: raw.length
		} : void 0;
		if (raw.slice(lineStart, newline).replace(/\r$/, "") === "---") return {
			fenceStart: lineStart,
			bodyStart: newline + 1
		};
		lineStart = newline + 1;
	}
}
async function readText(path, signal) {
	try {
		const content = await readFile(path, {
			encoding: "utf8",
			signal
		});
		signal?.throwIfAborted();
		return content;
	} catch (error) {
		signal?.throwIfAborted();
		if (isAbsentPathError$1(error)) return void 0;
		throw error;
	}
}
function stringField$2(data, key) {
	const value = data?.[key];
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function stripMarkdownExtension(value) {
	return value.toLowerCase().endsWith(".md") ? value.slice(0, -3) : value;
}
function isAbsentPathError$1(error) {
	return hasCode(error, "ENOENT") || hasCode(error, "ENOTDIR");
}
function hasCode(error, code) {
	return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
//#endregion
//#region lib/types/documents.js
/**
* Skill document editing: normalize an uploaded or downloaded document into a
* writable `SKILL.md`, replace one document atomically, and switch the
* harness's invocation keys on and off.
*
* Enablement is the one operation this plugin performs on files the user owns,
* because a standalone plugin has no catalog filter to hide a skill with. It
* writes only the two invocation keys the harness already understands and
* records their previous values in the ledger, so enabling restores the
* document's own settings.
*
* @module dsh-plugin-skill-manager/documents
*/
/** Frontmatter keys that switch a skill off. */
const DISABLE_KEY = "disable-model-invocation";
const USER_KEY = "user-invocable";
/**
* Normalize one input document into a writable skill bundle.
*
* A document that already carries a kebab-case `name` and a non-empty
* `description` is written verbatim, so installation never rewrites fields it
* does not own. Anything else — a bare Markdown note, or frontmatter missing
* one field — is completed from the entry name and the first body line, with
* every other frontmatter field preserved.
* @param input - the document to normalize.
* @returns the prepared bundle, or the skip reason for an unusable document.
*/
function prepareSkillDocument(input) {
	const document = parseSkillDocument(input.content);
	const fallback = fallbackNameFromPath(input.filename);
	if (document.kind === "unusable") return {
		kind: "invalid",
		name: fallback ?? basename(input.filename),
		reason: "invalid"
	};
	const data = document.data;
	const name = stringField$1(data?.name) ?? fallback;
	if (name === void 0) return {
		kind: "invalid",
		name: basename(input.filename),
		reason: "invalid"
	};
	const description = stringField$1(data?.description) ?? descriptionFromBody(document.body);
	if (description.length === 0) return {
		kind: "invalid",
		name,
		reason: "invalid"
	};
	if (data !== void 0 && stringField$1(data.name) === name && stringField$1(data.description) !== void 0) return {
		kind: "prepared",
		skill: {
			name,
			description,
			content: input.content
		}
	};
	return {
		kind: "prepared",
		skill: {
			name,
			description,
			content: `---\n${stringify({
				...data,
				name,
				description
			}).trimEnd()}\n---\n\n${document.body.trim()}\n`
		}
	};
}
/**
* Rewrite one document's invocation keys, keeping every other field and the body.
* @param content - the document as read.
* @param next - the two invocation keys to set; `null` removes a key.
* @returns the rewritten document text.
* @throws Error when the document has no usable frontmatter block.
*/
function withInvocation(content, next) {
	const document = parseSkillDocument(content);
	if (document.kind === "unusable" || document.data === void 0) throw new Error("the document has no frontmatter block to switch invocation keys in");
	const data = { ...document.data };
	for (const key of [DISABLE_KEY, USER_KEY]) {
		const value = next[key];
		if (value === null) delete data[key];
		else data[key] = value;
	}
	return `---\n${stringify(data).trimEnd()}\n---\n${document.body}`;
}
/**
* The invocation values the ledger must remember for one document.
* @param content - the document as read.
* @param name - skill name used for diagnostics.
* @returns the previous values, or `undefined` when the document is unusable.
*/
function previousInvocation(content) {
	const document = parseSkillDocument(content);
	if (document.kind === "unusable" || document.data === void 0) return void 0;
	return {
		[DISABLE_KEY]: scalarOrNull$1(document.data[DISABLE_KEY]),
		[USER_KEY]: scalarOrNull$1(document.data[USER_KEY])
	};
}
/** The invocation keys that switch a skill back off. */
function disabledInvocation() {
	return {
		[DISABLE_KEY]: true,
		[USER_KEY]: false
	};
}
/**
* The invocation keys that restore one ledger record.
* @param previous - the values recorded at disable time.
* @returns the keys to write back.
*/
function restoredInvocation(previous) {
	return {
		[DISABLE_KEY]: previous[DISABLE_KEY] ?? null,
		[USER_KEY]: previous[USER_KEY] ?? null
	};
}
/**
* Write one prepared skill under a managed root.
* @param root - absolute directory receiving `<name>/SKILL.md`.
* @param skill - the normalized bundle.
* @param overwrite - whether an existing skill directory may be replaced.
* @returns whether the document was written or left alone.
*/
async function installSkill(root, skill, overwrite) {
	const directory = join(root, skill.name);
	const target = join(directory, "SKILL.md");
	if (!overwrite && await pathExists(target)) return "exists";
	await mkdir(directory, { recursive: true });
	await writeTextAtomic(target, skill.content);
	return "installed";
}
/**
* Write one skill bundle: its normalized `SKILL.md` plus the resource files
* that travel beside it.
* @param root - absolute directory receiving `<name>/`.
* @param skill - the normalized bundle.
* @param resources - resource files relative to the skill directory.
* @param overwrite - whether an existing skill directory may be replaced.
* @returns whether the bundle was written or left alone.
* @throws Error when a resource path would leave the skill directory.
*/
async function installBundle(root, skill, resources, overwrite) {
	const directory = join(root, skill.name);
	const target = join(directory, "SKILL.md");
	if (!overwrite && await pathExists(target)) return "exists";
	for (const resource of resources) if (!isInside(directory, join(directory, resource.path))) throw new Error(`bundle resource "${resource.path}" leaves the skill directory`);
	await mkdir(directory, { recursive: true });
	await writeTextAtomic(target, skill.content);
	for (const resource of resources) {
		const path = join(directory, resource.path);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, resource.data);
	}
	return "installed";
}
/**
* Replace one text file through a temporary sibling, so a failed write never
* leaves a half-written skill document.
* @param target - absolute path to replace.
* @param content - complete replacement text.
*/
async function writeTextAtomic(target, content) {
	const temporary = join(dirname(target), `.${basename(target)}.tmp-${process.pid.toString()}`);
	await writeFile(temporary, content, { encoding: "utf8" });
	await rename(temporary, target);
}
async function pathExists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}
function stringField$1(value) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function scalarOrNull$1(value) {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
}
/**
* Derive the fallback skill name from the entry path: a `SKILL.md` bundle is
* named by its containing directory, and any other document by its own file name.
*/
function fallbackNameFromPath(filename) {
	const base = basename(filename);
	return base.toLowerCase() === "skill.md" ? skillNameFromEntry(basename(dirname(filename))) : skillNameFromEntry(base);
}
//#endregion
//#region lib/types/bundles.js
/**
* Turn one archive's files into installable skills.
*
* A skill bundle is a directory holding `SKILL.md` plus whatever resources the
* skill needs, so an archive installs each such directory as one skill and
* keeps its sibling files. The common single top-level directory that
* "Download ZIP" and Finder produce is stripped first, and an archive with no
* `SKILL.md` at all falls back to its Markdown documents.
*
* @module dsh-plugin-skill-manager/bundles
*/
/** The `SKILL.md` file name, case-insensitive in an archive listing. */
const SKILL_FILE = "skill.md";
/**
* Plan one archive's entries as skills.
* @param entries - files read from the archive, in archive order.
* @returns the bundles, the loose documents, and the unusable bundle directories.
*/
function planArchive(entries) {
	const files = stripCommonRoot(entries);
	const skillPaths = files.map((entry) => entry.path).filter((path) => path.toLowerCase() === SKILL_FILE || path.toLowerCase().endsWith(`/${SKILL_FILE}`)).sort((left, right) => directoryOf(left).length - directoryOf(right).length);
	const bundles = [];
	const documents = [];
	const invalid = [];
	const claimed = new Set(skillPaths);
	for (const skillPath of skillPaths) {
		const directory = directoryOf(skillPath);
		const deeper = skillPaths.filter((other) => other !== skillPath && directoryOf(other).startsWith(directory) && directoryOf(other) !== directory);
		const owned = files.filter((entry) => {
			if (!entry.path.startsWith(directory)) return false;
			if (entry.path === skillPath) return true;
			return !deeper.some((otherDirectory) => entry.path.startsWith(otherDirectory));
		});
		const skillFile = owned.find((entry) => entry.path === skillPath);
		/* v8 ignore next -- the path came from this listing, so its own entry is present */
		if (skillFile === void 0) continue;
		const outcome = prepareSkillDocument({
			filename: skillPath,
			content: decode$1(skillFile.data)
		});
		if (outcome.kind === "invalid") {
			invalid.push({
				name: outcome.name,
				reason: "invalid"
			});
			continue;
		}
		bundles.push({
			skill: outcome.skill,
			directory,
			files: owned.filter((entry) => entry.path !== skillPath).map((entry) => ({
				path: entry.path.slice(directory.length),
				data: entry.data
			}))
		});
	}
	for (const entry of files) {
		if (claimed.has(entry.path)) continue;
		if (!entry.path.toLowerCase().endsWith(".md")) continue;
		if (directoryOf(entry.path) !== "") continue;
		documents.push({
			filename: entry.path,
			content: decode$1(entry.data)
		});
	}
	return {
		bundles,
		documents,
		invalid
	};
}
/** The directory prefix (with trailing `/`) that holds one `SKILL.md`, or `''` at the archive root. */
function directoryOf(path) {
	const index = path.lastIndexOf("/");
	return index < 0 ? "" : path.slice(0, index + 1);
}
/**
* Drop the single top-level directory Finder and GitHub wrap archives in, so a
* `my-skills/SKILL.md` layout installs the same skills as a bare `SKILL.md`.
*/
function stripCommonRoot(entries) {
	const roots = new Set(entries.map((entry) => entry.path.split("/", 1)[0] ?? ""));
	if (roots.size !== 1 || entries.some((entry) => !entry.path.includes("/"))) return entries;
	const root = [...roots][0] ?? "";
	return entries.map((entry) => ({
		...entry,
		path: entry.path.slice(root.length + 1)
	}));
}
function decode$1(data) {
	return new TextDecoder("utf-8").decode(data);
}
//#endregion
//#region lib/types/github.js
/**
* GitHub skill import: resolve a repository link to its `SKILL.md` documents.
*
* The import reads the repository's git tree through the public REST API and
* downloads each matching document from `raw.githubusercontent.com`, so a
* repository without a local checkout can still be learned. Only documents
* named `SKILL.md` are considered, matching the directory-bundle convention
* the harness discovers.
*
* @module dsh-plugin-skill-manager/github
*/
const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";
const SEGMENT = /^[A-Za-z0-9._-]+$/;
/** Failure of one GitHub import, reported to the browser as a failed request. */
var GitHubImportError = class extends Error {};
/**
* Parse a GitHub repository link.
* @param url - `https://github.com/<owner>/<repo>` with an optional `/tree/<ref>[/<path>]` suffix.
* @returns the resolved owner, repository, ref, and subdirectory, or `undefined` for an unsupported link.
*/
function parseGitHubUrl(url) {
	let parsed;
	try {
		parsed = new URL(url.trim());
	} catch {
		return;
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return void 0;
	if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") return void 0;
	const segments = parsed.pathname.split("/").filter((segment) => segment.length > 0);
	const owner = segments[0];
	const repository = segments[1];
	if (owner === void 0 || repository === void 0) return void 0;
	if (!SEGMENT.test(owner)) return void 0;
	const repo = repository.endsWith(".git") ? repository.slice(0, -4) : repository;
	if (!SEGMENT.test(repo)) return void 0;
	if (segments.length === 2) return {
		owner,
		repo
	};
	if (segments[2] !== "tree") return void 0;
	const ref = segments[3];
	if (ref === void 0 || ref.length === 0) return void 0;
	const path = segments.slice(4).join("/");
	return {
		owner,
		repo,
		ref,
		...path.length > 0 ? { path } : {}
	};
}
/**
* Download every `SKILL.md` document one repository exposes.
* @param source - parsed repository link.
* @param config - size limits and timeout.
* @param signal - caller cancellation.
* @returns the downloaded documents and the entries that were skipped.
* @throws GitHubImportError when the repository, ref, or download cannot be read.
*/
async function fetchGitHubDocuments(source, config, signal) {
	const lifetime = withTimeout(signal, config.timeoutMs);
	const ref = source.ref ?? await readDefaultBranch(source, lifetime);
	const tree = await readTree(source, ref, lifetime);
	const prefix = source.path === void 0 ? "" : `${source.path.replace(/^\/+|\/+$/g, "")}/`;
	const skills = tree.filter((entry) => entry.type === "blob" && (entry.path === "SKILL.md" || entry.path.endsWith("/SKILL.md")) && entry.path.startsWith(prefix));
	const documents = [];
	const skipped = [];
	for (const entry of skills) {
		if (documents.length >= config.maxFiles) {
			skipped.push({
				name: entry.path,
				reason: "limit"
			});
			continue;
		}
		const content = await readRawDocument(source, ref, entry.path, lifetime);
		if (Buffer.byteLength(content, "utf8") > config.maxDocumentBytes) {
			skipped.push({
				name: entry.path,
				reason: "too-large"
			});
			continue;
		}
		documents.push({
			filename: entry.path,
			content
		});
	}
	return {
		documents,
		skipped
	};
}
async function readDefaultBranch(source, signal) {
	const branch = stringField(await readJson(`${GITHUB_API}/repos/${source.owner}/${source.repo}`, signal), "default_branch");
	if (branch === void 0) throw new GitHubImportError("GitHub repository has no default branch");
	return branch;
}
async function readTree(source, ref, signal) {
	const tree = (await readJson(`${GITHUB_API}/repos/${source.owner}/${source.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, signal))["tree"];
	if (!Array.isArray(tree)) throw new GitHubImportError(`GitHub ref "${ref}" has no readable tree`);
	const entries = [];
	for (const entry of tree) {
		if (entry === null || typeof entry !== "object") continue;
		const path = entry.path;
		const type = entry.type;
		if (typeof path === "string" && typeof type === "string") entries.push({
			path,
			type
		});
	}
	return entries;
}
async function readRawDocument(source, ref, path, signal) {
	const encoded = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
	const response = await fetchWithin(`${GITHUB_RAW}/${source.owner}/${source.repo}/${encodeURIComponent(ref)}/${encoded}`, signal);
	if (!response.ok) throw new GitHubImportError(`GitHub document "${path}" could not be downloaded (${response.status.toString()})`);
	return await response.text();
}
async function readJson(url, signal) {
	const response = await fetchWithin(url, signal);
	if (!response.ok) throw new GitHubImportError(response.status === 404 ? "GitHub repository or ref was not found" : `GitHub request failed with status ${response.status.toString()}`);
	let parsed;
	try {
		parsed = await response.json();
	} catch (error) {
		throw new GitHubImportError(`GitHub response was not JSON: ${String(error)}`);
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new GitHubImportError("GitHub response was not a JSON object");
	return parsed;
}
async function fetchWithin(url, signal) {
	try {
		return await fetch(url, {
			signal,
			headers: {
				accept: "application/vnd.github+json",
				"user-agent": "dsh-plugin-skill-manager",
				"x-github-api-version": "2022-11-28"
			}
		});
	} catch (error) {
		throw new GitHubImportError(`GitHub request failed: ${String(error)}`);
	}
}
/** Combine caller cancellation with the import deadline. */
function withTimeout(signal, timeoutMs) {
	const timeout = AbortSignal.timeout(timeoutMs);
	return signal === void 0 ? timeout : AbortSignal.any([signal, timeout]);
}
function stringField(value, key) {
	const field = value[key];
	return typeof field === "string" && field.length > 0 ? field : void 0;
}
//#endregion
//#region lib/types/zip.js
/**
* Minimal ZIP reader: enough for a skill bundle produced by Finder's
* "Compress", GitHub's "Download ZIP", or `zip -r`.
*
* It reads the central directory (so entries written with a data descriptor
* still report their real sizes), supports the two methods those tools emit —
* stored and deflate — and rejects everything else rather than guessing.
* Traversal-safe by construction: every entry path is normalized and refused
* when it is absolute or contains a `..` segment, so extraction cannot escape
* the directory a caller joins it against.
*
* @module dsh-plugin-skill-manager/zip
*/
const EOCD_SIGNATURE = 101010256;
const CENTRAL_SIGNATURE = 33639248;
const LOCAL_SIGNATURE = 67324752;
const EOCD_MIN_BYTES = 22;
const MAX_COMMENT_BYTES = 65535;
const ZIP64_SENTINEL = 4294967295;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 1;
/** A ZIP that cannot be read within the given bounds. */
var ZipError = class extends Error {};
/**
* Read every file in one ZIP archive.
* @param archive - complete archive bytes.
* @param limits - accepted member count and sizes.
* @returns the archive's files in central-directory order.
* @throws ZipError when the archive is malformed, encoded with an unsupported feature, or over a bound.
*/
function readZip(archive, limits) {
	const eocd = findEndOfCentralDirectory(archive);
	const members = new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint16(eocd + 10, true);
	const directorySize = new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint32(eocd + 12, true);
	const directoryOffset = new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint32(eocd + 16, true);
	if (members > limits.maxMembers) throw new ZipError(`the archive holds ${members.toString()} entries; the limit is ${limits.maxMembers.toString()}`);
	if (directoryOffset + directorySize > archive.byteLength) throw new ZipError("the archive central directory is truncated");
	const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
	const entries = [];
	let total = 0;
	let cursor = directoryOffset;
	for (let index = 0; index < members; index += 1) {
		if (cursor + 46 > archive.byteLength || view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) throw new ZipError("the archive central directory is malformed");
		const flags = view.getUint16(cursor + 8, true);
		const method = view.getUint16(cursor + 10, true);
		const compressedSize = view.getUint32(cursor + 20, true);
		const uncompressedSize = view.getUint32(cursor + 24, true);
		const nameLength = view.getUint16(cursor + 28, true);
		const extraLength = view.getUint16(cursor + 30, true);
		const commentLength = view.getUint16(cursor + 32, true);
		const localOffset = view.getUint32(cursor + 42, true);
		const name = decodeText(archive.subarray(cursor + 46, cursor + 46 + nameLength));
		cursor += 46 + nameLength + extraLength + commentLength;
		if ((flags & FLAG_ENCRYPTED) !== 0) throw new ZipError(`the archive entry "${name}" is encrypted`);
		if (compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL || localOffset === ZIP64_SENTINEL) throw new ZipError(`the archive entry "${name}" uses ZIP64, which this plugin does not read`);
		if (name.endsWith("/")) continue;
		const path = safePath(name);
		if (uncompressedSize > limits.maxEntryBytes) throw new ZipError(`the archive entry "${name}" exceeds ${limits.maxEntryBytes.toString()} bytes`);
		total += uncompressedSize;
		if (total > limits.maxTotalBytes) throw new ZipError(`the archive exceeds ${limits.maxTotalBytes.toString()} uncompressed bytes`);
		entries.push({
			path,
			data: readEntry(archive, view, localOffset, method, compressedSize, uncompressedSize, name)
		});
	}
	return entries;
}
function findEndOfCentralDirectory(archive) {
	if (archive.byteLength < EOCD_MIN_BYTES) throw new ZipError("the file is too small to be a ZIP archive");
	const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
	const earliest = Math.max(0, archive.byteLength - EOCD_MIN_BYTES - MAX_COMMENT_BYTES);
	for (let offset = archive.byteLength - EOCD_MIN_BYTES; offset >= earliest; offset -= 1) if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
	throw new ZipError("the file is not a ZIP archive");
}
function readEntry(archive, view, localOffset, method, compressedSize, uncompressedSize, name) {
	if (localOffset + 30 > archive.byteLength || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new ZipError(`the archive entry "${name}" has no local header`);
	const nameLength = view.getUint16(localOffset + 26, true);
	const extraLength = view.getUint16(localOffset + 28, true);
	const start = localOffset + 30 + nameLength + extraLength;
	const end = start + compressedSize;
	if (end > archive.byteLength) throw new ZipError(`the archive entry "${name}" is truncated`);
	const data = archive.subarray(start, end);
	switch (method) {
		case METHOD_STORED: return data.slice();
		case METHOD_DEFLATE: {
			const inflated = inflateRawSync(data);
			if (inflated.byteLength !== uncompressedSize) throw new ZipError(`the archive entry "${name}" inflated to an unexpected size`);
			return new Uint8Array(inflated);
		}
		default: throw new ZipError(`the archive entry "${name}" uses compression method ${method.toString()}, which this plugin does not read`);
	}
}
/** Normalize one entry path and refuse anything that could escape its directory. */
function safePath(name) {
	const unified = name.replaceAll("\\", "/");
	if (unified.startsWith("/") || /^[A-Za-z]:/.test(unified)) throw new ZipError(`the archive entry "${name}" is an absolute path`);
	const segments = unified.split("/").filter((segment) => segment.length > 0 && segment !== ".");
	if (segments.includes("..")) throw new ZipError(`the archive entry "${name}" leaves the archive root`);
	if (segments.length === 0) throw new ZipError(`the archive entry "${name}" has no file name`);
	return segments.join("/");
}
function decodeText(bytes) {
	return new TextDecoder("utf-8").decode(bytes);
}
//#endregion
//#region lib/types/ledger.js
/**
* Disable ledger: the durable record of every skill this plugin turned off,
* including the frontmatter values it replaced so enabling restores them.
*
* @module dsh-plugin-skill-manager/ledger
*/
/** Current on-disk ledger format. */
const LEDGER_VERSION = 1;
/**
* In-memory view of the disable ledger with whole-file persistence.
*
* The file is read once at construction. A missing file is the normal empty
* state; an unreadable or malformed file is reported and treated as empty
* rather than blocking plugin activation, and the next write replaces it.
*/
var SkillLedger = class {
	file;
	warn;
	records = /* @__PURE__ */ new Map();
	scanAgentsRoot;
	/**
	* @param file - absolute path of the JSON state file.
	* @param warn - sink for a state file that could not be used.
	*/
	constructor(file, warn) {
		this.file = file;
		this.warn = warn;
	}
	/** Absolute path of the backing state file. */
	get path() {
		return this.file;
	}
	/** Read the state file into memory, replacing any previously loaded records. */
	load() {
		this.records.clear();
		this.scanAgentsRoot = void 0;
		let raw;
		try {
			raw = readFileSync(this.file, "utf8");
		} catch (error) {
			if (!isAbsentPathError(error)) this.warn(`skill-manager: state file ${this.file} could not be read: ${String(error)}`);
			return;
		}
		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch (error) {
			this.warn(`skill-manager: state file ${this.file} is not valid JSON: ${String(error)}`);
			return;
		}
		for (const record of readRecords(parsed)) this.records.set(record.name, record);
		this.scanAgentsRoot = readScanAgentsRoot(parsed);
	}
	/**
	* The persisted choice for the shared agents root.
	* @returns the stored choice, or `undefined` when the user never changed it.
	*/
	get scannedAgentsRoot() {
		return this.scanAgentsRoot;
	}
	/**
	* Persist whether the shared agents root is scanned.
	* @param enabled - the choice to store.
	*/
	setScanAgentsRoot(enabled) {
		this.scanAgentsRoot = enabled;
	}
	/**
	* Whether one skill name is currently available to catalogs.
	* @param name - kebab-case skill name.
	* @returns false while the name is recorded as disabled.
	*/
	isEnabled(name) {
		return !this.records.has(name);
	}
	/**
	* The record for one disabled name.
	* @param name - kebab-case skill name.
	* @returns the stored record, or `undefined` when the name is enabled.
	*/
	record(name) {
		return this.records.get(name);
	}
	/** Every disabled record, for display alongside the scanned catalog. */
	disabled() {
		return [...this.records.values()];
	}
	/**
	* Record one skill as disabled.
	* @param record - the entry observed at disable time.
	*/
	disable(record) {
		this.records.set(record.name, record);
	}
	/**
	* Drop one skill's disabled record.
	* @param name - kebab-case skill name.
	*/
	enable(name) {
		this.records.delete(name);
	}
	/** Write the complete ledger, replacing the previous file atomically. */
	async persist() {
		const payload = {
			version: LEDGER_VERSION,
			...this.scanAgentsRoot === void 0 ? {} : { scanAgentsRoot: this.scanAgentsRoot },
			disabled: [...this.records.values()].sort((left, right) => left.name.localeCompare(right.name))
		};
		await mkdir(dirname(this.file), { recursive: true });
		const temporary = `${this.file}.tmp-${process.pid.toString()}`;
		await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });
		await rename(temporary, this.file);
	}
};
function readScanAgentsRoot(parsed) {
	if (parsed === null || typeof parsed !== "object") return void 0;
	const value = parsed.scanAgentsRoot;
	return typeof value === "boolean" ? value : void 0;
}
function readRecords(parsed) {
	if (parsed === null || typeof parsed !== "object") return [];
	const disabled = parsed.disabled;
	if (!Array.isArray(disabled)) return [];
	const records = [];
	for (const entry of disabled) {
		const record = readRecord(entry);
		if (record !== void 0) records.push(record);
	}
	return records;
}
function readRecord(entry) {
	if (entry === null || typeof entry !== "object") return void 0;
	const candidate = entry;
	if (typeof candidate.name !== "string" || candidate.name.length === 0) return void 0;
	const previous = candidate.previous !== null && typeof candidate.previous === "object" ? candidate.previous : {};
	return {
		name: candidate.name,
		source: typeof candidate.source === "string" ? candidate.source : "custom",
		path: typeof candidate.path === "string" ? candidate.path : "",
		disabledAt: typeof candidate.disabledAt === "string" ? candidate.disabledAt : "",
		previous: {
			"disable-model-invocation": scalarOrNull(previous["disable-model-invocation"]),
			"user-invocable": scalarOrNull(previous["user-invocable"])
		}
	};
}
function scalarOrNull(value) {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
}
function isAbsentPathError(error) {
	return typeof error === "object" && error !== null && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}
//#endregion
//#region lib/types/manager.js
/**
* Skill manager core: root resolution, catalog projection, enablement,
* document editing, and installation. Every filesystem decision lives here;
* the HTTP route only decodes a request and encodes the outcome.
*
* @module dsh-plugin-skill-manager/manager
*/
const DEFAULT_GITHUB_MAX_FILES = 20;
const DEFAULT_GITHUB_MAX_DOCUMENT_BYTES = 524288;
const DEFAULT_GITHUB_TIMEOUT_MS = 3e4;
const DEFAULT_UPLOAD_MAX_DOCUMENTS = 20;
const DEFAULT_UPLOAD_MAX_DOCUMENT_BYTES = 524288;
const DEFAULT_ZIP_MAX_BYTES = 52428800;
const DEFAULT_ZIP_MAX_UNCOMPRESSED_BYTES = 209715200;
const DEFAULT_ZIP_MAX_MEMBERS = 2e3;
const DEFAULT_ZIP_MAX_ENTRY_BYTES = 67108864;
/** One failed operation, carrying the stable code the page branches on. */
var SkillManagerError = class extends Error {
	code;
	/**
	* @param code - stable failure code.
	* @param message - human diagnostic.
	*/
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "SkillManagerError";
	}
};
/** Owner of the managed skill catalog and its one write path. */
var SkillManager = class {
	/** Every configured root, including the shared agents root while its scan is off. */
	configuredRoots;
	agentsRoot;
	scanAgentsRootDefault;
	installRoot;
	ledger;
	github;
	uploadMaxDocuments;
	uploadMaxDocumentBytes;
	zipMaxBytes;
	zipLimits;
	/**
	* @param ctx - host context used only for logging.
	* @param config - managed roots, state file, and import bounds.
	*/
	constructor(ctx, config = {}) {
		const dshHome = resolveDshHome(config.dshHome);
		const agentsHome = resolve(config.agentsHome ?? process.env.DSH_AGENTS_HOME ?? join(homedir(), ".agents"));
		this.agentsRoot = {
			path: join(agentsHome, "skills"),
			source: "user-agents",
			rank: 500
		};
		this.configuredRoots = [
			{
				path: join(dshHome, "skills"),
				source: "user-dsh",
				rank: 400
			},
			this.agentsRoot,
			...(config.extraRoots ?? []).map((root) => ({
				path: resolve(root.path),
				source: root.source,
				rank: root.rank
			}))
		];
		this.scanAgentsRootDefault = config.includeAgentsRoot ?? false;
		this.installRoot = resolve(config.installRoot ?? join(dshHome, "skills"));
		this.ledger = new SkillLedger(resolve(config.stateFile ?? join(dshHome, "skill-manager.json")), (message) => {
			ctx.logger.warn(message);
		});
		this.ledger.load();
		this.github = {
			maxFiles: positive("githubMaxFiles", config.githubMaxFiles, DEFAULT_GITHUB_MAX_FILES),
			maxDocumentBytes: positive("githubMaxDocumentBytes", config.githubMaxDocumentBytes, DEFAULT_GITHUB_MAX_DOCUMENT_BYTES),
			timeoutMs: positive("githubTimeoutMs", config.githubTimeoutMs, DEFAULT_GITHUB_TIMEOUT_MS)
		};
		this.uploadMaxDocuments = positive("uploadMaxDocuments", config.uploadMaxDocuments, DEFAULT_UPLOAD_MAX_DOCUMENTS);
		this.uploadMaxDocumentBytes = positive("uploadMaxDocumentBytes", config.uploadMaxDocumentBytes, DEFAULT_UPLOAD_MAX_DOCUMENT_BYTES);
		this.zipMaxBytes = positive("zipMaxBytes", config.zipMaxBytes, DEFAULT_ZIP_MAX_BYTES);
		this.zipLimits = {
			maxMembers: positive("zipMaxMembers", config.zipMaxMembers, DEFAULT_ZIP_MAX_MEMBERS),
			maxEntryBytes: positive("zipMaxEntryBytes", config.zipMaxEntryBytes, DEFAULT_ZIP_MAX_ENTRY_BYTES),
			maxTotalBytes: positive("zipMaxUncompressedBytes", config.zipMaxUncompressedBytes, DEFAULT_ZIP_MAX_UNCOMPRESSED_BYTES)
		};
	}
	/**
	* Largest JSON request body this manager's bounds can produce: the archive
	* cap plus base64 expansion and framing.
	*/
	get maxRequestBodyBytes() {
		return Math.ceil(this.zipMaxBytes * 4 / 3) + 1048576;
	}
	/**
	* Report the managed catalog.
	* @param signal - caller cancellation.
	* @returns the current management view.
	*/
	async catalog(signal) {
		const scanned = await scanRoots(this.scannedRoots(), signal);
		const present = /* @__PURE__ */ new Set();
		const duplicates = /* @__PURE__ */ new Set();
		for (const skill of scanned) if (present.has(skill.name)) duplicates.add(skill.name);
		else present.add(skill.name);
		const skills = scanned.map((skill) => toEntry(skill, this.ledger.isEnabled(skill.name), duplicates.has(skill.name))).concat(this.ledger.disabled().filter((record) => !present.has(record.name)).map(orphanEntry)).sort(compareEntries);
		return {
			roots: this.scannedRoots().map((root) => ({
				path: root.path,
				source: root.source,
				rank: root.rank
			})).sort(compareRoots),
			skills,
			installRoot: this.installRoot,
			statePath: this.ledger.path,
			agentsRootEnabled: this.scansAgentsRoot(),
			agentsRootPath: this.agentsRoot.path,
			uploadLimits: {
				maxDocumentBytes: this.uploadMaxDocumentBytes,
				maxArchiveBytes: this.zipMaxBytes
			}
		};
	}
	/**
	* Turn one skill on or off by writing the harness's invocation keys.
	* @param request - the skill name and the state it should reach.
	* @param signal - caller cancellation.
	* @returns the refreshed catalog.
	* @throws SkillManagerError `not-found` when the name has no document and no record.
	*/
	async setEnabled(request, signal) {
		signal?.throwIfAborted();
		const scanned = await this.findSkill(request.name, signal);
		if (request.enabled) {
			const record = this.ledger.record(request.name);
			if (record !== void 0) {
				const path = this.assertManagedPath(record.path);
				const current = await readDocument(path, signal);
				if (current !== void 0) await writeTextAtomic(path, withInvocation(current.content, restoredInvocation(record.previous)));
				this.ledger.enable(request.name);
				await this.ledger.persist();
			}
			return await this.catalog(signal);
		}
		if (scanned === void 0) throw new SkillManagerError("not-found", `no managed root defines skill "${request.name}"`);
		const path = this.assertManagedPath(scanned.path);
		const current = await readDocument(path, signal);
		if (current === void 0) throw new SkillManagerError("not-found", `no skill document exists at "${path}"`);
		const previous = previousInvocation(current.content);
		if (previous === void 0) throw new SkillManagerError("invalid", `"${path}" has no frontmatter block to switch invocation keys in`);
		await writeTextAtomic(path, withInvocation(current.content, disabledInvocation()));
		this.ledger.disable({
			name: scanned.name,
			source: scanned.source,
			path,
			disabledAt: (/* @__PURE__ */ new Date()).toISOString(),
			previous
		});
		await this.ledger.persist();
		signal?.throwIfAborted();
		return await this.catalog(signal);
	}
	/**
	* Choose whether the shared agents root is scanned, and persist the choice.
	* @param enabled - whether the root's documents join the catalog.
	* @param signal - caller cancellation.
	* @returns the refreshed catalog.
	*/
	async setAgentsRoot(enabled, signal) {
		signal?.throwIfAborted();
		this.ledger.setScanAgentsRoot(enabled);
		await this.ledger.persist();
		signal?.throwIfAborted();
		return await this.catalog(signal);
	}
	/**
	* Read one skill document for the editor.
	* @param path - absolute document path inside a managed root.
	* @param signal - caller cancellation.
	* @returns the document text and its freshness token.
	*/
	async read(path, signal) {
		const resolved = this.assertManagedPath(path);
		const document = await readDocument(resolved, signal);
		if (document === void 0) throw new SkillManagerError("not-found", `no skill document exists at "${resolved}"`);
		return {
			path: resolved,
			content: document.content,
			version: document.version
		};
	}
	/**
	* Replace one skill document.
	* @param request - path, replacement text, and the version it was read from.
	* @param signal - caller cancellation.
	* @returns the stored document and its new freshness token.
	*/
	async write(request, signal) {
		const resolved = this.assertManagedPath(request.path);
		const current = await readDocument(resolved, signal);
		if (current === void 0) throw new SkillManagerError("not-found", `no skill document exists at "${resolved}"`);
		if (current.version !== request.version) throw new SkillManagerError("conflict", `"${resolved}" changed after it was read`);
		await writeTextAtomic(resolved, request.content);
		signal?.throwIfAborted();
		return await this.read(resolved, signal);
	}
	/**
	* Install documents the browser read from the user's disk.
	* @param request - documents and whether an existing skill directory may be replaced.
	* @param signal - caller cancellation.
	* @returns installed names, skipped documents, and the refreshed catalog.
	*/
	async install(request, signal) {
		signal?.throwIfAborted();
		const bundles = request.bundles ?? [];
		if (request.documents.length + bundles.length > this.uploadMaxDocuments) throw new SkillManagerError("rejected", `at most ${this.uploadMaxDocuments.toString()} documents or archives may be installed at once`);
		const skipped = [];
		const installed = [];
		await this.installPrepared(prepareAll(request.documents, skipped, this.uploadMaxDocumentBytes), request.overwrite, installed, skipped, signal);
		for (const bundle of bundles) {
			signal?.throwIfAborted();
			const archive = decodeBase64(bundle.data);
			if (archive.byteLength > this.zipMaxBytes) throw new SkillManagerError("rejected", `"${bundle.filename}" exceeds ${this.zipMaxBytes.toString()} bytes`);
			let entries;
			try {
				entries = readZip(archive, this.zipLimits);
			} catch (error) {
				throw new SkillManagerError("invalid", error instanceof ZipError ? error.message : String(error));
			}
			const plan = planArchive(entries);
			for (const failure of plan.invalid) skipped.push({
				name: failure.name,
				reason: "invalid"
			});
			await this.installPrepared(prepareAll(plan.documents, skipped, this.uploadMaxDocumentBytes), request.overwrite, installed, skipped, signal);
			for (const entry of plan.bundles) {
				signal?.throwIfAborted();
				if (await installBundle(this.installRoot, entry.skill, entry.files, request.overwrite) === "installed") installed.push(entry.skill.name);
				else skipped.push({
					name: entry.skill.name,
					reason: "exists"
				});
			}
		}
		signal?.throwIfAborted();
		return {
			installed,
			skipped,
			catalog: await this.catalog(signal)
		};
	}
	/**
	* Install every `SKILL.md` one GitHub repository exposes.
	* @param request - repository link and whether existing skill directories may be replaced.
	* @param signal - caller cancellation.
	* @returns installed names, skipped documents, and the refreshed catalog.
	*/
	async importGitHub(request, signal) {
		signal?.throwIfAborted();
		const source = parseGitHubUrl(request.url);
		if (source === void 0) throw new SkillManagerError("github", "the link is not a GitHub repository or /tree/<ref> URL");
		const target = request.ref === void 0 || request.ref.length === 0 ? source : {
			...source,
			ref: request.ref
		};
		let fetched;
		try {
			fetched = await fetchGitHubDocuments(target, this.github, signal);
		} catch (error) {
			throw new SkillManagerError("github", error instanceof GitHubImportError ? error.message : String(error));
		}
		signal?.throwIfAborted();
		const skipped = fetched.skipped.map((entry) => ({
			name: entry.name,
			reason: entry.reason
		}));
		const installed = [];
		await this.installPrepared(prepareAll(fetched.documents, skipped, Number.POSITIVE_INFINITY), request.overwrite, installed, skipped, signal);
		signal?.throwIfAborted();
		return {
			installed,
			skipped,
			catalog: await this.catalog(signal)
		};
	}
	/** Write every prepared skill, appending outcomes to the caller's lists. */
	async installPrepared(prepared, overwrite, installed, skipped, signal) {
		for (const skill of prepared) {
			signal?.throwIfAborted();
			if (await installSkill(this.installRoot, skill, overwrite) === "installed") installed.push(skill.name);
			else skipped.push({
				name: skill.name,
				reason: "exists"
			});
		}
	}
	async findSkill(name, signal) {
		return (await scanRoots(this.scannedRoots(), signal)).find((skill) => skill.name === name);
	}
	/** The roots discovery reads: the shared agents root only while its scan is on. */
	scannedRoots() {
		return this.scansAgentsRoot() ? this.configuredRoots : this.configuredRoots.filter((root) => root !== this.agentsRoot);
	}
	/** The effective scan choice: the persisted switch, else the deployment default. */
	scansAgentsRoot() {
		return this.ledger.scannedAgentsRoot ?? this.scanAgentsRootDefault;
	}
	/** Resolve one client path and refuse anything outside every managed root. */
	assertManagedPath(path) {
		const resolved = resolve(path);
		if (!this.configuredRoots.some((root) => isInside(root.path, resolved))) throw new SkillManagerError("outside-roots", `"${resolved}" is outside every managed skill root`);
		return resolved;
	}
};
/** Resolve the harness home without depending on a harness package. */
function resolveDshHome(configured) {
	if (configured !== void 0 && configured.length > 0) return resolve(expandHome(configured));
	const fromEnv = process.env.DSH_HOME;
	if (fromEnv !== void 0 && fromEnv.trim().length > 0) return resolve(expandHome(fromEnv));
	return join(homedir(), ".dsh");
}
function expandHome(path) {
	if (path === "~") return homedir();
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
	return path;
}
function decodeBase64(value) {
	return new Uint8Array(Buffer.from(value, "base64"));
}
function prepareAll(documents, skipped, maxBytes) {
	const prepared = [];
	for (const document of documents) {
		if (Buffer.byteLength(document.content, "utf8") > maxBytes) {
			skipped.push({
				name: document.filename,
				reason: "invalid"
			});
			continue;
		}
		const outcome = prepareSkillDocument(document);
		if (outcome.kind === "invalid") {
			skipped.push({
				name: outcome.name,
				reason: outcome.reason
			});
			continue;
		}
		prepared.push(outcome.skill);
	}
	return prepared;
}
function toEntry(skill, enabled, duplicate) {
	return {
		name: skill.name,
		description: skill.description,
		source: skill.source,
		rank: skill.rank,
		root: skill.root,
		path: skill.path,
		enabled,
		modelInvocable: skill.invocation.modelInvocable,
		userInvocable: skill.invocation.userInvocable,
		state: skill.state,
		...skill.error === void 0 ? {} : { error: skill.error },
		duplicate
	};
}
/** A disabled name whose document disappeared from every managed root. */
function orphanEntry(record) {
	return {
		name: record.name,
		description: "",
		source: record.source,
		rank: 0,
		root: "",
		path: record.path,
		enabled: false,
		modelInvocable: false,
		userInvocable: false,
		state: "missing",
		error: "the disabled entry is no longer present in any managed root",
		duplicate: false
	};
}
function compareEntries(left, right) {
	return missingRank(left) - missingRank(right) || left.rank - right.rank || left.name.localeCompare(right.name) || left.path.localeCompare(right.path);
}
function missingRank(entry) {
	return entry.state === "missing" ? 1 : 0;
}
function compareRoots(left, right) {
	return left.rank - right.rank || left.path.localeCompare(right.path);
}
function positive(field, value, fallback) {
	const resolved = value ?? fallback;
	if (!Number.isInteger(resolved) || resolved < 1) throw new TypeError(`skill-manager: ${field} must be a positive integer`);
	return resolved;
}
//#endregion
//#region lib/types/http.js
/**
* The plugin's one HTTP route: decode a JSON operation, run it against the
* manager, and encode the outcome. Failures travel as a structured envelope
* with a stable code so the page can branch on the cause.
*
* @module dsh-plugin-skill-manager/http
*/
/**
* Build the route handler bound to one manager instance.
* @param manager - the manager owning every filesystem decision.
* @param ctx - host context used only for logging.
* @returns a Fetch handler answering one JSON operation.
*/
function createHandler(manager, ctx) {
	return async (request) => {
		const limit = manager.maxRequestBodyBytes;
		const declared = request.headers.get("content-length");
		if (declared !== null && Number(declared) > limit) return failure({
			code: "rejected",
			message: `the request body exceeds ${limit.toString()} bytes`
		}, 413);
		let body;
		try {
			body = await request.json();
		} catch {
			return failure({
				code: "invalid",
				message: "the request body is not JSON"
			}, 400);
		}
		const decoded = decode(body);
		if ("failure" in decoded) return failure(decoded.failure, 400);
		try {
			return json({
				ok: true,
				value: await dispatch(manager, decoded.request, request.signal)
			});
		} catch (error) {
			if (error instanceof SkillManagerError) return failure({
				code: error.code,
				message: error.message
			}, statusOf(error.code));
			ctx.logger.warn(`skill-manager: request failed: ${String(error)}`);
			return failure({
				code: "internal",
				message: String(error)
			}, 500);
		}
	};
}
async function dispatch(manager, request, signal) {
	switch (request.op) {
		case "list": return await manager.catalog(signal);
		case "setAgentsRoot": return await manager.setAgentsRoot(request.enabled, signal);
		case "setEnabled": return await manager.setEnabled(request.request, signal);
		case "read": return await manager.read(request.path, signal);
		case "write": return await manager.write(request.request, signal);
		case "install": return await manager.install(request.request, signal);
		case "github": return await manager.importGitHub(request.request, signal);
	}
}
function decode(body) {
	if (!isRecord(body)) return invalid("the request body must be an object");
	switch (body.op) {
		case "list": return { request: { op: "list" } };
		case "setAgentsRoot": return typeof body.enabled === "boolean" ? { request: {
			op: "setAgentsRoot",
			enabled: body.enabled
		} } : invalid("\"setAgentsRoot\" requires an enabled boolean");
		case "read": return typeof body.path === "string" ? { request: {
			op: "read",
			path: body.path
		} } : invalid("\"read\" requires a path string");
		case "setEnabled": {
			const request = decodeToggle(body.request);
			return request === void 0 ? invalid("\"setEnabled\" requires { name, enabled }") : { request: {
				op: "setEnabled",
				request
			} };
		}
		case "write": {
			const request = decodeWrite(body.request);
			return request === void 0 ? invalid("\"write\" requires { path, content, version }") : { request: {
				op: "write",
				request
			} };
		}
		case "install": {
			const request = decodeInstall(body.request);
			return request === void 0 ? invalid("\"install\" requires { documents, bundles?, overwrite }") : { request: {
				op: "install",
				request
			} };
		}
		case "github": {
			const request = decodeGitHub(body.request);
			return request === void 0 ? invalid("\"github\" requires { url, overwrite }") : { request: {
				op: "github",
				request
			} };
		}
		default: return invalid(`unknown operation ${JSON.stringify(body.op)}`);
	}
}
function decodeToggle(value) {
	if (!isRecord(value)) return void 0;
	if (typeof value.name !== "string" || typeof value.enabled !== "boolean") return void 0;
	return {
		name: value.name,
		enabled: value.enabled
	};
}
function decodeWrite(value) {
	if (!isRecord(value)) return void 0;
	if (typeof value.path !== "string" || typeof value.content !== "string" || typeof value.version !== "string") return void 0;
	return {
		path: value.path,
		content: value.content,
		version: value.version
	};
}
function decodeInstall(value) {
	if (!isRecord(value) || !Array.isArray(value.documents) || typeof value.overwrite !== "boolean") return void 0;
	const documents = [];
	for (const entry of value.documents) {
		if (!isRecord(entry) || typeof entry.filename !== "string" || typeof entry.content !== "string") return void 0;
		documents.push({
			filename: entry.filename,
			content: entry.content
		});
	}
	const rawBundles = value.bundles ?? [];
	if (!Array.isArray(rawBundles)) return void 0;
	const bundles = [];
	for (const entry of rawBundles) {
		if (!isRecord(entry) || typeof entry.filename !== "string" || typeof entry.data !== "string") return void 0;
		bundles.push({
			filename: entry.filename,
			data: entry.data
		});
	}
	return {
		documents,
		bundles,
		overwrite: value.overwrite
	};
}
function decodeGitHub(value) {
	if (!isRecord(value) || typeof value.url !== "string" || typeof value.overwrite !== "boolean") return void 0;
	if (value.ref !== void 0 && typeof value.ref !== "string") return void 0;
	return {
		url: value.url,
		...value.ref === void 0 ? {} : { ref: value.ref },
		overwrite: value.overwrite
	};
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function invalid(message) {
	return { failure: {
		code: "invalid",
		message
	} };
}
function statusOf(code) {
	switch (code) {
		case "not-found": return 404;
		case "conflict": return 409;
		case "outside-roots": return 403;
		case "rejected": return 413;
		case "github":
		case "invalid": return 400;
		case "internal": return 500;
	}
}
function json(value) {
	return new Response(JSON.stringify(value), {
		status: 200,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
function failure(error, status) {
	return new Response(JSON.stringify({
		ok: false,
		error
	}), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
//#endregion
//#region lib/types/index.js
/**
* Skill manager plugin — host half.
*
* Serves the Skill management page in the dsh Web client: it scans the
* user-level skill roots, lists every skill with its source and precedence,
* turns a skill off by writing the harness's own invocation keys into its
* `SKILL.md`, reads and replaces skill documents, and installs skills from
* uploaded documents or a GitHub repository link.
*
* This is a standalone community plugin: the host half registers one
* authenticated JSON route and owns every filesystem decision; the browser
* half is a Settings page that calls it.
*
* @module dsh-plugin-skill-manager
*/
const name = "skill-manager";
const inject = ["connection"];
/** Validated plugin configuration; the loader reads this schema, `apply` reads {@link Config}. */
const Config = z.object({
	dshHome: z.string(),
	agentsHome: z.string(),
	includeAgentsRoot: z.boolean(),
	extraRoots: z.array(z.object({
		path: z.string(),
		source: z.string(),
		rank: z.number()
	})).default([]),
	stateFile: z.string(),
	installRoot: z.string(),
	githubMaxFiles: z.natural().default(20),
	githubMaxDocumentBytes: z.natural().default(524288),
	githubTimeoutMs: z.natural().default(3e4),
	uploadMaxDocuments: z.natural().default(20),
	uploadMaxDocumentBytes: z.natural().default(524288)
});
/** The pathname the browser half calls; absolute, no trailing slash. */
const ROUTE_PATH = "/api/skill-manager";
/**
* Mount the host half: one authenticated JSON route over the skill manager.
* @param ctx - host plugin context.
* @param config - managed roots, state file, and import bounds.
*/
function apply(ctx, config = {}) {
	const handler = createHandler(new SkillManager(ctx, config ?? {}), ctx);
	ctx.effect(() => ctx.connection.fetch.register({
		path: ROUTE_PATH,
		methods: ["POST"],
		requestBody: "buffered",
		fetch: handler
	}), "skill-manager: route");
}
//#endregion
export { Config, ROUTE_PATH, apply, inject, name };

//# sourceMappingURL=index.js.map