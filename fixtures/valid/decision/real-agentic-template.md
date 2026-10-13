# Decisions (ADRs)

A single-file Architecture Decision Record register (lightweight; split into `docs/adr/NNNN-*.md`
only if it grows past ~50 entries). An ADR captures a **non-obvious decision** — something a
future reader (human or agent) would ask "why?" about. **ADRs are immutable once Accepted**:
correct the world with a *new* ADR that supersedes, don't rewrite history.

## Format

```
## ADR-NNNN: <title>
**Status:** Proposed | Accepted | Superseded by ADR-MMMM
**Date:** YYYY-MM-DD
**Decision:** what we decided, stated plainly.
**Why:** the forces — what we optimized for, what we traded away, alternatives rejected.
**Consequences:** what this makes easy/hard; what now must hold true.
```

---

## ADR-0001: Adopt the agentic-template framework
**Status:** Accepted
**Date:** TODO(domain)
**Decision:** This project uses the agentic-template — `AGENTS.md` contract with generic/domain
blocks, deterministic hooks, the universal skill set, the `/ship` Definition of Done, and the
docs/agent-layer doctrine.
**Why:** Consistent, portable agent operability across projects; deterministic safety (no secret
leaks / DB wipes); an inherited Definition of Done so prompts stay lean; a repo-as-memory shape
that supports session hand-off and autonomous looping.
**Consequences:** Generic behavior is maintained upstream in the template and synced down
(`TEMPLATE-SYNC.md`); domain behavior lives in `DOMAIN` blocks and `origin: project` skills.

## ADR-0002: The north star — git as the platform, events as the trigger, a facade over the human flow
**Status:** Accepted
**Date:** 2026-07-24
**Decision:** The framework anchors on the founding intent now pinned as the **North star** block in
`AGENTS.md`: git is the platform (changelog, issue tracker, database of ideas and their evolution,
prompts, and finally code — nothing ephemeral); agents respond to events, not polls; a few core files
drive everything; the irreducible core is three moves (plan → build → ship) around a human-based
workflow of review/approve/kick-back points; tickets carry hierarchy, context, and relationships; and
the whole thing is a simple facade that fits an existing software-engineering flow. Human roles are
defined as interfaces (`docs/roles.md`) so a higher-level agent can later assume the coordination
role — deferred with a trigger in `FUTURE.md`, not assumed.
**Why:** The intent was getting lost in implementation — say a word enough times and it stops meaning
anything. The named failure mode is *spec-chasing*: comparing features myopically until apples and
oranges look equivalent and the lived experience / original goal is gone. Forces folded in: cron-based
agent runners (OpenClaw) proved always-on agents, but the web is event-driven, so the flow must be
too; spec-driven development's real payoff is everything documented in git plus observability, not
process ceremony; prior art (Herdr giving tmux/ssh simple structure plus bespoke alerting) showed the
win is a modest facade meeting a current need — nothing profound. Alternatives rejected: a board/PM
tool as source of truth (views stay git projections), a cron scheduler at the core (events instead),
a bigger bespoke framework (a facade instead).
**Consequences:** Every proposed addition is tested against the north star — if it can't be traced to
plan/build/ship or a stakeholder decision point, it's scaffolding creep (`FUTURE.md` or nowhere).
Boards, alerts, and PM tools remain projections of git, never sources of truth. Prompt/skill changes
go through the same commit discipline as code, so the system's own evolution stays auditable. The
human workflow is the explicit interface; delegating it to an orchestrator is promotion-triggered
future work, and the merge gate is delegated last, if ever.

<!-- DOMAIN: append project ADRs as ADR-0003, ADR-0004, … -->

