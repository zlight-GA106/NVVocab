# NVVocab 部署指南

NVVocab 是一个基于 Vite、React、TypeScript、Tailwind CSS 和 Supabase 的 PWA 词库应用。本文只说明两件事：如何部署到服务器，以及如何连接 Supabase。

## 目录

- [一、本地构建](#一-本地构建)
- [二、部署到服务器](#二-部署到服务器)
- [三、配置 Supabase 数据库](#三-配置-supabase-数据库)
- [四、连接 Supabase](#四-连接-supabase)
- [五、首次启动流程](#五-首次启动流程)


## 一、本地构建

安装依赖：

```bash
npm install
```

构建生产文件：

```bash
npm run build
```

构建完成后，静态文件会生成到：

```text
dist
```

本项目是纯前端 SPA，服务器只需要托管 `dist` 目录。

## 二、部署到服务器

### 方式 A：Nginx 静态部署

把 `dist` 上传到服务器，例如：

```text
/var/www/nvvocab/dist
```

Nginx 配置示例：

```nginx
server {
  listen 80;
  server_name your-domain.example;

  root /var/www/nvvocab/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果需要 HTTPS，建议使用 Certbot 或你的反向代理平台签发证书。

### 方式 B：Docker + Nginx

在项目根目录创建 `Dockerfile`：

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

创建 `nginx.conf`：

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

构建并运行：

```bash
npm run build
docker build -t nvvocab .
docker run -d --name nvvocab -p 8080:80 nvvocab
```

访问：

```text
http://your-server-host:8080
```

### 方式 C：Vercel、Netlify、Cloudflare Pages

构建命令：

```bash
npm run build
```

输出目录：

```text
dist
```

如果刷新子路由时出现 404，需要配置 SPA fallback，把所有路径回退到 `index.html`。

Vercel 可使用：

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Netlify 可使用：

```text
/* /index.html 200
```

## 三、配置 Supabase 数据库

数据库初始化 SQL 已整理在：

```text
wordbase.sql
```

进入 Supabase Dashboard 的 SQL Editor，复制并执行 `wordbase.sql`。

该 SQL 会创建：

- `public.wordbase`
- `public.review_logs`
- `study.target`

并启用 RLS：

- 单词表只允许当前登录用户管理自己的单词。
- 复习日志只允许当前登录用户管理自己的日志。
- 学习目标只允许当前登录用户管理自己的目标。

## 四、连接 Supabase

本项目采用 BYOB 模式，不在服务器中保存 Supabase 凭证

部署完成后，第一次打开应用会进入：

```text
/oobe
```

需要填写两项：

| 字段 | 获取位置 |
| --- | --- |
| Project URL | Supabase Dashboard 到 Project Settings 到 API |
| Publishable key | Supabase Dashboard 到 Project Settings 到 API |

Project URL 示例：

```text
https://your-project-ref.supabase.co
```

Publishable key 示例：

```text
sb_publishable_xxx
```



不要在浏览器端填写 service role key。service role key 只能用于可信服务器环境，不能提交到 GitHub，也不能放进前端代码。

如果使用自托管 Supabase，Project URL 填浏览器可访问的 API Gateway 地址，例如：

```text
http://your-supabase-host:8000
```
同时Publishable key可以在supabase安装目录的.env文件中找到    
应用会把连接信息保存到当前浏览器的 localStorage。凭证不会写入服务器，也不会进入构建产物。

## 五、首次启动流程

1. 打开部署后的站点。
2. 进入 `/oobe`，填写 Supabase Project URL 和 Publishable key。
3. 连接测试成功后进入 `/oobe/register`。
4. 创建账号。
5. 如果 Supabase Auth 关闭了邮箱确认，会直接进入仪表盘。
6. 如果 Supabase Auth 开启了邮箱确认，需要先确认邮箱，再进入 `/auth` 登录。
7. 登录后进入 `/import` 导入词库，或进入 `/settings` 维护连接与主题。

Supabase Auth 建议配置：

- 如果部署到正式域名，请在 Supabase Authentication URL Configuration 中加入站点地址。

站点地址示例：

```text
https://your-domain.example
```

允许的重定向地址示例：

```text
https://your-domain.example/**
http://127.0.0.1:5173/**
```

