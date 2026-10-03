/**
 * The page's stylesheet. A standalone plugin ships no build-time CSS pipeline,
 * so the rules live here as one string injected into a plugin-owned `<style>`
 * tag; every class carries the `dsm-` prefix so nothing collides with the
 * shell. Colors and geometry come from the client's own design tokens.
 *
 * @module dsh-plugin-skill-manager/client/styles
 */
/** Stable id of the injected style tag. */
export declare const STYLE_TAG_ID = "dsh-plugin-skill-manager";
/** Class names the page uses. */
export declare const css: {
    readonly section: "dsm-section";
    readonly heading: "dsm-heading";
    readonly intro: "dsm-intro";
    readonly status: "dsm-status";
    readonly hint: "dsm-hint";
    readonly failure: "dsm-failure";
    readonly inlineFailure: "dsm-inline-failure";
    readonly notice: "dsm-notice";
    readonly noticeOk: "dsm-notice-ok";
    readonly noticeError: "dsm-notice-error";
    readonly roots: "dsm-roots";
    readonly rootsLabel: "dsm-roots-label";
    readonly agentsRoot: "dsm-agents-root";
    readonly agentsRootLabel: "dsm-agents-root-label";
    readonly root: "dsm-root";
    readonly rank: "dsm-rank";
    readonly actions: "dsm-actions";
    readonly github: "dsm-github";
    readonly fileInput: "dsm-file-input";
    readonly list: "dsm-list";
    readonly row: "dsm-row";
    readonly rowMain: "dsm-row-main";
    readonly rowTitle: "dsm-row-title";
    readonly name: "dsm-name";
    readonly description: "dsm-description";
    readonly meta: "dsm-meta";
    readonly priority: "dsm-priority";
    readonly path: "dsm-path";
    readonly duplicate: "dsm-duplicate";
    readonly editor: "dsm-editor";
    readonly editorHeader: "dsm-editor-header";
    readonly textarea: "dsm-textarea";
    readonly editorActions: "dsm-editor-actions";
    readonly rowActions: "dsm-row-actions";
    readonly state: "dsm-state";
};
/** The complete stylesheet for the page. */
export declare const STYLESHEET: string;
//# sourceMappingURL=styles.d.ts.map