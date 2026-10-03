# dsh-plugin-skill-manager

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 客户端提供的技能管理插件：在「设置」里新增**技能**页面，列出本部署可从用户级技能目录加载的全部技能、标出决定重名的来源与优先级、可停用单个技能、可打开编辑 `SKILL.md`，并支持从上传的文档或 GitHub 仓库链接安装技能。

页面完全沿用客户端自身的设计体系——`@deepseek-ai/dsh-client-ui-primitives` 与共享的 `--dsw-*` 主题 token——并注册进官方 `settings.section` 插槽，因此在设置弹窗里的观感与内置分区一致。

## 安装

```sh
# 从 npm 安装（发布后）
dsh plugin --profile web add dsh-plugin-skill-manager@latest

# 从本仓库安装
git clone https://github.com/majinggui/dsh-plugin-skill-manager
cd dsh-plugin-skill-manager && pnpm install && pnpm build
dsh plugin --profile web add link:$(pwd)
```

然后重启对应 profile（`dsh web`、`pnpm run dev:web` 或桌面端），打开 **设置 → 技能**。

本包声明了一个 bundle 补丁（`cordis.patch.yml`），插入唯一一行插件条目，同时挂载两半：宿主半拥有一个带鉴权的 JSON 路由，浏览器半注册设置页面。

## 页面提供的能力

| 操作 | 效果 |
|---|---|
| 技能目录 | 扫描根目录下的每个 `SKILL.md` 与平铺 `.md` 文档，附带来源、优先级、绝对路径与启停状态 |
| 扫描共享 agents 目录 | 把 `~/.agents/skills` 加入或移出扫描范围；默认关闭，且选择会被记住 |
| 启用 / 停用 | 开关单个技能名（机制见下） |
| 编辑 `SKILL.md` | 把文档读入内联编辑器，并按其读取时的版本写回 |
| 上传技能文档 | 在浏览器中读取 `.md` 文件与/或技能包压缩文件（`.zip`），安装到安装根目录 |
| 从 GitHub 导入 | 读取仓库链接并安装它暴露的每个 `SKILL.md` |
| 覆盖已存在的技能 | 向安装请求传递 `overwrite`，否则已存在的同名技能会被跳过 |

无法解析的文档会连同解析错误一起列出而不是消失；两个根目录定义同名技能时会在行内说明，因为开关作用于整个名称。

### 技能压缩包

上传 `.zip` 时，其中每个含 `SKILL.md` 的目录都会作为一个技能安装，并保留同级文件（脚本、参考文档、资源）。Finder 与 GitHub「Download ZIP」常见的外层单层目录会被自动剥离；若压缩包里没有任何 `SKILL.md`，则回退为安装其根目录下的 Markdown 文档。

````text
bundle.zip
└── pdf-helper/
    ├── SKILL.md          →  ~/.dsh/skills/pdf-helper/SKILL.md  （frontmatter 已规范化）
    └── scripts/fill.sh   →  ~/.dsh/skills/pdf-helper/scripts/fill.sh
````

条目路径会被规范化：绝对路径或含 `..` 的条目一律拒绝，因此解压无法逃出安装根目录；加密、ZIP64 与不支持的压缩方式都会给出可读原因并拒绝。

### 启停的工作方式

独立插件没有目录过滤器可用，因此停用会把 harness 本就支持的这两个调用控制键写进文档 frontmatter：

```yaml
disable-model-invocation: true
user-invocable: false
```

