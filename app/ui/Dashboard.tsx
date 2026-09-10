"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addTransactionFromAmount,
  buildSnapshots,
  money,
  pct,
  portfolioStats,
} from "../../lib/calculator";
import {
  DcaPlan,
  FundQuote,
  Transaction,
  Frequency,
} from "../../lib/types";

const STORAGE = "fund-dca-assistant-v2";

const demoPlans: DcaPlan[] = [
  {
    id: "demo-1",
    name: "沪深300 定投",
    code: "000300",
    amount: 500,
    frequency: "weekly",
    startDate: new Date().toISOString().slice(0, 10),
    enabled: true,
  },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, FundQuote>>({});
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("500");
  const [frequency, setFrequency] =
    useState<Frequency>("weekly");
  const [startDate, setStartDate] = useState(today());

  const [buyCode, setBuyCode] = useState("");
  const [buyAmount, setBuyAmount] = useState("500");
  const [buyNav, setBuyNav] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE);

    if (!raw) return;

    try {
      const data = JSON.parse(raw);

      setPlans(data.plans ?? []);
      setTransactions(data.transactions ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({
        plans,
        transactions,
      })
    );
  }, [plans, transactions]);

  const codes = useMemo(
    () =>
      Array.from(
        new Set([
          ...plans.map((p) => p.code),
          ...transactions.map((t) => t.code),
        ])
      ),
    [plans, transactions]
  );

  async function refreshQuotes() {
    if (!codes.length) return;

    setLoading(true);

    const next: Record<string, FundQuote> = {
      ...quotes,
    };

    await Promise.all(
      codes.map(async (c) => {
        try {
          const response = await fetch(`/api/fund/${c}`);

          if (response.ok) {
            next[c] = await response.json();
          }
        } catch {}
      })
    );

    setQuotes(next);
    setLoading(false);
  }

  useEffect(() => {
    refreshQuotes();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(",")]);

  const stats = portfolioStats(
    transactions,
    quotes
  );

  const snapshots = buildSnapshots(
    transactions,
    quotes
  );

  function addPlan() {
    if (!/^\d{6}$/.test(code)) {
      alert("请输入 6 位基金代码");
      return;
    }

    if (Number(amount) <= 0) {
      alert("请输入有效定投金额");
      return;
    }

    const plan: DcaPlan = {
      id: crypto.randomUUID(),
      name:
        name.trim() ||
        `基金 ${code}`,
      code,
      amount: Number(amount),
      frequency,
      startDate,
      enabled: true,
    };

    setPlans((v) => [
      plan,
      ...v,
    ]);

    setCode("");
    setName("");
  }

  function addBuy() {
    if (!/^\d{6}$/.test(buyCode)) {
      alert("请输入 6 位基金代码");
      return;
    }

    const nav = Number(buyNav);

    if (nav <= 0) {
      alert("请输入买入净值");
      return;
    }

    const transaction =
      addTransactionFromAmount(
        buyCode,
        quotes[buyCode]?.name ||
          `基金 ${buyCode}`,
        today(),
        Number(buyAmount),
        nav
      );

    setTransactions((v) => [
      transaction,
      ...v,
    ]);

    setBuyCode("");
    setBuyNav("");
  }

  function seedDemo() {
    const plan = demoPlans[0];

    const quote = quotes[plan.code];

    const nav = quote?.nav || 1;

    const transaction =
      addTransactionFromAmount(
        plan.code,
        plan.name,
        today(),
        plan.amount,
        nav,
        plan.id
      );

    setPlans((v) =>
      v.length ? v : [plan]
    );

    setTransactions((v) => [
      transaction,
      ...v,
    ]);
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            FUND DCA ASSISTANT
          </div>

          <h1>基金定投助手</h1>

          <p>
            真实净值估值 + 定投记录 + 累计收益
          </p>
        </div>

        <button
          className="ghost"
          onClick={refreshQuotes}
          disabled={loading}
        >
          {loading
            ? "刷新中…"
            : "刷新基金数据"}
        </button>
      </header>

      <section className="stats">
        <Card
          title="总资产"
          value={money(stats.value)}
        />

        <Card
          title="累计投入"
          value={money(stats.invested)}
        />

        <Card
          title="累计收益"
          value={money(stats.profit)}
          tone={
            stats.profit >= 0
              ? "up"
              : "down"
          }
        />

        <Card
          title="总收益率"
          value={pct(stats.rate)}
          tone={
            stats.rate >= 0
              ? "up"
              : "down"
          }
        />

        <Card
          title="今日预计收益"
          value={money(
            stats.todayEstimate
          )}
          tone={
            stats.todayEstimate >= 0
              ? "up"
              : "down"
          }
          note="估值，非最终结算收益"
        />
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="panelTitle">
            新增定投计划
          </div>

          <div className="form">
            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value)
              }
              placeholder="基金代码，例如 000001"
              maxLength={6}
            />

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="计划名称（可选）"
            />

            <input
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              type="number"
              min="1"
              placeholder="每次金额"
            />

            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(
                  e.target.value as Frequency
                )
              }
            >
              <option value="daily">
                每日
              </option>

              <option value="weekly">
                每周
              </option>

              <option value="monthly">
                每月
              </option>
            </select>

            <input
              value={startDate}
              onChange={(e) =>
                setStartDate(
                  e.target.value
                )
              }
              type="date"
            />

            <button onClick={addPlan}>
              添加定投
            </button>
          </div>

          <div className="hint">
            周末不自动生成交易日；真正扣款时请以你的券商/基金平台成交记录为准。
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle">
            手动记录一次买入
          </div>

          <div className="form">
            <input
              value={buyCode}
              onChange={(e) =>
                setBuyCode(e.target.value)
              }
              placeholder="基金代码"
              maxLength={6}
            />

            <input
              value={buyAmount}
              onChange={(e) =>
                setBuyAmount(
                  e.target.value
                )
              }
              type="number"
              min="1"
              placeholder="投入金额"
            />

            <input
              value={buyNav}
              onChange={(e) =>
                setBuyNav(
                  e.target.value
                )
              }
              type="number"
              min="0"
              step="0.0001"
              placeholder="成交净值"
            />

            <button onClick={addBuy}>
              记录买入
            </button>
          </div>

          <div className="hint">
            每笔投入都会换算成真实份额，后续收益按“份额 × 最新净值”计算，收益可以自然滚存。
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <div className="panelTitle">
              定投计划
            </div>

            <div className="muted">
              支持每日 / 每周 / 每月
            </div>
          </div>

          {!plans.length && (
            <button
              className="secondary"
              onClick={seedDemo}
            >
              先生成示例
            </button>
          )}
        </div>

        {plans.length === 0 ? (
          <div className="empty">
            还没有定投计划。添加一个基金代码即可开始。
          </div>
        ) : (
          <div className="table">
            {plans.map((plan) => {
              const quote =
                quotes[plan.code];

              const transactionsForPlan =
                transactions.filter(
                  (transaction) =>
                    transaction.planId ===
                      plan.id ||
                    transaction.code ===
                      plan.code
                );

              const invested =
                transactionsForPlan.reduce(
                  (sum, transaction) =>
                    sum +
                    transaction.amount +
                    transaction.fee,
                  0
                );

              const shares =
                transactionsForPlan.reduce(
                  (sum, transaction) =>
                    sum +
                    transaction.shares,
                  0
                );

              const value =
                shares *
                (quote?.estimatedNav ??
                  quote?.nav ??
                  0);

              const profit =
                value - invested;

              return (
                <div
                  className="row"
                  key={plan.id}
                >
                  <div>
                    <strong>
                      {plan.name}
                    </strong>

                    <span>
                      {plan.code} ·{" "}
                      {freqLabel(
                        plan.frequency
                      )}{" "}
                      · ¥{plan.amount}/次
                    </span>
                  </div>

                  <div>
                    <span>
                      累计投入
                    </span>

                    <strong>
                      {money(invested)}
                    </strong>
                  </div>

                  <div>
                    <span>
                      当前市值
                    </span>

                    <strong>
                      {money(value)}
                    </strong>
                  </div>

                  <div>
                    <span>
                      收益
                    </span>

                    <strong
                      className={
                        profit >= 0
                          ? "up"
                          : "down"
                      }
                    >
                      {money(profit)}
                    </strong>
                  </div>

                  <button
                    className="danger"
                    onClick={() =>
                      setPlans((v) =>
                        v.filter(
                          (x) =>
                            x.id !==
                            plan.id
                        )
                      )
                    }
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <div className="panelTitle">
              基金实时数据
            </div>

            <div className="muted">
              估值数据来自天天基金公开接口；最终净值以官方披露为准。
            </div>
          </div>
        </div>

        {codes.length === 0 ? (
          <div className="empty">
            添加基金后这里会显示最新净值。
          </div>
        ) : (
          <div className="quoteGrid">
            {codes.map((code) => {
              const quote =
                quotes[code];

              return (
                <div
                  className="quote"
                  key={code}
                >
                  <strong>
                    {quote?.name ||
                      `基金 ${code}`}
                  </strong>

                  <span>
                    {code}
                  </span>

                  <b>
                    {quote?.estimatedNav
                      ? quote.estimatedNav.toFixed(
                          4
                        )
                      : quote?.nav
                        ? quote.nav.toFixed(
                            4
                          )
                        : "—"}
                  </b>

                  <em
                    className={
                      (quote?.estimatedChangePct ??
                        0) >= 0
                        ? "up"
                        : "down"
                    }
                  >
                    {quote?.estimatedChangePct ==
                    null
                      ? "—"
                      : `${
                          quote.estimatedChangePct >=
                          0
                            ? "+"
                            : ""
                        }${quote.estimatedChangePct.toFixed(
                          2
                        )}%`}
                  </em>

                  <small>
                    净值日期：
                    {quote?.navDate ||
                      "—"}{" "}
                    · 估值：
                    {quote?.estimatedAt ||
                      "—"}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelTitle">
          收益走势
        </div>

        <div className="chart">
          {snapshots.length < 2 ? (
            <div className="empty">
              至少记录两次交易后，这里会显示资产变化。
            </div>
          ) : (
            <div className="bars">
              {snapshots
                .slice(-24)
                .map((snapshot, index) => {
                  const max =
                    Math.max(
                      ...snapshots.map(
                        (item) =>
                          item.value
                      ),
                      1
                    );

                  return (
                    <div
                      className="barWrap"
                      key={
                        snapshot.date
                      }
                      title={`${snapshot.date} ${money(
                        snapshot.value
                      )}`}
                    >
                      <div
                        className="bar"
                        style={{
                          height: `${Math.max(
                            4,
                            (snapshot.value /
                              max) *
                              100
                          )}%`,
                        }}
                      />

                      {index % 4 === 0 && (
                        <small>
                          {snapshot.date.slice(
                            5
                          )}
                        </small>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>
          基金定投助手 v0.2
        </span>

        <span>
          数据仅供记录与分析，不构成投资建议
        </span>
      </footer>
    </main>
  );
}

function Card({
  title,
  value,
  tone,
  note,
}: {
  title: string;
  value: string;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="card">
      <span>{title}</span>

      <strong className={tone}>
        {value}
      </strong>

      {note && (
        <small>{note}</small>
      )}
    </div>
  );
}

function freqLabel(
  value: Frequency
) {
  return value === "daily"
    ? "每日"
    : value === "weekly"
      ? "每周"
      : "每月";
}
