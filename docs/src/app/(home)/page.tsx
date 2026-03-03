import { FileCode2, Hash, Plug } from "lucide-react";
import Link from "next/link";
import { codeToHtml } from "shiki";

const VIVARIUM_JSON = `{
  "services": {
    "postgres": {
      "user": "app",
      "password": "secret",
      "database": "myapp"
    },
    "redis": true
  },
  "packages": {
    "backend": { "envFile": "backend/.env" },
    "frontend": {
      "envFile": "frontend/.env",
      "framework": "vite"
    }
  }
}`;

export default async function HomePage() {
  const highlighted = await codeToHtml(VIVARIUM_JSON, {
    lang: "json",
    theme: "vesper",
  });

  return (
    <main className="flex flex-col items-center w-full">
      {/* Hero with dot-grid background */}
      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 w-full max-w-4xl mx-auto overflow-hidden">
        <div
          className="hero-dot-grid absolute inset-0 pointer-events-none"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 40%, transparent 100%)",
          }}
        />

        <div className="animate-fade-up animate-fade-up-1 relative z-10 inline-block text-xs font-semibold tracking-widest uppercase text-fd-muted-foreground border border-fd-border rounded-full px-3 py-1 mb-8">
          Opinionated by design
        </div>

        <h1 className="animate-fade-up animate-fade-up-2 relative z-10 font-[family-name:var(--font-mono-display)] text-5xl sm:text-6xl font-extrabold tracking-tight text-fd-foreground leading-tight mb-6">
          Stop fighting over ports.
          <span className="animate-blink ml-1 text-fd-primary">|</span>
        </h1>

        <p className="animate-fade-up animate-fade-up-3 relative z-10 text-xl text-fd-muted-foreground max-w-2xl mb-10 leading-relaxed">
          Vivarium assigns your dev stack. You don&apos;t configure it. You just
          run it. Postgres, Valkey, and S3 spin up with zero port decisions on
          your part.
        </p>

        <div className="animate-fade-up animate-fade-up-4 relative z-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/docs/quick-start"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-fd-primary text-fd-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/niranjan94/vivarium"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 rounded-lg border border-fd-border text-fd-foreground font-semibold text-sm hover:bg-fd-accent transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Philosophy callout */}
      <section className="w-full max-w-4xl mx-auto px-6 mb-20">
        <div className="rounded-xl border border-fd-border bg-fd-card px-8 py-8 text-center">
          <p className="text-lg font-semibold text-fd-foreground mb-2">
            Vivarium makes decisions. You bring a config file. That&apos;s the
            contract.
          </p>
          <p className="text-fd-muted-foreground text-sm max-w-xl mx-auto">
            If you need to pick specific ports, swap out Postgres for MySQL, or
            configure your own S3 endpoint, Vivarium is not for you. It trades
            flexibility for zero cognitive overhead.
          </p>
        </div>
      </section>

      {/* Feature cards with icons and accent left border */}
      <section className="w-full max-w-4xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <article className="rounded-xl border border-fd-border border-l-2 border-l-fd-primary bg-fd-card p-6 hover:bg-fd-accent transition-colors">
            <Hash className="w-5 h-5 text-fd-primary mb-3" />
            <h2 className="text-base font-bold text-fd-foreground mb-2">
              Deterministic Ports
            </h2>
            <p className="text-fd-muted-foreground text-sm leading-relaxed">
              Every project gets a unique index. All ports are derived from it
              arithmetically. No conflicts, no negotiation, ever.
            </p>
          </article>
          <article className="rounded-xl border border-fd-border border-l-2 border-l-fd-primary bg-fd-card p-6 hover:bg-fd-accent transition-colors">
            <FileCode2 className="w-5 h-5 text-fd-primary mb-3" />
            <h2 className="text-base font-bold text-fd-foreground mb-2">
              Convention-Based Env
            </h2>
            <p className="text-fd-muted-foreground text-sm leading-relaxed">
              Name your package{" "}
              <code className="font-mono text-xs bg-fd-muted px-1 py-0.5 rounded">
                backend
              </code>{" "}
              or{" "}
              <code className="font-mono text-xs bg-fd-muted px-1 py-0.5 rounded">
                frontend
              </code>{" "}
              and the right env vars appear automatically. No wiring required.
            </p>
          </article>
          <article className="rounded-xl border border-fd-border border-l-2 border-l-fd-primary bg-fd-card p-6 hover:bg-fd-accent transition-colors">
            <Plug className="w-5 h-5 text-fd-primary mb-3" />
            <h2 className="text-base font-bold text-fd-foreground mb-2">
              MCP-Ready
            </h2>
            <p className="text-fd-muted-foreground text-sm leading-relaxed">
              A postgres-mcp sidecar ships automatically. Wire it to Claude or
              Cursor in seconds with no extra configuration.
            </p>
          </article>
        </div>
      </section>

      {/* Config snippet with shiki highlighting */}
      <section className="w-full max-w-4xl mx-auto px-6 mb-28">
        <div className="rounded-xl border border-fd-border bg-fd-card overflow-hidden">
          {/* Terminal chrome: macOS traffic light dots + filename */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-fd-border bg-fd-muted/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-xs font-mono text-fd-muted-foreground ml-2">
              vivarium.json
            </span>
          </div>

          <div
            className="text-sm leading-relaxed p-6 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />

          <div className="px-5 py-3 border-t border-fd-border bg-fd-muted/50 text-center">
            <p className="text-xs text-fd-muted-foreground">
              That&apos;s the whole config. Vivarium does the rest.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
