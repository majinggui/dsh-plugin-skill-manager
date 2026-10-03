/**
 * Browser-side client for the plugin's JSON route: one request per operation,
 * with the Host's stable failure code preserved for the page's branches.
 *
 * @module dsh-plugin-skill-manager/client/api
 */
import { ROUTE_PATH } from "../protocol.js";
/**
 * Send one operation to the Host.
 * @param request - the operation and its arguments.
 * @returns the decoded value or the structured failure.
 */
export async function call(request) {
    let response;
    try {
        response = await fetch(ROUTE_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request),
        });
    }
    catch (error) {
        return { ok: false, error: { code: 'internal', message: String(error) } };
    }
    let body;
    try {
        body = await response.json();
    }
    catch (error) {
        return { ok: false, error: { code: 'internal', message: `the Host response was not JSON: ${String(error)}` } };
    }
    if (typeof body !== 'object' || body === null) {
        return { ok: false, error: { code: 'internal', message: 'the Host response was not an object' } };
    }
    const envelope = body;
    if (envelope.ok === true)
        return { ok: true, value: envelope.value };
    return { ok: false, error: decodeFailure(envelope.error) };
}
function decodeFailure(error) {
    if (typeof error === 'object' && error !== null) {
        const candidate = error;
        if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
            return { code: candidate.code, message: candidate.message };
        }
    }
    return { code: 'internal', message: 'the Host reported an unreadable failure' };
}
//# sourceMappingURL=api.js.map