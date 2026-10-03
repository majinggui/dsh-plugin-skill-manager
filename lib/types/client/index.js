/**
 * Skill manager plugin — browser half.
 *
 * Registers one `settings.section` page named Skills over the plugin's own
 * JSON route. The page is built from the client's own design system
 * (`@deepseek-ai/dsh-client-ui-primitives` plus the `--dsw-*` tokens), so it
 * sits in the official Settings dialog like a shipped section.
 *
 * @module dsh-plugin-skill-manager/client
 */
import { call } from "./api.js";
import { en, zh } from "./locales.js";
import { STYLE_TAG_ID, STYLESHEET } from "./styles.js";
import { SkillManagerSection } from "./SkillManagerSection.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'skills';
/** Required client services: the settings slot ledger and the locale registry. */
export const inject = ['slots', 'locale'];
/**
 * Mount the skills settings section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skill-manager: dictionaries');
    ctx.effect(() => {
        if (document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`) !== null)
            return () => { };
        const tag = document.createElement('style');
        tag.dataset.plugin = 'skill-manager';
        tag.dataset.pluginCss = STYLE_TAG_ID;
        tag.textContent = STYLESHEET;
        document.head.appendChild(tag);
        return () => { tag.remove(); };
    }, 'skill-manager: styles');
    const t = ctx.locale.bind(NS);
    const injected = () => ({
        list: async () => await call({ op: 'list' }),
        setAgentsRoot: async (enabled) => await call({ op: 'setAgentsRoot', enabled }),
        setEnabled: async (request) => await call({ op: 'setEnabled', request }),
        read: async (path) => await call({ op: 'read', path }),
        write: async (request) => await call({ op: 'write', request }),
        install: async (request) => await call({ op: 'install', request }),
        importGitHub: async (request) => await call({ op: 'github', request }),
    });
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'skills',
        order: 18,
        label: () => t('nav'),
        locale: NS,
        inject: injected,
    }, SkillManagerSection));
}
//# sourceMappingURL=index.js.map