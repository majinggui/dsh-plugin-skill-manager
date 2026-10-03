/**
 * Managed-root scan: directory discovery, tolerant frontmatter parsing, and
 * document reading under the same conventions the harness's local skill
 * provider uses.
 *
 * The scan is deliberately independent from the harness registry: the page
 * must show every root entry, including ones a higher-priority root shadows
 * and ones the registry rejects as invalid.
 *
 * @module dsh-plugin-skill-manager/catalog
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
/** Longest description derived from a body line before truncation. */
export const MAX_DERIVED_DESCRIPTION_LENGTH = 400;
/** Kebab-case skill name grammar the harness accepts. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Precedence rank of the user-level `$DSH_HOME/skills` root. */
export const USER_DSH_SKILL_RANK = 400;
/** Precedence rank of the user-level `$DSH_AGENTS_HOME/skills` root. */
export const USER_AGENTS_SKILL_RANK = 500;
/**
 * Whether a string is a valid kebab-case skill name.
 * @param name - candidate skill name.
 * @returns whether the name matches the harness grammar.
 */
export function isSkillName(name) {
    return SKILL_NAME.test(name);
}
/**
 * Whether one absolute path lies inside a root directory (or is that root).
 * @param root - absolute root directory.
 * @param path - absolute path to test.
 * @returns whether the path is the root itself or one of its descendants.
 */
export function isInside(root, path) {
    const child = relative(root, path);
    if (child.length === 0)
        return true;
    return child !== '..' && !child.startsWith(`..${sep}`);
}
/**
 * Scan every managed root for skill documents.
 * @param roots - managed roots in report order.
 * @param signal - caller cancellation.
 * @returns one parsed entry per discovered document.
 */
