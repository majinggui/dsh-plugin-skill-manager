/**
 * Skill manager settings page: the scanned user-level skill catalog with its
 * source and precedence, per-name enablement, SKILL.md editing, and document
 * or GitHub installation.
 *
 * The page owns only viewing state; every read and write crosses the injected
 * request callbacks, and the Host owns discovery, the enablement ledger, path
 * confinement, and installations.
 */
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SkillCatalog, SkillDocumentValue, SkillFailure, SkillGitHubRequest, SkillInstallRequest, SkillInstallValue, SkillToggleRequest, SkillWriteRequest } from '../protocol.ts';
/** The result of one request, as the page's injected callbacks report it. */
export type SkillOutcome<Value> = {
    readonly ok: true;
    readonly value: Value;
} | {
    readonly ok: false;
    readonly error: SkillFailure;
};
/** Registration-side request face the page drives. */
export interface SkillManagerInjected {
    /** Read the current managed catalog. */
    list: () => Promise<SkillOutcome<SkillCatalog>>;
    /** Turn one skill name on or off; resolves with the refreshed catalog. */
    setEnabled: (request: SkillToggleRequest) => Promise<SkillOutcome<SkillCatalog>>;
    /** Read one skill document for the editor. */
    read: (path: string) => Promise<SkillOutcome<SkillDocumentValue>>;
    /** Replace one skill document. */
    write: (request: SkillWriteRequest) => Promise<SkillOutcome<SkillDocumentValue>>;
    /** Install documents the browser read from the user's disk. */
    install: (request: SkillInstallRequest) => Promise<SkillOutcome<SkillInstallValue>>;
    /** Install every `SKILL.md` one GitHub repository exposes. */
    importGitHub: (request: SkillGitHubRequest) => Promise<SkillOutcome<SkillInstallValue>>;
}
/**
 * Props the renderer binds for the skills settings section. The page reads the
 * locale seat and its own request face only.
 */
export type SkillManagerSectionProps = PropsLocale<'skills'> & InjectFace<SkillManagerInjected>;
/** Render the skills management page. */
export declare function SkillManagerSection(props: SkillManagerSectionProps): import("react").JSX.Element;
//# sourceMappingURL=SkillManagerSection.d.ts.map