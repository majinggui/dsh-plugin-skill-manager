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

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the Connection Context merge (ctx.connection).
import type {} from '@deepseek-ai/dsh-client-connection'
import z from 'schemastery'
import { SkillManager } from './manager.ts'
import { createHandler } from './http.ts'

export const name = 'skill-manager'
export const inject = ['connection']

/** Skill manager deployment configuration. */
export interface Config {
  /** DeepSeek Harness config root. Defaults to `$DSH_HOME` or `~/.dsh`. */
  dshHome?: string
  /** Shared agent config root. Defaults to `$DSH_AGENTS_HOME` or `~/.agents`. */
  agentsHome?: string
  /** Extra managed roots, reported after the two user-level defaults. */
  extraRoots?: { path: string; source: string; rank: number }[]
  /** Absolute path of the disable ledger. Defaults to `<dshHome>/skill-manager.json`. */
  stateFile?: string
  /** Directory document and GitHub imports write into. Defaults to `<dshHome>/skills`. */
  installRoot?: string
  /** Largest number of documents one GitHub import installs. */
  githubMaxFiles?: number
  /** Largest accepted GitHub document size in bytes. */
  githubMaxDocumentBytes?: number
  /** Milliseconds allowed for one GitHub import. */
  githubTimeoutMs?: number
  /** Largest number of documents one upload installs. */
  uploadMaxDocuments?: number
  /** Largest accepted upload document size in bytes. */
  uploadMaxDocumentBytes?: number
}

/** Validated plugin configuration; the loader reads this schema, `apply` reads {@link Config}. */
export const Config = z.object({
  dshHome: z.string(),
  agentsHome: z.string(),
  extraRoots: z.array(z.object({
    path: z.string(),
    source: z.string(),
    rank: z.number(),
  })).default([]),
  stateFile: z.string(),
  installRoot: z.string(),
  githubMaxFiles: z.natural().default(20),
  githubMaxDocumentBytes: z.natural().default(524288),
  githubTimeoutMs: z.natural().default(30000),
  uploadMaxDocuments: z.natural().default(20),
  uploadMaxDocumentBytes: z.natural().default(524288),
})

/** The pathname the browser half calls; absolute, no trailing slash. */
export const ROUTE_PATH = '/api/skill-manager'

/**
 * Mount the host half: one authenticated JSON route over the skill manager.
 * @param ctx - host plugin context.
 * @param config - managed roots, state file, and import bounds.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const manager = new SkillManager(ctx, config ?? {})
  const handler = createHandler(manager, ctx)
  ctx.effect(
    () => ctx.connection.fetch.register({
      path: ROUTE_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: handler,
    }),
    'skill-manager: route',
  )
}
