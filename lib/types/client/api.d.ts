/**
 * Browser-side client for the plugin's JSON route: one request per operation,
 * with the Host's stable failure code preserved for the page's branches.
 *
 * @module dsh-plugin-skill-manager/client/api
 */
import { type SkillFailure, type SkillRequest } from '../protocol.ts';
/** One request outcome: the value, or the Host's structured failure. */
export type SkillResult<Value> = {
    readonly ok: true;
    readonly value: Value;
} | {
    readonly ok: false;
    readonly error: SkillFailure;
};
/**
 * Send one operation to the Host.
 * @param request - the operation and its arguments.
 * @returns the decoded value or the structured failure.
 */
export declare function call<Value>(request: SkillRequest): Promise<SkillResult<Value>>;
//# sourceMappingURL=api.d.ts.map