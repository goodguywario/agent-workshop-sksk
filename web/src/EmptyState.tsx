export function EmptyState({ what }: { what: string }) {
  return (
    <div className="empty">
      <p className="empty-title">No {what} yet</p>
      <p>Run <code>/plan-party</code> in opencode. This page updates by itself while the planner works.</p>
    </div>
  );
}
