"use client";
import Link from "next/link";
import LiveCards from "./live-cards";
import LivePayout from "./live-payout";
import ProtectedReserve from "./protected-reserve";
import dynamic from "next/dynamic";
const WhopVerification = dynamic(() => import("./whop-verification"), {
  ssr: false,
});
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  SlidersHorizontal,
  ChartNoAxesCombined,
  Calculator,
  Layers,
  Landmark,
  BriefcaseBusiness,
  Clock,
  type LucideIcon,
} from "lucide-react";
import {
  formatMoney as money,
  projectProfit,
  safeToSpend,
  purchaseImpact,
  type Action,
  type Invoice,
} from "@/domain";
import { useFinancialStore } from "./demo-store";
import type { LiveSession } from "./live-gate";
import { answerQuestion } from "@/lib/intelligence";
type Page =
  | "Overview"
  | "Projects"
  | "Money"
  | "Invoices"
  | "Expenses"
  | "Clients"
  | "Collaborators"
  | "Cards"
  | "Insights"
  | "Tax center"
  | "Settings";
type Modal =
  | "search"
  | "project"
  | "invoice"
  | "expense"
  | "client"
  | "collaborator"
  | "commitment"
  | "allocation"
  | "simulator"
  | "breakdown"
  | "onboarding"
  | "confirm"
  | null;