## ADR-0003: One stack and one deploy shape for every child
**Status:** Accepted; the stack list and the compose shape are superseded by ADR-0008, the deploy tool by ADR-0009
**Date:** 2026-09-21
**Decision:** Every child of this template runs the same stack and deploys the same way:
**NestJS** API · **Angular SSR** web · **PostgreSQL + Drizzle** (migrations, append-only journal) ·
**Valkey + BullMQ** for queues · **Docker Compose** in production with the shape in
`ops/compose.prod.template.yml` (`postgres`, `valkey`, `migrate` one-shot gating the app services,
`api`, `web`, workers, `db-backup` to the object store; `expose` never `ports`; a memory limit on
every service) · one VPS driven by a deploy tool (Coolify or equivalent) that builds nothing on the
box and deploys images by digest · **Cloudflare** in front for DNS, TLS, DDoS and the WAF ·
**Cloudflare R2** (no egress) behind the CDN for public assets, signed URLs only for gated ones.
Each child's dev port block (`PORTFOLIO.md`) keeps every project runnable side by side on one
machine. A child that deviates records the deviation and the trigger that ends it in the
`PORTFOLIO.md` stack-conformance table; a deviation without a trigger is a defect.
**Why:** Three products (a trades SaaS, a cookbook publisher, a prediction-market bot) converged on
the same components independently, and the one that deviated (an Express server composed by hand,
a runtime schema bootstrap instead of migrations, a file-store fallback) is the one whose deploy
path was broken when audited. One stack means one compose shape, one set of skills and knowledge
that apply everywhere, one hosting bill pattern, and a `deploy-readiness` audit that is the same
checklist for every child. Alternatives rejected: a managed platform per service (four bills, four
dashboards, for traffic that fits one box); letting each child pick (every promotion becomes
conditional); a monorepo of all children (couples release cadence and blast radius).
**Consequences:** `bootstrap` confirms the stack rather than choosing it; `adopt-template` records
deviations with triggers instead of rewriting a working product on day one. The compose skeleton and
the deploy doctrine are template-managed and synced. Knowledge entries assume this stack. A child
moving off a deviation (Express → NestJS, runtime bootstrap → Drizzle migrations) does it as an epic
with the `migration-safety` skill, never as a side effect of another task.

## ADR-0006: Class exemptions to the one stack are recorded once, in the class
**Status:** Accepted
**Date:** 2026-09-22
**Decision:** ADR-0003 requires every deviation to carry a trigger. Some deviations are properties of
an app class, not of a project, and have no trigger because they are correct: an operator console or
bot (class "internal tooling / ops") does not need Angular SSR (no SEO, no first paint for a
visitor, live panels over sockets), does not need a public release tag, and its access control is
the single-operator shape in `docs/_RBAC-TEMPLATE.md`. These are written in `docs/app-classes.md`
against the class, and a child of that class inherits them without a per-project row. Everything
else in ADR-0003 still applies to that class: Postgres + Drizzle migrations, Valkey + BullMQ, the
compose shape, images by digest, the off-box probe, the runbook.
**Why:** weather-prediction-markets conforms to the stack in every way that matters and would have
to record three "deviations" with invented triggers, or rebuild a loopback console as SSR to satisfy
a rule written for marketing sites. A rule that produces fake triggers stops being read.
**Consequences:** `adopt-template` checks the class first and records only project-level deviations.
`PORTFOLIO.md` conformance rows cite the class exemption instead of a trigger.

## ADR-0007: The deploy tool is a script; CI builds, the box pulls by digest
**Status:** Superseded by ADR-0009
**Date:** 2026-09-22
**Decision:** One template-managed workflow, `.github/workflows/app-ci.yml`, runs every child's
checks on every push, builds each image once on the default branch and pushes it to GHCR by commit
sha, and, when the repo variable `DEPLOY_ENABLED` is set, copies the compose file and `ops/deploy.sh`
to the box over SSH and runs the deploy by digest. `ops/deploy.sh` writes the digests into the env
file, appends `ops/releases.log`, and runs `compose pull` then `up -d --wait`; `ops/rollback.sh`
replays the previous line. A child configures all of it in `ops/ci.json`. Two scheduled workflows,
`probe.yml` and `backup-check.yml`, watch the site, the readiness endpoint and the backup bucket
from off the box. `scripts/deploy-check.mjs` verifies the repo side of every mechanical
deploy-readiness row and runs inside `scripts/check.mjs` for any child with `ops/ci.json`.
**Why:** three children had three deploy stories and none had deployed: Handshake's compose named an
image nothing built; Heirloom's CI built images but nothing deployed them, awaiting a Coolify
install that never happened; weather-markets ran on a desktop with a watchdog that dies with it. A
deploy tool on the box is another service to upgrade, back up and secure, for the work of forty
lines of shell. GitHub's cron is a free watcher that is not on the box. Digest plus a log file is a
complete rollback story with no git on the server.
**Consequences:** "Coolify or equivalent" in ADR-0003 reads as this pipeline. Every child gets it by
sync; each provides `ops/ci.json`, Dockerfiles with a `USER` line, a compose in the template shape,
`docs/runbook.md`, and turns on the switches in `docs/ci-cd.md`. Children that outgrow one box move
to the same images on something else; the workflow's deploy job is the only part that changes.

