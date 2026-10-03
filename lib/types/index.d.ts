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
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
export declare const name = "skill-manager";
export declare const inject: string[];
/** Skill manager deployment configuration. */
export interface Config {
    /** DeepSeek Harness config root. Defaults to `$DSH_HOME` or `~/.dsh`. */
    dshHome?: string;
    /** Shared agent config root. Defaults to `$DSH_AGENTS_HOME` or `~/.agents`. */
    agentsHome?: string;
    /** Extra managed roots, reported after the two user-level defaults. */
    extraRoots?: {
        path: string;
        source: string;
        rank: number;
    }[];
    /** Absolute path of the disable ledger. Defaults to `<dshHome>/skill-manager.json`. */
    stateFile?: string;
    /** Directory document and GitHub imports write into. Defaults to `<dshHome>/skills`. */
    installRoot?: string;
    /** Largest number of documents one GitHub import installs. */
    githubMaxFiles?: number;
    /** Largest accepted GitHub document size in bytes. */
    githubMaxDocumentBytes?: number;
    /** Milliseconds allowed for one GitHub import. */
    githubTimeoutMs?: number;
    /** Largest number of documents one upload installs. */
    uploadMaxDocuments?: number;
    /** Largest accepted upload document size in bytes. */
    uploadMaxDocumentBytes?: number;
}
/** Validated plugin configuration; the loader reads this schema, `apply` reads {@link Config}. */
export declare const Config: z<Schemastery.ObjectS<{
    dshHome: z<string, string>;
    agentsHome: z<string, string>;
    extraRoots: z<({
        path?: string | null;
        source?: string | null;
        rank?: number | null;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        path: z<string, string>;
        source: z<string, string>;
        rank: z<number, number>;
    }>[]>;
    stateFile: z<string, string>;
    installRoot: z<string, string>;
    githubMaxFiles: z<number, number>;
    githubMaxDocumentBytes: z<number, number>;
    githubTimeoutMs: z<number, number>;
    uploadMaxDocuments: z<number, number>;
    uploadMaxDocumentBytes: z<number, number>;
}>, Schemastery.ObjectT<{
    dshHome: z<string, string>;
    agentsHome: z<string, string>;
    extraRoots: z<({
        path?: string | null;
        source?: string | null;
        rank?: number | null;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        path: z<string, string>;
        source: z<string, string>;
        rank: z<number, number>;
    }>[]>;
    stateFile: z<string, string>;
    installRoot: z<string, string>;
    githubMaxFiles: z<number, number>;
    githubMaxDocumentBytes: z<number, number>;
    githubTimeoutMs: z<number, number>;
    uploadMaxDocuments: z<number, number>;
    uploadMaxDocumentBytes: z<number, number>;
}>>;
/** The pathname the browser half calls; absolute, no trailing slash. */
export declare const ROUTE_PATH = "/api/skill-manager";
/**
 * Mount the host half: one authenticated JSON route over the skill manager.
 * @param ctx - host plugin context.
 * @param config - managed roots, state file, and import bounds.
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map