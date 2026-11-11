# 后会有期刊

绿白学术期刊风格的本地全栈开发基线。站名使用“有”，节目名《后会友期》使用“友”。

## 启动

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run server
```

默认访问 `http://127.0.0.1:5177`，端口被占用时 Vite 会选择下一个可用端口，以终端输出为准。

后端 API 默认运行在 `http://127.0.0.1:8787`。本地开发请设置管理员密码后再启动：

```powershell
$env:ADMIN_PASSWORD="local-admin-password-123456"
$env:SESSION_SECRET="local-session-secret-至少32个字符"
npm.cmd run server
```

也可以直接运行 `powershell -ExecutionPolicy Bypass -File scripts/start-local-api.ps1`，仅用于本地开发。

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

自动化浏览器测试使用本机 Microsoft Edge，无需下载另一套浏览器。测试配置端口为 5177。

## 页面

| 地址 | 内容 |
| --- | --- |
| `/` | 检索、学科索引、最新作品、本期刊物 |
| `/works` | 全文检索、体裁/学科/关键词筛选与分页 |
| `/works/:id` | 作品阅读、AI/来源标注、待审评论、分享链接 |
| `/issues` | 期刊目录 |
| `/issues/:slug` | 卷首语、分类目录、作品阅读 |
| `/submit` | 无需注册的笔名投稿、私密邮箱、体裁条件表单、预览 |
| `/admin` | 管理员登录后的稿件、评论、撤稿、组刊与草稿 |
| `/guidelines` | 投稿边界与审核规则 |
| `/about` | 刊物定位与当前版本说明 |

## 重要边界

- **已接入本地后端，但仍不是生产收稿服务。** 投稿、评论、审核与期刊保存到本地 SQLite；不发邮件，生产部署前仍需补真实运营流程。
- `/admin` 已接入管理员密码和 HttpOnly Cookie 会话；生产环境必须使用强 `ADMIN_PASSWORD` 与 `SESSION_SECRET`，并通过 HTTPS。
- 私密邮箱、授权说明、AI 工具详情和审核备注不进入公开 API；本地数据库未加密，请勿输入真实敏感信息。
- 预置作者、作品和期刊均为明确标注的示例，不引用未经核实的节目情节。
- 接受 AI 生成主体和授权转载；文学作品仍须有真实依据，不收同人、虚构剧情、想象对话或人物心理。
- 正式服务所需的生产级身份系统、私密字段加密/托管、审核审计、修订版本与邮件通知仍未接入。
- 本地新增内容的文章 ID 具备数据库持久性；尚未实现正式域名、邮件回执和跨设备作者查询。

## 实现

React + TypeScript + Vite；Express + Node SQLite 提供本地单体 API，React Router 处理路由，Zod 校验投稿，React Markdown 渲染基础 Markdown，Lucide 提供图标。禁用正文图片与原始 HTML，不添加 AI 生成接口。

原创 PNG 样刊封面位于 `public/assets/`。封面生成脚本 `scripts/generate-covers.ps1` 使用 Windows System.Drawing；含中文，建议用 PowerShell 7 执行，或用 UTF-8 读取为 ScriptBlock 执行。

业务纯函数测试位于 `src/domain.test.ts`；端到端与响应式截图测试位于 `tests/journal.spec.ts`。完整需求见上级目录 `docs/variety-journal-prd.md`，开发阶段说明见 `docs/variety-journal-implementation.md`。
