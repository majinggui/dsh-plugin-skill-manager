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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type SkillManagerLocaleKey } from './locales.ts';
export type { SkillManagerInjected, SkillManagerSectionProps } from './SkillManagerSection.tsx';
export type { SkillManagerLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Skill manager settings page copy. */
        skills: SkillManagerLocaleKey;
    }
}
/** Required client services: the settings slot ledger and the locale registry. */
export declare const inject: string[];
/**
 * Mount the skills settings section.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map