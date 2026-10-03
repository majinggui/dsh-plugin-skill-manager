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

import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import {
  descriptionFromBody,
  isInside,
  parseSkillDocument,
  skillNameFromEntry,
} from './catalog.ts'
import type { DisabledRecord } from './ledger.ts'

/** One complete document offered for installation. */
export interface DocumentInput {
  /** File name or repository-relative path the document came from. */
  readonly filename: string
  /** Complete document text. */
  readonly content: string
}

/** A document normalized into a writable skill bundle. */
export interface PreparedSkill {
  /** Kebab-case skill name. */
  readonly name: string
  /** Routing description written into the frontmatter. */
  readonly description: string
  /** Complete `SKILL.md` text. */
  readonly content: string
}

/** Outcome of normalizing one input document. */
export type PrepareOutcome =
  | { readonly kind: 'prepared'; readonly skill: PreparedSkill }
  | { readonly kind: 'invalid'; readonly name: string; readonly reason: 'invalid' }

/** Frontmatter keys that switch a skill off. */
const DISABLE_KEY = 'disable-model-invocation'
const USER_KEY = 'user-invocable'

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
export function prepareSkillDocument(input: DocumentInput): PrepareOutcome {
  const document = parseSkillDocument(input.content)
  const fallback = fallbackNameFromPath(input.filename)
  if (document.kind === 'unusable') {
    return { kind: 'invalid', name: fallback ?? basename(input.filename), reason: 'invalid' }
  }
  const data = document.data
  const name = stringField(data?.name) ?? fallback
  if (name === undefined) return { kind: 'invalid', name: basename(input.filename), reason: 'invalid' }
  const description = stringField(data?.description) ?? descriptionFromBody(document.body)
  if (description.length === 0) return { kind: 'invalid', name, reason: 'invalid' }
  if (data !== undefined && stringField(data.name) === name && stringField(data.description) !== undefined) {
    return { kind: 'prepared', skill: { name, description, content: input.content } }
  }
  const frontmatter = stringifyYaml({ ...data, name, description }).trimEnd()
  const body = document.body.trim()
  return {
    kind: 'prepared',
    skill: {
      name,
      description,
      content: `---\n${frontmatter}\n---\n\n${body}\n`,
    },
  }
}

/**
 * Rewrite one document's invocation keys, keeping every other field and the body.
 * @param content - the document as read.
 * @param next - the two invocation keys to set; `null` removes a key.
 * @returns the rewritten document text.
 * @throws Error when the document has no usable frontmatter block.
 */
export function withInvocation(
  content: string,
  next: { readonly [DISABLE_KEY]: string | number | boolean | null; readonly [USER_KEY]: string | number | boolean | null },
): string {
  const document = parseSkillDocument(content)
  if (document.kind === 'unusable' || document.data === undefined) {
    throw new Error('the document has no frontmatter block to switch invocation keys in')
  }
  const data: Record<string, unknown> = { ...document.data }
  for (const key of [DISABLE_KEY, USER_KEY] as const) {
    const value = next[key]
    if (value === null) delete data[key]
    else data[key] = value
  }
  return `---\n${stringifyYaml(data).trimEnd()}\n---\n${document.body}`
}

/**
 * The invocation values the ledger must remember for one document.
 * @param content - the document as read.
 * @param name - skill name used for diagnostics.
 * @returns the previous values, or `undefined` when the document is unusable.
 */
export function previousInvocation(content: string): DisabledRecord['previous'] | undefined {
  const document = parseSkillDocument(content)
  if (document.kind === 'unusable' || document.data === undefined) return undefined
  return {
    [DISABLE_KEY]: scalarOrNull(document.data[DISABLE_KEY]),
    [USER_KEY]: scalarOrNull(document.data[USER_KEY]),
  }
}

/** The invocation keys that switch a skill back off. */
export function disabledInvocation(): Parameters<typeof withInvocation>[1] {
  return { [DISABLE_KEY]: true, [USER_KEY]: false }
}

/**
 * The invocation keys that restore one ledger record.
 * @param previous - the values recorded at disable time.
 * @returns the keys to write back.
 */
export function restoredInvocation(previous: DisabledRecord['previous']): Parameters<typeof withInvocation>[1] {
  return { [DISABLE_KEY]: previous[DISABLE_KEY] ?? null, [USER_KEY]: previous[USER_KEY] ?? null }
}

/**
 * Write one prepared skill under a managed root.
 * @param root - absolute directory receiving `<name>/SKILL.md`.
 * @param skill - the normalized bundle.
 * @param overwrite - whether an existing skill directory may be replaced.
 * @returns whether the document was written or left alone.
 */
export async function installSkill(root: string, skill: PreparedSkill, overwrite: boolean): Promise<'installed' | 'exists'> {
  const directory = join(root, skill.name)
  const target = join(directory, 'SKILL.md')
  if (!overwrite && await pathExists(target)) return 'exists'
  await mkdir(directory, { recursive: true })
  await writeTextAtomic(target, skill.content)
  return 'installed'
}

/** One resource file that travels beside a bundle's `SKILL.md`. */
export interface BundleResource {
  /** Path relative to the skill directory, `/`-separated. */
  readonly path: string
  /** File bytes. */
  readonly data: Uint8Array
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
export async function installBundle(
  root: string,
  skill: PreparedSkill,
  resources: readonly BundleResource[],
  overwrite: boolean,
): Promise<'installed' | 'exists'> {
  const directory = join(root, skill.name)
  const target = join(directory, 'SKILL.md')
  if (!overwrite && await pathExists(target)) return 'exists'
  for (const resource of resources) {
    if (!isInside(directory, join(directory, resource.path))) {
      throw new Error(`bundle resource "${resource.path}" leaves the skill directory`)
    }
  }
  await mkdir(directory, { recursive: true })
  await writeTextAtomic(target, skill.content)
  for (const resource of resources) {
    const path = join(directory, resource.path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, resource.data)
  }
  return 'installed'
}

/**
 * Replace one text file through a temporary sibling, so a failed write never
 * leaves a half-written skill document.
 * @param target - absolute path to replace.
 * @param content - complete replacement text.
 */
export async function writeTextAtomic(target: string, content: string): Promise<void> {
  const temporary = join(dirname(target), `.${basename(target)}.tmp-${process.pid.toString()}`)
  await writeFile(temporary, content, { encoding: 'utf8' })
  await rename(temporary, target)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    // A missing target is the normal first-install case.
    return false
  }
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function scalarOrNull(value: unknown): string | number | boolean | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null
}

/**
 * Derive the fallback skill name from the entry path: a `SKILL.md` bundle is
 * named by its containing directory, and any other document by its own file name.
 */
function fallbackNameFromPath(filename: string): string | undefined {
  const base = basename(filename)
  return base.toLowerCase() === 'skill.md'
    ? skillNameFromEntry(basename(dirname(filename)))
    : skillNameFromEntry(base)
}
