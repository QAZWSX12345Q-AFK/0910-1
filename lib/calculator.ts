import {
  DcaPlan,
  FundQuote,
  Snapshot,
  Transaction,
} from "./types";

export function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;
}

export function portfolioStats(
  transactions: Transaction[],
  quotes: Record<string, FundQuote>
) {
  const invested = transactions.reduce(
    (sum, item) => sum + item.amount + item.fee,
    0
  );

  const value = transactions.reduce((sum, item) => {
    const quote = quotes[item.code];

    const nav =
      quote?.estimatedNav ??
      quote?.nav ??
      item.nav;

    return sum + item.shares * nav;
  }, 0);

  const profit = value - invested;

  const rate =
    invested > 0
      ? (profit / invested) * 100
      : 0;

  const todayEstimate = transactions.reduce(
    (sum, item) => {
      const quote = quotes[item.code];

      if (
        !quote ||
        quote.estimatedChangePct === null
      ) {
        return sum;
      }

      const nav =
        quote.estimatedNav ??
        quote.nav ??
        item.nav;

      return (
        sum +
        item.shares *
          nav *
          quote.estimatedChangePct /
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

export function createTransaction(
  code: string,
  name: string,
  date: string,
  amount: number,
  nav: number,
  planId?: string,
  fee = 0
): Transaction {
  if (amount <= 0) {
    throw new Error("投入金额必须大于 0");
  }

  if (nav <= 0) {
    throw new Error("净值必须大于 0");
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

export function buildSnapshots(
  transactions: Transaction[],
  quotes: Record<string, FundQuote>
): Snapshot[] {
  const dates = Array.from(
    new Set(
      transactions.map(
        (item) => item.date
      )
    )
  ).sort();

  return dates.map((date) => {
    const list = transactions.filter(
      (item) => item.date <= date
    );

    const invested = list.reduce(
      (sum, item) =>
        sum + item.amount + item.fee,
      0
    );

    const value = list.reduce(
      (sum, item) => {
        const quote = quotes[item.code];

        const nav =
          quote?.nav ??
          item.nav;

        return (
          sum +
          item.shares * nav
        );
      },
      0
    );

    return {
      date,
      invested,
      value,
    };
  });
}

export function frequencyLabel(
  frequency: DcaPlan["frequency"]
) {
  if (frequency === "daily") {
    return "每日";
  }

  if (frequency === "weekly") {
    return "每周";
  }

  return "每月";
}
