/**
 * The page's stylesheet. A standalone plugin ships no build-time CSS pipeline,
 * so the rules live here as one string injected into a plugin-owned `<style>`
 * tag; every class carries the `dsm-` prefix so nothing collides with the
 * shell. Colors and geometry come from the client's own design tokens.
 *
 * @module dsh-plugin-skill-manager/client/styles
 */

/** Stable id of the injected style tag. */
export const STYLE_TAG_ID = 'dsh-plugin-skill-manager'

/** Class names the page uses. */
export const css = {
  section: 'dsm-section',
  heading: 'dsm-heading',
  intro: 'dsm-intro',
  status: 'dsm-status',
  hint: 'dsm-hint',
  failure: 'dsm-failure',
  inlineFailure: 'dsm-inline-failure',
  notice: 'dsm-notice',
  noticeOk: 'dsm-notice-ok',
  noticeError: 'dsm-notice-error',
  roots: 'dsm-roots',
  rootsLabel: 'dsm-roots-label',
  agentsRoot: 'dsm-agents-root',
  agentsRootLabel: 'dsm-agents-root-label',
  root: 'dsm-root',
  rank: 'dsm-rank',
  actions: 'dsm-actions',
  github: 'dsm-github',
  fileInput: 'dsm-file-input',
  list: 'dsm-list',
  row: 'dsm-row',
  rowMain: 'dsm-row-main',
  rowTitle: 'dsm-row-title',
  name: 'dsm-name',
  description: 'dsm-description',
  meta: 'dsm-meta',
  priority: 'dsm-priority',
  path: 'dsm-path',
  duplicate: 'dsm-duplicate',
  editor: 'dsm-editor',
  editorHeader: 'dsm-editor-header',
  textarea: 'dsm-textarea',
  editorActions: 'dsm-editor-actions',
  rowActions: 'dsm-row-actions',
  state: 'dsm-state',
} as const

/** The complete stylesheet for the page. */
export const STYLESHEET = `
.${css.section} {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 760px;
  color: var(--dsw-alias-label-primary);
}
.${css.heading} { margin: 0; font-size: 16px; font-weight: 600; }
.${css.intro}, .${css.status}, .${css.hint}, .${css.duplicate}, .${css.notice}, .${css.inlineFailure} {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
}
.${css.intro} { color: var(--dsw-alias-label-secondary); }
.${css.status}, .${css.hint}, .${css.duplicate} { color: var(--dsw-alias-label-tertiary); }
.${css.failure} {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-state-error-primary);
}
.${css.inlineFailure} { color: var(--dsw-alias-state-error-primary); }
.${css.notice} { color: var(--dsw-alias-label-secondary); }
.${css.noticeOk} { color: var(--dsw-alias-state-success-primary); }
.${css.noticeError} { color: var(--dsw-alias-state-error-primary); }
.${css.roots} {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}
.${css.rootsLabel} { color: var(--dsw-alias-label-secondary); }
.${css.root} { display: inline-flex; align-items: center; gap: 4px; }
.${css.rank} { font-variant-numeric: tabular-nums; }
.${css.agentsRoot} {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.${css.agentsRootLabel} { white-space: nowrap; }
.${css.actions}, .${css.github}, .${css.editorActions} { display: flex; align-items: center; gap: 8px; }
.${css.actions} { flex-wrap: wrap; }
.${css.github} { width: 100%; }
.${css.github} > :first-child { flex: 1 1 auto; min-width: 0; }
.${css.fileInput} { display: none; }
.${css.list} { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.${css.row} {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
  padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.${css.row}[data-state='missing'] { border-style: dashed; }
.${css.rowMain} { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1 1 auto; }
.${css.rowTitle} { display: flex; align-items: center; gap: 8px; }
.${css.name} { font-family: var(--ds-font-family-code); font-size: 13px; color: var(--dsw-alias-label-primary); }
.${css.description} { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.${css.meta} {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}
.${css.priority} { font-variant-numeric: tabular-nums; }
.${css.path} {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
  font-family: var(--ds-font-family-code);
}
.${css.rowActions} { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.${css.state} { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.${css.state}[data-enabled='true'] { color: var(--dsw-alias-label-secondary); }
.${css.editor} {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
  padding-top: 8px;
}
.${css.editorHeader} {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.${css.textarea} {
  min-height: 220px;
  width: 100%;
  resize: vertical;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  padding: 8px 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 18px;
}
`
