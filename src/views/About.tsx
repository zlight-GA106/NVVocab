import { Shield } from 'lucide-react';
import type { CSSProperties } from 'react';

const sourceRepositoryUrl = 'https://github.com/zlight-GA106/NVVocab#';
const githubIconPath = '/github-mark-transparent.png';
const licenseDocumentPath = '/agplv3.txt';

const panelStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.5)',
} satisfies CSSProperties;

export default function About() {
  return (
    <main className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-2 py-10">
      <section
        className="w-full max-w-md rounded-[28px] border border-neutral-200/40 p-8 text-center shadow-sm backdrop-blur-md dark:border-white/10"
        style={panelStyle}
      >
        <img
          alt=""
          aria-hidden="true"
          className="mx-auto mb-5 size-16 rounded-full object-cover"
          src="/bwolf.png"
        />

        <h1
          className="text-4xl font-semibold tracking-normal"
          style={{ color: 'rgb(var(--m3-primary))' }}
        >
          NVVocab
        </h1>
        <p className="mt-2 text-base text-[#49454f] dark:text-[#cac4d0]">非易失性词库</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#79747e] px-5 text-sm font-medium text-[#1d1b20] transition-colors hover:bg-[rgb(var(--m3-primary)_/_0.06)] dark:border-[#938f99] dark:text-[#e6e0e9]"
            href={sourceRepositoryUrl}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt=""
              aria-hidden="true"
              className="size-4 object-contain dark:invert"
              src={githubIconPath}
            />
            <span>GitHub</span>
          </a>

          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/40 px-5 text-sm font-medium transition-colors hover:bg-[rgb(var(--m3-primary)_/_0.06)] dark:border-white/10"
            href={licenseDocumentPath}
            rel="noreferrer"
            target="_blank"
            style={{
              backgroundColor: 'rgb(var(--m3-primary-container) / 0.58)',
              color: 'rgb(var(--m3-primary))',
            }}
          >
            <Shield aria-hidden="true" className="size-4" strokeWidth={2} />
            <span>AGPL-3.0</span>
          </a>
        </div>

        <p className="mt-8 text-xs text-neutral-400">NVVocab © 2026 zlight106</p>
      </section>
    </main>
  );
}
