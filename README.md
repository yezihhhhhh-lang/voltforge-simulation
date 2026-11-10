# VoltForge 公司经营模拟

面向中学生社团的多人公司经营模拟。所有团队通过同一个公开网站注册公司、提交每轮经营决策；管理员统一结算、公布结果并进入下一轮。

## 已实现

- 公司注册、团队登录、管理员登录
- 不同设备共享公司、轮次、决定和报表数据
- 8轮市场事件与统一市场竞争
- 生产、定价、工资、设备、研发、营销、贷款和还款决策
- 每轮真实利润表、现金流量表、资产负债表和经营明细
- 估值折线、公开排名和管理员全公司分析
- 付费购买其他公司上一轮部分情报
- 管理员查看提交、解锁、重置密码、删除公司、结算、公布、进入下一轮、导出和清空全年
- 刷新后保持登录状态与当前页面；密码支持显示/隐藏

## 技术结构

- `web/`：浏览器页面和交互
- `worker/server.js`：Cloudflare Worker API、登录会话、经营结算
- `drizzle/`：D1 数据库迁移
- `.openai/hosting.json`：Sites 部署配置
- `scripts/`：构建与检查

## 本地检查

```bash
npm run build
npm run check
```

正式部署需要三个服务器环境变量，真实值不要提交到 GitHub：

- `INVITE_CODE`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## GitHub

整个仓库可以直接上传 GitHub。`.env.example` 只列出变量名称；正式密码保存在部署平台的加密环境变量中。

## Netlify

项目可以直接连接或上传到 Netlify。构建命令、静态发布目录和 Functions 目录已经写入 `netlify.toml`。Netlify Database 迁移会创建带 `vf_` 前缀的新表，因此旧版测试表不会与正式版冲突。部署时需要保留 `INVITE_CODE`、`ADMIN_PASSWORD` 和 `SESSION_SECRET` 三个环境变量。