## ADR-0008: The mandate — one small SaaS, safe from day one, on my own boxes, offline on a laptop
**Status:** Accepted; superseded in part by ADR-0011 (the database dial replaces the Neon-at-first-customer trigger), ADR-0014 (tunnel ingress), ADR-0015 (the `web` container replaces Cloudflare Workers), ADR-0019 (script deploy replaces Coolify). The rest stands; `MANDATE.md` is now the authoritative text.
**Date:** 2026-09-21
**Decision:** Every child is the system described in `docs/mandate.md`, and that file is the
authoritative what-and-why; `docs/operating-guide.md` is the how. The one stack is: Cloudflare as the
whole edge (registrar, proxied DNS, WAF, Turnstile, Workers, R2, Tunnel, Access); the Angular web
app with hybrid rendering on Workers (public routes prerendered, `/app/**` client-rendered, no Node
server); a NestJS API on Hetzner boxes managed by Coolify, reachable only through a tunnel; Postgres
18 in our own `db-stack` with data on a replicated Hetzner Volume and wal-g streaming WAL to R2;
**pg-boss** inside Postgres for jobs; Better Auth with sessions in Postgres and one `canPerform`
policy module; R2 in production and an S3-compatible container locally; PostHog Cloud EU for
analytics, replay, flags, and errors; Resend in production and Mailpit locally; GitHub for repo,
Actions, GHCR, and scheduled probes. Two compose stacks always (`ops/app-stack.yaml`,
`ops/db-stack.yaml`), five environments (local, dev, QA, UAT, production) fed by one image on a
scheduled train. The contract lives in `packages/contracts` (Zod), the env schema in
`packages/config`, `.env.example` is generated. Every deviation carries a trigger from the mandate's
trigger table; a deviation without one is a defect.
**Why:** ADR-0003 chose components; the mandate chooses outcomes and derives the components from
them: revenue worth losing is assumed from day one (so PITR, replicated disk, and a rehearsed restore
precede the first customer), state lives on exactly one box and everything else is disposable, the
public surface never goes down with a box, production is the local stack with real credentials, and
the laptop runs the whole thing with the network cable pulled. Valkey + BullMQ failed the last test:
a second datastore that must be run locally and can evict, for a job feature nothing has needed.
pg-boss enqueues in the write's own transaction. A Node SSR server on the box failed the third: the
marketing page went down with the API. Supabase and Neon are named in the mandate with the reasons
they are not chosen yet, and Neon has a trigger (the first paying customer).
**Consequences:** `AGENTS.md`'s stack block names the mandate; stack and style rules move to
`.claude/rules/*.md` scoped by path so Angular rules load only under `apps/web` and Drizzle rules
only near the schema. `ops/compose.prod.template.yml` is replaced by the two stacks; the local
`compose.yml` runs the same Postgres image. `FUTURE.md` carries the mandate's trigger table; the
template's own process triggers stay beside it. `PORTFOLIO.md` scores children against the mandate.
Children on Valkey + BullMQ record it as a deviation with the trigger "a job feature pg-boss lacks is
proven necessary" or migrate as an epic with `migration-safety`. Knowledge entries that assume
Valkey are read with that in mind until re-verified.

## ADR-0009: Coolify deploys by API and webhook; the train promotes one image through four stages
**Status:** Superseded by ADR-0018 (the train, restated without Coolify) and ADR-0019 (script deploy over an inventory)
**Date:** 2026-09-21
**Decision:** CI still builds every image once and pushes it to GHCR by commit sha, and nothing is
ever built on a box. The deploy step is no longer SSH plus a compose script: `ops/deploy.sh <stage>`
sets `APP_IMAGE` on the stage's Coolify application through the API and calls its deploy webhook;
Coolify pulls and restarts, `migrate` gates `api` and `worker`, and `migrate` appends the image to
`releases.log` on the box before it runs. The web app deploys with wrangler to Workers. Promotion is
`train.yml`: every merge → dev; nightly suite + `nightly-audit` tag `dev-green/<date>`; weekdays
07:00 → QA; Mondays 09:00 → UAT after three days' dwell; Wednesdays 10:00 → production after two,
tagged `vX.Y.Z` by `scripts/release.mjs`, behind a GitHub Environment approval until
`TRAIN_AUTO_PROD`. Every hop checks CI, the smoke suite on the target, the probe over the dwell, the
PostHog error rate, and the absence of a `train:hold` issue; red stops and opens an issue.
`canary-watch.yml` rolls back on its own. `preview.yml` gives every PR a Workers preview and an api
container on a database cloned from QA. `restore-drill.yml` and `scrub.yml` run weekly.
**Why:** ADR-0007's script was the right call against a Coolify that never got installed and three
children with no deploy at all. The mandate adds a second box, five environments, and a promotion
schedule; forty lines of shell per stage per box becomes the thing that is bespoke on every server,
and "never fix on a box by hand" needs one control plane that owns env, deploys, and logs. Coolify
is that control plane; its dashboard sits behind a Cloudflare Tunnel with Access, so it adds no open
port. The train exists because "deploy on merge" is fine for dev and wrong for customers: dwell time
plus the probe plus the error rate is what turns an image into a release, and the checks are the
same whether a human or the calendar triggers the hop.
**Consequences:** `ops/deploy.sh` and `ops/rollback.sh` speak Coolify's API; `ops/ci.json` names the
stages; `docs/ci-cd.md` lists every switch, variable, and secret. The third human gate (production
release) is a GitHub Environment required reviewer, removed by setting `TRAIN_AUTO_PROD` after a
month of untouched automatic hops. `backup-check.yml` watches wal-g's base backups and WAL age
instead of nightly dumps. A red restore drill freezes the train through a `train:hold` issue the
drill opens and closes.

