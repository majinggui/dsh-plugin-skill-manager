window.__ModuleLoader__.load({ id: "@majinggui/dsh-plugin-skill-manager", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react_jsx_runtime = require("react/jsx-runtime");
//#region src/protocol.ts
/**
* Wire vocabulary shared by the host and browser halves of the skill manager
* plugin. Types plus two constants only: the browser half imports this module,
* so it must stay free of Node built-ins and host code.
*
* @module dsh-plugin-skill-manager/protocol
*/
/** The pathname the browser half calls; absolute, no trailing slash. */
const ROUTE_PATH = "/api/skill-manager";
//#endregion
//#region src/client/api.ts
/**
* Browser-side client for the plugin's JSON route: one request per operation,
* with the Host's stable failure code preserved for the page's branches.
*
* @module dsh-plugin-skill-manager/client/api
*/
/**
* Send one operation to the Host.
* @param request - the operation and its arguments.
* @returns the decoded value or the structured failure.
*/
async function call(request) {
	let response;
	try {
		response = await fetch(ROUTE_PATH, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(request)
		});
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "internal",
				message: String(error)
			}
		};
	}
	let body;
	try {
		body = await response.json();
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "internal",
				message: `the Host response was not JSON: ${String(error)}`
			}
		};
	}
	if (typeof body !== "object" || body === null) return {
		ok: false,
		error: {
			code: "internal",
			message: "the Host response was not an object"
		}
	};
	const envelope = body;
	if (envelope.ok === true) return {
		ok: true,
		value: envelope.value
	};
	return {
		ok: false,
		error: decodeFailure(envelope.error)
	};
}
function decodeFailure(error) {
	if (typeof error === "object" && error !== null) {
		const candidate = error;
		if (typeof candidate.code === "string" && typeof candidate.message === "string") return {
			code: candidate.code,
			message: candidate.message
		};
	}
	return {
		code: "internal",
		message: "the Host reported an unreadable failure"
	};
}
//#endregion
//#region src/client/locales.ts
/** English copy. */
const en = {
	nav: "Skills",
	title: "Skills",
	intro: "Every skill this deployment can load from its user-level roots, with the source and precedence that decide a duplicated name.",
	roots: "Scanned roots",
	scanAgentsRoot: "Also scan the shared agents directory",
	refresh: "Refresh",
	upload: "Upload skill documents",
	tooLarge: "File is larger than this deployment accepts",
	uploadHint: "Choose Markdown documents, skill archives (.zip), or both. A document becomes one skill named by its frontmatter or file name; an archive installs every directory holding a SKILL.md, keeping the files beside it.",
	overwrite: "Replace existing skills",
	github: "Import from GitHub",
	githubPlaceholder: "https://github.com/<owner>/<repo>",
	githubAction: "Import",
	empty: "No skill documents were found in the scanned roots.",
	loading: "Reading the skill catalog…",
	retry: "Try again",
	error: "The request failed",
	priority: "Priority",
	duplicate: "Name appears in more than one root; the switch applies to every one of them.",
	stateInvalid: "Unusable",
	stateMissing: "Document missing",
	enabled: "Enabled",
	disabled: "Disabled",
	toggleOn: "Enable",
	toggleOff: "Disable",
	toggleNote: "Disabling writes disable-model-invocation: true and user-invocable: false into SKILL.md, and enabling restores the values it replaced.",
	edit: "Edit SKILL.md",
	editor: "Editing",
	save: "Save",
	cancel: "Cancel",
	saving: "Saving…",
	close: "Close editor",
	conflict: "The document changed on disk after it was opened. Reopen it to continue.",
	installed: "Installed",
	skippedExists: "Skipped (already exists)",
	skippedInvalid: "Skipped (unusable)",
	skippedTooLarge: "Skipped (too large)",
	skippedLimit: "Skipped (import limit reached)",
	sourceUserDsh: "User (~/.dsh)",
	sourceUserAgents: "Shared agents (~/.agents)",
	installRoot: "Imports are written to"
};
/** Simplified Chinese copy. */
const zh = {
	nav: "技能",
	title: "技能",
	intro: "本部署可从用户级技能目录加载的全部技能，并标出来源与决定重名的优先级。",
	roots: "扫描目录",
	scanAgentsRoot: "同时扫描共享 agents 目录",
	refresh: "刷新",
	upload: "上传技能文档",
	tooLarge: "文件超过本部署接受的大小上限",
	uploadHint: "可选择 Markdown 文档、技能包压缩文件（.zip），或两者一起。文档按 frontmatter（缺失时取文件名）成为单个技能；压缩包会安装其中每个含 SKILL.md 的目录，并保留同级文件。",
	overwrite: "覆盖已存在的技能",
	github: "从 GitHub 导入",
	githubPlaceholder: "https://github.com/<owner>/<repo>",
	githubAction: "导入",
	empty: "扫描目录中没有找到任何技能文档。",
	loading: "正在读取技能目录…",
	retry: "重试",
	error: "请求失败",
	priority: "优先级",
	duplicate: "同名技能存在于多个目录；启停会同时作用于它们。",
	stateInvalid: "无法解析",
	stateMissing: "文档已不存在",
	enabled: "已启用",
	disabled: "已停用",
	toggleOn: "启用",
	toggleOff: "停用",
	toggleNote: "停用会向 SKILL.md 写入 disable-model-invocation: true 与 user-invocable: false；启用则恢复被替换前的取值。",
	edit: "编辑 SKILL.md",
	editor: "正在编辑",
	save: "保存",
	cancel: "取消",
	saving: "保存中…",
	close: "关闭编辑器",
	conflict: "该文档在打开后已被外部修改，请重新打开后再保存。",
	installed: "已安装",
	skippedExists: "已跳过（同名已存在）",
	skippedInvalid: "已跳过（无法解析）",
	skippedTooLarge: "已跳过（文件过大）",
	skippedLimit: "已跳过（超出导入数量上限）",
	sourceUserDsh: "用户（~/.dsh）",
	sourceUserAgents: "共享 agents（~/.agents）",
	installRoot: "导入写入目录"
};
//#endregion
//#region src/client/styles.ts
/**
* The page's stylesheet. A standalone plugin ships no build-time CSS pipeline,
* so the rules live here as one string injected into a plugin-owned `<style>`
* tag; every class carries the `dsm-` prefix so nothing collides with the
* shell. Colors and geometry come from the client's own design tokens.
*
* @module dsh-plugin-skill-manager/client/styles
*/
/** Stable id of the injected style tag. */
const STYLE_TAG_ID = "dsh-plugin-skill-manager";
/** Class names the page uses. */
const css = {
	section: "dsm-section",
	heading: "dsm-heading",
	intro: "dsm-intro",
	status: "dsm-status",
	hint: "dsm-hint",
	failure: "dsm-failure",
	inlineFailure: "dsm-inline-failure",
	notice: "dsm-notice",
	noticeOk: "dsm-notice-ok",
	noticeError: "dsm-notice-error",
	roots: "dsm-roots",
	rootsLabel: "dsm-roots-label",
	agentsRoot: "dsm-agents-root",
	agentsRootLabel: "dsm-agents-root-label",
	root: "dsm-root",
	rank: "dsm-rank",
	actions: "dsm-actions",
	github: "dsm-github",
	fileInput: "dsm-file-input",
	list: "dsm-list",
	row: "dsm-row",
	rowMain: "dsm-row-main",
	rowTitle: "dsm-row-title",
	name: "dsm-name",
	description: "dsm-description",
	meta: "dsm-meta",
	priority: "dsm-priority",
	path: "dsm-path",
	duplicate: "dsm-duplicate",
	editor: "dsm-editor",
	editorHeader: "dsm-editor-header",
	textarea: "dsm-textarea",
	editorActions: "dsm-editor-actions",
	rowActions: "dsm-row-actions",
	state: "dsm-state"
};
/** The complete stylesheet for the page. */
const STYLESHEET = `
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
`;
//#endregion
//#region src/client/SkillManagerSection.tsx
/**
* Skill manager settings page: the scanned user-level skill catalog with its
* source and precedence, per-name enablement, SKILL.md editing, and document
* or GitHub installation.
*
* The page owns only viewing state; every read and write crosses the injected
* request callbacks, and the Host owns discovery, the enablement ledger, path
* confinement, and installations.
*/
/** Localized root label for each discovery source the Host reports. */
const SOURCE_KEYS = {
	"user-dsh": "sourceUserDsh",
	"user-agents": "sourceUserAgents"
};
/** Locale key naming each skip reason the Host can report. */
const SKIP_REASON_KEYS = {
	exists: "skippedExists",
	invalid: "skippedInvalid",
	"too-large": "skippedTooLarge",
	limit: "skippedLimit"
};
/** Render the skills management page. */
function SkillManagerSection(props) {
	const { t, list, setEnabled, setAgentsRoot, read, write, install, importGitHub } = props;
	const [view, setView] = (0, react.useState)({ status: "loading" });
	const [notice, setNotice] = (0, react.useState)();
	const [editor, setEditor] = (0, react.useState)();
	const [busy, setBusy] = (0, react.useState)(false);
	const [overwrite, setOverwrite] = (0, react.useState)(false);
	const [url, setUrl] = (0, react.useState)("");
	const fileInput = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		let current = true;
		Promise.resolve().then(() => list()).then((outcome) => {
			if (current) setView(toView(outcome));
		});
		return () => {
			current = false;
		};
	}, [list]);
	const refresh = () => {
		list().then((outcome) => {
			setView(toView(outcome));
		});
	};
	const toggle = (skill, next) => {
		setNotice(void 0);
		if (skill.state === "missing" || skill.state === "invalid") {
			setNotice({
				tone: "error",
				text: "the entry has no usable document to switch"
			});
			return;
		}
		setEnabled({
			name: skill.name,
			enabled: next
		}).then((outcome) => {
			if (outcome.ok) {
				setView({
					status: "ready",
					catalog: outcome.value
				});
				return;
			}
			setNotice({
				tone: "error",
				text: outcome.error.message
			});
		});
	};
	const toggleAgentsRoot = (next) => {
		setNotice(void 0);
		setAgentsRoot(next).then((outcome) => {
			if (outcome.ok) setView({
				status: "ready",
				catalog: outcome.value
			});
			else setNotice({
				tone: "error",
				text: outcome.error.message
			});
		});
	};
	const openEditor = (skill) => {
		setNotice(void 0);
		read(skill.path).then((outcome) => {
			if (outcome.ok) {
				setEditor({
					path: outcome.value.path,
					name: skill.name,
					content: outcome.value.content,
					version: outcome.value.version
				});
				return;
			}
			setNotice({
				tone: "error",
				text: outcome.error.message
			});
		});
	};
	const saveEditor = (open) => {
		setBusy(true);
		write({
			path: open.path,
			content: open.content,
			version: open.version
		}).then((outcome) => {
			setBusy(false);
			if (outcome.ok) {
				setEditor(void 0);
				setNotice({
					tone: "ok",
					text: `${t("editor")} · ${open.name} · ${t("save")}`
				});
				refresh();
				return;
			}
			setEditor((previous) => previous === void 0 ? previous : {
				...previous,
				error: outcome.error.code
			});
		});
	};
	const installed = (value) => {
		setView({
			status: "ready",
			catalog: value.catalog
		});
		setNotice({
			tone: "ok",
			text: describeInstall(value, t)
		});
	};
	const onFiles = (event) => {
		const files = [...event.target.files ?? []];
		event.target.value = "";
		if (files.length === 0) return;
		const limits = view.status === "ready" ? view.catalog.uploadLimits : void 0;
		for (const file of files) {
			const limit = file.name.toLowerCase().endsWith(".zip") ? limits?.maxArchiveBytes : limits?.maxDocumentBytes;
			if (limit !== void 0 && file.size > limit) {
				setNotice({
					tone: "error",
					text: `${file.name} — ${t("tooLarge")}: ${formatBytes(file.size)} > ${formatBytes(limit)}`
				});
				return;
			}
		}
		setBusy(true);
		setNotice(void 0);
		(async () => {
			const documents = [];
			const bundles = [];
			for (const file of files) {
				if (file.name.toLowerCase().endsWith(".zip")) {
					bundles.push({
						filename: file.name,
						data: await encodeBase64(file)
					});
					continue;
				}
				documents.push({
					filename: file.name,
					content: await file.text()
				});
			}
			return await install({
				documents,
				bundles,
				overwrite
			});
		})().then((outcome) => {
			setBusy(false);
			if (outcome.ok) installed(outcome.value);
			else setNotice({
				tone: "error",
				text: outcome.error.message
			});
		});
	};
	const runGitHub = () => {
		setBusy(true);
		setNotice(void 0);
		importGitHub({
			url: url.trim(),
			overwrite
		}).then((outcome) => {
			setBusy(false);
			if (outcome.ok) installed(outcome.value);
			else setNotice({
				tone: "error",
				text: outcome.error.message
			});
		});
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: css.section,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: css.heading,
				children: t("title")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: css.intro,
				children: t("intro")
			}),
			view.status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: css.status,
				children: t("loading")
			}),
			view.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.failure,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
					t("error"),
					": ",
					view.message
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					size: "sm",
					variant: "outline",
					onClick: () => {
						setView({ status: "loading" });
						refresh();
					},
					children: t("retry")
				})]
			}),
			view.status === "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.roots,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.rootsLabel,
						children: t("roots")
					}), view.catalog.roots.map((root) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: css.root,
						title: root.path,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: "neutral",
							children: sourceLabel(root.source, t)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: css.rank,
							children: root.rank
						})]
					}, root.path))]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: css.hint,
					title: view.catalog.installRoot,
					children: [
						t("installRoot"),
						": ",
						view.catalog.installRoot
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.agentsRoot,
					title: view.catalog.agentsRootPath,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
							checked: view.catalog.agentsRootEnabled,
							label: `${t("scanAgentsRoot")}: ${view.catalog.agentsRootPath}`,
							disabled: busy,
							onChange: toggleAgentsRoot
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.agentsRootLabel,
							children: t("scanAgentsRoot")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: css.path,
							children: view.catalog.agentsRootPath
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.actions,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							ref: fileInput,
							className: css.fileInput,
							type: "file",
							accept: ".md,text/markdown,.zip,application/zip",
							multiple: true,
							onChange: onFiles
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "outline",
							disabled: busy,
							onClick: () => {
								fileInput.current?.click();
							},
							children: t("upload")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "ghost",
							disabled: busy,
							onClick: refresh,
							children: t("refresh")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
							checked: overwrite,
							onChange: setOverwrite,
							label: t("overwrite"),
							disabled: busy
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: css.hint,
					children: t("uploadHint")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.github,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						value: url,
						"aria-label": t("github"),
						placeholder: t("githubPlaceholder"),
						disabled: busy,
						onChange: (event) => {
							setUrl(event.target.value);
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						variant: "outline",
						disabled: busy || url.trim().length === 0,
						onClick: runGitHub,
						children: t("githubAction")
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: css.hint,
					children: t("toggleNote")
				}),
				notice !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: `${css.notice} ${notice.tone === "ok" ? css.noticeOk : css.noticeError}`,
					children: notice.text
				}),
				view.catalog.skills.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: css.status,
					children: t("empty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: css.list,
					children: view.catalog.skills.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: css.row,
						"data-state": skill.state,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.rowMain,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: css.rowTitle,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
											className: css.name,
											children: skill.name
										}),
										skill.state === "invalid" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "warning",
											children: t("stateInvalid")
										}),
										skill.state === "missing" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "danger",
											children: t("stateMissing")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: css.description,
									children: skill.description.length > 0 ? skill.description : skill.error
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: css.meta,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "neutral",
											children: sourceLabel(skill.source, t)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: css.priority,
											children: [
												t("priority"),
												" ",
												skill.rank
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: css.path,
											title: skill.path,
											children: skill.path
										})
									]
								}),
								skill.duplicate && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: css.duplicate,
									children: t("duplicate")
								}),
								editor !== void 0 && editor.path === skill.path && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: css.editor,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: css.editorHeader,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("editor") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
													className: css.name,
													children: skill.name
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: css.path,
													title: skill.path,
													children: skill.path
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													size: "sm",
													variant: "ghost",
													onClick: () => {
														setEditor(void 0);
													},
													children: t("close")
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											className: css.textarea,
											value: editor.content,
											spellCheck: false,
											"aria-label": `${t("editor")} ${skill.name}`,
											onChange: (event) => {
												setEditor({
													...editor,
													content: event.target.value
												});
											}
										}),
										editor.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: css.inlineFailure,
											children: editor.error === "conflict" ? t("conflict") : editor.error
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: css.editorActions,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												size: "sm",
												variant: "primary",
												disabled: busy,
												onClick: () => {
													saveEditor(editor);
												},
												children: busy ? t("saving") : t("save")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												size: "sm",
												variant: "ghost",
												disabled: busy,
												onClick: () => {
													setEditor(void 0);
												},
												children: t("cancel")
											})]
										})
									]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.rowActions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.state,
									"data-enabled": skill.enabled ? "true" : void 0,
									children: skill.enabled ? t("enabled") : t("disabled")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
									checked: skill.enabled,
									label: `${skill.enabled ? t("toggleOff") : t("toggleOn")}: ${skill.name}`,
									disabled: busy || skill.state === "invalid",
									onChange: (next) => {
										toggle(skill, next);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: "ghost",
									disabled: busy || skill.state === "missing",
									onClick: () => {
										openEditor(skill);
									},
									children: t("edit")
								})
							]
						})]
					}, `${skill.name}:${skill.path}`))
				})
			] })
		]
	});
}
/** Render a byte count for a size complaint. */
function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes.toString()} B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1048576).toFixed(1)} MB`;
}
/**
* Base64-encode one archive, chunked so a large bundle never overflows the
* argument limit of `String.fromCharCode`.
*/
async function encodeBase64(file) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	const chunk = 32768;
	for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
	return btoa(binary);
}
function toView(outcome) {
	return outcome.ok ? {
		status: "ready",
		catalog: outcome.value
	} : {
		status: "error",
		message: outcome.error.message
	};
}
function sourceLabel(source, t) {
	const key = SOURCE_KEYS[source];
	return key === void 0 ? source : t(key);
}
/** One-line outcome of an installation, in the active language. */
function describeInstall(value, t) {
	const parts = [];
	if (value.installed.length > 0) parts.push(`${t("installed")}: ${value.installed.join(", ")}`);
	const counts = /* @__PURE__ */ new Map();
	for (const skipped of value.skipped) counts.set(skipped.reason, (counts.get(skipped.reason) ?? 0) + 1);
	for (const [reason, count] of counts) parts.push(`${t(SKIP_REASON_KEYS[reason])}: ${count.toString()}`);
	return parts.length === 0 ? t("empty") : parts.join(" · ");
}
//#endregion
//#region src/client/index.ts
/** Dictionary namespace owned by this plugin. */
const NS = "skills";
/** Required client services: the settings slot ledger and the locale registry. */
const inject = ["slots", "locale"];
/**
* Mount the skills settings section.
* @param ctx - the browser plugin context.
*/
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "skill-manager: dictionaries");
	ctx.effect(() => {
		if (document.querySelector(`style[data-plugin-css="dsh-plugin-skill-manager"]`) !== null) return () => {};
		const tag = document.createElement("style");
		tag.dataset.plugin = "skill-manager";
		tag.dataset.pluginCss = STYLE_TAG_ID;
		tag.textContent = STYLESHEET;
		document.head.appendChild(tag);
		return () => {
			tag.remove();
		};
	}, "skill-manager: styles");
	const t = ctx.locale.bind(NS);
	const injected = () => ({
		list: async () => await call({ op: "list" }),
		setAgentsRoot: async (enabled) => await call({
			op: "setAgentsRoot",
			enabled
		}),
		setEnabled: async (request) => await call({
			op: "setEnabled",
			request
		}),
		read: async (path) => await call({
			op: "read",
			path
		}),
		write: async (request) => await call({
			op: "write",
			request
		}),
		install: async (request) => await call({
			op: "install",
			request
		}),
		importGitHub: async (request) => await call({
			op: "github",
			request
		})
	});
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "skills",
		order: 18,
		label: () => t("nav"),
		locale: NS,
		inject: injected
	}, SkillManagerSection));
}
//#endregion
exports.apply = apply;
exports.inject = inject;

return module.exports;
} });
//# sourceMappingURL=client.js.map