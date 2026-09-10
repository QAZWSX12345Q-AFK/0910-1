import {
  DcaPlan,
  FundQuote,
  Snapshot,
  Transaction,
} from "./types";

export function money(n: number) {
  return new Intl.NumberFormat(
    "zh-CN",
    {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(n) ? n : 0
  );
}

export function pct(n: number) {
  return `${(
    Number.isFinite(n) ? n : 0
  ).toFixed(2)}%`;
}

export function portfolioStats(
  transactions: Transaction[],
  quotes: Record<
    string,
    FundQuote
  >
) {
  const invested =
    transactions.reduce(
      (sum, transaction) =>
        sum +
        transaction.amount +
        transaction.fee,
      0
    );

  const value =
    transactions.reduce(
      (sum, transaction) => {
        const quote =
          quotes[transaction.code];

        const nav =
          quote?.estimatedNav ??
          quote?.nav ??
          transaction.nav;

        return (
          sum +
          transaction.shares *
            nav
        );
      },
      0
    );

  const profit =
    value - invested;

  const rate = invested
    ? (profit / invested) * 100
    : 0;

  const todayEstimate =
    transactions.reduce(
      (sum, transaction) => {
        const quote =
          quotes[transaction.code];

        const change =
          quote?.estimatedChangePct ??
          0;

        const nav =
          quote?.nav ??
          transaction.nav;

        return (
          sum +
          (transaction.shares *
            nav *
            change) /
            100
        );
      },
      0
    );

  return {
    invested,
    value,
    profit,
    rate,
    todayEstimate,
  };
}

export function addTransactionFromAmount(
  code: string,
  name: string,
  date: string,
  amount: number,
  nav: number,
  planId?: string,
  fee = 0
): Transaction {
  if (!amount || amount <= 0) {
    throw new Error(
      "投入金额必须大于 0"
    );
  }

  if (!nav || nav <= 0) {
    throw new Error(
      "净值必须大于 0"
    );
  }

  return {
    id: crypto.randomUUID(),
    planId,
    code,
    name,
    date,
    amount,
    nav,
    shares: amount / nav,
    fee,
  };
}

export function dueDates(
  plan: DcaPlan,
  until = new Date()
) {
  const result: string[] = [];

  const start = new Date(
    `${plan.startDate}T00:00:00`
  );

  const end = new Date(until);

  if (start > end) {
    return result;
  }

  for (
    let date = new Date(start);
    date <= end;
    date.setDate(
      date.getDate() + 1
    )
  ) {
    const weekday =
      date.getDay();

    let due = false;

    if (
      plan.frequency ===
      "daily"
    ) {
      due =
        weekday !== 0 &&
        weekday !== 6;
    }

    if (
      plan.frequency ===
      "weekly"
    ) {
      due =
        weekday ===
        start.getDay();
    }

    if (
      plan.frequency ===
      "monthly"
    ) {
      due =
        date.getDate() ===
        start.getDate();
    }

    if (due) {
      result.push(
        date
          .toISOString()
          .slice(0, 10)
      );
    }
  }

  return result;
}

export function buildSnapshots(
  transactions: Transaction[],
  quotes: Record<
    string,
    FundQuote
  >
): Snapshot[] {
  const dates = Array.from(
    new Set(
      transactions.map(
        (transaction) =>
          transaction.date
      )
    )
  ).sort();

  return dates.map((date) => {
    const transactionsAtDate =
      transactions.filter(
        (transaction) =>
          transaction.date <= date
      );

    const invested =
      transactionsAtDate.reduce(
        (sum, transaction) =>
          sum +
          transaction.amount +
          transaction.fee,
        0
      );

    const value =
      transactionsAtDate.reduce(
        (sum, transaction) => {
          const quote =
            quotes[
              transaction.code
            ];

          const nav =
            quote?.nav ??
            transaction.nav;

          return (
            sum +
            transaction.shares *
              nav
          );
        },
        0
      );

    return {
      date,
      value,
      invested,
    };
  });
}
