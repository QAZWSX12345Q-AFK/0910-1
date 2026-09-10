"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createTransaction,
  frequencyLabel,
  money,
  percent,
  portfolioStats,
  buildSnapshots,
} from "../../lib/calculator";

import {
  DcaPlan,
  FundQuote,
  Frequency,
  Transaction,
} from "../../lib/types";

const STORAGE =
  "fund-dca-assistant-final-v1";

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

export default function Dashboard() {
  const [plans, setPlans] =
    useState<DcaPlan[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [quotes, setQuotes] =
    useState<Record<string, FundQuote>>(
      {}
    );

  const [loading, setLoading] =
    useState(false);

  const [code, setCode] =
    useState("");

  const [name, setName] =
    useState("");

  const [amount, setAmount] =
    useState("500");

  const [frequency, setFrequency] =
    useState<Frequency>("weekly");

  const [startDate, setStartDate] =
    useState(today());

  const [buyCode, setBuyCode] =
    useState("");

  const [buyAmount, setBuyAmount] =
    useState("500");

  const [buyNav, setBuyNav] =
    useState("");

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          STORAGE
        );

      if (!saved) return;

      const data = JSON.parse(saved);

      setPlans(data.plans || []);
      setTransactions(
        data.transactions || []
      );
    } catch {
      console.warn(
        "无法读取本地数据"
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({
        plans,
        transactions,
      })
    );
  }, [
    plans,
    transactions,
  ]);

  const codes = useMemo(() => {
    return Array.from(
      new Set([
        ...plans.map(
          (item) => item.code
        ),
        ...transactions.map(
          (item) => item.code
        ),
      ])
    );
  }, [
    plans,
    transactions,
  ]);

  useEffect(() => {
    if (!codes.length) return;

    loadQuotes(codes);
  }, [codes.join(",")]);

  function loadQuotes(
    fundCodes: string[]
  ) {
    setLoading(true);

    let completed = 0;

    fundCodes.forEach((fundCode) => {
      const callback =
        `fundCallback_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`;

      const script =
        document.createElement(
          "script"
        );

      (
        window as unknown as Record<
          string,
          (data: Record<string, string>) => void
        >
      )[callback] = (data) => {
        const quote: FundQuote = {
          code:
            data.fundcode ||
            fundCode,

          name:
            data.name ||
            `基金 ${fundCode}`,

          nav:
            Number(data.dwjz) || 0,

          navDate:
            data.jzrq || "",

          estimatedNav:
            Number(data.gsz) ||
            null,

          estimatedChangePct:
            Number(data.gszzl) ||
            null,

          estimatedAt:
            data.gztime || null,
        };

        setQuotes((current) => ({
          ...current,
          [fundCode]: quote,
        }));

        delete (
          window as unknown as Record<
            string,
            unknown
          >
        )[callback];

        script.remove();

        completed += 1;

        if (
          completed ===
          fundCodes.length
        ) {
          setLoading(false);
        }
      };

      script.src =
        `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}&callback=${callback}`;

      script.onerror = () => {
        script.remove();

        completed += 1;

        if (
          completed ===
          fundCodes.length
        ) {
          setLoading(false);
        }
      };

      document.body.appendChild(
        script
      );
    });
  }

  const stats =
    portfolioStats(
      transactions,
      quotes
    );

  const snapshots =
    buildSnapshots(
      transactions,
      quotes
    );

  function addPlan() {
    if (!/^\d{6}$/.test(code)) {
      alert(
        "请输入 6 位基金代码"
      );
      return;
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      alert(
        "请输入有效定投金额"
      );
      return;
    }

    const plan: DcaPlan = {
      id: crypto.randomUUID(),
      name:
        name.trim() ||
        `基金 ${code}`,
      code,
      amount: numericAmount,
      frequency,
      startDate,
      enabled: true,
    };

    setPlans((current) => [
      plan,
      ...current,
    ]);

    setCode("");
    setName("");
  }

  function addBuy() {
    if (!/^\d{6}$/.test(buyCode)) {
      alert(
        "请输入 6 位基金代码"
      );
      return;
    }

    const numericAmount =
      Number(buyAmount);

    const numericNav =
      Number(buyNav);

    if (
      numericAmount <= 0 ||
      numericNav <= 0
    ) {
      alert(
        "请输入有效金额和净值"
      );
      return;
    }

    const quote =
      quotes[buyCode];

    const transaction =
      createTransaction(
        buyCode,
        quote?.name ||
          `基金 ${buyCode}`,
        today(),
        numericAmount,
        numericNav
      );

    setTransactions(
      (current) => [
        transaction,
        ...current,
      ]
    );

    setBuyCode("");
    setBuyNav("");
  }

  function addEstimatedTransaction(
    plan: DcaPlan
  ) {
    const quote =
      quotes[plan.code];

    if (!quote) {
      alert(
        "还没有获取到基金数据，请先刷新基金数据。"
      );
      return;
    }

    const nav =
      quote.estimatedNav ??
      quote.nav;

    if (!nav) {
      alert(
        "当前没有有效净值。"
      );
      return;
    }

    const transaction =
      createTransaction(
        plan.code,
        plan.name,
        today(),
        plan.amount,
        nav,
        plan.id
      );

    setTransactions(
      (current) => [
        transaction,
        ...current,
      ]
    );
  }

  function deletePlan(
    id: string
  ) {
    if (
      !confirm(
        "只删除定投计划，不删除历史交易记录，确定吗？"
      )
    ) {
      return;
    }

    setPlans((current) =>
      current.filter(
        (item) =>
          item.id !== id
      )
    );
  }

  function clearAll() {
    if (
      !confirm(
        "确定删除全部本地数据吗？此操作不可恢复。"
      )
    ) {
      return;
    }

    setPlans([]);
    setTransactions([]);
    setQuotes({});

    localStorage.removeItem(
      STORAGE
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            FUND DCA ASSISTANT
          </div>

          <h1>
            基金定投助手
          </h1>

          <p>
            定投 · 持仓 · 收益 · 资产管理
          </p>
        </div>

        <button
          className="ghost"
          onClick={() =>
            loadQuotes(codes)
          }
          disabled={
            loading ||
            codes.length === 0
          }
        >
          {loading
            ? "刷新中..."
            : "刷新基金数据"}
        </button>
      </header>

      <section className="stats">
        <Stat
          title="总资产"
          value={money(
            stats.value
          )}
        />

        <Stat
          title="累计投入"
          value={money(
            stats.invested
          )}
        />

        <Stat
          title="累计收益"
          value={money(
            stats.profit
          )}
          positive={
            stats.profit >= 0
          }
        />

        <Stat
          title="总收益率"
          value={percent(
            stats.rate
          )}
          positive={
            stats.rate >= 0
          }
        />

        <Stat
          title="今日预计收益"
          value={money(
            stats.todayEstimate
          )}
          positive={
            stats.todayEstimate >=
            0
          }
          note="盘中估值，仅供参考"
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
                setCode(
                  e.target.value
                )
              }
              placeholder="基金代码，例如 000001"
              maxLength={6}
            />

            <input
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              placeholder="计划名称"
            />

            <input
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
              type="number"
              min="1"
              placeholder="每次投入"
            />

            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(
                  e.target
                    .value as Frequency
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

            <button
              onClick={addPlan}
            >
              添加定投计划
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panelTitle">
            记录实际买入
          </div>

          <div className="form">
            <input
              value={buyCode}
              onChange={(e) =>
                setBuyCode(
                  e.target.value
                )
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

            <button
              onClick={addBuy}
            >
              记录买入
            </button>
          </div>

          <div className="hint">
            每笔交易都会记录实际份额，因此收益会按照真实份额持续滚存。
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <div className="panelTitle">
              我的定投计划
            </div>

            <div className="muted">
              点击「执行本次」可以模拟一次实际定投。
            </div>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="empty">
            暂时没有定投计划。
          </div>
        ) : (
          <div className="table">
            {plans.map(
              (plan) => {
                const quote =
                  quotes[
                    plan.code
                  ];

                const list =
                  transactions.filter(
                    (item) =>
                      item.planId ===
                      plan.id
                  );

                const invested =
                  list.reduce(
                    (sum, item) =>
                      sum +
                      item.amount +
                      item.fee,
                    0
                  );

                const shares =
                  list.reduce(
                    (sum, item) =>
                      sum +
                      item.shares,
                    0
                  );

                const nav =
                  quote?.estimatedNav ??
                  quote?.nav ??
                  0;

                const value =
                  shares * nav;

                const profit =
                  value -
                  invested;

                return (
                  <div
                    className="row"
                    key={
                      plan.id
                    }
                  >
                    <div>
                      <strong>
                        {plan.name}
                      </strong>

                      <span>
                        {plan.code} ·{" "}
                        {frequencyLabel(
                          plan.frequency
                        )} · ¥
                        {plan.amount}
                      </span>
                    </div>

                    <div>
                      <span>
                        累计投入
                      </span>

                      <strong>
                        {money(
                          invested
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        当前市值
                      </span>

                      <strong>
                        {money(
                          value
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        收益
                      </span>

                      <strong
                        className={
                          profit >=
                          0
                            ? "up"
                            : "down"
                        }
                      >
                        {money(
                          profit
                        )}
                      </strong>
                    </div>

                    <div className="actions">
                      <button
                        onClick={() =>
                          addEstimatedTransaction(
                            plan
                          )
                        }
                      >
                        执行本次
                      </button>

                      <button
                        className="danger"
                        onClick={() =>
                          deletePlan(
                            plan.id
                          )
                        }
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <div className="panelTitle">
              我的基金
            </div>

            <div className="muted">
              实时估值来自公开基金估值接口。
            </div>
          </div>
        </div>

        {codes.length === 0 ? (
          <div className="empty">
            添加基金后显示数据。
          </div>
        ) : (
          <div className="quoteGrid">
            {codes.map(
              (fundCode) => {
                const quote =
                  quotes[
                    fundCode
                  ];

                return (
                  <div
                    className="quote"
                    key={
                      fundCode
                    }
                  >
                    <strong>
                      {quote?.name ||
                        `基金 ${fundCode}`}
                    </strong>

                    <span>
                      {fundCode}
                    </span>

                    <b>
                      {quote
                        ? (
                            quote.estimatedNav ??
                            quote.nav
                          ).toFixed(
                            4
                          )
                        : "加载中"}
                    </b>

                    <em
                      className={
                        (
                          quote?.estimatedChangePct ??
                          0
                        ) >= 0
                          ? "up"
                          : "down"
                      }
                    >
                      {quote?.estimatedChangePct ===
                      null
                        ? "暂无估值"
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
                        "--"}
                    </small>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <div className="panelTitle">
              资产走势
            </div>

            <div className="muted">
              根据交易记录计算
            </div>
          </div>
        </div>

        {snapshots.length <
        2 ? (
          <div className="empty">
            记录至少两次交易后显示资产走势。
          </div>
        ) : (
          <div className="bars">
            {snapshots
              .slice(-30)
              .map(
                (
                  snapshot,
                  index
                ) => {
                  const max =
                    Math.max(
                      ...snapshots.map(
                        (
                          item
                        ) =>
                          item.value
                      ),
                      1
                    );

                  const height =
                    Math.max(
                      4,
                      (snapshot.value /
                        max) *
                        100
                    );

                  return (
                    <div
                      className="barWrap"
                      key={`${snapshot.date}-${index}`}
                      title={`${snapshot.date} ${money(
                        snapshot.value
                      )}`}
                    >
                      <div
                        className="bar"
                        style={{
                          height: `${height}%`,
                        }}
                      />

                      <small>
                        {snapshot.date.slice(
                          5
                        )}
                      </small>
                    </div>
                  );
                }
              )}
          </div>
        )}
      </section>

      <section className="panel dangerPanel">
        <div className="panelHead">
          <div>
            <div className="panelTitle">
              数据管理
            </div>

            <div className="muted">
              当前数据保存在本浏览器中。
            </div>
          </div>

          <button
            className="danger"
            onClick={
              clearAll
            }
          >
            清空全部数据
          </button>
        </div>
      </section>

      <footer>
        <span>
          基金定投助手 v1.0
        </span>

        <span>
          数据仅供记录与分析，不构成投资建议
        </span>
      </footer>
    </main>
  );
}

function Stat({
  title,
  value,
  positive,
  note,
}: {
  title: string;
  value: string;
  positive?: boolean;
  note?: string;
}) {
  return (
    <div className="card">
      <span>
        {title}
      </span>

      <strong
        className={
          positive === undefined
            ? ""
            : positive
              ? "up"
              : "down"
        }
      >
        {value}
      </strong>

      {note && (
        <small>
          {note}
        </small>
      )}
    </div>
  );
}
