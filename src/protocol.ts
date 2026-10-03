/**
 * Wire vocabulary shared by the host and browser halves of the skill manager
 * plugin. Types plus two constants only: the browser half imports this module,
 * so it must stay free of Node built-ins and host code.
 *
 * @module dsh-plugin-skill-manager/protocol
 */

/** The pathname the browser half calls; absolute, no trailing slash. */
export const ROUTE_PATH = '/api/skill-manager'

/** One skill root this plugin scans. */
export interface SkillRoot {
  /** Absolute root directory. */
  readonly path: string
  /** Discovery source identifier such as `user-dsh`; the browser localizes it. */
  readonly source: string
  /** Precedence rank shared with the harness's local provider: lower wins. */
  readonly rank: number
}

/** One skill document found under a managed root. */
export interface SkillEntry {
  /** Kebab-case name from frontmatter, or the entry name when frontmatter is unusable. */
  readonly name: string
  /** Frontmatter description; empty while `state` is `invalid`. */
  readonly description: string
  /** Discovery source identifier of the owning root. */
  readonly source: string
  /** Precedence rank of the owning root. */
  readonly rank: number
  /** Absolute root directory the document was discovered under. */
  readonly root: string
  /** Absolute path of the `SKILL.md` file, or of the flat `.md` entry. */
  readonly path: string
  /** Whether this plugin has left the skill switched on. */
  readonly enabled: boolean
  /** Frontmatter model-invocation control as the document currently declares it. */
  readonly modelInvocable: boolean
  /** Frontmatter user-invocation control as the document currently declares it. */
  readonly userInvocable: boolean
  /** Whether the document parsed into a usable skill. */
  readonly state: 'ready' | 'invalid' | 'missing'
  /** Why the document is not usable; present while `state` is not `ready`. */
  readonly error?: string
  /** Whether another scanned entry carries the same name. */
  readonly duplicate: boolean
}

/** Upload bounds the page applies before sending anything. */
export interface SkillUploadLimits {
  /** Largest accepted Markdown document, in bytes. */
  readonly maxDocumentBytes: number
  /** Largest accepted skill archive, in bytes, before extraction. */
  readonly maxArchiveBytes: number
}

/** The complete management view: scanned roots, their skills, and write targets. */
export interface SkillCatalog {
  /** Scanned roots in rank order; the shared agents root is absent while its scan is off. */
  readonly roots: readonly SkillRoot[]
  /** Whether the shared agents root is being scanned. */
  readonly agentsRootEnabled: boolean
  /** Absolute path of the shared agents root, whether or not it is scanned. */
  readonly agentsRootPath: string
  /** Every scanned document, sorted by rank, then name, then path. */
  readonly skills: readonly SkillEntry[]
  /** Directory that document and GitHub imports write into. */
  readonly installRoot: string
  /** State file backing the enable/disable ledger. */
  readonly statePath: string
  /** Upload bounds this deployment accepts. */
  readonly uploadLimits: SkillUploadLimits
}

/** Enable or disable one skill by name. */
export interface SkillToggleRequest {
  /** Kebab-case skill name. */
  readonly name: string
  /** Whether the name becomes available to the model and user catalogs. */
  readonly enabled: boolean
}

/** One skill document with its concurrency token. */
export interface SkillDocumentValue {
  /** Absolute path of the document. */
  readonly path: string
  /** Complete document text. */
  readonly content: string
  /** Opaque freshness token covering the read content. */
  readonly version: string
}

/** Replace one skill document. */
export interface SkillWriteRequest {
  /** Absolute path of the document. */
  readonly path: string
  /** Complete replacement text. */
  readonly content: string
  /** Freshness token received with the content this write is based on. */
  readonly version: string
}

/** One browser-read document offered for installation. */
export interface SkillUploadDocument {
  /** Original file name; its stem names the skill when frontmatter is missing. */
  readonly filename: string
  /** Complete document text. */
  readonly content: string
}

/** One browser-read skill archive offered for installation. */
export interface SkillUploadBundle {
  /** Original file name, used only for diagnostics. */
  readonly filename: string
  /** Complete archive bytes, base64-encoded. */
  readonly data: string
}

/** Install browser-read skill documents and archives. */
export interface SkillInstallRequest {
  /** Markdown documents to install. */
  readonly documents: readonly SkillUploadDocument[]
  /** Skill archives to install; omitted or empty when only documents are sent. */
  readonly bundles?: readonly SkillUploadBundle[]
  /** Whether an existing skill directory may be replaced. */
  readonly overwrite: boolean
}

/** Import every `SKILL.md` a GitHub repository exposes. */
export interface SkillGitHubRequest {
  /** `https://github.com/<owner>/<repo>` URL, optionally with `/tree/<ref>/<path>`. */
  readonly url: string
  /** Explicit ref; the repository default branch when omitted. */
  readonly ref?: string
  /** Whether an existing skill directory may be replaced. */
  readonly overwrite: boolean
}

/** One document that was not installed. */
export interface SkillSkippedDocument {
  /** Best-known name of the skipped document. */
  readonly name: string
  /** Why it was skipped. */
  readonly reason: 'exists' | 'invalid' | 'too-large' | 'limit'
}

/** Outcome of an install operation, with the refreshed catalog. */
export interface SkillInstallValue {
  /** Names installed by this call. */
  readonly installed: readonly string[]
  /** Documents this call left untouched. */
  readonly skipped: readonly SkillSkippedDocument[]
  /** Catalog state after the operation. */
  readonly catalog: SkillCatalog
}

/** Request bodies the browser half sends, discriminated by `op`. */
export type SkillRequest =
  | { readonly op: 'list' }
  | { readonly op: 'setAgentsRoot'; readonly enabled: boolean }
  | { readonly op: 'setEnabled'; readonly request: SkillToggleRequest }
  | { readonly op: 'read'; readonly path: string }
  | { readonly op: 'write'; readonly request: SkillWriteRequest }
  | { readonly op: 'install'; readonly request: SkillInstallRequest }
  | { readonly op: 'github'; readonly request: SkillGitHubRequest }

/** Stable failure codes the browser half branches on. */
export type SkillFailureCode =
  | 'not-found'
  | 'outside-roots'
  | 'conflict'
  | 'github'
  | 'rejected'
  | 'invalid'
  | 'internal'

/** One failed request as the browser half receives it. */
export interface SkillFailure {
  readonly code: SkillFailureCode
  readonly message: string
}