export async function scanRoots(roots, signal) {
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
export async function scanRoot(root, signal) {
    const scanned = [];
    for (const entry of await listRootEntries(root.path, signal)) {
        signal?.throwIfAborted();
        const path = entry.kind === 'directory' ? join(entry.path, 'SKILL.md') : entry.path;
        const content = await readText(path, signal);
        if (content === undefined)
            continue;
        scanned.push(parseEntry({ root, path, fallback: entry.name, content }));
    }
    return scanned;
}
/**
 * Read one skill document and its concurrency token.
 * @param path - absolute document path.
 * @param signal - caller cancellation.
 * @returns the document text and version, or `undefined` when it is absent.
 */
export async function readDocument(path, signal) {
    const content = await readText(path, signal);
    return content === undefined ? undefined : { content, version: documentVersion(content) };
}
/**
 * Content-addressed freshness token for one document.
 * @param content - complete document text.
 * @returns stable hex digest of the content.
 */
export function documentVersion(content) {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}
/**
 * Parse one document's frontmatter without rejecting the entry.
 * @param content - complete document text.
 * @returns the parsed frontmatter (absent when the document has none) and the body, or the parse error.
 */
export function parseSkillDocument(content) {
    const normalized = content.startsWith('\uFEFF') ? content.slice(1) : content;
    const firstLineEnd = normalized.indexOf('\n');
    if (firstLineEnd < 0 || normalized.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') {
        return { kind: 'parsed', data: undefined, body: normalized };
    }
    const end = findFrontmatterEnd(normalized, firstLineEnd + 1);
    if (end === undefined)
        return { kind: 'unusable', error: 'frontmatter has no closing "---" line' };
    let parsed;
    try {
        parsed = parseYaml(normalized.slice(firstLineEnd + 1, end.fenceStart));
    }
    catch (error) {
        return { kind: 'unusable', error: `frontmatter is not valid YAML: ${String(error)}` };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { kind: 'unusable', error: 'frontmatter must be a YAML object' };
    }
    return { kind: 'parsed', data: parsed, body: normalized.slice(end.bodyStart) };
}
/**
 * Derive a kebab-case skill name from a file or directory name.
 * @param value - the entry name, with or without a `.md` extension.
 * @returns a valid skill name, or `undefined` when nothing usable remains.
 */
export function skillNameFromEntry(value) {
    const candidate = stripMarkdownExtension(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return isSkillName(candidate) ? candidate : undefined;
}
/**
 * Derive a routing description from the first meaningful line of a body.
 * @param body - document body without frontmatter.
 * @returns one trimmed line, truncated to a routing-sized description.
 */
export function descriptionFromBody(body) {
    for (const line of body.split('\n')) {
        const text = line.replace(/^[\s>*#-]+/, '').trim();
        if (text.length === 0)
            continue;
        return text.length > MAX_DERIVED_DESCRIPTION_LENGTH
            ? `${text.slice(0, MAX_DERIVED_DESCRIPTION_LENGTH - 1)}…`
            : text;
    }
    return '';
}
async function listRootEntries(root, signal) {
    let dirents;
    try {
        dirents = await readdir(root, { withFileTypes: true, encoding: 'utf8' });
    }
    catch (error) {
        if (isAbsentPathError(error))
            return [];
        throw error;
    }
    signal?.throwIfAborted();
    const entries = [];
    for (const dirent of [...dirents].sort((left, right) => left.name.localeCompare(right.name))) {
        if (dirent.name.startsWith('.'))
            continue;
        const path = join(root, dirent.name);
        const kind = await entryKind(path, dirent, signal);
        if (kind !== undefined)
            entries.push({ name: dirent.name, path, kind });
    }
    return entries;
}
async function entryKind(path, dirent, signal) {
    if (dirent.isDirectory())
        return 'directory';
    if (dirent.isFile())
        return markdownKind(path);
    if (!dirent.isSymbolicLink())
        return undefined;
    try {
        const info = await stat(path);
        signal?.throwIfAborted();
        if (info.isDirectory())
            return 'directory';
        return info.isFile() ? markdownKind(path) : undefined;
    }
    catch {
        // A dangling or unreadable symbolic link is not a manageable skill entry.
        return undefined;
    }
}
function markdownKind(path) {
    return path.toLowerCase().endsWith('.md') ? 'file' : undefined;
}
function parseEntry(input) {
    const document = parseSkillDocument(input.content);
    const base = {
        source: input.root.source,
        rank: input.root.rank,
        root: input.root.path,
        path: input.path,
    };
    if (document.kind === 'unusable') {
        return { ...base, name: fallbackName(input.fallback), description: '', state: 'invalid', error: document.error, invocation: FULL_INVOCATION };
    }
    const invocation = invocationPolicy(document.data);
    const name = stringField(document.data, 'name');
    if (name === undefined || !isSkillName(name)) {
        return {
            ...base,
            name: fallbackName(input.fallback),
            description: stringField(document.data, 'description') ?? '',
            state: 'invalid',
            error: name === undefined
                ? 'frontmatter requires a kebab-case "name"'
                : `frontmatter name "${name}" is not kebab-case`,
            invocation,
        };
    }
    const description = stringField(document.data, 'description');
    if (description === undefined) {
        return {
            ...base,
            name,
            description: '',
            state: 'invalid',
            error: 'frontmatter requires a non-empty "description"',
            invocation,
        };
    }
    return { ...base, name, description, state: 'ready', invocation };
}
function fallbackName(fallback) {
    return skillNameFromEntry(fallback) ?? fallback;
}
/** Invocation controls used for an entry whose frontmatter could not be read at all. */
const FULL_INVOCATION = { modelInvocable: true, userInvocable: true };
/** Values the harness reads as `true` for the invocation keys. */
const TRUE_FLAGS = new Set([true, 1, '1', 'true', 'yes', 'on']);
/** Values the harness reads as `false` for the invocation keys. */
const FALSE_FLAGS = new Set([false, 0, '0', 'false', 'no', 'off']);
function invocationPolicy(data) {
    return {
        modelInvocable: flagValue(data?.['disable-model-invocation']) !== true,
        userInvocable: flagValue(data?.['user-invocable']) !== false,
    };
}
function flagValue(value) {
    const normalized = typeof value === 'string' ? value.toLowerCase() : value;
    if (TRUE_FLAGS.has(normalized))
        return true;
    if (FALSE_FLAGS.has(normalized))
        return false;
    return undefined;
}
function findFrontmatterEnd(raw, start) {
    let lineStart = start;
    while (true) {
        const newline = raw.indexOf('\n', lineStart);
        // A segment without a newline is the file's last one: it either closes the
        // block or the block never closes.
        if (newline < 0) {
            return raw.slice(lineStart).replace(/\r$/, '') === '---'
                ? { fenceStart: lineStart, bodyStart: raw.length }
                : undefined;
        }
        if (raw.slice(lineStart, newline).replace(/\r$/, '') === '---') {
            return { fenceStart: lineStart, bodyStart: newline + 1 };
        }
        lineStart = newline + 1;
    }
}
async function readText(path, signal) {
    try {
        const content = await readFile(path, { encoding: 'utf8', signal });
        signal?.throwIfAborted();
        return content;
    }
    catch (error) {
        signal?.throwIfAborted();
        if (isAbsentPathError(error))
            return undefined;
        throw error;
    }
}
function stringField(data, key) {
    const value = data?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
function stripMarkdownExtension(value) {
    return value.toLowerCase().endsWith('.md') ? value.slice(0, -3) : value;
}
function isAbsentPathError(error) {
    return hasCode(error, 'ENOENT') || hasCode(error, 'ENOTDIR');
}
function hasCode(error, code) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
//# sourceMappingURL=catalog.js.map