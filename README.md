# NVVocab - 非易失性词库

NVVocab 是一个面向英语词汇冲刺复习的 PWA 应用。它采用 Vite、React、TypeScript、Tailwind CSS 和 Supabase 构建，核心目标是把短时记忆中的词汇通过键盘默写、间隔复习和本地离线队列固化为长期记忆。

项目采用 BYOB 模式。前端不内置任何 Supabase 项目凭证，用户在首航引导中填入自己的 Supabase Project URL 与 Publishable key，凭证仅保存到当前浏览器的 localStorage。

## 功能概览

- 首航引导：先连接 Supabase，再创建或登录账号，避免未认证导入触发 RLS 拦截。
- 仪表盘：复习热力图、词库状态分布、复习进度、连续打卡、下一轮复习时间和今日目标。
- 词库一览：按首字母、书籍或章节、导入时间筛选词库，支持删除和加入打印候选篮。
- 批量导入：粘贴教辅文本后自动解析单词、音标和释义，并写入当前登录用户的词库。
- 沉浸默写：复习模式使用 SM-2 调度，练习模式不写入复习日志；支持范围筛选、随机乱序、本次数量限制。
- 离线复习：断网时将复习结果暂存到本地队列，恢复网络后自动同步到 Supabase。
- 学习目标：维护长期目标、开始结束时间、累计投入时间和每日新增词目标。
- 打印编辑器：支持 A4 与 58mm 热敏纸排版、候选篮、拖拽排序和黑白打印输出。
- 动态取色：从图片提取 Material You 风格色盘并持久化到本地。
- PWA：支持安装到桌面或移动端主屏幕，静态资源离线缓存。

## 技术栈

- Vite 8
- React 19
- TypeScript 6
- Tailwind CSS 4
- Supabase JS 2
- React Router 7
- Recharts
- react-calendar-heatmap
- vite-plugin-pwa
- lucide-react

## 本地开发

### 环境要求

- Node.js 22 LTS 或更新版本
- npm
- 一个可用的 Supabase 项目，云端项目或自托管项目均可

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

启动后访问终端输出的本地地址，例如：

```text
http://127.0.0.1:5173
```

### 构建生产包

```bash
npm run build
```

构建产物会输出到 `dist` 目录。

### 本地预览生产包

```bash
npm run preview
```

## 连接到 Supabase

本项目不使用 `.env` 注入 Supabase 凭证。Supabase 连接信息由用户在浏览器内通过 OOBE 或系统设置页写入本地存储。

首次进入应用时，打开：

```text
/oobe
```

填写以下两项：

| 字段 | 来源 | 示例 |
| --- | --- | --- |
| Project URL | Supabase Dashboard 的 Project Settings 到 API 页面 | `https://your-project-ref.supabase.co` |
| Publishable key | Supabase Dashboard 的 Project Settings 到 API 页面 | `sb_publishable_...` |

旧项目如果还没有 Publishable key，可以使用 legacy anon public key。不要在浏览器端填写 service role key。service role key 拥有管理员权限，只能用于可信服务器环境。

凭证会保存到 localStorage：

| localStorage key | 含义 |
| --- | --- |
| `WORD_JIFFY_SB_URL` | Supabase Project URL |
| `WORD_JIFFY_SB_KEY` | Supabase Publishable key 或 legacy anon key |

如果使用自托管 Supabase，请填写对浏览器可访问的 API Gateway 地址，例如：

```text
http://192.168.95.55:8000
```

对应的公开 key 以自托管 Supabase 的配置或 `supabase status` 输出为准。

## Supabase 数据库部署

进入 Supabase SQL Editor，按顺序执行下方 SQL。脚本会创建 `public.wordbase`、`public.review_logs` 和 `study.target`，并启用 RLS。所有用户数据均通过 `auth.uid() = user_id` 隔离。

