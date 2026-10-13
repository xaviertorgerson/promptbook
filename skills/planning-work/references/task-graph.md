# Task graph

## Cutting the walking skeleton

1. Name the riskiest assumption: the brief's, or the one-way ADR that would invalidate the most later
   work if wrong.
2. Pick the journey that exercises it and its thinnest path: one trigger, one write, one read, one
   screen or endpoint.
3. Run it through every real piece the product will use: the real data store, the real auth, the
   build that makes the one artifact, the deploy to the first real stage, the health probe, the
   browser check. A mock of a risky part defeats the purpose.
4. Its criteria are pipeline facts plus the one behaviour, plus the fitness functions the ADRs name.
5. Every other task in the epic `depends_on` it, directly or through another task.

Skip the skeleton for a bug, a chore, or a feature inside a skeleton that is already proven, unless
the feature crosses a new one-way door.

## Vertical slices

| Slice | Good | Bad |
|---|---|---|
| Unit of work | one observable behaviour of one journey, through every layer it needs | "the database layer", "all the endpoints" |
| Criteria | three to five EARS sentences, each provable by one test | a restatement of the whole epic |
| Review | one diff a human reads in one sitting | a change touching every module |

A cross-cutting change (a schema, a shared contract) is its own task that the slices depend on; flag a
breaking contract change in the spec and put the client side in the same task's criteria.

## The one-session test

A task is small enough when an agent can, in one focused session: read its guiding docs, implement,
write a test per criterion, and pass its evaluator. Signs it is too big: more than about five criteria,
two journeys, `touches` spanning unrelated modules, size L or XL, or a Context paragraph that needs
"and then". Split before `ready`; the split shares the parent through `parent:`.

## Touches, overlap and lanes

Two tasks **may run in parallel** only when no dependency path connects them **and** their `touches`
are disjoint. Globs overlap when one path could match both:

- the same glob, or one a prefix of the other (`src/bills/**` and `src/bills/api.ts`);
- a shared hot spot both must edit: a lockfile, the migrations folder, a route table, a DI module, a
  generated client, the spec's Tasks table;
- `**` overlaps everything (and is never allowed outside the skeleton).

Overlapping tasks form one **lane**: add a `depends_on` from the later one to the earlier so they run
in sequence. List the lanes in the hand-back:

```
lane A: SPLIT-1 → SPLIT-2 → SPLIT-4   (src/bills/**, migrations/**)
lane B: SPLIT-1 → SPLIT-3             (src/settle/**)
```

## The spec's Tasks table

| Task | Title | CUJ | Priority | Depends on |
|---|---|---|---|---|
| [`SPLIT-1`](tasks/SPLIT-1.md) | Walking skeleton | CUJ-1 | P0 | — |
| [`SPLIT-2`](tasks/SPLIT-2.md) | <title> | CUJ-1, CUJ-2 | P1 | `SPLIT-1` |

The CUJ column must equal each task's `cuj` frontmatter (the trace warns `task-index-agrees`).

## Scale

| Work | Graph |
|---|---|
| Bug | one task: cite the violated REQ/NFR and the CUJ; one regression criterion; no skeleton |
| Chore | one task citing the REQ/NFR it serves |
| Feature | 2–6 tasks; depend on the existing skeleton's merge, or a new skeleton for a new one-way door |
| New product | skeleton first, then the slices; 5–15 tasks per epic is typical, more means another epic |
