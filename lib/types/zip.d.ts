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
/** Bounds applied to one archive before anything is written. */
export interface ZipLimits {
    /** Largest number of entries accepted. */
    readonly maxMembers: number;
    /** Largest uncompressed size of one entry, in bytes. */
    readonly maxEntryBytes: number;
    /** Largest uncompressed size of the complete archive, in bytes. */
    readonly maxTotalBytes: number;
}
/** One file read from an archive. */
export interface ZipEntry {
    /** Normalized relative path, `/`-separated, never absolute and never containing `..`. */
    readonly path: string;
    /** File bytes; the caller owns the buffer. */
    readonly data: Uint8Array;
}
/** A ZIP that cannot be read within the given bounds. */
export declare class ZipError extends Error {
}
/**
 * Read every file in one ZIP archive.
 * @param archive - complete archive bytes.
 * @param limits - accepted member count and sizes.
 * @returns the archive's files in central-directory order.
 * @throws ZipError when the archive is malformed, encoded with an unsupported feature, or over a bound.
 */
export declare function readZip(archive: Uint8Array, limits: ZipLimits): ZipEntry[];
//# sourceMappingURL=zip.d.ts.map