```sql
create extension if not exists "pgcrypto";

create schema if not exists study;

create table if not exists public.wordbase (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  words text not null,
  phonetic text,
  translate text not null,
  book_tag text,
  introtime timestamptz not null default now(),
  repetitions integer not null default 0,
  interval integer not null default 1,
  easiness numeric not null default 2.5,
  next_review_at timestamptz not null default now(),
  wrong_count integer not null default 0
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word_id uuid references public.wordbase(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  quality integer not null check (quality >= 0 and quality <= 5)
);

create table if not exists study.target (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  time_invested_seconds integer not null default 0,
  daily_word_target integer not null default 50,
  created_at timestamptz not null default now()
);

create index if not exists wordbase_user_next_review_idx
  on public.wordbase (user_id, next_review_at);

create index if not exists wordbase_user_book_tag_idx
  on public.wordbase (user_id, book_tag);

create index if not exists wordbase_user_introtime_idx
  on public.wordbase (user_id, introtime);

create index if not exists review_logs_user_reviewed_at_idx
  on public.review_logs (user_id, reviewed_at);

create index if not exists review_logs_user_word_idx
  on public.review_logs (user_id, word_id);

create index if not exists study_target_user_created_at_idx
  on study.target (user_id, created_at desc);

alter table public.wordbase enable row level security;
alter table public.review_logs enable row level security;
alter table study.target enable row level security;

drop policy if exists "wordbase_select_own_rows" on public.wordbase;
drop policy if exists "wordbase_insert_own_rows" on public.wordbase;
drop policy if exists "wordbase_update_own_rows" on public.wordbase;
drop policy if exists "wordbase_delete_own_rows" on public.wordbase;

create policy "wordbase_select_own_rows"
on public.wordbase
for select
to authenticated
using (auth.uid() = user_id);

create policy "wordbase_insert_own_rows"
on public.wordbase
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "wordbase_update_own_rows"
on public.wordbase
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "wordbase_delete_own_rows"
on public.wordbase
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "review_logs_select_own_rows" on public.review_logs;
drop policy if exists "review_logs_insert_own_rows" on public.review_logs;
drop policy if exists "review_logs_update_own_rows" on public.review_logs;
drop policy if exists "review_logs_delete_own_rows" on public.review_logs;

create policy "review_logs_select_own_rows"
on public.review_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "review_logs_insert_own_rows"
on public.review_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "review_logs_update_own_rows"
on public.review_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "review_logs_delete_own_rows"
on public.review_logs
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "study_target_select_own_rows" on study.target;
drop policy if exists "study_target_insert_own_rows" on study.target;
drop policy if exists "study_target_update_own_rows" on study.target;
drop policy if exists "study_target_delete_own_rows" on study.target;

create policy "study_target_select_own_rows"
on study.target
for select
to authenticated
using (auth.uid() = user_id);

create policy "study_target_insert_own_rows"
on study.target
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "study_target_update_own_rows"
on study.target
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "study_target_delete_own_rows"
on study.target
for delete
to authenticated
using (auth.uid() = user_id);
```

## Supabase Auth 配置

进入 Supabase Dashboard 的 Authentication 设置页：

1. 启用 Email 登录方式。
2. 本地快速测试时，可以关闭 Confirm email，让注册后立即建立 Session。
3. 生产环境建议开启邮箱确认，并配置可用 SMTP。
4. 如果部署到线上域名，请在 URL Configuration 中加入站点地址和允许的重定向地址。

推荐站点地址示例：

```text
https://your-domain.example
```

推荐允许的重定向地址示例：

```text
https://your-domain.example/**
http://127.0.0.1:5173/**
```

## 首次初始化流程

1. 打开应用。
2. 如果还没有本地 Supabase 凭证，会自动进入 `/oobe`。
3. 填入 Project URL 与 Publishable key，点击测试连接。
4. 连接成功后进入 `/oobe/register`。
5. 创建首个账号。如果 Supabase 关闭了邮箱确认，会自动登录并进入仪表盘。
6. 进入 `/import` 导入词库，或进入 `/settings` 维护连接凭证和主题。

如果注册成功后无法自动登录，通常是 Supabase Auth 开启了邮箱确认。先完成邮箱确认，再进入 `/auth` 登录。

## 静态部署

本项目是 SPA 静态应用，生产构建只需要部署 `dist` 目录。前端不需要服务器端环境变量。

### Vercel

构建命令：

```bash
npm run build
```

输出目录：

```text
dist
```

需要配置 SPA 回退，将所有路径回退到 `index.html`。Vercel 通常会自动处理 Vite SPA，也可以添加 `vercel.json`：

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

### Netlify

构建命令：

```bash
npm run build
```

发布目录：

```text
dist
```

添加 `dist/_redirects` 或在项目中配置：

```text
/* /index.html 200
```

### Cloudflare Pages

构建命令：

```bash
npm run build
```

构建输出目录：

```text
dist
```

为 SPA 配置回退到 `index.html`。

### Nginx

将 `dist` 目录部署到站点根目录，并配置回退：

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

## PWA 与离线同步

应用使用 `vite-plugin-pwa` 生成 Service Worker：

