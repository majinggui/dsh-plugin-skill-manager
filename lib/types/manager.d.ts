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
    /** Deployment default for scanning the shared agents root; the page's switch overrides it. */
    readonly includeAgentsRoot?: boolean;
    /** Largest archive one upload may carry, before extraction. */
    readonly zipMaxBytes?: number;
    /** Largest uncompressed size one archive may reach. */
    readonly zipMaxUncompressedBytes?: number;
    /** Largest number of files one archive may hold. */
    readonly zipMaxMembers?: number;
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
    /** Every configured root, including the shared agents root while its scan is off. */
    private readonly configuredRoots;
    private readonly agentsRoot;
    private readonly scanAgentsRootDefault;
    private readonly installRoot;
    private readonly ledger;
    private readonly github;
    private readonly uploadMaxDocuments;
    private readonly uploadMaxDocumentBytes;
    private readonly zipMaxBytes;
    private readonly zipLimits;
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
     * Choose whether the shared agents root is scanned, and persist the choice.
     * @param enabled - whether the root's documents join the catalog.
     * @param signal - caller cancellation.
     * @returns the refreshed catalog.
     */
    setAgentsRoot(enabled: boolean, signal?: AbortSignal): Promise<SkillCatalog>;
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
    /** Write every prepared skill, appending outcomes to the caller's lists. */
    private installPrepared;
    private findSkill;
    /** The roots discovery reads: the shared agents root only while its scan is on. */
    private scannedRoots;
    /** The effective scan choice: the persisted switch, else the deployment default. */
    private scansAgentsRoot;
    /** Resolve one client path and refuse anything outside every managed root. */
    private assertManagedPath;
}
//# sourceMappingURL=manager.d.ts.map