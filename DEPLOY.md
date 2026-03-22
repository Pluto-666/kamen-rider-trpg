# 🚀 免费部署指南 - Vercel

## 为什么选择 Vercel？

| 平台 | 免费额度 | Next.js 支持 | 部署难度 | 推荐度 |
|------|---------|-------------|---------|--------|
| **Vercel** | 100GB/月 + 无限部署 | ✅ 原生支持 | ⭐ 最简单 | ⭐⭐⭐⭐⭐ |
| Netlify | 100GB/月 | ⚠️ 需适配 | ⭐⭐ | ⭐⭐⭐ |
| Cloudflare Pages | 无限带宽 | ⚠️ Edge Runtime | ⭐⭐⭐ | ⭐⭐⭐ |
| Render | 750小时/月 | ✅ 支持 | ⭐⭐ | ⭐⭐ |

**Vercel 是 Next.js 官方平台，个人使用完全免费！**

---

## 部署步骤

### 第一步：注册账号

1. 访问 [Vercel 官网](https://vercel.com)
2. 点击 **Sign Up** 使用 GitHub 账号注册（推荐）
3. 如果没有 GitHub 账号，先去 [GitHub](https://github.com) 注册

### 第二步：推送代码到 GitHub

```bash
# 1. 初始化 Git 仓库（如果还没有）
git init

# 2. 添加所有文件
git add .

# 3. 提交
git commit -m "Initial commit: 假面骑士TRPG平台"

# 4. 在 GitHub 创建新仓库后，关联远程仓库
git remote add origin https://github.com/你的用户名/你的仓库名.git

# 5. 推送代码
git push -u origin main
```

### 第三步：在 Vercel 导入项目

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New...** → **Project**
3. 选择你的 GitHub 仓库
4. Vercel 会自动检测 Next.js 项目

### 第四步：配置环境变量 ⚠️ 重要！

在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|---|------|
| `DEEPSEEK_API_KEY` | `sk-xxxxxx` | DeepSeek AI API Key |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase 匿名密钥 |

**配置路径**：Project Settings → Environment Variables

### 第五步：部署

1. 点击 **Deploy** 按钮
2. 等待 2-3 分钟构建完成
3. 部署成功后会获得一个免费域名：`https://你的项目.vercel.app`

---

## 部署后配置

### 自定义域名（可选）

1. 进入项目 → Settings → Domains
2. 添加你的域名（需要自己购买域名）
3. 按提示配置 DNS

### 自动部署

- 每次 `git push` 到 main 分支，Vercel 会自动重新部署
- PR 请求会自动生成预览链接

---

## 常见问题

### Q: 部署失败怎么办？

检查 Vercel 的构建日志，常见原因：
- 环境变量未配置
- 依赖安装失败
- TypeScript 类型错误

### Q: 页面访问慢？

Vercel 默认使用全球 CDN，国内访问可能较慢。解决方案：
- 绑定自定义域名 + 国内 CDN
- 或考虑 Cloudflare Pages

### Q: API 超时？

免费版 API 最长执行 10 秒。如有需要：
- 优化代码减少执行时间
- 或升级到 Pro 计划

---

## 费用说明

### Vercel 免费套餐包含：

- ✅ 无限次部署
- ✅ 100GB 带宽/月（个人博客/小项目足够）
- ✅ 100GB 函数执行/月
- ✅ 自动 HTTPS
- ✅ 全球 CDN
- ✅ 预览部署

### 什么时候需要付费？

- 带宽超过 100GB/月
- 需要更长的 API 执行时间
- 需要团队协作功能

**对于个人 TRPG 项目，免费套餐完全够用！**

---

## 备选方案

如果 Vercel 不满足需求，可以考虑：

### Cloudflare Pages（完全免费，无带宽限制）

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录
wrangler login

# 部署
wrangler pages deploy .vercel/output/static
```

注意：Cloudflare 使用 Edge Runtime，部分 Node.js API 不可用。

---

## 需要帮助？

- [Vercel 官方文档](https://vercel.com/docs)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
