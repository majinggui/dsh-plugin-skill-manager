/**
 * Wire vocabulary shared by the host and browser halves of the skill manager
 * plugin. Types plus two constants only: the browser half imports this module,
 * so it must stay free of Node built-ins and host code.
 *
 * @module dsh-plugin-skill-manager/protocol
 */
/** The pathname the browser half calls; absolute, no trailing slash. */
export const ROUTE_PATH = '/api/skill-manager';
//# sourceMappingURL=protocol.js.map