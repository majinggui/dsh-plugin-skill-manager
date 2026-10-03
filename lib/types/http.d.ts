/**
 * The plugin's one HTTP route: decode a JSON operation, run it against the
 * manager, and encode the outcome. Failures travel as a structured envelope
 * with a stable code so the page can branch on the cause.
 *
 * @module dsh-plugin-skill-manager/http
 */
import type { Context } from '@deepseek-ai/cordis';
import { SkillManager } from './manager.ts';
/**
 * Build the route handler bound to one manager instance.
 * @param manager - the manager owning every filesystem decision.
 * @param ctx - host context used only for logging.
 * @returns a Fetch handler answering one JSON operation.
 */
export declare function createHandler(manager: SkillManager, ctx: Context): (request: Request) => Promise<Response>;
//# sourceMappingURL=http.d.ts.map