const nav: { name: Page; icon: LucideIcon }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Projects", icon: FolderOpen },
  { name: "Money", icon: Wallet },
  { name: "Invoices", icon: FileText },
  { name: "Expenses", icon: Receipt },
  { name: "Clients", icon: Users },
  { name: "Collaborators", icon: BriefcaseBusiness },
  { name: "Cards", icon: CreditCard },
  { name: "Insights", icon: ChartNoAxesCombined },
];
const templates = [
  "Wedding",
  "Portrait Session",
  "Commercial Shoot",
  "Video Production",
  "Content Retainer",
  "Social Media Retainer",
  "Design Project",
  "Custom Project",
];
const templateDefaults: Record<string, string> = {
  Wedding: "Wedding coverage · booking retainer",
  "Portrait Session": "Portrait session · session fee",
  "Commercial Shoot": "Commercial shoot · creative fee",
  "Video Production": "Video production · pre-production deposit",
  "Content Retainer": "Monthly content package · retainer",
  "Social Media Retainer": "Social media management · monthly retainer",
  "Design Project": "Design services · project deposit",
  "Custom Project": "Creative services",
};
const invoiceItems = [
  "Shoot/session fee",
  "Coverage hours",
  "Editing",
  "Retouching",
  "Additional images",
  "Video deliverables",
  "Second shooter",
  "Assistant",
  "Travel",
  "Mileage",
  "Equipment rental",
  "Studio rental",
  "Rush delivery",
  "Overtime",
  "Commercial usage",
  "Licensing",
  "Prints",
  "Albums",
  "Social deliverables",
  "Monthly retainer",
];
const categories = [
  "Gear",
  "Camera Equipment",
  "Lighting",
  "Audio",
  "Computers",
  "Storage",
  "Software",
  "Adobe",
  "AI Tools",
  "Gallery Hosting",
  "Cloud Storage",
  "Studio",
  "Rentals",
  "Travel",
  "Mileage",
  "Parking",
  "Meals",
  "Props",
  "Wardrobe",
  "Contractors",
  "Editing",
  "Printing",
  "Albums",
  "Advertising",
  "Website",
  "Insurance",
  "Education",
  "Professional Services",
  "Payment Fees",
  "Licensing",
  "Other",
];
const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const date = (v: string) =>
  new Date(v + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
function BrandMark() {
  return (
    <span className="brandmark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
function ProjectArtwork({ type, index = 0 }: { type: string; index?: number }) {
  const theme =
    type === "Wedding"
      ? "wedding"
      : type.includes("Portrait")
        ? "portrait"
        : type.includes("Commercial")
          ? "commercial"
          : type.includes("Video")
            ? "video"
            : type.includes("Design")
              ? "design"
              : type.includes("Retainer")
                ? "retainer"
                : "custom";
  return (
    <span className={`project-art project-art--${theme}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <small>{String(index + 1).padStart(2, "0")}</small>
    </span>
  );
}
function Chip({ children, status }: { children?: ReactNode; status: string }) {
  return (
    <span className={"chip " + status}>
      {children ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required = true,
  children,
  wide = false,
  min,
  max,
  step,
  list,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  children?: ReactNode;
  wide?: boolean;
  min?: string;
  max?: string;
  step?: string;
  list?: string;
}) {
  return (
    <label className={"field " + (wide ? "wide" : "")}>
      {label}
      {children ? (
        <select name={name} defaultValue={defaultValue} required={required}>
          {children}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          min={min}
          max={max}
          step={step}
          list={list}
        />
      )}
    </label>
  );
}
function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const root = ref.current;
    const fields = root?.querySelectorAll<HTMLElement>(
      "button,input,select,textarea,a[href]",
    );
    fields?.[1]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = root?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modalback"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <div className="modalhead">
          <h2 id="modal-title">{title}</h2>
          <button
            className="iconbtn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function LedgerLine({
  label,
  value,
  total = false,
}: {
  label: string;
  value: number;
  total?: boolean;
}) {
  return (
    <div className={"ledgerline " + (total ? "total" : "")}>
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Layers size={27} />
      <h2>{title}</h2>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export default function Workspace({
  liveSession,
}: {
  liveSession?: LiveSession;
}) {
  const {
    state: s,
    dispatch,
    refresh,
    ready,
    storageError,
  } = useFinancialStore(liveSession);
  const live = !!liveSession;
  const [page, setPage] = useState<Page>("Overview");
  const [draftProject, setDraftProject] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [purchaseInput, setPurchaseInput] = useState("2400");
  const purchase = /^\d+(\.\d{1,2})?$/.test(purchaseInput)
    ? Math.round(Number(purchaseInput) * 100)
    : NaN;
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ReturnType<
    typeof answerQuestion
  > | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    detail: string;
    action: Action;
  } | null>(null);
  const [business, setBusiness] = useState("Your creative studio");
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(
          live
            ? `frameledger-business-${liveSession?.businessId}`
            : "frameledger-business",
        );
        if (saved) setBusiness(saved);
      } catch {
        /* Browser storage may be blocked. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [live, liveSession?.businessId]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !modal &&
        ready
      ) {
        event.preventDefault();
        setSearchQuery("");
        setModal("search");
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [modal, ready]);
  const searchTerm = searchQuery.trim().toLowerCase();
  const searchResults = [
    ...s.projects.map((p) => ({
      key: `project-${p.id}`,
      title: p.name,
      detail: `Project · ${s.clients.find((c) => c.id === p.clientId)?.name ?? p.type}`,
      page: "Projects" as Page,
      projectId: p.id,
      invoiceNumber: "",
    })),
    ...s.invoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      title: invoice.number,
      detail: `Invoice · ${s.projects.find((p) => p.id === invoice.projectId)?.name ?? invoice.description}`,
      page: "Invoices" as Page,
      projectId: "",
      invoiceNumber: invoice.number,
    })),
    ...[
      ...nav.map((item) => item.name),
      "Tax center" as Page,
      "Settings" as Page,
    ].map((name) => ({
      key: `page-${name}`,
      title: name,
      detail: "Go to workspace page",
      page: name,
      projectId: "",
      invoiceNumber: "",
    })),
  ]
    .filter((result) =>
      `${result.title} ${result.detail}`.toLowerCase().includes(searchTerm),
    )
    .slice(0, 10);
  const cash = safeToSpend(s);
  const balanceStale = Boolean(
    live &&
    s.balanceSyncedAt &&
    (!Number.isFinite(Date.parse(s.balanceSyncedAt)) ||
      clock - Date.parse(s.balanceSyncedAt) > 15 * 60 * 1000),
  );
  const outstanding = s.invoices
    .filter((i) => i.status !== "void")
    .reduce((n, i) => n + i.amount - i.paid, 0);
  const income = s.payments.reduce((n, p) => n + p.amount - p.refunded, 0);
  const outgo =
    s.expenses.reduce((n, e) => n + e.amount, 0) +
    s.commitments.reduce((n, c) => n + c.paid, 0);
  const overdue = s.invoices.filter(
    (i) => ["sent", "partial"].includes(i.status) && i.dueDate < today(),
  );
  const missing = s.expenses.filter((e) => !e.receipt);
  const project = selected
    ? s.projects.find((p) => p.id === selected)
    : undefined;
  function go(p: Page) {
    setPage(p);
    setSelected(null);
    setQuery("");
    setMobile(false);
  }
  function open(m: Modal) {
    setError("");
    if (balanceStale && m === "simulator") {
      setError(
        "Refresh your provider balance before simulating a purchase. The last sync is more than 15 minutes old.",
      );
      return;
    }
    if (m === "invoice")
      setDraftProject(
        selected ?? s.projects.find((p) => p.status === "active")?.id ?? "",
      );
    if (
      live &&
      !s.balanceSyncedAt &&
      ["simulator", "breakdown"].includes(m ?? "")
    ) {
      setError(
        "Reconcile your financial account before using cash calculations.",
      );
      return;
    }
    setModal(m);
  }
  const close = useCallback(() => {
    setModal(null);
    setError("");
  }, []);
  async function act(a: Action, message: string) {
    try {
      await dispatch(a);
      setToast(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn’t save this change.",
      );
      return false;
    }
  }
  function ask(a: Action, title: string, detail: string) {
    setConfirm({ action: a, title, detail });
    open("confirm");
  }
  function projectOptions() {
    return s.projects
      .filter((p) => p.status === "active")
      .map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ));
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (n: string) => String(f.get(n) ?? "").trim();
    const cents = (n: string) => {
      const v = str(n);
      if (!/^\d+(\.\d{1,2})?$/.test(v))
        throw new Error(
          "Enter an amount with no more than two decimal places.",
        );
      return Math.round(Number(v) * 100);
    };
    try {
      let action: Action | undefined;
      let message = "Changes saved";
      switch (modal) {
        case "project":
          action = {
            type: "CREATE_PROJECT",
            project: {
              id: uid(),
              name: str("name"),
              clientId: str("clientId"),
              type: str("type"),
              date: str("date"),
              value: cents("amount"),
              status: "active",
            },
          };
          message = "Project wallet created";
          break;
        case "client":
          action = {
            type: "CREATE_CLIENT",
            client: {
              id: uid(),
              name: str("name"),
              email: str("email"),
              company: str("company") || undefined,
            },
          };
          message = "Client added";
          break;
        case "invoice":
          action = {
            type: "CREATE_INVOICE",
            invoice: {
              id: uid(),
              projectId: str("projectId"),
              number: `INV-${String(s.invoices.length + 101).padStart(4, "0")}`,
              description: str("description"),
              amount: cents("amount"),
              paid: 0,
              status: "draft",
              dueDate: str("date"),
            },
          };
          message = "Invoice draft created";
          break;
        case "expense":
          action = {
            type: "ADD_EXPENSE",
            expense: {
              id: uid(),
              merchant: str("merchant"),
              amount: cents("amount"),
              category: str("category"),
              date: str("date"),
              projectId: str("projectId") || undefined,
              receipt: str("receipt") || undefined,
              commitmentId: str("commitmentId") || undefined,
            },
          };
          message = "Expense recorded";
          break;
        case "commitment":
          action = {
            type: "ADD_COMMITMENT",
            commitment: {
              id: uid(),
              projectId: str("projectId"),
              collaboratorId: str("collaboratorId") || undefined,
              description: str("description"),
              amount: cents("amount"),
              paid: 0,
              kind: str("kind") as "contractor" | "travel" | "other",
            },
          };
          message = "Commitment reserved from safe to spend";
          break;
        case "collaborator":
          action = {
            type: "ADD_COLLABORATOR",
            collaborator: {
              id: uid(),
              name: str("name"),
              email: str("email"),
              role: str("role"),
              taxStatus: str("taxStatus"),
            },
          };
          message = "Collaborator added";
          break;
        case "allocation":
          action = {
            type: "SET_ALLOCATIONS",
            taxBps: Math.round(Number(str("tax")) * 100),
            gearBps: Math.round(Number(str("gear")) * 100),
          };
          message = "Autopilot rules updated for future income";
          break;
        case "onboarding": {
          action = {
            type: "SET_ALLOCATIONS",
            taxBps: Math.round(Number(str("tax")) * 100),
            gearBps: Math.round(Number(str("gear")) * 100),
          };
          const name = str("business");
          try {
            localStorage.setItem(
              live
                ? `frameledger-business-${liveSession?.businessId}`
                : "frameledger-business",
              name,
            );
            localStorage.setItem(
              live
                ? `frameledger-preferences-${liveSession?.businessId}`
                : "frameledger-preferences",
              JSON.stringify({
                discipline: str("discipline"),
                payment: str("payment"),
                contractors: str("contractors"),
              }),
            );
          } catch {
            message =
              "Workspace personalized for this session. Browser storage is unavailable.";
          }
          setBusiness(name);
          if (!message.includes("Browser storage"))
            message = "Your creative workspace is ready";
          break;
        }
      }
      if (action && (await act(action, message))) close();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Check the form and try again.",
      );
    }
  }
  function exportCSV() {
    const rows = [
      ["Date", "Merchant", "Category", "Project", "Amount (USD)"],
      ...s.expenses.map((e) => [
        e.date,
        e.merchant,
        e.category,
        s.projects.find((p) => p.id === e.projectId)?.name ?? "Overhead",
        (e.amount / 100).toFixed(2),
      ]),
    ];
    const text = rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@\t\r-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    link.download = live
      ? "frameledger-expenses.csv"
      : "frameledger-demo-expenses.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("Expense CSV downloaded");
  }
  async function reconcile() {
    try {
      const response = await fetch("/api/reconcile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${liveSession?.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId: liveSession?.businessId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to reconcile balance");
      await refresh();
      setToast("Provider balance refreshed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reconcile balance");
    }
  }
  const newButton = (m: Modal, label: string) => (
    <button className="btn primary" onClick={() => open(m)}>
      <Plus size={14} />
      {label}
    </button>
  );
  function invoiceTable(items: Invoice[]) {
    return items.length ? (
      <div
        className="tablewrap"
        tabIndex={0}
        role="region"
        aria-label="Scrollable financial records"
      >
        <table>
          <thead>
            <tr>
              <th>Invoice / project</th>
              <th>Due</th>
              <th>Status</th>
              <th className="right">Balance due</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.number}</strong>
                  <div className="projectmeta" style={{ marginTop: 5 }}>
                    {s.projects.find((p) => p.id === i.projectId)?.name}
                  </div>
                </td>
                <td>{date(i.dueDate)}</td>
                <td>
                  <Chip status={i.status} />
                </td>
                <td className="right">{money(i.amount - i.paid)}</td>
                <td>
                  <div className="inlineactions">
                    {!live ? (
                      <a
                        className="btn"
                        href={"/pay/" + i.id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Preview <ArrowUpRight size={12} />
                      </a>
                    ) : i.paymentUrl ? (
                      <a
                        className="btn"
                        href={i.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Payment link <ArrowUpRight size={12} />
                      </a>
                    ) : i.status !== "draft" ? (
                      <span className="projectmeta">Provider link pending</span>
                    ) : null}
                    {i.status === "draft" && (
                      <button
                        className="btn"
                        onClick={() =>
                          ask(
                            { type: "SEND_INVOICE", id: i.id },
                            live
                              ? "Create live Whop invoice?"
                              : "Mark invoice sent in demo?",
                            live
                              ? `${i.number} will be created on your connected Whop account. Confirm the client and amount before proceeding.`
                              : `${i.number} will become payable in this browser. No email is sent.`,
                          )
                        }
                      >
                        {live ? "Create live invoice" : "Mark sent"}
                      </button>
                    )}
                    {!live && ["sent", "partial"].includes(i.status) && (
                      <button
                        className="btn"
                        onClick={() =>
                          ask(
                            { type: "PAY_INVOICE", id: i.id },
                            "Simulate invoice payment?",
                            `${money(i.amount - i.paid)} of synthetic income will be recorded, allocated, and linked to this project. No real money moves.`,
                          )
                        }
                      >
                        Demo payment
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Your next payment starts here"
        detail="Create an invoice and connect it to a project."
        action={newButton("invoice", "Create invoice")}
      />
    );
  }
  function projectsList() {
    return (
      <div className="projectlist">
        {s.projects.slice(0, 4).map((p, i) => {
          const profit = projectProfit(s, p.id);
          return (
            <button
              className="projectrow"
              style={{
                width: "100%",
                background: "none",
                textAlign: "left",
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
              }}
              key={p.id}
              onClick={() => {
                setSelected(p.id);
                setPage("Projects");
              }}
            >
              <ProjectArtwork type={p.type} index={i} />
              <div className="project-copy">
                <div className="projectmeta project-index">
                  PROJECT {String(i + 1).padStart(2, "0")} / {p.type}
                </div>
                <div className="projectname">{p.name}</div>
                <div className="projectmeta">
                  {date(p.date)} <span style={{ margin: "0 5px" }}>·</span>{" "}
                  {s.clients.find((c) => c.id === p.clientId)?.name ??
                    "Client not assigned"}
                </div>
              </div>
              <span className="project-status">
                <Chip status={p.status} />
              </span>
              <div className="projectamount">
                {money(p.value)}
                <small>
                  {s.expenses.some((e) => e.projectId === p.id) ||
                  s.commitments.some((c) => c.projectId === p.id)
                    ? `${Math.round(profit.margin * 100)}% est. margin`
                    : "Costs not estimated"}
                </small>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
  function transactions() {
    const rows = [
      ...s.payments.map((p) => ({
        id: p.id,
        name:
          s.invoices.find((i) => i.id === p.invoiceId)?.description ??
          "Payment",
        projectId: s.invoices.find((i) => i.id === p.invoiceId)?.projectId,
        amount: p.amount - p.refunded,
        category: "Invoice payment",
        date: "Settled",
        incoming: true,
      })),
      ...s.expenses.map((e) => ({ ...e, name: e.merchant, incoming: false })),
      ...s.commitments
        .filter((c) => c.paid > 0)
        .map((c) => ({
          ...c,
          name: c.description,
          amount: c.paid,
          incoming: false,
          category: "Collaborator payment",
          date: "Paid",
        })),
    ]
      .reverse()
      .slice(0, 7);
    return rows.length ? (
      <div
        className="tablewrap"
        tabIndex={0}
        role="region"
        aria-label="Scrollable financial records"
      >
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Project</th>
              <th>Category</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="merchant">
                    <span className="merchanticon">
                      {t.incoming ? (
                        <ArrowDownLeft size={15} />
                      ) : (
                        <ArrowUpRight size={15} />
                      )}
                    </span>
                    <div>
                      <strong>{t.name}</strong>
                      <div className="projectmeta" style={{ marginTop: 4 }}>
                        {live ? "Recorded" : "Synthetic"} · {t.date}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  {s.projects.find((p) => p.id === t.projectId)?.name ??
                    "Business overhead"}
                </td>
                <td>
                  <Chip status={t.incoming ? "green" : "draft"}>
                    {t.category}
                  </Chip>
                </td>
                <td className={"right " + (t.incoming ? "positive" : "")}>
                  {t.incoming ? "+" : "−"}
                  {money(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="A clean slate"
        detail="Your project income and expenses will appear here."
      />
    );
  }
  if (!ready && storageError)
    return (
      <main className="loading">
        <section className="panel">
          <h2>Workspace unavailable</h2>
          <p className="subtitle" role="alert">
            {storageError}
          </p>
          <button className="btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </section>
      </main>
    );
  if (!ready)
    return (
      <main className="loading" aria-label="Loading financial workspace">
        <div>
          <div className="brand">FrameLedger</div>
          <div className="skeleton" />
        </div>
      </main>
    );
  return (
    <div className="app">
      <aside
        className={"sidebar " + (mobile ? "open" : "")}
        aria-label="Main navigation"
      >
        <Link className="brand" href="/">
          <BrandMark />
          FrameLedger
          <span style={{ fontSize: 8, alignSelf: "flex-start", marginTop: 4 }}>
            ™
          </span>
        </Link>
        <button
          className="workspace"
          style={{ width: "100%", textAlign: "left" }}
          onClick={() => open("onboarding")}
        >
          <span className="avatar">YS</span>
          <span style={{ flex: 1 }}>
            <strong>{business}</strong>
            <small style={{ display: "block", marginTop: 4 }}>
              Creative business
            </small>
          </span>
          <ChevronDown size={13} />
        </button>
        <div className="navlabel">WORKSPACE</div>
        <nav className="nav">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              aria-current={page === name ? "page" : undefined}
              onClick={() => go(name)}
            >
              <Icon size={17} strokeWidth={1.65} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav className="nav">
            <button
              className={page === "Tax center" ? "active" : ""}
              aria-current={page === "Tax center" ? "page" : undefined}
              onClick={() => go("Tax center")}
            >
              <Landmark size={16} />
              Tax center
            </button>
            <button
              className={page === "Settings" ? "active" : ""}
              aria-current={page === "Settings" ? "page" : undefined}
              onClick={() => go("Settings")}
            >
              <Settings size={16} />
              Settings & support
            </button>
          </nav>
          <div className="profile">
            <span
              className="avatar"
              style={{
                background: "var(--surface-muted)",
                color: "var(--muted)",
              }}
            >
              IR
            </span>
            <div>
              <strong>{live ? "Account owner" : "Ian Royes"}</strong>
              <small style={{ display: "block", marginTop: 4 }}>
                {live ? "Live workspace" : "Demo workspace"}
              </small>
            </div>
            <ShieldCheck
              size={14}
              style={{ marginLeft: "auto", color: "var(--muted)" }}
            />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="actions">
            <button
              className="iconbtn mobilemenu"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={19} />
            </button>
            <span className="crumb">
              Workspace{" "}
              <span style={{ padding: "0 11px", color: "var(--line)" }}>/</span>{" "}
              <span style={{ color: "var(--ink)" }}>{page}</span>
            </span>
          </div>
          <div className="top-actions">
            <button
              className="command-trigger"
              aria-label="Search workspace"
              onClick={() => {
                setSearchQuery("");
                open("search");
              }}
            >
              <Search size={16} aria-hidden="true" />
              <span>Find anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="demo">
              {live
                ? process.env.NEXT_PUBLIC_APP_STAGE === "staging"
                  ? "STAGING · NO LIVE PAYMENTS"
                  : "LIVE WORKSPACE"
                : "DEMO MODE · SYNTHETIC DATA"}
            </span>
            <button
              className="iconbtn"
              aria-label="View action items"
              onClick={() => {
                go("Overview");
                document
                  .getElementById("action-items")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Bell size={17} />
            </button>
            <span
              className="avatar"
              style={{ width: 27, height: 27, fontSize: 10 }}
            >
              IR
            </span>
          </div>
        </header>
        <main className="content" id="main-content">
          {storageError && (
            <div className="notice warn" role="alert">
              {storageError}
            </div>
          )}
          {error && !modal && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {live && s.balanceSyncedAt && (
            <div
              className="notice"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <span>
                Provider balance synced{" "}
                {new Date(s.balanceSyncedAt).toLocaleString()}.
                {balanceStale
                  ? " Balance may be out of date. Refresh before spending."
                  : ""}
              </span>
              <button className="btn" onClick={reconcile}>
                Refresh provider balance
              </button>
            </div>
          )}
          <div className="pagehead">
            <div>
              <p className="page-eyebrow">
                Your studio <span>/</span>{" "}
                {page === "Overview" ? "Financial overview" : page}
              </p>
              <h1>
                {page === "Overview"
                  ? "Your business, in balance."
                  : page === "Projects" && project
                    ? project.name
                    : page === "Money"
                      ? "Give every dollar a purpose."
                      : page === "Insights"
                        ? "See what your work earns."
                        : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "More clarity for your money. More space for your craft."
                  : page === "Projects"
                    ? "From the first deposit to the final profit."
                    : page === "Money"
                      ? "One actual balance. Clear virtual reserves."
                      : page === "Invoices"
                        ? "Beautifully simple billing, tied to the work."
                        : page === "Expenses"
                          ? "Know where it went. Know which project it belongs to."
                          : page === "Insights"
                            ? "Clear answers from the numbers in your workspace."
                            : "The financial side of your creative business."}
              </p>
            </div>
            <div className="actions">
              {page === "Overview" ? null : page === "Projects" ? (
                newButton("project", "New project")
              ) : page === "Invoices" ? (
                newButton("invoice", "New invoice")
              ) : page === "Expenses" ? (
                <>
                  <button className="btn" onClick={exportCSV}>
                    <Download size={14} />
                    Export
                  </button>
                  {newButton("expense", "Add expense")}
                </>
              ) : page === "Clients" ? (
                newButton("client", "Add client")
              ) : page === "Collaborators" ? (
                newButton("collaborator", "Add collaborator")
              ) : null}
            </div>
          </div>
          {page === "Overview" && (
            <section
              className="overview-quick-actions"
              aria-label="Quick actions"
            >
              {[
                {
                  modal: "invoice" as const,
                  label: "Create invoice",
                  detail: "Get paid for your work",
                  icon: FileText,
                },
                {
                  modal: "expense" as const,
                  label: "Add expense",
                  detail: "Keep every cost in view",
                  icon: Receipt,
                },
                {
                  modal: "project" as const,
                  label: "New project",
                  detail: "Give your next job a home",
                  icon: FolderOpen,
                },
                {
                  modal: "simulator" as const,
                  label: "Can I afford this?",
                  detail: "See its impact before you spend",
                  icon: Calculator,
                },
              ].map(({ modal: target, label, detail, icon: Icon }) => (
                <button
                  key={target}
                  className="quick-action"
                  aria-label={label}
                  onClick={() => open(target)}
                >
                  <span className="quick-action-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="quick-action-copy">
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowUpRight
                    className="quick-action-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </section>
          )}
          {live &&
          !s.balanceSyncedAt &&
          ["Overview", "Money", "Insights", "Tax center"].includes(page) ? (
            <section className="panel">
              <h2>Connect and reconcile your financial account</h2>
              <p className="subtitle">
                Safe to Spend is unavailable until your provider balance is
                verified. You can create clients, projects, and draft invoices
                while connection setup is completed.
              </p>
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    const response = await fetch("/api/reconcile", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${liveSession?.token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        businessId: liveSession?.businessId,
                      }),
                    });
                    const result = await response.json();
                    if (!response.ok)
                      throw new Error(
                        result.error ?? "Unable to reconcile balance",
                      );
                    await refresh();
                    setToast("Provider balance refreshed");
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Unable to reconcile balance",
                    );
                  }
                }}
              >
                Refresh provider balance
              </button>
            </section>
          ) : null}
          {page === "Overview" && (!live || !!s.balanceSyncedAt) && (
            <>
              <div className="dashboard-top">
                <section className="panel balance-panel">
                  <div className="balance-visual" aria-hidden="true">
                    <span className="wallet-layer wallet-layer-back" />
                    <span className="wallet-layer wallet-layer-middle" />
                    <span className="wallet-layer wallet-layer-front" />
                  </div>
                  <div className="balance-heading">
                    <div className="balance-title">
                      Safe to spend{" "}
                      <button
                        className="iconbtn"
                        style={{ padding: 0, color: "var(--muted)" }}
                        onClick={() => open("breakdown")}
                        aria-label="How safe to spend is calculated"
                      >
                        <CircleHelp size={14} />
                      </button>
                    </div>
                    <div className="big-money">
                      {money(cash.total).split(".")[0]}
                      <span className="cents">
                        .{money(cash.total).split(".")[1]}
                      </span>
                    </div>
                    <div className="balance-sub">
                      <ShieldCheck size={12} />
                      After recorded reserves and commitments
                    </div>
                  </div>
                  {balanceStale && (
                    <p role="status">
                      Outdated balance — refresh before relying on this amount.
                    </p>
                  )}
                  <div className="reserved">
                    <div
                      className="reservebar"
                      role="img"
                      aria-label={`Balance allocation: ${money(cash.total)} available, ${money(cash.taxReserve)} tax reserve, ${money(cash.gearReserve)} gear reserve, ${money(cash.commitments)} committed`}
                    >
                      <span
                        style={{
                          background: "var(--accent)",
                          flex: Math.max(1, cash.total),
                        }}
                      />
                      <span
                        style={{
                          background: "var(--reserve-tax)",
                          flex: Math.max(1, cash.taxReserve),
                        }}
                      />
                      <span
                        style={{
                          background: "var(--reserve-gear)",
                          flex: Math.max(1, cash.gearReserve),
                        }}
                      />
                      <span
                        style={{
                          background: "var(--reserve-commitment)",
                          flex: Math.max(1, cash.commitments),
                        }}
                      />
                    </div>
                    <div className="legend">
                      <span>
                        <i
                          className="dot"
                          style={{ background: "var(--accent)" }}
                        />
                        Available
                      </span>
                      <span>
                        <i
                          className="dot"
                          style={{ background: "var(--reserve-tax)" }}
                        />
                        Taxes
                      </span>
                      <span>
                        <i
                          className="dot"
                          style={{ background: "var(--reserve-gear)" }}
                        />
                        Gear
                      </span>
                      <span>
                        <i
                          className="dot"
                          style={{ background: "var(--reserve-commitment)" }}
                        />
                        Committed
                      </span>
                    </div>
                  </div>
                  <div className="balance-foot">
                    <span>
                      Actual balance{" "}
                      <strong style={{ marginLeft: 10 }}>
                        {money(cash.balance)}
                      </strong>
                    </span>
                    <button
                      className="textbtn"
                      onClick={() => open("breakdown")}
                    >
                      View breakdown <ArrowRight size={13} />
                    </button>
                  </div>
                </section>
                <section className="panel cashflow-panel">
                  <div className="panelhead">
                    <h2>Money in, money out</h2>
                    <span className="projectmeta">
                      {live ? "Recorded activity" : "All demo activity"}
                    </span>
                  </div>
                  <div className="cashstats">
                    <div>
                      <div className="statlabel">
                        <span
                          className="dot"
                          style={{ background: "var(--accent)" }}
                        />
                        Money in
                      </div>
                      <div className="statvalue">{money(income)}</div>
                    </div>
                    <div>
                      <div className="statlabel">
                        <span
                          className="dot"
                          style={{ background: "var(--reserve-commitment)" }}
                        />
                        Money out
                      </div>
                      <div className="statvalue">{money(outgo)}</div>
                    </div>
                  </div>
                  <div
                    className="flow-comparison"
                    role="img"
                    aria-label={`Settled money in ${money(income)}, money out ${money(outgo)}. Outstanding invoices of ${money(outstanding)} are excluded.`}
                  >
                    <div className="flow-line">
                      <ArrowDownLeft size={16} aria-hidden="true" />
                      <div className="flow-track">
                        <span
                          className="flow-fill"
                          style={{
                            width: `${(income / Math.max(income, outgo, 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span>In</span>
                    </div>
                    <div className="flow-line">
                      <ArrowUpRight size={16} aria-hidden="true" />
                      <div className="flow-track">
                        <span
                          className="flow-fill out"
                          style={{
                            width: `${(outgo / Math.max(income, outgo, 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span>Out</span>
                    </div>
                  </div>
                  <p className="flow-caption">
                    Recorded cash movement. Unpaid invoices aren’t included.
                  </p>
                </section>
              </div>
              <div className="metrics">
                <section className="panel metric">
                  <div className="metric-top">
                    <span className="statlabel">Outstanding invoices</span>
                    <FileText size={15} />
                  </div>
                  <div className="statvalue">{money(outstanding)}</div>
                  <small>
                    {
                      s.invoices.filter(
                        (i) => i.amount > i.paid && i.status !== "void",
                      ).length
                    }{" "}
                    invoices · expected, not settled
                  </small>
                </section>
                <section className="panel metric">
                  <div className="metric-top">
                    <span className="statlabel">Tax reserve</span>
                    <Landmark size={15} />
                  </div>
                  <div className="statvalue">{money(cash.taxReserve)}</div>
                  <small>
                    <span className="positive">{s.taxBps / 100}%</span> of
                    qualifying income · virtual reserve
                  </small>
                </section>
                <section className="panel metric">
                  <div>
                    <div className="metric-top">
                      <span className="statlabel">Upcoming commitments</span>
                      <Clock size={15} />
                    </div>
                    <div className="statvalue">{money(cash.commitments)}</div>
                  </div>
                  <small>
                    {s.commitments.filter((c) => c.paid < c.amount).length}{" "}
                    commitments protected
                  </small>
                </section>
              </div>
              <div className="dashboard-mid">
                <section className="panel">
                  <div className="panelhead">
                    <h2>
                      Work in progress{" "}
                      <span className="chip" style={{ marginLeft: 8 }}>
                        {s.projects.filter((p) => p.status === "active").length}
                      </span>
                    </h2>
                    <button className="textbtn" onClick={() => go("Projects")}>
                      All projects <ArrowRight size={13} />
                    </button>
                  </div>
                  {projectsList()}
                </section>
                <section className="panel" id="action-items">
                  <div className="panelhead">
                    <h2>A little attention</h2>
                    <span className="chip">
                      {(overdue.length ? 1 : 0) +
                        (cash.commitments ? 1 : 0) +
                        (missing.length ? 1 : 0)}
                    </span>
                  </div>
                  <div className="actionitem">
                    <span className="actionicon">
                      <FileText size={15} />
                    </span>
                    <div>
                      <p>
                        {overdue.length
                          ? `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} past due`
                          : "Invoices are on track"}
                      </p>
                      <small>
                        {overdue.length
                          ? "A good time to follow up."
                          : "Keep your next payment in view."}
                      </small>
                    </div>
                    <button
                      className="iconbtn"
                      aria-label="Review invoices"
                      onClick={() => go("Invoices")}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="actionitem">
                    <span
                      className="actionicon"
                      style={{
                        background: "var(--surface-muted)",
                        color: "var(--muted)",
                      }}
                    >
                      <Users size={15} />
                    </span>
                    <div>
                      <p>
                        {cash.commitments
                          ? `${money(cash.commitments)} committed`
                          : "Commitments are settled"}
                      </p>
                      <small>Already protected from safe to spend.</small>
                    </div>
                    <button
                      className="iconbtn"
                      aria-label="Review commitments"
                      onClick={() => go("Collaborators")}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="actionitem">
                    <span
                      className="actionicon"
                      style={{
                        background: "var(--surface-muted)",
                        color: "var(--accent)",
                      }}
                    >
                      <Receipt size={15} />
                    </span>
                    <div>
                      <p>
                        {missing.length
                          ? `${missing.length} receipt${missing.length === 1 ? "" : "s"} missing`
                          : "Keep the paper trail tidy"}
                      </p>
                      <small>
                        {missing.length
                          ? "Add a receipt reference to your records."
                          : "Attach spending to the work behind it."}
                      </small>
                    </div>
                    <button
                      className="iconbtn"
                      aria-label="Review expenses"
                      onClick={() => go("Expenses")}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </section>
              </div>
              <section className="panel transactions">
                <div className="panelhead">
                  <h2>Recent activity</h2>
                  <button className="textbtn" onClick={() => go("Money")}>
                    All activity <ArrowRight size={13} />
                  </button>
                </div>
                {transactions()}
              </section>
              <p
                className="projectmeta"
                style={{ marginTop: 20, textAlign: "center" }}
              >
                A financial workspace for your creative business.{" "}
                {live
                  ? "Balances require provider reconciliation."
                  : "Demo balances and events are synthetic."}
              </p>
            </>
          )}
          {page === "Projects" && !project && (
            <>
              <div className="searchbox">
                <Search size={15} />
                <input
                  aria-label="Search projects"
                  placeholder="Find a project…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="section-grid">
                {s.projects
                  .filter((p) =>
                    p.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((p, index) => {
                    const f = projectProfit(s, p.id);
                    return (
                      <button
                        key={p.id}
                        className="panel projectcard"
                        style={{ textAlign: "left" }}
                        onClick={() => setSelected(p.id)}
                      >
                        <div className="project-cover">
                          <ProjectArtwork type={p.type} index={index} />
                          <Chip status={p.status} />
                        </div>
                        <div className="project-index projectmeta">
                          {p.type}
                        </div>
                        <h2>{p.name}</h2>
                        <p className="projectmeta">
                          {s.clients.find((c) => c.id === p.clientId)?.name} ·{" "}
                          {date(p.date)}
                        </p>
                        <div
                          className="lifecycle"
                          style={{ width: "100%" }}
                          aria-label={`Project progress: ${money(f.received)} received of ${money(p.value)}`}
                        >
                          <span className="done" />
                          <span className={f.received > 0 ? "done" : ""} />
                          <span
                            className={f.received >= p.value ? "done" : ""}
                          />
                          <span
                            className={p.status === "completed" ? "done" : ""}
                          />
                        </div>
                        <div
                          className="projectbottom"
                          style={{ width: "100%" }}
                        >
                          <div>
                            <div className="statlabel">Project value</div>
                            <strong>{money(p.value)}</strong>
                          </div>
                          <div className="right">
                            <div className="statlabel">Estimated profit</div>
                            <strong className="positive">
                              {s.expenses.some((e) => e.projectId === p.id) ||
                              s.commitments.some((c) => c.projectId === p.id)
                                ? money(f.estimatedProfit)
                                : "Costs not estimated"}
                            </strong>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
              {!s.projects.length && (
                <Empty
                  title="Give your next job a wallet"
                  detail="Connect the project, payment, costs, and profit in one place."
                  action={newButton("project", "Create project")}
                />
              )}
            </>
          )}
          {page === "Projects" &&
            project &&
            (() => {
              const f = projectProfit(s, project.id);
              const commitments = s.commitments.filter(
                (c) => c.projectId === project.id,
              );
              return (
                <>
                  <div className="actions" style={{ marginBottom: 20 }}>
                    <button className="btn" onClick={() => setSelected(null)}>
                      ← All projects
                    </button>
                    <Chip status={project.status} />
                    <span className="projectmeta">
                      {project.type} · {date(project.date)}
                    </span>
                  </div>
                  <div className="metrics" style={{ marginBottom: 24 }}>
                    {[
                      ["Received", f.received],
                      ["Still owed", f.outstanding],
                      ["Estimated profit", f.estimatedProfit],
                    ].map(([label, value]) => (
                      <div className="panel metric" key={label}>
                        <div className="statlabel">{label}</div>
                        <div className="statvalue">
                          {money(value as number)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="detail-grid">
                    <div>
                      <section className="panel">
                        <div className="panelhead">
                          <h2>Project invoices</h2>
                          <button
                            className="textbtn"
                            onClick={() => open("invoice")}
                          >
                            <Plus size={13} />
                            Create invoice
                          </button>
                        </div>
                        {invoiceTable(
                          s.invoices.filter((i) => i.projectId === project.id),
                        )}
                      </section>
                      <section className="panel">
                        <div className="panelhead">
                          <h2>Committed costs</h2>
                          <button
                            className="textbtn"
                            onClick={() => open("commitment")}
                          >
                            <Plus size={13} />
                            Add commitment
                          </button>
                        </div>
                        {commitments.length ? (
                          commitments.map((c) => (
                            <div className="ledgerline" key={c.id}>
                              <div>
                                {c.description}
                                <small
                                  style={{ display: "block", marginTop: 5 }}
                                >
                                  {c.paid === c.amount
                                    ? "Resolved"
                                    : `${money(c.amount - c.paid - s.expenses.filter((e) => e.commitmentId === c.id).reduce((n, e) => n + e.amount, 0))} still reserved`}
                                </small>
                              </div>
                              <div className="inlineactions">
                                <strong
                                  style={{
                                    alignSelf: "center",
                                    marginRight: 6,
                                  }}
                                >
                                  {money(c.amount)}
                                </strong>
                                {c.paid < c.amount && (
                                  <>
                                    {live &&
                                      liveSession &&
                                      c.kind === "contractor" && (
                                        <LivePayout
                                          session={liveSession}
                                          commitmentId={c.id}
                                          onRefresh={refresh}
                                        />
                                      )}
                                    {!live &&
                                      !s.expenses.some(
                                        (e) => e.commitmentId === c.id,
                                      ) && (
                                        <button
                                          className="btn"
                                          onClick={() =>
                                            ask(
                                              {
                                                type: "PAY_COMMITMENT",
                                                id: c.id,
                                              },
                                              "Simulate commitment payment?",
                                              `${money(c.amount - c.paid)} will be deducted from the synthetic balance. No real payment is sent.`,
                                            )
                                          }
                                        >
                                          Demo pay
                                        </button>
                                      )}
                                    <button
                                      className="btn"
                                      onClick={() =>
                                        ask(
                                          {
                                            type: "RELEASE_COMMITMENT",
                                            id: c.id,
                                          },
                                          "Release unused commitment?",
                                          `Release the unpaid portion of ${c.description} back to safe to spend. Recorded expenses stay attached to this project.`,
                                        )
                                      }
                                    >
                                      Release
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="subtitle">No committed costs yet.</p>
                        )}
                      </section>
                      <section className="panel">
                        <div className="panelhead">
                          <h2>Project expenses</h2>
                          <button
                            className="textbtn"
                            onClick={() => open("expense")}
                          >
                            <Plus size={13} />
                            Add expense
                          </button>
                        </div>
                        {s.expenses
                          .filter((e) => e.projectId === project.id)
                          .map((e) => (
                            <LedgerLine
                              key={e.id}
                              label={`${e.merchant} · ${e.category}`}
                              value={e.amount}
                            />
                          ))}
                        {!s.expenses.some(
                          (e) => e.projectId === project.id,
                        ) && (
                          <p className="subtitle">
                            Add fuel, rental, and other direct costs to reveal
                            the real margin.
                          </p>
                        )}
                      </section>
                    </div>
                    <div>
                      <section className="panel">
                        <div className="panelhead">
                          <h2>What this job earns</h2>
                          <ChartNoAxesCombined size={16} />
                        </div>
                        <LedgerLine
                          label="Contracted revenue"
                          value={project.value}
                        />
                        <LedgerLine label="Payment fees" value={-f.fees} />
                        <LedgerLine
                          label="Paid project costs"
                          value={-f.costs}
                        />
                        <LedgerLine
                          label="Remaining commitments"
                          value={-f.committed}
                        />
                        <LedgerLine
                          label="Estimated final profit"
                          value={f.estimatedProfit}
                          total
                        />
                        <div className="lifecycle">
                          <span
                            className="done"
                            style={{ flex: Math.max(f.margin, 0) }}
                          />
                          <span style={{ flex: Math.max(1 - f.margin, 0) }} />
                        </div>
                        <p className="subtitle" style={{ marginBottom: 0 }}>
                          {s.expenses.some((e) => e.projectId === project.id) ||
                          s.commitments.some((c) => c.projectId === project.id)
                            ? `${Math.round(f.margin * 100)}% estimated margin.`
                            : "Costs have not been estimated. Add project costs before relying on this profit estimate."}{" "}
                          Before owner labor, tax, and business overhead. This
                          is project contribution, not take-home pay. Unpaid
                          income is not guaranteed.
                        </p>
                        <LedgerLine
                          label="Realized profit so far"
                          value={f.actualProfit}
                        />
                      </section>
                      <section className="panel">
                        <h2>Finish the job. See the result.</h2>
                        <p className="subtitle">
                          Collect the project balance and resolve all
                          commitments before closing the wallet.
                        </p>
                        <button
                          className="btn primary"
                          disabled={project.status === "completed"}
                          onClick={() =>
                            ask(
                              { type: "CLOSE_PROJECT", id: project.id },
                              "Close this project?",
                              `Finalize ${project.name} with all income collected and commitments resolved. Profit remains available in your reports.`,
                            )
                          }
                        >
                          <Check size={14} />
                          {project.status === "completed"
                            ? "Project completed"
                            : "Close project"}
                        </button>
                      </section>
                    </div>
                  </div>
                </>
              );
            })()}
          {page === "Money" && (!live || !!s.balanceSyncedAt) && (
            <>
              <div className="notice">
                <ShieldCheck
                  size={14}
                  style={{ verticalAlign: "middle", marginRight: 7 }}
                />
                Reserves are virtual bookkeeping buckets within one balance.
                They are not separate bank accounts or legally segregated funds.
              </div>
              <div className="detail-grid">
                <section className="panel balance-panel">
                  <div className="balance-title">Safe to spend</div>
                  <div className="big-money">{money(cash.total)}</div>
                  {balanceStale && (
                    <p role="status">
                      Outdated balance — refresh before relying on this amount.
                    </p>
                  )}
                  <LedgerLine
                    label="Actual settled balance"
                    value={cash.balance}
                  />
                  {cash.pendingExpenses > 0 && (
                    <LedgerLine
                      label="Expenses awaiting provider match"
                      value={-cash.pendingExpenses}
                    />
                  )}
                  <LedgerLine label="Tax reserve" value={-cash.taxReserve} />
                  <LedgerLine label="Gear reserve" value={-cash.gearReserve} />
                  <LedgerLine
                    label="Project commitments"
                    value={-cash.commitments}
                  />
                  <LedgerLine
                    label="Other protected reserves"
                    value={-cash.protectedReserves}
                  />
                  <button
                    className="btn"
                    style={{ marginTop: 20 }}
                    onClick={() => open("simulator")}
                  >
                    <Calculator size={14} />
                    Can I afford this?
                  </button>
                </section>
                <section className="panel">
                  <div className="panelhead">
                    <h2>Money Autopilot</h2>
                    <button
                      className="textbtn"
                      onClick={() => open("allocation")}
                    >
                      <SlidersHorizontal size={13} />
                      Edit rules
                    </button>
                  </div>
                  <p className="subtitle">
                    Every qualifying payment gets a purpose. Rules apply to new
                    income.
                  </p>
                  {[
                    ["Taxes", s.taxBps / 100, "var(--reserve-tax)"],
                    ["Gear fund", s.gearBps / 100, "var(--reserve-gear)"],
                    [
                      "Available before commitments",
                      (10000 - s.taxBps - s.gearBps) / 100,
                      "var(--accent)",
                    ],
                  ].map(([label, value, color]) => (
                    <div className="allocation" key={label}>
                      <span
                        className="dot"
                        style={{
                          background: String(color),
                          width: 9,
                          height: 9,
                        }}
                      />
                      <span>{label}</span>
                      <strong>{value}%</strong>
                    </div>
                  ))}
                  <p className="subtitle" style={{ marginBottom: 0 }}>
                    Committed costs are deducted separately. Allocation is
                    bookkeeping; it does not transfer funds.
                  </p>
                </section>
              </div>
              <ProtectedReserve
                amount={cash.protectedReserves}
                dispatch={dispatch}
              />
              <section className="panel" style={{ marginTop: 20 }}>
                <div className="panelhead">
                  <h2>Your activity</h2>
                  <button className="textbtn" onClick={() => open("expense")}>
                    Record an expense <Plus size={13} />
                  </button>
                </div>
                {transactions()}
              </section>
            </>
          )}
          {page === "Invoices" && (
            <>
              <div className="metrics" style={{ margin: "0 0 24px" }}>
                <div className="panel metric">
                  <div className="statlabel">Outstanding</div>
                  <div className="statvalue">{money(outstanding)}</div>
                </div>
                <div className="panel metric">
                  <div className="statlabel">Received</div>
                  <div className="statvalue">{money(income)}</div>
                </div>
                <div className="panel metric">
                  <div className="statlabel">Past due</div>
                  <div className="statvalue">
                    {money(overdue.reduce((n, i) => n + i.amount - i.paid, 0))}
                  </div>
                </div>
              </div>
              <section className="panel">
                <div className="panelhead">
                  <h2>All invoices</h2>
                  <span className="projectmeta">
                    Deposits, final balances, and retainers
                  </span>
                </div>
                <div className="searchbox">
                  <Search size={15} aria-hidden="true" />
                  <input
                    aria-label="Search invoices"
                    placeholder="Find an invoice…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                {query &&
                !s.invoices.some((invoice) =>
                  `${invoice.number} ${s.projects.find((p) => p.id === invoice.projectId)?.name ?? ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ) ? (
                  <p className="subtitle">No invoices match your search.</p>
                ) : (
                  invoiceTable(
                    s.invoices.filter((invoice) =>
                      `${invoice.number} ${s.projects.find((p) => p.id === invoice.projectId)?.name ?? ""}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    ),
                  )
                )}
              </section>
              <p className="subtitle">
                {live
                  ? "Live invoice fulfillment relies on verified provider webhooks. Invoice creation and sharing are separate from payment confirmation."
                  : "Demo invoices are stored in this browser. Payment simulation does not send invoices or charge clients."}
              </p>
            </>
          )}
          {page === "Expenses" && (
            <section className="panel">
              <div className="panelhead">
                <h2>Every expense has a story</h2>
                <span className="chip">{missing.length} missing receipts</span>
              </div>
              {s.expenses.length ? (
                <div
                  className="tablewrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Scrollable financial records"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Merchant</th>
                        <th>Category</th>
                        <th>Project / overhead</th>
                        <th>Receipt reference</th>
                        <th className="right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.expenses.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <strong>{e.merchant}</strong>
                            <div
                              className="projectmeta"
                              style={{ marginTop: 5 }}
                            >
                              {date(e.date)}
                            </div>
                          </td>
                          <td>
                            <select
                              aria-label={`Category for ${e.merchant}`}
                              value={e.category}
                              onChange={(ev) =>
                                act(
                                  {
                                    type: "UPDATE_EXPENSE",
                                    id: e.id,
                                    category: ev.target.value,
                                  },
                                  "Category updated",
                                )
                              }
                            >
                              {categories.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={`Project for ${e.merchant}`}
                              value={e.projectId ?? ""}
                              onChange={(ev) => {
                                const action: Action = {
                                  type: "ASSIGN_EXPENSE",
                                  id: e.id,
                                  projectId: ev.target.value || undefined,
                                };
                                const affectsCompleted = s.projects.some(
                                  (p) =>
                                    p.status === "completed" &&
                                    (p.id === e.projectId ||
                                      p.id === action.projectId),
                                );
                                if (affectsCompleted)
                                  ask(
                                    action,
                                    "Update completed project costs?",
                                    "This changes a completed project’s actual profit and reopens it for review. Its recorded costs and margin will be recalculated. No money will move.",
                                  );
                                else
                                  void act(
                                    action,
                                    "Project association updated",
                                  );
                              }}
                            >
                              <option value="">Business overhead</option>
                              {s.projects.map((p) => (
                                <option value={p.id} key={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {!live && (
                              <input
                                aria-label={`Receipt reference for ${e.merchant}`}
                                placeholder="Receipt reference / file name"
                                defaultValue={e.receipt ?? ""}
                                onBlur={(ev) => {
                                  if (ev.target.value !== e.receipt)
                                    act(
                                      {
                                        type: "UPDATE_EXPENSE",
                                        id: e.id,
                                        receipt: ev.target.value,
                                      },
                                      "Receipt reference saved",
                                    );
                                }}
                              />
                            )}
                            <label
                              className="textbtn"
                              style={{ marginTop: 8, cursor: "pointer" }}
                            >
                              Attach receipt
                              <input
                                type="file"
                                aria-label={`Attach receipt for ${e.merchant}`}
                                accept="application/pdf,image/png,image/jpeg"
                                className="receipt-file"
                                onChange={async (ev) => {
                                  const file = ev.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    if (
                                      file.size > 5 * 1024 * 1024 ||
                                      ![
                                        "application/pdf",
                                        "image/png",
                                        "image/jpeg",
                                      ].includes(file.type)
                                    )
                                      throw new Error(
                                        "Choose a PDF, PNG, or JPEG under 5 MB.",
                                      );
                                    let receipt = file.name;
                                    if (live && liveSession) {
                                      const form = new FormData();
                                      form.set("file", file);
                                      form.set("expenseId", e.id);
                                      const response = await fetch(
                                        `/api/receipts?businessId=${encodeURIComponent(liveSession.businessId)}`,
                                        {
                                          method: "POST",
                                          headers: {
                                            Authorization: `Bearer ${liveSession.token}`,
                                          },
                                          body: form,
                                        },
                                      );
                                      const result = await response.json();
                                      if (!response.ok)
                                        throw new Error(
                                          result.error ??
                                            "Receipt upload failed",
                                        );
                                      receipt = result.receiptId;
                                    }
                                    await act(
                                      {
                                        type: "UPDATE_EXPENSE",
                                        id: e.id,
                                        receipt,
                                      },
                                      live
                                        ? "Receipt uploaded privately"
                                        : "Demo file name saved; keep the original externally",
                                    );
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "Unable to attach receipt",
                                    );
                                  }
                                  ev.target.value = "";
                                }}
                              />
                            </label>
                            {live && e.receipt && (
                              <button
                                className="textbtn"
                                style={{ display: "block", marginTop: 7 }}
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/receipts?businessId=${encodeURIComponent(liveSession?.businessId ?? "")}&receiptId=${encodeURIComponent(e.receipt ?? "")}`,
                                      {
                                        headers: {
                                          Authorization: `Bearer ${liveSession?.token}`,
                                        },
                                      },
                                    );
                                    const result = await response.json();
                                    if (!response.ok)
                                      throw new Error(
                                        result.error ??
                                          "Unable to retrieve receipt",
                                      );
                                    window.open(
                                      result.url,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "Unable to open receipt",
                                    );
                                  }
                                }}
                              >
                                View uploaded receipt
                              </button>
                            )}
                          </td>
                          <td className="right">{money(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Make the small costs count"
                  detail="Record the fuel, subscriptions, rentals, and gear behind your work."
                  action={newButton("expense", "Add first expense")}
                />
              )}
              <p className="subtitle" style={{ margin: "18px 0 0" }}>
                {live
                  ? "Upload PDF, PNG, or JPEG receipts up to 5 MB. Private downloads expire after 60 seconds."
                  : "Demo attachments store only the file name in this browser. Keep original receipts externally; no file is uploaded."}
              </p>
            </section>
          )}
          {page === "Clients" && (
            <div className="section-grid">
              {s.clients.map((c) => {
                const projects = s.projects.filter((p) => p.clientId === c.id);
                const invoices = s.invoices.filter((i) =>
                  projects.some((p) => p.id === i.projectId),
                );
                return (
                  <section className="panel" key={c.id}>
                    <div className="avatar">
                      {c.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <h2 style={{ marginTop: 19 }}>{c.name}</h2>
                    <p className="subtitle">
                      {c.email}
                      <br />
                      {c.company}
                    </p>
                    <LedgerLine
                      label="Revenue received"
                      value={invoices.reduce((n, i) => n + i.paid, 0)}
                    />
                    <LedgerLine
                      label="Open invoices"
                      value={invoices
                        .filter((i) => i.status !== "void")
                        .reduce((n, i) => n + i.amount - i.paid, 0)}
                    />
                    <p className="projectmeta" style={{ marginTop: 17 }}>
                      {projects.length} project
                      {projects.length === 1 ? "" : "s"} together
                    </p>
                  </section>
                );
              })}
              {!s.clients.length && (
                <Empty
                  title="Start with a client"
                  detail="Keep their projects and financial relationship together."
                  action={newButton("client", "Add client")}
                />
              )}
            </div>
          )}
          {page === "Collaborators" && (
            <>
              <div className="notice">
                Track tax-document status only. Keep W-9s and tax IDs with a
                qualified external service. Never add tax IDs to notes or
                receipt references.
              </div>
              <div className="section-grid">
                {s.collaborators.map((c) => {
                  const assigned = s.commitments.filter(
                    (x) => x.collaboratorId === c.id,
                  );
                  return (
                    <section className="panel" key={c.id}>
                      <div className="avatar">
                        {c.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <h2 style={{ marginTop: 18 }}>{c.name}</h2>
                      <p className="subtitle">
                        {c.role} · {c.email}
                      </p>
                      <Chip status="draft">W-9: {c.taxStatus}</Chip>
                      <LedgerLine
                        label="Paid"
                        value={assigned.reduce((n, x) => n + x.paid, 0)}
                      />
                      <LedgerLine
                        label="Still committed"
                        value={assigned.reduce(
                          (n, x) => n + x.amount - x.paid,
                          0,
                        )}
                      />
                    </section>
                  );
                })}
              </div>
              <section className="panel" style={{ marginTop: 22 }}>
                <div className="panelhead">
                  <h2>Upcoming project commitments</h2>
                  <button
                    className="textbtn"
                    onClick={() => open("commitment")}
                  >
                    <Plus size={13} />
                    Add commitment
                  </button>
                </div>
                {s.commitments
                  .filter((c) => c.paid < c.amount)
                  .map((c) => (
                    <div className="ledgerline" key={c.id}>
                      <div>
                        {c.description}
                        <small style={{ display: "block", marginTop: 5 }}>
                          {s.projects.find((p) => p.id === c.projectId)?.name}
                        </small>
                      </div>
                      <div className="actions">
                        <strong>{money(c.amount - c.paid)}</strong>
                        <button
                          className="btn"
                          onClick={() => {
                            setPage("Projects");
                            setSelected(c.projectId);
                          }}
                        >
                          Review <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
              </section>
            </>
          )}
          {page === "Cards" && live && liveSession ? (
            <LiveCards session={liveSession} />
          ) : (
            page === "Cards" && (
              <section className="panel">
                <div className="detail-grid">
                  <div>
                    <h2>Spending, connected to the work.</h2>
                    <p className="subtitle">
                      Verified Whop card infrastructure can support account
                      cards and transaction history. Cards require a configured
                      live account and provider eligibility.
                    </p>
                    <div className="notice">
                      Card issuance and controls are unavailable in this demo.
                      No card details are fabricated. Project-specific cards,
                      merchant restrictions, and spend limits remain
                      capability-gated.
                    </div>
                    <button className="btn" onClick={() => go("Settings")}>
                      View connection status <ArrowRight size={14} />
                    </button>
                  </div>
                  <div
                    style={{
                      background: "var(--surface-muted)",
                      borderRadius: 14,
                      padding: 30,
                      minHeight: 205,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="actions">
                      <BrandMark />
                      <strong>FrameLedger</strong>
                    </div>
                    <div>
                      <p className="eyebrow">CONNECTED SPENDING</p>
                      <h2 style={{ marginTop: 10 }}>
                        Ready when your account is.
                      </h2>
                      <p className="projectmeta" style={{ marginTop: 9 }}>
                        Concept only · No active card
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )
          )}
          {page === "Insights" && (!live || !!s.balanceSyncedAt) && (
            <>
              <section className="panel" style={{ marginBottom: 22 }}>
                <div className="panelhead">
                  <h2>
                    <Sparkles
                      size={17}
                      style={{ verticalAlign: "middle", marginRight: 8 }}
                    />
                    Ask your numbers
                  </h2>
                  <Chip status="draft">Deterministic insights</Chip>
                </div>
                <p className="subtitle">
                  Answers come from your workspace, with visible calculations.
                  This assistant cannot move money.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAnswer(answerQuestion(s, question));
                  }}
                  className="actions"
                >
                  <input
                    aria-label="Ask a financial question"
                    placeholder="How much do I owe collaborators?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                  />
                  <button className="btn primary" type="submit">
                    Ask <ArrowRight size={14} />
                  </button>
                </form>
                {answer && (
                  <div className="notice" style={{ margin: "20px 0 0" }}>
                    <p>{answer.answer}</p>
                    {answer.facts.map((f, i) => (
                      <LedgerLine key={i} label={f.label} value={f.amount} />
                    ))}
                    <p style={{ marginTop: 9 }}>{answer.caveat}</p>
                  </div>
                )}
              </section>
              <section className="panel">
                <div className="panelhead">
                  <h2>Profit behind the projects</h2>
                  <span className="projectmeta">
                    Before owner labor, tax & overhead
                  </span>
                </div>
                <div
                  className="tablewrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Scrollable financial records"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th className="right">Revenue</th>
                        <th className="right">Costs + commitments</th>
                        <th className="right">Estimated profit</th>
                        <th className="right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.projects.map((p) => {
                        const f = projectProfit(s, p.id);
                        return (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.name}</strong>
                            </td>
                            <td className="right">{money(f.revenue)}</td>
                            <td className="right">
                              {money(f.costs + f.committed + f.fees)}
                            </td>
                            <td className="right positive">
                              {money(f.estimatedProfit)}
                            </td>
                            <td className="right">
                              {s.expenses.some((e) => e.projectId === p.id) ||
                              s.commitments.some((c) => c.projectId === p.id)
                                ? `${Math.round(f.margin * 100)}%`
                                : "Costs not estimated"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel" style={{ marginTop: 22 }}>
                <div className="panelhead">
                  <h2>Expected cash outlook</h2>
                  <button className="textbtn" onClick={() => open("simulator")}>
                    Simulate a purchase <ArrowRight size={13} />
                  </button>
                </div>
                <div className="forecast">
                  {[30, 60, 90].map((days) => {
                    const expected = s.invoices
                      .filter(
                        (i) =>
                          ["sent", "partial"].includes(i.status) &&
                          new Date(i.dueDate).getTime() <=
                            clock + days * 86400000,
                      )
                      .reduce((n, i) => n + i.amount - i.paid, 0);
                    return (
                      <div key={days}>
                        <span className="statlabel">
                          Next {days} days · receivables
                        </span>
                        <strong>{money(expected)}</strong>
                      </div>
                    );
                  })}
                </div>
                <p className="subtitle" style={{ marginBottom: 0 }}>
                  Receivables are expected income, not settled cash. Includes
                  unpaid overdue invoices; timing is uncertain. No forecast is a
                  guarantee.
                </p>
              </section>
            </>
          )}
          {page === "Tax center" && (!live || !!s.balanceSyncedAt) && (
            <>
              <div className="notice warn">
                Estimates only. Consult a qualified tax professional for tax
                advice. Reserves are your chosen savings allocation, not a
                calculation of tax liability.
              </div>
              <div className="detail-grid">
                <section className="panel balance-panel">
                  <div className="balance-title">Your virtual tax reserve</div>
                  <div className="big-money">{money(cash.taxReserve)}</div>
                  <p className="subtitle">
                    {s.taxBps / 100}% reserved from qualifying income. Not a
                    separate account.
                  </p>
                  <button className="btn" onClick={() => open("allocation")}>
                    Adjust reserve percentage
                  </button>
                </section>
                <section className="panel">
                  <h2>Records for your tax professional</h2>
                  <LedgerLine label="Recorded income" value={income} />
                  <LedgerLine
                    label="Categorized expenses"
                    value={s.expenses.reduce((n, e) => n + e.amount, 0)}
                  />
                  <LedgerLine
                    label="Paid collaborators / commitments"
                    value={s.commitments.reduce((n, c) => n + c.paid, 0)}
                  />
                  <button
                    className="btn"
                    style={{ marginTop: 20 }}
                    onClick={exportCSV}
                  >
                    <Download size={14} />
                    Export expense records
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "Settings" && (
            <>
              {live && liveSession && (
                <WhopVerification session={liveSession} />
              )}
              <div className="detail-grid">
                <section className="panel">
                  <h2>Your workspace</h2>
                  <p className="subtitle">
                    Configure your creative discipline, payment style, and
                    reserve preferences.
                  </p>
                  <button className="btn" onClick={() => open("onboarding")}>
                    Personalize workspace <ArrowRight size={14} />
                  </button>
                  <div className="ledgerline" style={{ marginTop: 20 }}>
                    <span>Financial mode</span>
                    <Chip status="sent">
                      {live ? "Live" : "Demo · synthetic"}
                    </Chip>
                  </div>
                  <div className="ledgerline">
                    <span>Currency</span>
                    <strong>USD</strong>
                  </div>
                  <div className="ledgerline">
                    <span>Transaction markup</span>
                    <strong>Disabled</strong>
                  </div>
                </section>
                <section className="panel">
                  <h2>Connection status</h2>
                  <p className="subtitle">
                    Live financial services require authenticated Whop and
                    Supabase configuration, provider approval, and production
                    security review.
                  </p>
                  <div className="ledgerline">
                    <span>Whop financial account</span>
                    <Chip status="draft">
                      {s.balanceSyncedAt
                        ? "Balance synchronized"
                        : "Pending connection"}
                    </Chip>
                  </div>
                  <div className="ledgerline">
                    <span>Application data</span>
                    <Chip status="draft">
                      {live ? "Supabase workspace" : "Browser demo storage"}
                    </Chip>
                  </div>
                  <div className="ledgerline">
                    <span>Financial actions</span>
                    <Chip status="draft">
                      {live ? "User-confirmed only" : "Disabled"}
                    </Chip>
                  </div>
                </section>
              </div>
              <section className="panel">
                {live ? (
                  <>
                    <h2>Secure session</h2>
                    <p className="subtitle">
                      Sign out on shared devices after using your financial
                      workspace.
                    </p>
                    <button
                      className="btn"
                      onClick={() => liveSession?.signOut()}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <h2>A fresh start for this demo</h2>
                    <p className="subtitle">
                      Reset synthetic projects and transactions to the original
                      wedding example. This removes changes made in this
                      browser.
                    </p>
                    <button
                      className="btn danger"
                      onClick={() =>
                        ask(
                          { type: "RESET" },
                          "Reset demo workspace?",
                          "All changes to synthetic financial records in this browser will be replaced by the sample wedding scenario.",
                        )
                      }
                    >
                      Reset demo data
                    </button>
                  </>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 4).map(({ name, icon: Icon }) => (
          <button
            className={page === name ? "active" : ""}
            key={name}
            aria-current={page === name ? "page" : undefined}
            onClick={() => go(name)}
          >
            <Icon size={19} />
            {name}
          </button>
        ))}
        <button aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
          <Menu size={19} />
          More
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2
            size={15}
            style={{ verticalAlign: "middle", marginRight: 9 }}
          />
          {toast}
        </div>
      )}
      {modal && (
        <ModalShell
          title={
            modal === "confirm"
              ? (confirm?.title ?? "Confirm action")
              : (
                  {
                    search: "Find anything",
                    project: "Create a project wallet",
                    invoice: "Create an invoice",
                    expense: "Record an expense",
                    client: "Add a client",
                    collaborator: "Add a collaborator",
                    commitment: "Reserve a project cost",
                    allocation: "Set your Money Autopilot",
                    simulator: "Can I afford this?",
                    breakdown: "Your safe-to-spend breakdown",
                    onboarding: "Make this workspace yours",
                  } as Record<string, string>
                )[modal]
          }
          onClose={close}
        >
          {modal === "search" ? (
            <div
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                  return;
                const targets = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    "input,button.command-result",
                  ),
                );
                if (targets.length < 2) return;
                event.preventDefault();
                const current = targets.indexOf(
                  document.activeElement as HTMLElement,
                );
                const next =
                  (current +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    targets.length) %
                  targets.length;
                targets[next]?.focus();
              }}
            >
              <label className="command-search">
                <Search size={18} aria-hidden="true" />
                <input
                  aria-label="Search projects, invoices, and pages"
                  placeholder="Projects, clients, invoice numbers…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="command-results">
                {searchResults.length ? (
                  searchResults.map((result) => (
                    <button
                      className="command-result"
                      key={result.key}
                      onClick={() => {
                        go(result.page);
                        if (result.projectId) setSelected(result.projectId);
                        if (result.invoiceNumber)
                          setQuery(result.invoiceNumber);
                        close();
                      }}
                    >
                      {result.projectId ? (
                        <FolderOpen size={18} aria-hidden="true" />
                      ) : result.invoiceNumber ? (
                        <FileText size={18} aria-hidden="true" />
                      ) : (
                        <ArrowRight size={18} aria-hidden="true" />
                      )}
                      <span>
                        <strong>{result.title}</strong>
                        <small>{result.detail}</small>
                      </span>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </button>
                  ))
                ) : (
                  <p className="subtitle" role="status">
                    No matches. Try a project, client, invoice number, or page
                    name.
                  </p>
                )}
              </div>
              <p className="command-hint">
                ↑ ↓ to navigate · Enter to open · Esc to close
              </p>
            </div>
          ) : modal === "breakdown" ? (
            <>
              <div className="notice">
                Settled cash minus money already spoken for. Bookkeeping
                reserves are not separate accounts.
              </div>
              <LedgerLine label="Actual settled balance" value={cash.balance} />
              {cash.pendingExpenses > 0 && (
                <LedgerLine
                  label="Expenses awaiting provider match"
                  value={-cash.pendingExpenses}
                />
              )}
              <LedgerLine label="Tax reserve" value={-cash.taxReserve} />
              <LedgerLine label="Gear reserve" value={-cash.gearReserve} />
              <LedgerLine
                label="Contractor commitments"
                value={
                  -s.commitments
                    .filter((c) => c.kind === "contractor")
                    .reduce((n, c) => n + c.amount - c.paid, 0)
                }
              />
              <LedgerLine
                label="Other project commitments"
                value={
                  -(
                    cash.commitments -
                    s.commitments
                      .filter((c) => c.kind === "contractor")
                      .reduce((n, c) => n + c.amount - c.paid, 0)
                  )
                }
              />
              <LedgerLine
                label="Protected reserves"
                value={-cash.protectedReserves}
              />
              <LedgerLine label="Safe to spend" value={cash.total} total />
              <p className="subtitle">
                Expected invoice payments are excluded until settled. Negative
                values mean obligations exceed available cash.
              </p>
            </>
          ) : modal === "simulator" ? (
            (() => {
              const impact = purchaseImpact(
                s,
                Number.isSafeInteger(purchase) && purchase > 0 ? purchase : 1,
              );
              return (
                <>
                  <p className="subtitle">
                    Test a purchase against your cash and commitments. Nothing
                    is bought or transferred.
                  </p>
                  <div className="formgrid">
                    <Field
                      label="What are you considering?"
                      name="item"
                      defaultValue="Sony lens"
                      wide
                    />
                    <label className="field">
                      Purchase amount (USD)
                      <input
                        aria-label="Purchase amount (USD)"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={purchaseInput}
                        onChange={(e) => setPurchaseInput(e.target.value)}
                      />
                    </label>
                    <Field name="timing" label="Timing" defaultValue="Today">
                      <option>Today</option>
                    </Field>
                  </div>
                  {purchase > 0 && Number.isSafeInteger(purchase) ? (
                    <>
                      <div className="breakdown">
                        <LedgerLine
                          label="Current safe to spend"
                          value={impact.current}
                        />
                        <LedgerLine label="Purchase" value={-purchase} />
                        <LedgerLine
                          label="Safe to spend afterward"
                          value={impact.after}
                          total
                        />
                        <LedgerLine
                          label="Outstanding expected in 30 days"
                          value={impact.expected30}
                        />
                        <LedgerLine
                          label="Outstanding expected in 60 days"
                          value={impact.expected60}
                        />
                        <LedgerLine
                          label="Committed project costs (already reserved)"
                          value={impact.commitments}
                        />
                      </div>
                      <div
                        className={"notice " + (impact.shortfall ? "warn" : "")}
                        style={{ marginTop: 20 }}
                      >
                        {impact.shortfall
                          ? `This purchase exceeds your safe-to-spend cash by ${money(impact.shortfall)}. Reserves and commitments would no longer be fully covered.`
                          : `This leaves ${money(impact.after)} after your currently recorded reserves and commitments.`}{" "}
                        Expected invoice payments may arrive late or not at all.
                        Your tax reserve of {money(impact.taxReserve)} is
                        unchanged in this simulation.
                      </div>
                    </>
                  ) : (
                    <div className="error" role="alert">
                      Enter a positive amount with no more than two decimal
                      places.
                    </div>
                  )}
                  <p className="projectmeta">
                    Cash-flow simulation based on recorded data. Not financial
                    advice. Future unrecorded expenses are excluded.
                  </p>
                </>
              );
            })()
          ) : modal === "confirm" ? (
            <>
              <p className="subtitle">{confirm?.detail}</p>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div className="modalfoot">
                <button className="btn" onClick={close}>
                  Cancel
                </button>
                <button
                  className={
                    "btn " +
                    (confirm?.action.type === "RESET" ? "danger" : "primary")
                  }
                  onClick={async () => {
                    if (
                      confirm &&
                      (await act(confirm.action, "Action completed"))
                    )
                      close();
                  }}
                >
                  Confirm
                </button>
              </div>
            </>
          ) : (
            <form
              onSubmit={save}
              onChange={(e) => {
                const field = e.target;
                if (
                  field instanceof HTMLSelectElement &&
                  modal === "invoice" &&
                  field.name === "projectId"
                )
                  setDraftProject(field.value);
              }}
            >
              <div className="formgrid">
                {modal === "project" && (
                  <>
                    <Field name="name" label="Project name" wide />
                    <Field name="clientId" label="Client">
                      {s.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Field>
                    <Field name="type" label="Project template">
                      {templates.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Field>
                    <Field
                      name="amount"
                      label="Project value (USD)"
                      type="number"
                      min="0.01"
                      step="0.01"
                    />
                    <Field
                      name="date"
                      label="Project date"
                      type="date"
                      defaultValue={today()}
                    />
                    <p className="projectmeta wide">
                      Create clients in the Clients area. Templates suggest
                      creative invoice items for this type of work. Every item
                      remains editable.
                    </p>
                  </>
                )}
                {modal === "invoice" && (
                  <>
                    <Field
                      name="projectId"
                      label="Project"
                      defaultValue={selected ?? undefined}
                      wide
                    >
                      {projectOptions()}
                    </Field>
                    <Field
                      key={draftProject}
                      name="description"
                      label="Line item / service description"
                      defaultValue={
                        templateDefaults[
                          s.projects.find((p) => p.id === draftProject)?.type ??
                            "Custom Project"
                        ]
                      }
                      list="invoice-items"
                      wide
                    />
                    <datalist id="invoice-items">
                      {invoiceItems.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    <Field
                      name="amount"
                      label="Invoice amount (USD)"
                      type="number"
                      min="0.01"
                      step="0.01"
                    />
                    <Field
                      name="date"
                      label="Due date"
                      type="date"
                      defaultValue={today()}
                    />
                    <p className="projectmeta wide">
                      Create separate retainer and final-balance invoices. An
                      invoice starts as a draft. Demo payments support partial
                      balances through the payment preview.
                    </p>
                  </>
                )}
                {modal === "expense" && (
                  <>
                    <Field name="merchant" label="Merchant / payee" wide />
                    <Field
                      name="amount"
                      label="Amount (USD)"
                      type="number"
                      min="0.01"
                      step="0.01"
                    />
                    <Field
                      name="date"
                      label="Date"
                      type="date"
                      defaultValue={today()}
                    />
                    <Field name="category" label="Category">
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Field>
                    <Field
                      name="projectId"
                      label="Project"
                      defaultValue={selected ?? ""}
                      required={false}
                    >
                      <option value="">Business overhead</option>
                      {projectOptions()}
                    </Field>
                    <Field
                      name="commitmentId"
                      label="Apply against an existing estimate"
                      required={false}
                      wide
                    >
                      <option value="">No existing commitment</option>
                      {s.commitments
                        .filter(
                          (c) => c.kind !== "contractor" && c.paid < c.amount,
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.description} ·{" "}
                            {s.projects.find((p) => p.id === c.projectId)?.name}
                          </option>
                        ))}
                    </Field>
                    {!live && (
                      <Field
                        name="receipt"
                        label="Receipt reference (optional, externally stored)"
                        required={false}
                        wide
                      />
                    )}
                    {live && (
                      <p className="projectmeta wide">
                        After saving, attach a private receipt from the expense
                        list.
                      </p>
                    )}
                    <p className="projectmeta wide">
                      An expense applied to an estimate reduces its outstanding
                      commitment, avoiding counting the cost twice.
                    </p>
                  </>
                )}
                {modal === "client" && (
                  <>
                    <Field name="name" label="Client name" wide />
                    <Field name="email" label="Email" type="email" wide />
                    <Field
                      name="company"
                      label="Company (optional)"
                      required={false}
                      wide
                    />
                  </>
                )}
                {modal === "collaborator" && (
                  <>
                    <Field name="name" label="Full name" wide />
                    <Field name="email" label="Email" type="email" wide />
                    <Field
                      name="role"
                      label="Role"
                      defaultValue="Second shooter"
                    />
                    <Field name="taxStatus" label="W-9 document status">
                      <option>Not requested</option>
                      <option>Requested</option>
                      <option>Received externally</option>
                      <option>Verified externally</option>
                    </Field>
                    <p className="projectmeta wide">
                      Status only. Do not enter a tax ID or upload a W-9 here.
                    </p>
                  </>
                )}
                {modal === "commitment" && (
                  <>
                    <Field
                      name="projectId"
                      label="Project"
                      defaultValue={selected ?? undefined}
                      wide
                    >
                      {projectOptions()}
                    </Field>
                    <Field
                      name="description"
                      label="What is this cost for?"
                      wide
                    />
                    <Field
                      name="amount"
                      label="Committed amount (USD)"
                      type="number"
                      min="0.01"
                      step="0.01"
                    />
                    <Field name="kind" label="Cost type">
                      <option value="contractor">Contractor</option>
                      <option value="travel">Travel</option>
                      <option value="other">Other project cost</option>
                    </Field>
                    <Field
                      name="collaboratorId"
                      label="Collaborator (optional)"
                      wide
                      required={false}
                    >
                      <option value="">No collaborator</option>
                      {s.collaborators.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Field>
                  </>
                )}
                {modal === "allocation" && (
                  <>
                    <p className="subtitle wide">
                      Choose the share of future settled income to protect. The
                      rest remains available before commitments. Existing
                      allocations stay as recorded.
                    </p>
                    <Field
                      name="tax"
                      label="Tax reserve (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={s.taxBps / 100}
                    />
                    <Field
                      name="gear"
                      label="Gear fund (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={s.gearBps / 100}
                    />
                    <div className="notice wide">
                      Together these percentages must not exceed 100%. These are
                      virtual bookkeeping allocations, not automatic bank
                      transfers.
                    </div>
                  </>
                )}
                {modal === "onboarding" && (
                  <>
                    <Field
                      name="business"
                      label="Your business name"
                      defaultValue={business}
                      wide
                    />
                    <Field name="discipline" label="Your creative discipline">
                      <option>Photographer</option>
                      <option>Videographer</option>
                      <option>Content creator</option>
                      <option>Designer</option>
                      <option>Social media manager</option>
                      <option>Creative agency</option>
                      <option>Other</option>
                    </Field>
                    <Field name="payment" label="How do you get paid?">
                      <option>Project invoices</option>
                      <option>Retainers</option>
                      <option>Platform payouts</option>
                      <option>Brand deals</option>
                      <option>Other</option>
                    </Field>
                    <Field
                      name="contractors"
                      label="Work with contractors?"
                      wide
                    >
                      <option>Yes</option>
                      <option>No</option>
                      <option>Sometimes</option>
                    </Field>
                    <Field
                      name="tax"
                      label="Reserve for taxes (%)"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={s.taxBps / 100}
                    />
                    <Field
                      name="gear"
                      label="Save for equipment (%)"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={s.gearBps / 100}
                    />
                    <p className="projectmeta wide">
                      This personalizes your workspace. Required identity
                      verification is handled separately by the financial
                      provider for live accounts.
                    </p>
                  </>
                )}
              </div>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div className="modalfoot">
                <button className="btn" type="button" onClick={close}>
                  Cancel
                </button>
                <button className="btn primary" type="submit">
                  {modal === "project"
                    ? "Create project"
                    : modal === "invoice"
                      ? "Create invoice draft"
                      : modal === "expense"
                        ? "Record expense"
                        : modal === "onboarding"
                          ? "Save workspace"
                          : "Save changes"}
                  <ArrowRight size={13} />
                </button>
              </div>
            </form>
          )}
        </ModalShell>
      )}
    </div>
  );
}