- 静态资源使用 CacheFirst 策略。
- Supabase REST 接口使用 NetworkOnly 策略，由前端离线队列兜底。
- 离线复习结果写入 `WORD_JIFFY_OFFLINE_QUEUE`。
- 浏览器恢复网络后，`useOfflineReviewSync` 会自动回放队列并清空已同步项。

如果需要验证离线能力，可以在浏览器 DevTools 中切换到 Offline，然后完成一次默写提交；恢复网络后刷新仪表盘检查日志是否同步。

## 本地存储键

| key | 用途 |
| --- | --- |
| `WORD_JIFFY_SB_URL` | Supabase Project URL |
| `WORD_JIFFY_SB_KEY` | Supabase Publishable key 或 legacy anon key |
| `WORD_JIFFY_M3_THEME` | 动态取色主题 |
| `WORD_JIFFY_BACKGROUND` | 动态背景色 |
| `WORD_JIFFY_OFFLINE_QUEUE` | 离线复习同步队列 |
| `WORD_JIFFY_PRINT_QUEUE` | 打印候选篮 |
| `WORD_JIFFY_CRAM_MODE` | 提前突击模式标记 |
| `WORD_JIFFY_DAILY_REVIEW_QUOTA` | 仪表盘手动复习配额 |
| `WORD_JIFFY_LEARNING_GOAL` | 旧版本地学习目标兼容数据 |

## 数据字段说明

### public.wordbase

| 字段 | 含义 |
| --- | --- |
| `words` | 单词拼写 |
| `phonetic` | 音标 |
| `translate` | 中文释义 |
| `book_tag` | 书籍或章节标签 |
| `introtime` | 导入时间 |
| `repetitions` | 连续正确次数 |
| `interval` | 下次复习间隔天数 |
| `easiness` | SM-2 简易度因子 |
| `next_review_at` | 下一次复习时间 |
| `wrong_count` | 累计错误次数 |

### public.review_logs

| 字段 | 含义 |
| --- | --- |
| `word_id` | 对应单词 |
| `reviewed_at` | 复习时间 |
| `quality` | 本次质量分，0 到 5 |

### study.target

| 字段 | 含义 |
| --- | --- |
| `title` | 学习目标名称 |
| `start_at` | 开始时间 |
| `end_at` | 结束时间 |
| `status` | `active` 或 `paused` |
| `time_invested_seconds` | 已投入秒数 |
| `daily_word_target` | 每日新增词目标 |

## SM-2 调度逻辑

复习质量分由默写结果转换：

- 完全正确且未看提示：5
- 看提示后正确：3
- 拼写错误：0

调度计算位于 `src/utils/ankiScheduler.ts`：

- `quality < 3` 时，`repetitions` 重置为 0，`interval` 重置为 1 天，`easiness` 扣减 0.2。
- `quality >= 3` 时，首次正确间隔 1 天，第二次正确间隔 6 天，之后按 `interval * easiness` 增长。
- `easiness` 最低限制为 1.3。

## 常见问题

### OOBE 测试连接失败

确认 Project URL 能被当前浏览器访问。云端 Supabase 使用 `https://your-project-ref.supabase.co`，自托管 Supabase 使用你的 API Gateway 地址。

确认 key 使用 Publishable key 或 legacy anon key，不要使用 service role key。

### 浏览器报 String contains non ISO-8859-1 code point

通常是 Supabase key 或 URL 中混入中文标点、中文注释、不可见字符或换行。重新从 Supabase Dashboard 复制 Project URL 与 Publishable key，并清空两端空格。

### 导入词库时报 401 Unauthorized 或 RLS policy

这是 RLS 生效后的正常保护。请先完成 Supabase 连接、注册或登录账号，再导入词库。导入时前端会附带当前用户的 `user_id`。

### study.target 返回 406

确认已经创建 `study` schema 和 `study.target` 表，并且查询中使用 `.schema('study')`。还要确认 RLS 策略允许当前登录用户读取自己的目标。

### 注册返回 500

检查 Supabase Auth 是否启用 Email provider。若开启 Confirm email，请配置 SMTP 或先在开发环境关闭邮箱确认。

### PWA 安装后没有更新

本项目设置了 `registerType: 'autoUpdate'`。如果浏览器缓存仍未刷新，可以关闭所有标签页后重新打开，或在 DevTools 的 Application 面板清理 Service Worker。

## 许可

本项目采用 AGPL-3.0 协议。协议文本随应用静态资源发布，路径为：

```text
/agplv3.txt
```
