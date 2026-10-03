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
/** Longest description derived from a body line before truncation. */
export declare const MAX_DERIVED_DESCRIPTION_LENGTH = 400;
/** Precedence rank of the user-level `$DSH_HOME/skills` root. */
export declare const USER_DSH_SKILL_RANK = 400;
/** Precedence rank of the user-level `$DSH_AGENTS_HOME/skills` root. */
export declare const USER_AGENTS_SKILL_RANK = 500;
/**
 * Whether a string is a valid kebab-case skill name.
 * @param name - candidate skill name.
 * @returns whether the name matches the harness grammar.
 */
export declare function isSkillName(name: string): boolean;
/** One directory this plugin manages. */
export interface ManagedRoot {
    /** Absolute root directory. */
    readonly path: string;
    /** Discovery source identifier handed to the browser unlocalized. */
    readonly source: string;
    /** Precedence rank shared with the local skill provider: lower wins. */
    readonly rank: number;
}
/** Invocation controls parsed from one document's frontmatter. */
export interface InvocationPolicy {
    readonly modelInvocable: boolean;
    readonly userInvocable: boolean;
}
/** One scanned skill document, parsed as far as its frontmatter allows. */
export interface ScannedSkill {
    readonly name: string;
    readonly description: string;
    readonly source: string;
    readonly rank: number;
    readonly root: string;
    readonly path: string;
    readonly state: 'ready' | 'invalid';
    readonly error?: string;
    readonly invocation: InvocationPolicy;
}
/** Frontmatter of one skill document, or the reason it could not be used. */
export type ParsedSkillDocument = {
    readonly kind: 'parsed';
    readonly data: Record<string, unknown> | undefined;
    readonly body: string;
} | {
    readonly kind: 'unusable';
    readonly error: string;
};
/**
 * Whether one absolute path lies inside a root directory (or is that root).
 * @param root - absolute root directory.
 * @param path - absolute path to test.
 * @returns whether the path is the root itself or one of its descendants.
 */
export declare function isInside(root: string, path: string): boolean;
/**
 * Scan every managed root for skill documents.
 * @param roots - managed roots in report order.
 * @param signal - caller cancellation.
 * @returns one parsed entry per discovered document.
 */
export declare function scanRoots(roots: readonly ManagedRoot[], signal?: AbortSignal): Promise<ScannedSkill[]>;
/**
 * Scan one managed root for skill documents.
 * @param root - the root to scan; a missing directory yields no entries.
 * @param signal - caller cancellation.
 * @returns parsed entries for this root in name order.
 */
export declare function scanRoot(root: ManagedRoot, signal?: AbortSignal): Promise<ScannedSkill[]>;
/**
 * Read one skill document and its concurrency token.
 * @param path - absolute document path.
 * @param signal - caller cancellation.
 * @returns the document text and version, or `undefined` when it is absent.
 */
export declare function readDocument(path: string, signal?: AbortSignal): Promise<{
    content: string;
    version: string;
} | undefined>;
/**
 * Content-addressed freshness token for one document.
 * @param content - complete document text.
 * @returns stable hex digest of the content.
 */
export declare function documentVersion(content: string): string;
/**
 * Parse one document's frontmatter without rejecting the entry.
 * @param content - complete document text.
 * @returns the parsed frontmatter (absent when the document has none) and the body, or the parse error.
 */
export declare function parseSkillDocument(content: string): ParsedSkillDocument;
/**
 * Derive a kebab-case skill name from a file or directory name.
 * @param value - the entry name, with or without a `.md` extension.
 * @returns a valid skill name, or `undefined` when nothing usable remains.
 */
export declare function skillNameFromEntry(value: string): string | undefined;
/**
 * Derive a routing description from the first meaningful line of a body.
 * @param body - document body without frontmatter.
 * @returns one trimmed line, truncated to a routing-sized description.
 */
export declare function descriptionFromBody(body: string): string;
//# sourceMappingURL=catalog.d.ts.map