## ADR-0010: Enforce, don't describe — hooks in the plugin, rules by path, gates that lefthook and CI share
**Status:** Accepted; refined by ADR-0020 (the manifest, the hashes, the conformance check)
**Date:** 2026-09-21
**Decision:** Every rule that matters is a hook, a type, a test, or a CI gate. The feedback loop is,
fastest first: the LSP plugin after every edit; a PostToolUse hook that runs Biome and tsc on the
touched project and returns only failures; a PreToolUse hook that denies destructive commands,
secret files, protected paths, and a `DROP` in a migration that cites no ADR; a Stop hook that
refuses a dirty finish in loop mode; a lefthook pre-commit that runs Biome, tsc, dependency-cruiser,
the Drizzle drift check, ears-lint, and the board check; CI running the same commands from
`ops/ci.json`. A task cannot reach `review` until `scripts/ears-coverage.mjs` finds every criterion
id in a test name. Hooks live in `.claude/hooks/`, subagents in `.claude/agents/`, path-scoped rules
in `.claude/rules/`. The template is a Claude Code plugin marketplace: `.claude/` is the plugin root
(skills, agents, hooks), installed and updated with `/plugin`; rules, docs, scripts, compose, and the
`GENERIC` blocks sync by manifest, and `sync-template.mjs` writes `.template-version` and prints the
`TEMPLATE-CHANGELOG.md` entries between versions, each labeled additive, behavioral, or breaking.
**Why:** the audit that preceded this ADR found the framework describing an enforcement layer that
did not exist: no PostToolUse hook, no pre-commit tooling, an "ears-coverage gate" that only checked
sentence grammar, protected paths that were asked about rather than denied, four disjoint command
sets between hooks and CI, and template versioning deferred in `FUTURE.md`. A prose rule is
advisory; a hook is a wall. Moving hooks under `.claude/` lets one plugin carry them to every child
without a second copy to drift.
**Consequences:** a child that installs the plugin removes the hook entries from its
`.claude/settings.json` (they would fire twice); one that does not keeps them via the manifest sync.
`ops/hooks` no longer exists; the changelog marks the move breaking with the one-line fix. `AGENTS.md`
shrinks below 200 lines because stack and style rules left it. Every skill has an `evals.md`, and
`skill-evals.yml` runs them when a description changes. Criterion ids are `AC-1` form; test names
carry them.

<!-- ADR-0011 … ADR-0020: the mandate, second edition (MANDATE.md, 2026-09-23). Each names what it
     supersedes and the trigger that reverses it. Written before any file changed (TEMPLATE-CHANGES §0). -->

