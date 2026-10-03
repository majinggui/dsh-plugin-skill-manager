/**
 * Skill manager core: root resolution, catalog projection, enablement,
 * document editing, and installation. Every filesystem decision lives here;
 * the HTTP route only decodes a request and encodes the outcome.
 *
 * @module dsh-plugin-skill-manager/manager
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SkillCatalog, SkillFailureCode, SkillGitHubRequest, SkillInstallRequest, SkillInstallValue, SkillToggleRequest } from './protocol.ts';
/** One failed operation, carrying the stable code the page branches on. */
export declare class SkillManagerError extends Error {
    readonly code: SkillFailureCode;
    /**
     * @param code - stable failure code.
     * @param message - human diagnostic.
     */
    constructor(code: SkillFailureCode, message: string);
}
/** Plugin configuration consumed by the manager. */
export interface ManagerConfig {
    readonly dshHome?: string;
    readonly agentsHome?: string;
    readonly extraRoots?: readonly {
        path: string;
        source: string;
        rank: number;
    }[];
    readonly stateFile?: string;
    readonly installRoot?: string;
    readonly githubMaxFiles?: number;
    readonly githubMaxDocumentBytes?: number;
    readonly githubTimeoutMs?: number;
    readonly uploadMaxDocuments?: number;
    readonly uploadMaxDocumentBytes?: number;
}
/** Owner of the managed skill catalog and its one write path. */
export declare class SkillManager {
    private readonly roots;
    private readonly installRoot;
    private readonly ledger;
    private readonly github;
    private readonly uploadMaxDocuments;
    private readonly uploadMaxDocumentBytes;
    /**
     * @param ctx - host context used only for logging.
     * @param config - managed roots, state file, and import bounds.
     */
    constructor(ctx: Context, config?: ManagerConfig);
    /**
     * Report the managed catalog.
     * @param signal - caller cancellation.
     * @returns the current management view.
     */
    catalog(signal?: AbortSignal): Promise<SkillCatalog>;
    /**
     * Turn one skill on or off by writing the harness's invocation keys.
     * @param request - the skill name and the state it should reach.
     * @param signal - caller cancellation.
     * @returns the refreshed catalog.
     * @throws SkillManagerError `not-found` when the name has no document and no record.
     */
    setEnabled(request: SkillToggleRequest, signal?: AbortSignal): Promise<SkillCatalog>;
    /**
     * Read one skill document for the editor.
     * @param path - absolute document path inside a managed root.
     * @param signal - caller cancellation.
     * @returns the document text and its freshness token.
     */
    read(path: string, signal?: AbortSignal): Promise<{
        path: string;
        content: string;
        version: string;
    }>;
    /**
     * Replace one skill document.
     * @param request - path, replacement text, and the version it was read from.
     * @param signal - caller cancellation.
     * @returns the stored document and its new freshness token.
     */
    write(request: {
        path: string;
        content: string;
        version: string;
    }, signal?: AbortSignal): Promise<{
        path: string;
        content: string;
        version: string;
    }>;
    /**
     * Install documents the browser read from the user's disk.
     * @param request - documents and whether an existing skill directory may be replaced.
     * @param signal - caller cancellation.
     * @returns installed names, skipped documents, and the refreshed catalog.
     */
    install(request: SkillInstallRequest, signal?: AbortSignal): Promise<SkillInstallValue>;
    /**
     * Install every `SKILL.md` one GitHub repository exposes.
     * @param request - repository link and whether existing skill directories may be replaced.
     * @param signal - caller cancellation.
     * @returns installed names, skipped documents, and the refreshed catalog.
     */
    importGitHub(request: SkillGitHubRequest, signal?: AbortSignal): Promise<SkillInstallValue>;
    private installAll;
    private findSkill;
    /** Resolve one client path and refuse anything outside every managed root. */
    private assertManagedPath;
}
//# sourceMappingURL=manager.d.ts.map