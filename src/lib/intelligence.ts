import {
  formatMoney,
  projectProfit,
  purchaseImpact,
  safeToSpend,
  type FinancialState,
} from "@/domain";
export type FinancialAnswer = {
  answer: string;
  facts: { label: string; amount: number }[];
  caveat: string;
};
export interface IntelligenceProvider {
  readonly name: string;
  answer(state: FinancialState, question: string): Promise<FinancialAnswer>;
}
const caveat =
  "Calculated from your workspace records. Expected invoices are not guaranteed cash. This is business cash-flow information, not financial or tax advice.";
/** Deterministic queries work offline; no financial data leaves the workspace. */
export function answerQuestion(
  state: FinancialState,
  question: string,
): FinancialAnswer {
  const q = question.trim().toLowerCase();
  const facts: FinancialAnswer["facts"] = [];
  let answer: string;
  if (/afford|purchase|buy|lens|light/.test(q)) {
    const match = q.match(
      /\$\s*([\d,]+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\b/,
    );
    const raw = match?.[1]?.replaceAll(",", "") ?? match?.[2];
    const amount = raw ? Math.round(Number(raw) * 100) : 0;
    if (!Number.isSafeInteger(amount) || amount <= 0)
      return {
        answer:
          "Include a positive purchase amount, such as “Can I afford a $2,400 lens?”",
        facts,
        caveat,
      };
    const impact = purchaseImpact(
      state,
      amount,
      new Date().toISOString().slice(0, 10),
    );
    facts.push(
      { label: "Safe to spend now", amount: impact.current },
      { label: "Purchase", amount },
      { label: "Safe to spend after", amount: impact.after },
      {
        label: "Unpaid invoices due within 30 days, including overdue",
        amount: impact.expected30,
      },
    );
    answer =
      impact.after < 0
        ? `This purchase exceeds your uncommitted cash by ${formatMoney(-impact.after)}. It would use money currently assigned to reserves or obligations.`
        : `This purchase would leave ${formatMoney(impact.after)} in uncommitted cash, with current reserves and commitments still deducted.`;
  } else if (/receipt/.test(q)) {
    const missing = state.expenses.filter((e) => !e.receipt);
    answer = `${missing.length} expense${missing.length === 1 ? "" : "s"} still need a receipt.`;
    facts.push(
      ...missing.map((e) => ({ label: e.merchant, amount: e.amount })),
    );
  } else if (/adobe|software|subscription/.test(q)) {
    const expenses = state.expenses.filter((e) =>
      /software|adobe|ai tools|gallery|cloud|subscription/i.test(
        `${e.category} ${e.merchant}`,
      ),
    );
    facts.push(
      ...expenses.map((e) => ({ label: e.merchant, amount: e.amount })),
    );
    answer = `Recorded software and subscription expenses total ${formatMoney(expenses.reduce((sum, e) => sum + e.amount, 0))}. Recurrence cannot be confirmed from a single charge.`;
  } else if (/collaborator|contractor|shooter/.test(q)) {
    const commitments = state.commitments.filter(
      (c) => c.kind === "contractor" && c.amount > c.paid,
    );
    facts.push(
      ...commitments.map((c) => ({
        label: c.description,
        amount: c.amount - c.paid,
      })),
    );
    answer = `${formatMoney(facts.reduce((sum, f) => sum + f.amount, 0))} is committed to collaborators. This money is already deducted from Safe to Spend.`;
  } else if (/owes|owed|invoice|client/.test(q)) {
    const invoices = state.invoices.filter(
      (i) => !["void", "draft"].includes(i.status) && i.paid < i.amount,
    );
    facts.push(
      ...invoices.map((i) => {
        const project = state.projects.find((p) => p.id === i.projectId);
        const client = state.clients.find((c) => c.id === project?.clientId);
        return {
          label: `${client?.name ?? "Unassigned client"} · ${i.number}`,
          amount: i.amount - i.paid,
        };
      }),
    );
    answer = `${formatMoney(facts.reduce((sum, f) => sum + f.amount, 0))} remains unpaid across ${invoices.length} sent invoices. These receivables are excluded from settled cash.`;
  } else if (/wedding|margin|profit|make|made/.test(q)) {
    const projects = state.projects.filter(
      (p) => !q.includes("wedding") || p.type === "Wedding",
    );
    facts.push(
      ...projects.map((p) => ({
        label: `${p.name} · received less recorded costs and fees`,
        amount: projectProfit(state, p.id).actualProfit,
      })),
    );
    const total = facts.reduce((sum, f) => sum + f.amount, 0);
    answer = `Cash profit across these ${projects.length} projects is ${formatMoney(total)}, before business overhead and tax. Open projects may still have unpaid costs. This is the complete workspace history; payment-date reporting is not yet available.`;
  } else if (/safe|balance|cash|spend/.test(q)) {
    const cash = safeToSpend(state);
    facts.push(
      { label: "Settled balance", amount: cash.balance },
      { label: "Tax reserve", amount: -cash.taxReserve },
      { label: "Gear reserve", amount: -cash.gearReserve },
      { label: "Commitments", amount: -cash.commitments },
      { label: "Protected reserves", amount: -cash.protectedReserves },
      { label: "Safe to spend", amount: cash.total },
    );
    answer = `You have ${formatMoney(cash.total)} after recorded reserves and commitments. Reserves are bookkeeping allocations, not separate bank accounts.`;
  } else {
    answer =
      "I can calculate unpaid invoices, collaborator commitments, software expenses, missing receipts, project profit, Safe to Spend, or a purchase impact. Try “Can I afford a $2,400 lens?”";
  }
  return { answer, facts, caveat };
}
export class DeterministicIntelligenceProvider implements IntelligenceProvider {
  readonly name = "Workspace calculations";
  async answer(state: FinancialState, question: string) {
    return answerQuestion(state, question);
  }
}
