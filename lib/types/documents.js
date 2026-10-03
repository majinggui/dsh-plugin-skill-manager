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
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { descriptionFromBody, parseSkillDocument, skillNameFromEntry, } from "./catalog.js";
/** Frontmatter keys that switch a skill off. */
const DISABLE_KEY = 'disable-model-invocation';
const USER_KEY = 'user-invocable';
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
export function prepareSkillDocument(input) {
    const document = parseSkillDocument(input.content);
    const fallback = fallbackNameFromPath(input.filename);
    if (document.kind === 'unusable') {
        return { kind: 'invalid', name: fallback ?? basename(input.filename), reason: 'invalid' };
    }
    const data = document.data;
    const name = stringField(data?.name) ?? fallback;
    if (name === undefined)
        return { kind: 'invalid', name: basename(input.filename), reason: 'invalid' };
    const description = stringField(data?.description) ?? descriptionFromBody(document.body);
    if (description.length === 0)
        return { kind: 'invalid', name, reason: 'invalid' };
    if (data !== undefined && stringField(data.name) === name && stringField(data.description) !== undefined) {
        return { kind: 'prepared', skill: { name, description, content: input.content } };
    }
    const frontmatter = stringifyYaml({ ...data, name, description }).trimEnd();
    const body = document.body.trim();
    return {
        kind: 'prepared',
        skill: {
            name,
            description,
            content: `---\n${frontmatter}\n---\n\n${body}\n`,
        },
    };
}
/**
 * Rewrite one document's invocation keys, keeping every other field and the body.
 * @param content - the document as read.
 * @param next - the two invocation keys to set; `null` removes a key.
 * @returns the rewritten document text.
 * @throws Error when the document has no usable frontmatter block.
 */
export function withInvocation(content, next) {
    const document = parseSkillDocument(content);
    if (document.kind === 'unusable' || document.data === undefined) {
        throw new Error('the document has no frontmatter block to switch invocation keys in');
    }
    const data = { ...document.data };
    for (const key of [DISABLE_KEY, USER_KEY]) {
        const value = next[key];
        if (value === null)
            delete data[key];
        else
            data[key] = value;
    }
    return `---\n${stringifyYaml(data).trimEnd()}\n---\n${document.body}`;
}
/**
 * The invocation values the ledger must remember for one document.
 * @param content - the document as read.
 * @param name - skill name used for diagnostics.
 * @returns the previous values, or `undefined` when the document is unusable.
 */
export function previousInvocation(content) {
    const document = parseSkillDocument(content);
    if (document.kind === 'unusable' || document.data === undefined)
        return undefined;
    return {
        [DISABLE_KEY]: scalarOrNull(document.data[DISABLE_KEY]),
        [USER_KEY]: scalarOrNull(document.data[USER_KEY]),
    };
}
/** The invocation keys that switch a skill back off. */
export function disabledInvocation() {
    return { [DISABLE_KEY]: true, [USER_KEY]: false };
}
/**
 * The invocation keys that restore one ledger record.
 * @param previous - the values recorded at disable time.
 * @returns the keys to write back.
 */
export function restoredInvocation(previous) {
    return { [DISABLE_KEY]: previous[DISABLE_KEY] ?? null, [USER_KEY]: previous[USER_KEY] ?? null };
}
/**
 * Write one prepared skill under a managed root.
 * @param root - absolute directory receiving `<name>/SKILL.md`.
 * @param skill - the normalized bundle.
 * @param overwrite - whether an existing skill directory may be replaced.
 * @returns whether the document was written or left alone.
 */
export async function installSkill(root, skill, overwrite) {
    const directory = join(root, skill.name);
    const target = join(directory, 'SKILL.md');
    if (!overwrite && await pathExists(target))
        return 'exists';
    await mkdir(directory, { recursive: true });
    await writeTextAtomic(target, skill.content);
    return 'installed';
}
/**
 * Replace one text file through a temporary sibling, so a failed write never
 * leaves a half-written skill document.
 * @param target - absolute path to replace.
 * @param content - complete replacement text.
 */
export async function writeTextAtomic(target, content) {
    const temporary = join(dirname(target), `.${basename(target)}.tmp-${process.pid.toString()}`);
    await writeFile(temporary, content, { encoding: 'utf8' });
    await rename(temporary, target);
}
async function pathExists(path) {
    try {
        await stat(path);
        return true;
    }
    catch {
        // A missing target is the normal first-install case.
        return false;
    }
}
function stringField(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
function scalarOrNull(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
}
/**
 * Derive the fallback skill name from the entry path: a `SKILL.md` bundle is
 * named by its containing directory, and any other document by its own file name.
 */
function fallbackNameFromPath(filename) {
    const base = basename(filename);
    return base.toLowerCase() === 'skill.md'
        ? skillNameFromEntry(basename(dirname(filename)))
        : skillNameFromEntry(base);
}
//# sourceMappingURL=documents.js.map