这样该技能就会从模型目录、`skill` 工具与 `/` 菜单中消失。插件会把它替换掉的原值记录在状态文件（`<dshHome>/skill-manager.json`）中，因此启用时会精确恢复文档此前的取值——包括删除原本就不存在的键。对没有 frontmatter 的文档会拒绝停用，而不是猜测。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `dshHome` | `$DSH_HOME` 或 `~/.dsh` | Harness 配置根目录；其 `skills` 子目录既被扫描也是安装目标 |
| `agentsHome` | `$DSH_AGENTS_HOME` 或 `~/.agents` | 共享 agent 配置根目录，即页面开关控制的那一个 |
| `includeAgentsRoot` | `false` | 用户改动开关之前是否扫描该目录；此后以开关保存的选择为准 |
| `extraRoots` | `[]` | 额外的受管根目录，每项包含 `path`、`source`、`rank` |
| `stateFile` | `<dshHome>/skill-manager.json` | 启停记录文件 |
| `installRoot` | `<dshHome>/skills` | 上传与 GitHub 导入的写入目录 |
| `githubMaxFiles` | `20` | 单次 GitHub 导入安装的最大文档数 |
| `githubMaxDocumentBytes` | `524288` | 单个 GitHub 文档的字节上限 |
| `githubTimeoutMs` | `30000` | 单次 GitHub 导入的截止时间 |
| `uploadMaxDocuments` | `20` | 单次上传可安装的文档与压缩包总数上限 |
| `uploadMaxDocumentBytes` | `524288` | 单个上传 Markdown 文档的字节上限 |
| `zipMaxBytes` | `52428800` | 单个压缩文件（解压前）的字节上限（50 MB） |
| `zipMaxUncompressedBytes` | `209715200` | 单个压缩包解压后的总字节上限（200 MB） |
| `zipMaxMembers` | `2000` | 单个压缩包内的文件数上限 |
| `zipMaxEntryBytes` | `67108864` | 压缩包内单个文件解压后的大小上限（64 MB） |

在声明插件行的位置设置：

```yaml
- insert:
    - id: skill-manager
      name: dsh-plugin-skill-manager
      config:
        extraRoots:
          - path: ~/team-skills
            source: team
            rank: 300
```

### 扫描哪些根目录

默认只扫描 `$DSH_HOME/skills` 与配置的 `extraRoots`。共享 agents 目录（`$DSH_AGENTS_HOME/skills`，rank 500）在页面开关打开之前**不会**被扫描；再次关闭后，其文档会在下一次读取时从目录中消失。该选择与停用记录一起保存在状态文件里，因此重启后仍然有效，并覆盖 `includeAgentsRoot`。

路径限制刻意比扫描范围更宽：读写始终限制在**所有已配置**的根目录内，因此在扫描打开期间被停用的技能，在扫描关闭后仍然可以重新启用。

## 安全约束

- 所有读写都被限制在已配置的根目录内；越界路径会以 `outside-roots` 被拒绝。
- 写入会带上读取时的内容哈希；期间文档被改动则以 `conflict` 拒绝。
- 每次写入都经过临时兄弟文件加重命名，失败不会留下半个 `SKILL.md`。
- 除非请求要求覆盖，安装不会替换已存在的技能。
- GitHub 导入只读取名为 `SKILL.md` 的文件，通过公开 API，并受配置的文件数、体积与时间上限约束。

## 开发

```sh
pnpm install
pnpm build        # tsc -b && tsdown：产出 lib/index.js（宿主）与 lib/client.js（浏览器）
pnpm typecheck
```

`lib/` 已纳入版本控制，因此 `dsh plugin add github:<owner>/<repo>` 无需构建即可工作；改动 `src/` 后请重新构建。

源码结构：

| 路径 | 职责 |
|---|---|
| `src/index.ts` | 宿主插件：配置与唯一的路由注册 |
| `src/manager.ts` | 根目录解析、目录投影、启停、安装 |
| `src/catalog.ts` | 根目录扫描与宽容的 frontmatter 解析 |
| `src/documents.ts` | 文档规范化、原子写入、调用控制键编辑 |
| `src/github.ts` | 仓库链接解析与有界下载 |
| `src/http.ts` | 请求解码与响应编码 |
| `src/protocol.ts` | 两侧共享的 wire 词汇 |
| `src/client/` | 设置页面、其客户端、文案与样式表 |

## 限制

- 启停会编辑 `SKILL.md`（见上）；完全不允许改动技能文件的部署无法使用本页面。
- 启停按名称生效：两个根目录下的同名技能无法分别开关。
- 目录是快照：在别处新增的技能会在下次刷新后出现。
- 项目级技能不在本页面范围内；只扫描用户级与已配置的根目录。
- 压缩包只支持 stored 与 deflate 两种压缩方式；加密或 ZIP64 压缩包会被直接拒绝，而不是猜测处理。

## 许可

MIT
