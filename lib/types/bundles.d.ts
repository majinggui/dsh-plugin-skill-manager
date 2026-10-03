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
import { type DocumentInput, type PreparedSkill } from './documents.ts';
import type { ZipEntry } from './zip.ts';
/** One resource file that travels beside a bundle's `SKILL.md`. */
export interface BundleFile {
    /** Path relative to the skill directory, `/`-separated. */
    readonly path: string;
    /** File bytes. */
    readonly data: Uint8Array;
}
/** One skill directory the archive describes. */
export interface PlannedBundle {
    /** Normalized `SKILL.md` bundle. */
    readonly skill: PreparedSkill;
    /** Directory holding `SKILL.md`. */
    readonly directory: string;
    /** Resource files beside `SKILL.md`, excluding it. */
    readonly files: readonly BundleFile[];
}
/** What one archive offers to install. */
export interface ArchivePlan {
    /** Skill directories holding a `SKILL.md`. */
    readonly bundles: readonly PlannedBundle[];
    /** Markdown documents found outside any bundle directory. */
    readonly documents: readonly DocumentInput[];
    /** Bundle directories that could not be normalized. */
    readonly invalid: readonly {
        readonly name: string;
        readonly reason: 'invalid';
    }[];
}
/**
 * Plan one archive's entries as skills.
 * @param entries - files read from the archive, in archive order.
 * @returns the bundles, the loose documents, and the unusable bundle directories.
 */
export declare function planArchive(entries: readonly ZipEntry[]): ArchivePlan;
//# sourceMappingURL=bundles.d.ts.map