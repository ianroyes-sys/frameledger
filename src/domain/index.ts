export type Currency = "USD";
export type Project = {
  id: string;
  name: string;
  clientId: string;
  type: string;
  date: string;
  value: number;
  status: "active" | "completed";
};
export type Client = {
  id: string;
  name: string;
  email: string;
  company?: string;
};
export type Invoice = {
  id: string;
  projectId: string;
  number: string;
  description: string;
  amount: number;
  paid: number;
  dueDate: string;
  paymentUrl?: string;
  status: "draft" | "sent" | "partial" | "paid" | "void";
};
export type Expense = {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
  projectId?: string;
  commitmentId?: string;
  settledExternally?: boolean;
  receipt?: string;
};
export type Commitment = {
  id: string;
  projectId: string;
  collaboratorId?: string;
  description: string;
  amount: number;
  paid: number;
  kind: "contractor" | "travel" | "other";
};
export type Collaborator = {
  id: string;
  name: string;
  role: string;
  email: string;
  taxStatus: string;
};
export type Payment = {
  id: string;
  invoiceId: string;
  amount: number;
  tax: number;
  gear: number;
  refunded: number;
  fee: number;
};
export type FinancialState = {
  version: 1;
  currency: Currency;
  actualSettledBalance?: number;
  balanceSyncedAt?: string;
  openingBalance: number;
  taxBps: number;
  gearBps: number;
  protectedReserves: number;
  projects: Project[];
  clients: Client[];
  invoices: Invoice[];
  expenses: Expense[];
  commitments: Commitment[];
  collaborators: Collaborator[];
  payments: Payment[];
  processedEvents: string[];
};
export function minor(value: number): number {
  if (!Number.isSafeInteger(value))
    throw new Error("Money must be a safe integer in cents");
  return value;
}
export function positive(value: number): number {
  minor(value);
  if (value <= 0) throw new Error("Amount must be positive");
  return value;
}
export function allocate(amount: number, weights: number[]): number[] {
  minor(amount);
  if (
    amount < 0 ||
    weights.some((w) => !Number.isInteger(w) || w < 0) ||
    weights.reduce((a, b) => a + b, 0) !== 10000
  )
    throw new Error("Allocations must total 100%");
  const parts = weights.map((w) =>
    Number((BigInt(amount) * BigInt(w)) / 10000n),
  );
  let remaining = amount - parts.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, remainder: (BigInt(amount) * BigInt(w)) % 10000n }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.i - b.i
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  for (const { i } of order) {
    if (remaining-- <= 0) break;
    parts[i]++;
  }
  return parts;
}
export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    (minor(cents) === 0 ? 0 : cents) / 100,
  );
}
/** Sum in integer space: cancellation must not hide a rounded intermediate. */
function moneySum(values: number[]): number {
  return minor(
    Number(values.reduce((sum, value) => sum + BigInt(minor(value)), 0n)),
  );
}
function expenseTotals(s: FinancialState) {
  const totals = new Map<string, number>();
  for (const expense of s.expenses) {
    if (expense.commitmentId)
      totals.set(
        expense.commitmentId,
        moneySum([totals.get(expense.commitmentId) ?? 0, expense.amount]),
      );
  }
  return totals;
}
function remainingCommitment(c: Commitment, totals: Map<string, number>) {
  return Math.max(0, moneySum([c.amount, -c.paid, -(totals.get(c.id) ?? 0)]));
}
export function safeToSpend(s: FinancialState) {
  const totals = expenseTotals(s);
  const pendingExpenses =
    s.actualSettledBalance !== undefined
      ? moneySum(
          s.expenses.filter((e) => !e.settledExternally).map((e) => e.amount),
        )
      : 0;
  const balance =
    s.actualSettledBalance !== undefined
      ? minor(s.actualSettledBalance)
      : moneySum([
          s.openingBalance,
          ...s.payments.flatMap((p) => [p.amount, -p.refunded, -p.fee]),
          ...s.expenses.map((e) => -e.amount),
          ...s.commitments.map((c) => -c.paid),
        ]);
  const taxReserve = moneySum(s.payments.map((p) => p.tax));
  const gearReserve = moneySum(s.payments.map((p) => p.gear));
  const commitments = moneySum(
    s.commitments.map((c) => remainingCommitment(c, totals)),
  );
  return {
    balance,
    taxReserve,
    gearReserve,
    commitments,
    pendingExpenses,
    protectedReserves: minor(s.protectedReserves),
    total: moneySum([
      balance,
      -taxReserve,
      -gearReserve,
      -commitments,
      -s.protectedReserves,
      -pendingExpenses,
    ]),
  };
}
export function projectProfit(s: FinancialState, id: string) {
  const project = s.projects.find((p) => p.id === id);
  if (!project) throw new Error("Project not found");
  const invoices = s.invoices.filter(
    (i) => i.projectId === id && i.status !== "void",
  );
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const payments = s.payments.filter((p) => invoiceIds.has(p.invoiceId));
  const received = moneySum(payments.flatMap((p) => [p.amount, -p.refunded]));
  const fees = moneySum(payments.map((p) => p.fee));
  const costs = moneySum([
    ...s.expenses.filter((e) => e.projectId === id).map((e) => e.amount),
    ...s.commitments.filter((c) => c.projectId === id).map((c) => c.paid),
  ]);
  const totals = expenseTotals(s);
  const committed = moneySum(
    s.commitments
      .filter((c) => c.projectId === id)
      .map((c) => remainingCommitment(c, totals)),
  );
  const estimatedProfit = moneySum([project.value, -costs, -committed, -fees]);
  return {
    revenue: minor(project.value),
    received,
    costs,
    committed,
    fees,
    estimatedProfit,
    actualProfit: moneySum([received, -costs, -fees]),
    margin: project.value ? estimatedProfit / project.value : 0,
    outstanding: Math.max(
      0,
      moneySum(invoices.flatMap((i) => [i.amount, -i.paid])),
    ),
  };
}
export function purchaseImpact(
  s: FinancialState,
  amount: number,
  asOf = new Date().toISOString().slice(0, 10),
) {
  positive(amount);
  const cash = safeToSpend(s);
  const from = new Date(asOf).getTime();
  if (!Number.isFinite(from)) throw new Error("Invalid forecast date");
  const expected = (days: number) =>
    moneySum(
      s.invoices
        .filter(
          (i) =>
            i.status !== "draft" &&
            i.status !== "void" &&
            new Date(i.dueDate).getTime() >= from &&
            new Date(i.dueDate).getTime() <= from + days * 86400000,
        )
        .flatMap((i) => [i.amount, -i.paid]),
    );
  const after = moneySum([cash.total, -amount]);
  return {
    current: cash.total,
    after,
    expected30: expected(30),
    expected60: expected(60),
    commitments: cash.commitments,
    taxReserve: cash.taxReserve,
    shortfall: Math.max(0, moneySum([amount, -cash.total])),
  };
}
export type Action =
  | { type: "CREATE_PROJECT"; project: Project }
  | { type: "CREATE_CLIENT"; client: Client }
  | { type: "CREATE_INVOICE"; invoice: Invoice }
  | { type: "SEND_INVOICE" | "CLOSE_PROJECT" | "PAY_COMMITMENT"; id: string }
  | { type: "PAY_INVOICE"; id: string; amount?: number; eventId?: string }
  | { type: "ADD_EXPENSE"; expense: Expense }
  | { type: "ASSIGN_EXPENSE"; id: string; projectId?: string }
  | { type: "ADD_COMMITMENT"; commitment: Commitment }
  | { type: "SET_ALLOCATIONS"; taxBps: number; gearBps: number }
  | { type: "ADD_COLLABORATOR"; collaborator: Collaborator }
  | { type: "REFUND_PAYMENT"; id: string; amount: number; eventId: string }
  | { type: "RELEASE_COMMITMENT"; id: string }
  | { type: "SET_PROTECTED_RESERVES"; amount: number }
  | { type: "UPDATE_EXPENSE"; id: string; category?: string; receipt?: string }
  | { type: "RESET" };