## ADR-0011: The database dial — `db-stack` on a data box by default, Neon at three measurable triggers
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** the Neon-at-first-customer trigger and the "move it at revenue" sentence in ADR-0008.
**Decision:** The production database is the only stateful thing in the system, and where it lives
is a dial with two positions that run the same image (`postgres:18` + pgvector + wal-g, built in
CI), the same major, the same migrations, and one `DATABASE_URL`. Position one, the default:
`db-stack` on a Hetzner data box (CX32 plus a 40 GB replicated Volume), `archive_command` shipping
every WAL segment to R2 through wal-g, a nightly base backup with 30 days' retention,
`restore-drill.yml` restoring base plus WAL into a scratch container every week and running the
smoke suite; a red drill stops the train. Position two: Neon for production only, pooled URL for
`api`, direct URL for `migrate` and `worker`, 7-day history. Flip when any one is true: the drill's
measured recovery time exceeds what a paying customer tolerates; API-driven load spikes that a box
resize cannot absorb; nobody on the team wants the 3am pager. The move is `pg_dump | psql` under
50 GB or logical replication for near-zero downtime, and no code changes. Supabase in neither
position: behind a NestJS API the browser never touches the database. Every other part of the
mandate is identical in both positions; `/db-dial` is the runbook for the move.
**Why:** ADR-0008 fixed the move to "the first paying customer", a business event that says nothing
about whether the self-hosted position is failing. Both positions are the same schema at the other
end of a URL, so the decision reduces to *when*, and *when* is three measurable conditions. Cost
says position one (the box is already paid for); the triggers say when position two is worth it.
The discipline that makes position one honest is code CI runs, not a habit: the drill stops the train.
**Consequences:** `PORTFOLIO.md` records each child's dial position and its trigger. `ops/db-stack.yaml`
is the position-one shape; `.env` per stage carries the URL. `restore-drill.yml` records recovery
time in its summary so the first trigger is a number, not a feeling. Knowledge entries that argue
"managed from day one" or "self-host forever" are read against this ADR.
**Reversed when:** the Neon bill exceeds the data box plus the on-call hours it saves for three
consecutive months while the drill's recovery time is back under tolerance — then production returns
to position one by the same `pg_dump | psql`.

## ADR-0012: pg-boss is the queue; Valkey + BullMQ exist only as a project overlay
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** the Valkey + BullMQ clause of ADR-0003; confirms ADR-0008's queue choice and adds the overlay rule.
**Decision:** Jobs go through pg-boss inside the one Postgres: enqueued in the same transaction as
the write, no second datastore, no eviction risk, pulled safely by workers on any box. Every job
carries the worker contract of ADR-0016. A product that needs BullMQ adds Valkey and its workers
in `ops/app-stack.project.yaml` (the overlay of ADR-0013) with `maxmemory-policy noeviction` and
`appendonly yes`, never `allkeys-lru`; the template ships no Valkey anywhere.
**Why:** BullMQ needs a Valkey configured as a durable store, and the template's compose configured
it as a cache (`allkeys-lru`, no persistence): a silent way to lose jobs. A queue in the database
removes a datastore from every laptop and every stage, and a job that enqueues in the write's own
transaction cannot be orphaned. BullMQ's throughput is not a need any child has demonstrated.
**Consequences:** `deploy-check` fails a base stack that names Valkey and warns on an overlay Valkey
without the durable settings. `.claude/rules/queue.md` carries the job contract. Heirloom keeps
BullMQ in its overlay until pg-boss is a task with criteria (TEMPLATE-CHANGES §8).
**Reversed when:** a job feature pg-boss lacks is proven necessary by a measured case (sustained
thousands of jobs a second, or stream semantics a product feature depends on) — then BullMQ enters
the base stack with the durable Valkey settings, and this ADR is superseded, not ignored.

## ADR-0013: Compose files are layered — template base plus a `*.project.*` overlay the sync never touches
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** whole-file replacement of compose files in `TEMPLATE-SYNC.md` and the compose consequence of ADR-0008.
**Decision:** The template owns `compose.yml`, `ops/app-stack.yaml`, and `ops/db-stack.yaml`; the
project owns `compose.project.yml`, `ops/app-stack.project.yaml`, and `ops/db-stack.project.yaml`,
merged by `COMPOSE_FILE`. A product's own services (a PDF renderer, a Valkey, an extra worker, a
different Postgres base image through the `PG_BASE` build arg) live in the overlay. Every
`*.project.*` file is excluded from the sync by rule, not by listing. `ops/services.json` names the
services a deploy must contain, and `deploy-check` asserts them against `docker compose config`
output before a deploy is allowed, together with non-root users and no published ports.
**Why:** Heirloom at template/v1.2.0 showed the failure mode of copy-based sync: template compose
files replaced the product's own, and its renderer, web server, queue store, and vector extension
vanished from the deployable stack while still being required by the code. The overlay protects
every future child from the template itself; `services.json` turns "did the merge keep my
services" into a gate.
**Consequences:** `bootstrap` writes the three overlays empty with a comment; `TEMPLATE-SYNC.md`
lists them as project-owned by rule. `deploy-check` needs Docker present to read the merged config
and falls back to the line parser with a warning where it is not. The base files stay
template-managed and whole-file, which is now safe because nothing project-specific lives in them.
**Reversed when:** Compose gains native template inheritance that makes overlays redundant, or a
child's overlay outgrows the base for two consecutive releases — the second means the base is wrong
and `promote-to-template` runs, not that the overlay rule is.

