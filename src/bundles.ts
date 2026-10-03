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

import { prepareSkillDocument, type DocumentInput, type PreparedSkill } from './documents.ts'
import type { ZipEntry } from './zip.ts'

/** One resource file that travels beside a bundle's `SKILL.md`. */
export interface BundleFile {
  /** Path relative to the skill directory, `/`-separated. */
  readonly path: string
  /** File bytes. */
  readonly data: Uint8Array
}

/** One skill directory the archive describes. */
export interface PlannedBundle {
  /** Normalized `SKILL.md` bundle. */
  readonly skill: PreparedSkill
  /** Directory holding `SKILL.md`. */
  readonly directory: string
  /** Resource files beside `SKILL.md`, excluding it. */
  readonly files: readonly BundleFile[]
}

/** What one archive offers to install. */
export interface ArchivePlan {
  /** Skill directories holding a `SKILL.md`. */
  readonly bundles: readonly PlannedBundle[]
  /** Markdown documents found outside any bundle directory. */
  readonly documents: readonly DocumentInput[]
  /** Bundle directories that could not be normalized. */
  readonly invalid: readonly { readonly name: string; readonly reason: 'invalid' }[]
}

/** The `SKILL.md` file name, case-insensitive in an archive listing. */
const SKILL_FILE = 'skill.md'

/**
 * Plan one archive's entries as skills.
 * @param entries - files read from the archive, in archive order.
 * @returns the bundles, the loose documents, and the unusable bundle directories.
 */
export function planArchive(entries: readonly ZipEntry[]): ArchivePlan {
  const files = stripCommonRoot(entries)
  const skillPaths = files
    .map(entry => entry.path)
    .filter(path => path.toLowerCase() === SKILL_FILE || path.toLowerCase().endsWith(`/${SKILL_FILE}`))
    .sort((left, right) => directoryOf(left).length - directoryOf(right).length)

  const bundles: PlannedBundle[] = []
  const documents: DocumentInput[] = []
  const invalid: { name: string; reason: 'invalid' }[] = []
  const claimed = new Set(skillPaths)

  for (const skillPath of skillPaths) {
    const directory = directoryOf(skillPath)
    const deeper = skillPaths.filter(other => other !== skillPath && directoryOf(other).startsWith(directory) && directoryOf(other) !== directory)
    const owned = files.filter((entry) => {
      if (!entry.path.startsWith(directory)) return false
      if (entry.path === skillPath) return true
      return !deeper.some(otherDirectory => entry.path.startsWith(otherDirectory))
    })
    const skillFile = owned.find(entry => entry.path === skillPath)
    /* v8 ignore next -- the path came from this listing, so its own entry is present */
    if (skillFile === undefined) continue
    const outcome = prepareSkillDocument({ filename: skillPath, content: decode(skillFile.data) })
    if (outcome.kind === 'invalid') {
      invalid.push({ name: outcome.name, reason: 'invalid' })
      continue
    }
    bundles.push({
      skill: outcome.skill,
      directory,
      files: owned
        .filter(entry => entry.path !== skillPath)
        .map(entry => ({ path: entry.path.slice(directory.length), data: entry.data })),
    })
  }

  for (const entry of files) {
    if (claimed.has(entry.path)) continue
    if (!entry.path.toLowerCase().endsWith('.md')) continue
    if (directoryOf(entry.path) !== '') continue
    documents.push({ filename: entry.path, content: decode(entry.data) })
  }

  return { bundles, documents, invalid }
}

/** The directory prefix (with trailing `/`) that holds one `SKILL.md`, or `''` at the archive root. */
function directoryOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index < 0 ? '' : path.slice(0, index + 1)
}

/**
 * Drop the single top-level directory Finder and GitHub wrap archives in, so a
 * `my-skills/SKILL.md` layout installs the same skills as a bare `SKILL.md`.
 */
function stripCommonRoot(entries: readonly ZipEntry[]): readonly ZipEntry[] {
  const roots = new Set(entries.map(entry => entry.path.split('/', 1)[0] ?? ''))
  if (roots.size !== 1 || entries.some(entry => !entry.path.includes('/'))) return entries
  const root = [...roots][0] ?? ''
  return entries.map(entry => ({ ...entry, path: entry.path.slice(root.length + 1) }))
}

function decode(data: Uint8Array): string {
  return new TextDecoder('utf-8').decode(data)
}
