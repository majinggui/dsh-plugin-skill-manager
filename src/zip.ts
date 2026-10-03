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

import { inflateRawSync } from 'node:zlib'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const EOCD_MIN_BYTES = 22
const MAX_COMMENT_BYTES = 0xffff
const ZIP64_SENTINEL = 0xffffffff
const METHOD_STORED = 0
const METHOD_DEFLATE = 8
const FLAG_ENCRYPTED = 0x0001

/** Bounds applied to one archive before anything is written. */
export interface ZipLimits {
  /** Largest number of entries accepted. */
  readonly maxMembers: number
  /** Largest uncompressed size of one entry, in bytes. */
  readonly maxEntryBytes: number
  /** Largest uncompressed size of the complete archive, in bytes. */
  readonly maxTotalBytes: number
}

/** One file read from an archive. */
export interface ZipEntry {
  /** Normalized relative path, `/`-separated, never absolute and never containing `..`. */
  readonly path: string
  /** File bytes; the caller owns the buffer. */
  readonly data: Uint8Array
}

/** A ZIP that cannot be read within the given bounds. */
export class ZipError extends Error {}

/**
 * Read every file in one ZIP archive.
 * @param archive - complete archive bytes.
 * @param limits - accepted member count and sizes.
 * @returns the archive's files in central-directory order.
 * @throws ZipError when the archive is malformed, encoded with an unsupported feature, or over a bound.
 */
export function readZip(archive: Uint8Array, limits: ZipLimits): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(archive)
  const members = new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint16(eocd + 10, true)
  const directorySize = new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint32(eocd + 12, true)
  const directoryOffset = new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint32(eocd + 16, true)
  if (members > limits.maxMembers) {
    throw new ZipError(`the archive holds ${members.toString()} entries; the limit is ${limits.maxMembers.toString()}`)
  }
  if (directoryOffset + directorySize > archive.byteLength) throw new ZipError('the archive central directory is truncated')

  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  const entries: ZipEntry[] = []
  let total = 0
  let cursor = directoryOffset
  for (let index = 0; index < members; index += 1) {
    if (cursor + 46 > archive.byteLength || view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw new ZipError('the archive central directory is malformed')
    }
    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decodeText(archive.subarray(cursor + 46, cursor + 46 + nameLength))
    cursor += 46 + nameLength + extraLength + commentLength

    if ((flags & FLAG_ENCRYPTED) !== 0) throw new ZipError(`the archive entry "${name}" is encrypted`)
    if (compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL || localOffset === ZIP64_SENTINEL) {
      throw new ZipError(`the archive entry "${name}" uses ZIP64, which this plugin does not read`)
    }
    if (name.endsWith('/')) continue
    const path = safePath(name)
    if (uncompressedSize > limits.maxEntryBytes) {
      throw new ZipError(`the archive entry "${name}" exceeds ${limits.maxEntryBytes.toString()} bytes`)
    }
    total += uncompressedSize
    if (total > limits.maxTotalBytes) {
      throw new ZipError(`the archive exceeds ${limits.maxTotalBytes.toString()} uncompressed bytes`)
    }
    entries.push({ path, data: readEntry(archive, view, localOffset, method, compressedSize, uncompressedSize, name) })
  }
  return entries
}

function findEndOfCentralDirectory(archive: Uint8Array): number {
  if (archive.byteLength < EOCD_MIN_BYTES) throw new ZipError('the file is too small to be a ZIP archive')
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  const earliest = Math.max(0, archive.byteLength - EOCD_MIN_BYTES - MAX_COMMENT_BYTES)
  for (let offset = archive.byteLength - EOCD_MIN_BYTES; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset
  }
  throw new ZipError('the file is not a ZIP archive')
}

function readEntry(
  archive: Uint8Array,
  view: DataView,
  localOffset: number,
  method: number,
  compressedSize: number,
  uncompressedSize: number,
  name: string,
): Uint8Array {
  if (localOffset + 30 > archive.byteLength || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
    throw new ZipError(`the archive entry "${name}" has no local header`)
  }
  const nameLength = view.getUint16(localOffset + 26, true)
  const extraLength = view.getUint16(localOffset + 28, true)
  const start = localOffset + 30 + nameLength + extraLength
  const end = start + compressedSize
  if (end > archive.byteLength) throw new ZipError(`the archive entry "${name}" is truncated`)
  const data = archive.subarray(start, end)
  switch (method) {
    case METHOD_STORED:
      return data.slice()
    case METHOD_DEFLATE: {
      const inflated = inflateRawSync(data)
      if (inflated.byteLength !== uncompressedSize) {
        throw new ZipError(`the archive entry "${name}" inflated to an unexpected size`)
      }
      return new Uint8Array(inflated)
    }
    default:
      throw new ZipError(`the archive entry "${name}" uses compression method ${method.toString()}, which this plugin does not read`)
  }
}

/** Normalize one entry path and refuse anything that could escape its directory. */
function safePath(name: string): string {
  const unified = name.replaceAll('\\', '/')
  if (unified.startsWith('/') || /^[A-Za-z]:/.test(unified)) {
    throw new ZipError(`the archive entry "${name}" is an absolute path`)
  }
  const segments = unified.split('/').filter(segment => segment.length > 0 && segment !== '.')
  if (segments.includes('..')) throw new ZipError(`the archive entry "${name}" leaves the archive root`)
  if (segments.length === 0) throw new ZipError(`the archive entry "${name}" has no file name`)
  return segments.join('/')
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}