## ADR-0014: Cloudflare Tunnel is the only ingress and does the routing; no reverse proxy on a box
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** the `expose` + reverse-proxy assumption of the ADR-0003 compose template.
**Decision:** Every box runs `cloudflared` as part of the stack. The tunnel's ingress rules route by
hostname and path (`/api/*` → `api:3000`, everything else → `web:4000`), which is the reverse-proxy
job, so there is no nginx, Caddy, or Traefik on a box and no open inbound port; the Hetzner firewall
has zero inbound rules. Cloudflare terminates TLS, filters, rate-limits, and caches. Cloudflare
Access with SSO sits in front of `/admin`, the QA and UAT hostnames, and anything internal; SSH is
through Access for Infrastructure or a single allow-listed IP during setup only. Load balancing on
the free tier is the same tunnel token on more than one box; Cloudflare Load Balancing with pools
and weights is a trigger.
**Why:** A proxy on the box is a second router with nothing to route and one more open port to
defend. The tunnel is outbound-only, so a box with no inbound rules still serves traffic, and adding
capacity is adding a box with the same token. One ingress table in the repo replaces a proxy config
per box.
**Consequences:** `ops/app-stack.yaml` carries the ingress in a comment and `cloudflared` as a
service; `compose.prod.yaml --profile local` skips it because it has no laptop stand-in. The
`expose:` lines go; nothing publishes a port. `docs/_DEPLOY-READINESS-TEMPLATE.md` rows describe
the tunnel, Access, and the firewall.
**Reversed when:** a customer contract or data-residency rule forbids Cloudflare in the path — then
a box-side proxy (Caddy) implements the same ingress table and this ADR is superseded.

## ADR-0015: The web app is served from the box by Angular's own server behind three cache rules
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** the Cloudflare Workers hosting of the web app in ADR-0008.
**Decision:** A `web` container from the one image runs Angular's server (`node dist/server.mjs`)
and serves the prerendered HTML, the hashed bundle, and the app-shell fallback; the tunnel routes
everything but `/api/*` to it. `serverRoutes` declares marketing, docs, pricing, and legal as
`RenderMode.Prerender`, `/app/**` as `RenderMode.Client`, and `RenderMode.Server` is reserved for a
page that must be both indexed and personalized. Three Cloudflare cache rules: hashed assets cached
a year; prerendered HTML and `index.html` cached an hour and served stale while revalidating and on
origin error; `/api/*` and `/app/*` bypass. The origin's `Cache-Control` headers set the same policy
so rules and headers never disagree. The static bundle on Cloudflare directly is a trigger.
**Why:** Workers looked like the way to keep the public site up through an outage; it was also a
second deployment model, a second origin, and a second cookie story. The property wanted — public
pages survive a dead box — comes from serve-stale cache rules; the SEO property comes from
prerendering at build, which does not care where the files are served from. One image, one deploy,
one origin.
**Consequences:** `train.yml` and `canary-watch.yml` lose their wrangler steps; canary is PostHog
flags plus watch-and-rollback of the image. `.claude/rules/angular.md` names the container and the
rules; `deploy-check` asserts `web` in `ops/services.json`. The `web` service is gated by `migrate`
like the others.
**Reversed when:** the app shell, not only the public pages, must stay up through every box being
down at once — the mandate's trigger — then `dist/browser` moves to Cloudflare static assets or R2
and this ADR is superseded.

