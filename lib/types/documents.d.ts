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
import type { DisabledRecord } from './ledger.ts';
/** One complete document offered for installation. */
export interface DocumentInput {
    /** File name or repository-relative path the document came from. */
    readonly filename: string;
    /** Complete document text. */
    readonly content: string;
}
/** A document normalized into a writable skill bundle. */
export interface PreparedSkill {
    /** Kebab-case skill name. */
    readonly name: string;
    /** Routing description written into the frontmatter. */
    readonly description: string;
    /** Complete `SKILL.md` text. */
    readonly content: string;
}
/** Outcome of normalizing one input document. */
export type PrepareOutcome = {
    readonly kind: 'prepared';
    readonly skill: PreparedSkill;
} | {
    readonly kind: 'invalid';
    readonly name: string;
    readonly reason: 'invalid';
};
/** Frontmatter keys that switch a skill off. */
declare const DISABLE_KEY = "disable-model-invocation";
declare const USER_KEY = "user-invocable";
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
export declare function prepareSkillDocument(input: DocumentInput): PrepareOutcome;
/**
 * Rewrite one document's invocation keys, keeping every other field and the body.
 * @param content - the document as read.
 * @param next - the two invocation keys to set; `null` removes a key.
 * @returns the rewritten document text.
 * @throws Error when the document has no usable frontmatter block.
 */
export declare function withInvocation(content: string, next: {
    readonly [DISABLE_KEY]: string | number | boolean | null;
    readonly [USER_KEY]: string | number | boolean | null;
}): string;
/**
 * The invocation values the ledger must remember for one document.
 * @param content - the document as read.
 * @param name - skill name used for diagnostics.
 * @returns the previous values, or `undefined` when the document is unusable.
 */
export declare function previousInvocation(content: string): DisabledRecord['previous'] | undefined;
/** The invocation keys that switch a skill back off. */
export declare function disabledInvocation(): Parameters<typeof withInvocation>[1];
/**
 * The invocation keys that restore one ledger record.
 * @param previous - the values recorded at disable time.
 * @returns the keys to write back.
 */
export declare function restoredInvocation(previous: DisabledRecord['previous']): Parameters<typeof withInvocation>[1];
/**
 * Write one prepared skill under a managed root.
 * @param root - absolute directory receiving `<name>/SKILL.md`.
 * @param skill - the normalized bundle.
 * @param overwrite - whether an existing skill directory may be replaced.
 * @returns whether the document was written or left alone.
 */
export declare function installSkill(root: string, skill: PreparedSkill, overwrite: boolean): Promise<'installed' | 'exists'>;
/** One resource file that travels beside a bundle's `SKILL.md`. */
export interface BundleResource {
    /** Path relative to the skill directory, `/`-separated. */
    readonly path: string;
    /** File bytes. */
    readonly data: Uint8Array;
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
export declare function installBundle(root: string, skill: PreparedSkill, resources: readonly BundleResource[], overwrite: boolean): Promise<'installed' | 'exists'>;
/**
 * Replace one text file through a temporary sibling, so a failed write never
 * leaves a half-written skill document.
 * @param target - absolute path to replace.
 * @param content - complete replacement text.
 */
export declare function writeTextAtomic(target: string, content: string): Promise<void>;
export {};
//# sourceMappingURL=documents.d.ts.map