/**
 * Browser-side client for the plugin's JSON route: one request per operation,
 * with the Host's stable failure code preserved for the page's branches.
 *
 * @module dsh-plugin-skill-manager/client/api
 */

import { ROUTE_PATH, type SkillFailure, type SkillRequest } from '../protocol.ts'

/** One request outcome: the value, or the Host's structured failure. */
export type SkillResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: SkillFailure }

/**
 * Send one operation to the Host.
 * @param request - the operation and its arguments.
 * @returns the decoded value or the structured failure.
 */
export async function call<Value>(request: SkillRequest): Promise<SkillResult<Value>> {
  let response: Response
  try {
    response = await fetch(ROUTE_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })
  } catch (error) {
    return { ok: false, error: { code: 'internal', message: String(error) } }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    return { ok: false, error: { code: 'internal', message: `the Host response was not JSON: ${String(error)}` } }
  }
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: { code: 'internal', message: 'the Host response was not an object' } }
  }
  const envelope = body as { ok?: unknown; value?: unknown; error?: unknown }
  if (envelope.ok === true) return { ok: true, value: envelope.value as Value }
  return { ok: false, error: decodeFailure(envelope.error) }
}

function decodeFailure(error: unknown): SkillFailure {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown }
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
      return { code: candidate.code as SkillFailure['code'], message: candidate.message }
    }
  }
  return { code: 'internal', message: 'the Host reported an unreadable failure' }
}
