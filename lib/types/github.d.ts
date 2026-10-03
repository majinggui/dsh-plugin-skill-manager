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
/** A repository, optional ref, and optional subdirectory taken from a GitHub link. */
export interface GitHubSource {
    readonly owner: string;
    readonly repo: string;
    readonly ref?: string;
    /** Repository-relative subdirectory to import from, when the link names one. */
    readonly path?: string;
}
/** Bounds and timeout applied to one GitHub import. */
export interface GitHubImportConfig {
    /** Largest number of `SKILL.md` documents one import installs. */
    readonly maxFiles: number;
    /** Largest accepted document size in bytes. */
    readonly maxDocumentBytes: number;
    /** Milliseconds allowed for the complete import. */
    readonly timeoutMs: number;
}
/** One document that was not downloaded. */
export interface GitHubSkippedDocument {
    readonly name: string;
    readonly reason: 'too-large' | 'limit';
}
/** Documents downloaded from one repository. */
export interface GitHubDocuments {
    readonly documents: readonly {
        readonly filename: string;
        readonly content: string;
    }[];
    readonly skipped: readonly GitHubSkippedDocument[];
}
/** Failure of one GitHub import, reported to the browser as a failed request. */
export declare class GitHubImportError extends Error {
}
/**
 * Parse a GitHub repository link.
 * @param url - `https://github.com/<owner>/<repo>` with an optional `/tree/<ref>[/<path>]` suffix.
 * @returns the resolved owner, repository, ref, and subdirectory, or `undefined` for an unsupported link.
 */
export declare function parseGitHubUrl(url: string): GitHubSource | undefined;
/**
 * Download every `SKILL.md` document one repository exposes.
 * @param source - parsed repository link.
 * @param config - size limits and timeout.
 * @param signal - caller cancellation.
 * @returns the downloaded documents and the entries that were skipped.
 * @throws GitHubImportError when the repository, ref, or download cannot be read.
 */
export declare function fetchGitHubDocuments(source: GitHubSource, config: GitHubImportConfig, signal?: AbortSignal): Promise<GitHubDocuments>;
//# sourceMappingURL=github.d.ts.map