## ADR-0016: Elastic workers — queue age is the signal, the worker contract is code, burst boxes come and go
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** nothing; fills the gap ADR-0008 left on scaling.
**Decision:** Heavy or bursty work never runs in a request; it is a job, and capacity is the number
of worker processes pulling from the one queue, wherever they run. Every job carries a `priority`
(paid before free, interactive before batch), a `tenant_id` used for fairness (at most N active jobs
per tenant), an idempotency key, a timeout, bounded retries with backoff, and a dead-letter queue
that pages. A worker is one process with a fixed concurrency sized to memory, registers a heartbeat
row every minute, and on SIGTERM stops taking jobs and finishes the ones in flight before exiting.
The scaling signal is queue age (the oldest waiting job's age per queue), never depth. Three sources
of workers, cheapest first: the main box always; the servers at home whenever on, `worker` only,
joined through Cloudflare WARP or Tailscale, with a lower priority weight and no autoscaler; burst
boxes on demand — `scripts/scale-workers.mjs` every five minutes from a GitHub cron creates one from
`ops/cloud-init.yaml` when age passes two minutes and fewer than the ceiling exist, and after fifteen
empty minutes sends SIGTERM, waits for the heartbeat to stop, and deletes it. Queue age, worker
count, and dead-letter count are PostHog events; the scaler reads the age event. The database does
not scale this way: it resizes, until the dial flips.
**Why:** Kubernetes would solve elasticity with a control plane and a second way of describing the
stack. Because no box holds state and the queue is the seam, elasticity is "start another worker
process somewhere", and Hetzner bills by the hour, so a two-hour burst costs cents. Queue depth
misleads (a hundred one-second jobs are fine; one ten-minute job waiting is not); age is what the
user feels, and it is also the ETA the product shows.
**Consequences:** `.claude/rules/queue.md` is the contract; `ops/app-stack.yaml` carries the
heartbeat file; `ops/cloud-init.yaml` is what a burst box and a home server both boot from;
`scale-workers.yml` needs the `hcloud` token and the PostHog read key.
**Reversed when:** burst boxes are running for more than half of every day for a month — then a
permanent second box is cheaper and the autoscaler's ceiling drops — or the queue leaves Postgres
(ADR-0012 reversed), which changes the signal's source but not this contract.

## ADR-0017: Better Auth is the asserted authentication library; `_RBAC-TEMPLATE` stays the authorization doctrine
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** the hand-rolled sessions in `docs/_RBAC-TEMPLATE.md`; makes ADR-0008's auth line an ADR.
**Decision:** Authentication is Better Auth inside the API: users and sessions in our own Postgres
tables, httpOnly `Secure` `SameSite=Lax` cookies set only by the API, email or magic link locally,
the `organization`, `twoFactor`, `passkey`, and `magicLink` plugins as products need them, `sso`
when sold, `apiKey` if an API is ever sold. Authorization is unchanged: one
`canPerform(principal, action, scope)` policy module in `packages/policy`, every route through it,
every permission with a negative-path test, every tenant-scoped row carrying `tenant_id`. No box
holds a session, so any box serves any user.
**Why:** A library, not a service: it works offline, has no per-user bill, and keeps users in our
tables. Hand-rolled sessions were the one piece of security code every child would have written
differently. The split keeps the policy module the single place a permission is decided, which is
what makes the negative-path tests meaningful.
**Consequences:** `docs/_RBAC-TEMPLATE.md` drops its session section and points at Better Auth;
`.claude/rules/security.md` carries cookie and header rules; `packages/policy` is asserted by
`bootstrap`. Cloudflare Access remains the edge gate for internal surfaces (ADR-0014).
**Reversed when:** an SSO or compliance requirement that Better Auth's plugins cannot meet arrives
with a customer — then a managed identity provider fronts the same policy module, and only the
authentication half of this ADR is superseded.

## ADR-0018: The promotion train — dev → QA → UAT → production on a schedule, gated by checks it runs itself
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** the single-stage deploy of ADR-0007 and the train half of ADR-0009 (restated without Coolify).
**Decision:** Five environments, one image tagged with its commit sha, built once. Every merge to
`main` deploys dev; the nightly suite and `nightly-audit` tag `dev-green/<date>` at 02:00; weekdays
07:00 the newest `dev-green` goes to QA if the smoke suite passes; Mondays 09:00 the QA image with
three days' dwell and no blocker goes to UAT; Wednesdays 10:00 the UAT image with two days' dwell
goes to production, tagged `vX.Y.Z` from Conventional Commits, behind the `production` environment's
required reviewer until `TRAIN_AUTO_PROD`. At every hop the train checks CI green on the sha, the
smoke suite on the target, the off-box probe over the dwell, the PostHog error rate, and no open
`train:hold` issue; any red stops and opens an issue; it never retries. Canary is not a stage: risky
behavior ships dark behind a PostHog flag, opens to the team, then a percentage, then all;
`canary-watch.yml` compares the error rate to the previous release every fifteen minutes for a day
and rolls back the image on its own. Every PR gets a preview: a compose project on the dev box at
`pr-<n>.dev.<domain>` through the tunnel's wildcard, with a database cloned from QA.
**Why:** Deploy-on-merge is right for dev and wrong for customers; dwell time plus the probe plus
the error rate is what turns an image into a release, and the checks are the same whether the
calendar or a human triggers the hop. The third human gate lives in GitHub's environment reviewer,
which an agent cannot satisfy.
**Consequences:** `train.yml`, `nightly.yml`, `canary-watch.yml`, `preview.yml` implement it with
`ops/deploy.sh <stage> <tag>` (ADR-0019) as the only deploy primitive; `docs/ci-cd.md` lists every
switch. A red `restore-drill.yml` opens the `train:hold` issue.
**Reversed when:** a customer contract requires release windows the calendar cannot express, or the
team grows past the size where a weekly production hop blocks work — then the same gates run
continuously (`TRAIN_AUTO_PROD` plus daily hops) and the calendar half of this ADR is superseded.

## ADR-0019: Script deploy over an inventory of N boxes plus burst boxes; no control plane on any box
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** the Coolify half of ADR-0009; extends ADR-0007.
**Decision:** `ops/hosts.yaml` is the inventory (role per host: `app`, `worker`, `data`).
`ops/deploy.sh <stage> <tag>` runs from the workflow over SSH: for each host of the stage it writes
the stage's `.env` from the workflow's secrets, pulls the image by tag, and restarts the role's
stack with `--wait`; then it publishes `releases/current.json` to R2, which burst boxes and new boxes
read at boot. `ops/rollback.sh <stage>` is the previous entry and the same deploy. Every box is
Ubuntu 24.04 from `ops/cloud-init.yaml` in the repo: zero inbound firewall rules, key-only SSH, no
root login, unattended upgrades, Docker with the socket never exposed, log rotation; containers run
as non-root with a read-only filesystem and dropped capabilities; the image is scanned by Trivy in
CI with its base pinned by digest. A box is never patched into a new shape: it is re-created and
joins the tunnel. Nothing stateful — no dashboard, no deploy tool — lives on a box.
**Why:** Coolify is a fine product and a poor fit for this design: a stateful control plane on a
box the mandate says holds no state, and no way to manage a burst box that lives two hours. ADR-0007
found this with evidence and ADR-0009 walked away from it for the wrong reason (five environments
were assumed to need a control plane; a compose project name per stage does not). Forty lines of
shell over an inventory deploy N boxes, and `releases/current.json` lets a box that did not exist
at deploy time still start the right image.
**Consequences:** `app-ci.yml`, `train.yml`, `canary-watch.yml`, `restore-drill.yml`, and
`preview.yml` call `ops/deploy.sh`; `COOLIFY_*` secrets go, `DEPLOY_SSH_KEY` and the inventory come.
`releases.log` on the box is written by `migrate` as before. `SETUP.md` §"Your own Linux servers"
is the same cloud-init.
**Reversed when:** the fleet passes ten boxes or two regions and inventory edits become the
bottleneck — then a control plane that itself holds no state is evaluated, and the shell script
becomes its driver, not its replacement.

## ADR-0020: The template is a plugin marketplace plus a versioned file sync with a changelog; `template-check` enforces conformance
**Status:** Accepted
**Date:** 2026-09-23
**Supersedes:** refines ADR-0010; closes FUTURE.md's TEMPLATE-VERSIONING for good.
**Decision:** `.claude/` is the `agentic` plugin (skills, subagents, hooks), installed at project
scope and updated with `/plugin update agentic@agentic`. Everything that is a file rather than a
plugin — rules, docs, scripts, compose bases, workflows, the `GENERIC` blocks of `AGENTS.md` — is
listed in one `template-manifest.json` the sync reads; `TEMPLATE-SYNC.md` is generated from it.
`*.project.*` files and any file whose frontmatter says `origin: project` are excluded by rule.
The sync writes `.template-version` and the hash of every managed file it laid down; the weekly
`template-sync.yml` PR quotes the changelog entries between versions with their labels.
`template-check.yml` fails a child that drifts: `.template-version` more than two releases behind,
a managed file whose hash differs from the manifest without an `origin: project` claim, hooks not
installed, or branch protection that does not match `ops/ruleset.json` (advisory where the token
cannot read rulesets).
**Why:** Consistency is what makes agents reliable across projects: the same hooks, skills, gates,
and layout mean a skill written once works everywhere and a lesson learned once is fixed everywhere.
A manifest in prose drifted from the script twice in one week; one JSON both read is the fix. Hashes
make "did the child edit a managed file by hand" a check instead of a review question.
**Consequences:** `scripts/sync-template.mjs` and `scripts/check.mjs` read the manifest; a child's
deliberate divergence is a one-line `origin: project` claim, visible in the diff. Rules stay on the
manifest side until Claude Code plugins can carry them.
**Reversed when:** plugins can carry rules and generated docs, making the manifest sync redundant —
then everything moves into the plugin — or the template has a single child, where a sync is a git
merge and this machinery is weight.
