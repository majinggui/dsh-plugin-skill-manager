/**
 * The plugin's one HTTP route: decode a JSON operation, run it against the
 * manager, and encode the outcome. Failures travel as a structured envelope
 * with a stable code so the page can branch on the cause.
 *
 * @module dsh-plugin-skill-manager/http
 */

import type { Context } from '@deepseek-ai/cordis'
import { SkillManager, SkillManagerError } from './manager.ts'
import type {
  SkillFailure,
  SkillGitHubRequest,
  SkillInstallRequest,
  SkillRequest,
  SkillToggleRequest,
  SkillUploadBundle,
  SkillUploadDocument,
  SkillWriteRequest,
} from './protocol.ts'

type Decoded = { readonly request: SkillRequest } | { readonly failure: SkillFailure }

/**
 * Build the route handler bound to one manager instance.
 * @param manager - the manager owning every filesystem decision.
 * @param ctx - host context used only for logging.
 * @returns a Fetch handler answering one JSON operation.
 */
export function createHandler(manager: SkillManager, ctx: Context): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const limit = manager.maxRequestBodyBytes
    const declared = request.headers.get('content-length')
    if (declared !== null && Number(declared) > limit) {
      return failure({ code: 'rejected', message: `the request body exceeds ${limit.toString()} bytes` }, 413)
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return failure({ code: 'invalid', message: 'the request body is not JSON' }, 400)
    }
    const decoded = decode(body)
    if ('failure' in decoded) return failure(decoded.failure, 400)
    try {
      return json({ ok: true, value: await dispatch(manager, decoded.request, request.signal) })
    } catch (error) {
      if (error instanceof SkillManagerError) {
        return failure({ code: error.code, message: error.message }, statusOf(error.code))
      }
      ctx.logger.warn(`skill-manager: request failed: ${String(error)}`)
      return failure({ code: 'internal', message: String(error) }, 500)
    }
  }
}

async function dispatch(manager: SkillManager, request: SkillRequest, signal: AbortSignal): Promise<unknown> {
  switch (request.op) {
    case 'list':
      return await manager.catalog(signal)
    case 'setAgentsRoot':
      return await manager.setAgentsRoot(request.enabled, signal)
    case 'setEnabled':
      return await manager.setEnabled(request.request, signal)
    case 'read':
      return await manager.read(request.path, signal)
    case 'write':
      return await manager.write(request.request, signal)
    case 'install':
      return await manager.install(request.request, signal)
    case 'github':
      return await manager.importGitHub(request.request, signal)
  }
}

function decode(body: unknown): Decoded {
  if (!isRecord(body)) return invalid('the request body must be an object')
  switch (body.op) {
    case 'list':
      return { request: { op: 'list' } }
    case 'setAgentsRoot':
      return typeof body.enabled === 'boolean'
        ? { request: { op: 'setAgentsRoot', enabled: body.enabled } }
        : invalid('"setAgentsRoot" requires an enabled boolean')
    case 'read':
      return typeof body.path === 'string' ? { request: { op: 'read', path: body.path } } : invalid('"read" requires a path string')
    case 'setEnabled': {
      const request = decodeToggle(body.request)
      return request === undefined ? invalid('"setEnabled" requires { name, enabled }') : { request: { op: 'setEnabled', request } }
    }
    case 'write': {
      const request = decodeWrite(body.request)
      return request === undefined ? invalid('"write" requires { path, content, version }') : { request: { op: 'write', request } }
    }
    case 'install': {
      const request = decodeInstall(body.request)
      return request === undefined ? invalid('"install" requires { documents, bundles?, overwrite }') : { request: { op: 'install', request } }
    }
    case 'github': {
      const request = decodeGitHub(body.request)
      return request === undefined ? invalid('"github" requires { url, overwrite }') : { request: { op: 'github', request } }
    }
    default:
      return invalid(`unknown operation ${JSON.stringify(body.op)}`)
  }
}

function decodeToggle(value: unknown): SkillToggleRequest | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.name !== 'string' || typeof value.enabled !== 'boolean') return undefined
  return { name: value.name, enabled: value.enabled }
}

function decodeWrite(value: unknown): SkillWriteRequest | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.path !== 'string' || typeof value.content !== 'string' || typeof value.version !== 'string') return undefined
  return { path: value.path, content: value.content, version: value.version }
}

function decodeInstall(value: unknown): SkillInstallRequest | undefined {
  if (!isRecord(value) || !Array.isArray(value.documents) || typeof value.overwrite !== 'boolean') return undefined
  const documents: SkillUploadDocument[] = []
  for (const entry of value.documents) {
    if (!isRecord(entry) || typeof entry.filename !== 'string' || typeof entry.content !== 'string') return undefined
    documents.push({ filename: entry.filename, content: entry.content })
  }
  const rawBundles = value.bundles ?? []
  if (!Array.isArray(rawBundles)) return undefined
  const bundles: SkillUploadBundle[] = []
  for (const entry of rawBundles) {
    if (!isRecord(entry) || typeof entry.filename !== 'string' || typeof entry.data !== 'string') return undefined
    bundles.push({ filename: entry.filename, data: entry.data })
  }
  return { documents, bundles, overwrite: value.overwrite }
}

function decodeGitHub(value: unknown): SkillGitHubRequest | undefined {
  if (!isRecord(value) || typeof value.url !== 'string' || typeof value.overwrite !== 'boolean') return undefined
  if (value.ref !== undefined && typeof value.ref !== 'string') return undefined
  return {
    url: value.url,
    ...value.ref === undefined ? {} : { ref: value.ref },
    overwrite: value.overwrite,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(message: string): Decoded {
  return { failure: { code: 'invalid', message } }
}

function statusOf(code: SkillManagerError['code']): number {
  switch (code) {
    case 'not-found':
      return 404
    case 'conflict':
      return 409
    case 'outside-roots':
      return 403
    case 'rejected':
      return 413
    case 'github':
    case 'invalid':
      return 400
    case 'internal':
      return 500
  }
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function failure(error: SkillFailure, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
