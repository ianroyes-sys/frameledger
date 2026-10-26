"use client";
import LiveGate from "./live-gate";
import Workspace from "./workspace";
export default function WorkspaceEntry({ live }: { live: boolean }) {
  return live ? (
    <LiveGate>{(session) => <Workspace liveSession={session} />}</LiveGate>
  ) : (
    <Workspace />
  );
}