function unique(list: { id: string }[], id: string) {
  if (!id || list.some((x) => x.id === id))
    throw new Error("Duplicate or empty ID");
}
function reopenProject(state: FinancialState, id: string | undefined) {
  const project = state.projects.find((p) => p.id === id);
  if (project?.status === "completed") project.status = "active";
}
export function reducer(state: FinancialState, action: Action): FinancialState {
  if (action.type === "RESET") return structuredClone(initialState);
  const s = structuredClone(state);
  switch (action.type) {
    case "CREATE_PROJECT":
      unique(s.projects, action.project.id);
      positive(action.project.value);
      if (!s.clients.some((c) => c.id === action.project.clientId))
        throw new Error("Client not found");
      s.projects.push(action.project);
      break;
    case "CREATE_CLIENT":
      unique(s.clients, action.client.id);
      s.clients.push(action.client);
      break;
    case "CREATE_INVOICE":
      unique(s.invoices, action.invoice.id);
      positive(action.invoice.amount);
      if (!s.projects.some((p) => p.id === action.invoice.projectId))
        throw new Error("Project not found");
      s.invoices.push({ ...action.invoice, paid: 0, status: "draft" });
      reopenProject(s, action.invoice.projectId);
      break;
    case "SEND_INVOICE": {
      const i = s.invoices.find((i) => i.id === action.id);
      if (!i || i.status !== "draft")
        throw new Error("Only draft invoices can be sent");
      i.status = "sent";
      break;
    }
    case "PAY_INVOICE": {
      const eventId =
        action.eventId ?? `demo-payment-${action.id}-${s.payments.length}`;
      if (s.processedEvents.includes(eventId)) return state;
      const i = s.invoices.find((i) => i.id === action.id);
      if (!i || !["sent", "partial"].includes(i.status))
        throw new Error("Invoice cannot receive payment");
      const amount = positive(action.amount ?? i.amount - i.paid);
      if (amount > i.amount - i.paid)
        throw new Error("Payment exceeds balance");
      const [tax, gear] = allocate(amount, [
        s.taxBps,
        s.gearBps,
        10000 - s.taxBps - s.gearBps,
      ]);
      s.payments.push({
        id: eventId,
        invoiceId: i.id,
        amount,
        tax,
        gear,
        fee: 0,
        refunded: 0,
      });
      reopenProject(s, i.projectId);
      i.paid += amount;
      i.status = i.paid === i.amount ? "paid" : "partial";
      s.processedEvents.push(eventId);
      break;
    }
    case "REFUND_PAYMENT": {
      if (s.processedEvents.includes(action.eventId)) return state;
      const p = s.payments.find((p) => p.id === action.id);
      if (!p) throw new Error("Payment not found");
      positive(action.amount);
      if (action.amount > p.amount - p.refunded)
        throw new Error("Refund exceeds payment");
      const remaining = p.amount - p.refunded;
      const taxReturn = Number(
        (BigInt(p.tax) * BigInt(action.amount)) / BigInt(remaining),
      );
      const gearReturn = Number(
        (BigInt(p.gear) * BigInt(action.amount)) / BigInt(remaining),
      );
      p.tax -= taxReturn;
      p.gear -= gearReturn;
      p.refunded += action.amount;
      const i = s.invoices.find((i) => i.id === p.invoiceId);
      if (i) {
        reopenProject(s, i.projectId);
        i.paid -= action.amount;
        i.status = i.paid ? "partial" : "sent";
      }
      s.processedEvents.push(action.eventId);
      break;
    }
    case "ADD_EXPENSE":
      unique(s.expenses, action.expense.id);
      positive(action.expense.amount);
      if (
        action.expense.projectId &&
        !s.projects.some((p) => p.id === action.expense.projectId)
      )
        throw new Error("Project not found");
      if (
        action.expense.commitmentId &&
        !s.commitments.some(
          (c) =>
            c.id === action.expense.commitmentId &&
            c.projectId === action.expense.projectId,
        )
      )
        throw new Error("Commitment and project do not match");
      s.expenses.push(action.expense);
      reopenProject(s, action.expense.projectId);
      break;
    case "ASSIGN_EXPENSE": {
      const e = s.expenses.find((e) => e.id === action.id);
      if (!e) throw new Error("Expense not found");
      if (
        action.projectId &&
        !s.projects.some((p) => p.id === action.projectId)
      )
        throw new Error("Project not found");
      if (action.projectId !== e.projectId) {
        reopenProject(s, e.projectId);
        reopenProject(s, action.projectId);
      }
      if (e.commitmentId && action.projectId !== e.projectId)
        e.commitmentId = undefined;
      e.projectId = action.projectId;
      break;
    }
    case "ADD_COMMITMENT":
      unique(s.commitments, action.commitment.id);
      positive(action.commitment.amount);
      if (!s.projects.some((p) => p.id === action.commitment.projectId))
        throw new Error("Project not found");
      if (
        action.commitment.collaboratorId &&
        !s.collaborators.some((c) => c.id === action.commitment.collaboratorId)
      )
        throw new Error("Collaborator not found");
      s.commitments.push({ ...action.commitment, paid: 0 });
      reopenProject(s, action.commitment.projectId);
      break;
    case "PAY_COMMITMENT": {
      const c = s.commitments.find((c) => c.id === action.id);
      if (!c) throw new Error("Commitment not found");
      if (s.expenses.some((e) => e.commitmentId === c.id))
        throw new Error(
          "Resolve expense-backed commitments with expenses and release the remainder",
        );
      if (c.paid === c.amount) throw new Error("Commitment already paid");
      if (safeToSpend(s).balance < c.amount - c.paid)
        throw new Error("Insufficient settled funds");
      c.paid = c.amount;
      break;
    }
    case "SET_ALLOCATIONS":
      allocate(0, [
        action.taxBps,
        action.gearBps,
        10000 - action.taxBps - action.gearBps,
      ]);
      s.taxBps = action.taxBps;
      s.gearBps = action.gearBps;
      break;
    case "CLOSE_PROJECT": {
      const p = s.projects.find((p) => p.id === action.id);
      if (!p) throw new Error("Project not found");
      const f = projectProfit(s, p.id);
      if (f.outstanding || f.committed || f.received < p.value)
        throw new Error(
          "Collect project revenue and resolve commitments before closing",
        );
      p.status = "completed";
      break;
    }
    case "RELEASE_COMMITMENT": {
      const c = s.commitments.find((c) => c.id === action.id);
      if (!c) throw new Error("Commitment not found");
      c.amount =
        c.paid +
        s.expenses
          .filter((e) => e.commitmentId === c.id)
          .reduce((n, e) => n + e.amount, 0);
      break;
    }
    case "SET_PROTECTED_RESERVES":
      minor(action.amount);
      if (action.amount < 0) throw new Error("Reserve must not be negative");
      s.protectedReserves = action.amount;
      break;
    case "UPDATE_EXPENSE": {
      const e = s.expenses.find((e) => e.id === action.id);
      if (!e) throw new Error("Expense not found");
      if (action.category) e.category = action.category;
      if (action.receipt) e.receipt = action.receipt;
      break;
    }
    case "ADD_COLLABORATOR":
      unique(s.collaborators, action.collaborator.id);
      s.collaborators.push(action.collaborator);
      break;
  }
  safeToSpend(s);
  return s;
}
export const initialState: FinancialState = {
  version: 1,
  currency: "USD",
  openingBalance: 0,
  taxBps: 2500,
  gearBps: 1000,
  protectedReserves: 0,
  clients: [
    {
      id: "client-johnson",
      name: "Emma & James Johnson",
      email: "johnsons@example.com",
    },
    {
      id: "client-studio",
      name: "Northline Studio",
      email: "hello@example.com",
      company: "Northline Studio",
    },
    { id: "client-cafe", name: "Sunday Coffee", email: "team@example.com" },
  ],
  projects: [
    {
      id: "project-johnson",
      name: "Johnson Wedding",
      clientId: "client-johnson",
      type: "Wedding",
      date: "2026-10-17",
      value: 320000,
      status: "active",
    },
    {
      id: "project-northline",
      name: "Northline / Fall Campaign",
      clientId: "client-studio",
      type: "Commercial Shoot",
      date: "2026-10-02",
      value: 480000,
      status: "active",
    },
    {
      id: "project-sunday",
      name: "Sunday Coffee / September",
      clientId: "client-cafe",
      type: "Content Retainer",
      date: "2026-09-30",
      value: 180000,
      status: "active",
    },
  ],
  invoices: [
    {
      id: "invoice-retainer",
      projectId: "project-johnson",
      number: "INV-0101",
      description: "Wedding booking retainer · 50%",
      amount: 160000,
      paid: 160000,
      dueDate: "2026-09-20",
      status: "paid",
    },
    {
      id: "invoice-final",
      projectId: "project-johnson",
      number: "INV-0102",
      description: "Wedding final balance",
      amount: 160000,
      paid: 0,
      dueDate: "2026-10-10",
      status: "sent",
    },
    {
      id: "invoice-northline",
      projectId: "project-northline",
      number: "INV-0103",
      description: "Fall campaign deposit",
      amount: 240000,
      paid: 0,
      dueDate: "2026-09-26",
      status: "sent",
    },
    {
      id: "invoice-sunday",
      projectId: "project-sunday",
      number: "INV-0104",
      description: "September content retainer",
      amount: 180000,
      paid: 0,
      dueDate: "2026-09-30",
      status: "sent",
    },
  ],
  expenses: [],
  commitments: [
    {
      id: "commit-shooter",
      projectId: "project-johnson",
      collaboratorId: "collab-maya",
      description: "Second shooter",
      amount: 45000,
      paid: 0,
      kind: "contractor",
    },
    {
      id: "commit-travel",
      projectId: "project-johnson",
      description: "Travel estimate",
      amount: 12000,
      paid: 0,
      kind: "travel",
    },
  ],
  collaborators: [
    {
      id: "collab-maya",
      name: "Maya Chen",
      role: "Second shooter",
      email: "maya@example.com",
      taxStatus: "Requested",
    },
  ],
  payments: [
    {
      id: "demo-booking",
      invoiceId: "invoice-retainer",
      amount: 160000,
      tax: 40000,
      gear: 16000,
      fee: 0,
      refunded: 0,
    },
  ],
  processedEvents: ["demo-booking"],
};
