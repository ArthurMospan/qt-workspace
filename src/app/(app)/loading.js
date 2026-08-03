// src/app/(app)/loading.js — the workspace's route-transition skeleton.
//
// There was none, so every navigation held the previous screen until the next
// one was ready and gave no sign that anything was happening. The pause is
// short; the absence of feedback during it is what reads as "did my click
// register?".
//
// Deliberately a shape rather than a spinner: it occupies the same regions the
// real screen will, so the arriving content does not appear to jump.

function Line({ className = '', style }) {
  return <div style={style} className={`animate-pulse rounded-[6px] bg-canvas ${className}`} />;
}

export default function WorkspaceLoading() {
  return (
    <div className="flex h-full flex-col gap-[20px] p-[24px] pt-[72px]" aria-hidden="true">
      <div className="flex items-center justify-between gap-[16px]">
        <Line className="h-[24px] w-[220px]" />
        <Line className="h-[32px] w-[120px]" />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-[16px] md:grid-cols-3">
        {[0, 1, 2].map(column => (
          <div key={column} className="flex flex-col gap-[10px]">
            <Line className="h-[16px] w-[100px]" />
            {[0, 1, 2, 3].map(card => (
              <Line
                key={card}
                className="h-[72px] w-full"
                // A little variation stops four identical rectangles reading as
                // a rendering bug.
                style={{ animationDelay: `${(column * 4 + card) * 60}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Завантаження…</span>
    </div>
  );
}
