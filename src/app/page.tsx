export const dynamic = "force-dynamic";
import WorkspaceEntry from "@/components/workspace-entry";
export default function Home() {
  return (
    <WorkspaceEntry live={process.env.FRAMELEDGER_MODE === "production"} />
  );
}
