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

type JsonpData = Record<string, string | undefined>;

type WindowWithCallbacks = Window & {
  [key: string]: unknown;
};

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

/**
 * 生成一个兼容性更好的唯一 ID。
 * 优先使用 crypto.randomUUID，
 * 如果浏览器不支持，则使用时间戳 + 随机数。
 */
function createId() {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/**
 * 安全转换数字。
 *
 * 注意：
 * 不能使用 Number(value) || null，
 * 因为 0 会被错误地变成 null。
 */
function toNumberOrNull(
  value: string | undefined
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
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

  /**
   * 页面第一次加载时读取本地数据。
   */
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          STORAGE
        );

      if (!saved) {
        return;
      }

      const data = JSON.parse(saved);

      setPlans(
        Array.isArray(data.plans)
          ? data.plans
          : []
      );

      setTransactions(
        Array.isArray(data.transactions)
          ? data.transactions
          : []
      );
    } catch {
      console.warn(
        "无法读取本地数据"
      );
    }
  }, []);

  /**
   * 数据变化后自动保存到浏览器。
   */
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          plans,
          transactions,
        })
      );
    } catch {
      console.warn(
        "无法保存本地数据"
      );
    }
  }, [
    plans,
    transactions,
  ]);

  /**
   * 当前所有涉及的基金代码。
   */
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
    ).filter(Boolean);
  }, [
    plans,
    transactions,
  ]);

  /**
   * 基金代码变化时自动加载行情。
   */
  useEffect(() => {
    if (!codes.length) {
      return;
    }

    loadQuotes(codes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(",")]);

  /**
   * 使用公开基金估值接口获取行情。
   *
   * 这里使用 JSONP，是因为 GitHub Pages 是纯静态网站，
   * 浏览器无法直接运行 Next.js server API。
   */
  function loadQuotes(
    fundCodes: string[]
  ) {
    if (!fundCodes.length) {
      return;
    }

    setLoading(true);

    let completed = 0;
    let finished = false;

    const scripts: HTMLScriptElement[] =
      [];

    const finishOne = () => {
      completed += 1;

      if (
        completed >= fundCodes.length &&
        !finished
      ) {
        finished = true;
        setLoading(false);
      }
    };

    fundCodes.forEach(
      (fundCode) => {
        const callback =
          `fundCallback_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}`;

        const script =
          document.createElement(
            "script"
          );

        scripts.push(script);

        let timeoutId:
          | ReturnType<typeof setTimeout>
          | undefined;

        let handled = false;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          script.remove();

          try {
            delete (
              window as WindowWithCallbacks
            )[callback];
          } catch {
            // ignore
          }
        };

        const handleFinish = () => {
          if (handled) {
            return;
          }

          handled = true;
          cleanup();
          finishOne();
        };

        (
          window as WindowWithCallbacks
        )[callback] = (
          data: JsonpData
        ) => {
          if (handled) {
            return;
          }

          const nav =
            toNumberOrNull(
              data?.dwjz
            );

          const estimatedNav =
            toNumberOrNull(
              data?.gsz
            );

          const estimatedChangePct =
            toNumberOrNull(
              data?.gszzl
            );

          const quote: FundQuote = {
            code:
              data?.fundcode ||
              fundCode,

            name:
              data?.name ||
              `基金 ${fundCode}`,

            nav:
              nav ?? 0,

            navDate:
              data?.jzrq ||
              "",

            estimatedNav,

            estimatedChangePct,

            estimatedAt:
              data?.gztime ||
              null,
          };

          setQuotes(
            (current) => ({
              ...current,
              [fundCode]: quote,
            })
          );

          handleFinish();
        };

        script.src =
          `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}&callback=${callback}`;

        script.async = true;

        script.onerror = () => {
          handleFinish();
        };

        /**
         * 8 秒超时。
         * 防止某个基金接口没有响应导致整个页面
         * 永远停留在“刷新中”。
         */
        timeoutId = setTimeout(() => {
          handleFinish();
        }, 8000);

        document.body.appendChild(
          script
        );
      }
    );
  }

  /**
   * 计算组合数据。
   */
  const stats =
    portfolioStats(
      transactions,
      quotes
    );

  /**
   * 计算资产走势。
   */
  const snapshots =
    buildSnapshots(
      transactions,
      quotes
    );

  /**
   * 添加定投计划。
   */
  function addPlan() {
    const normalizedCode =
      code.trim();

    if (
      !/^\d{6}$/.test(
        normalizedCode
      )
    ) {
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

    if (!startDate) {
      alert(
        "请选择开始日期"
      );
      return;
    }

    const plan: DcaPlan = {
      id: createId(),

      name:
        name.trim() ||
        `基金 ${normalizedCode}`,

      code:
        normalizedCode,

      amount:
        numericAmount,

      frequency,

      startDate,

      enabled: true,
    };

    setPlans(
      (current) => [
        plan,
        ...current,
      ]
    );

    setCode("");
    setName("");
  }

  /**
   * 手动记录一次实际买入。
   */
  function addBuy() {
    const normalizedCode =
      buyCode.trim();

    if (
      !/^\d{6}$/.test(
        normalizedCode
      )
    ) {
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
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0 ||
      !Number.isFinite(
        numericNav
      ) ||
      numericNav <= 0
    ) {
      alert(
        "请输入有效金额和净值"
      );
      return;
    }

    const quote =
      quotes[
        normalizedCode
      ];

    const transaction =
      createTransaction(
        normalizedCode,

        quote?.name ||
          `基金 ${normalizedCode}`,

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

  /**
   * 按当前估值执行一次定投。
   */
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

    if (
      !Number.isFinite(nav) ||
      nav <= 0
    ) {
      alert(
        "当前没有有效净值。"
      );
      return;
    }

    const transaction =
      createTransaction(
        plan.code,

        quote.name ||
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

  /**
   * 删除定投计划。
   *
   * 注意：只删除计划，不删除历史交易。
   */
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

    setPlans(
      (current) =>
        current.filter(
          (item) =>
            item.id !== id
        )
    );
  }

  /**
   * 清空所有本地数据。
   */
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

    try {
      localStorage.removeItem(
        STORAGE
      );
    } catch {
      // ignore
    }
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

      {/* ==================== 资产统计 ==================== */}

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
            stats.todayEstimate >= 0
          }
          note="盘中估值，仅供参考"
        />
      </section>

      {/* ==================== 新增区域 ==================== */}

      <section className="grid two">
        {/* 新增定投计划 */}

        <div className="panel">
          <div className="panelTitle">
            新增定投计划
          </div>

          <div className="form">
            <input
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
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

        {/* 记录实际买入 */}

        <div className="panel">
          <div className="panelTitle">
            记录实际买入
          </div>

          <div className="form">
            <input
              value={buyCode}
              onChange={(e) =>
                setBuyCode(
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
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

      {/* ==================== 定投计划 ==================== */}

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
                    (
                      sum,
                      item
                    ) =>
                      sum +
                      item.amount +
                      item.fee,
                    0
                  );

                const shares =
                  list.reduce(
                    (
                      sum,
                      item
                    ) =>
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
                    key={plan.id}
                  >
                    <div>
                      <strong>
                        {plan.name}
                      </strong>

                      <span>
                        {plan.code} ·{" "}
                        {frequencyLabel(
                          plan.frequency
                        )}{" "}
                        · ¥
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
                          profit >= 0
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

      {/* ==================== 基金行情 ==================== */}

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

                /**
                 * quote 可能还没有加载完成。
                 *
                 * 所有字段都使用 ?. 或 ??，
                 * 防止 undefined 导致页面崩溃。
                 */

                const displayNav =
                  quote?.estimatedNav ??
                  quote?.nav ??
                  null;

                const changePct =
                  quote?.estimatedChangePct;

                return (
                  <div
                    className="quote"
                    key={fundCode}
                  >
                    <strong>
                      {quote?.name ||
                        `基金 ${fundCode}`}
                    </strong>

                    <span>
                      {fundCode}
                    </span>

                    <b>
                      {displayNav !==
                        null &&
                      Number.isFinite(
                        displayNav
                      )
                        ? displayNav.toFixed(
                            4
                          )
                        : "加载中"}
                    </b>

                    <em
                      className={
                        (
                          changePct ??
                          0
                        ) >= 0
                          ? "up"
                          : "down"
                      }
                    >
                      {changePct ==
                      null
                        ? "暂无估值"
                        : `${
                            changePct >=
                            0
                              ? "+"
                              : ""
                          }${changePct.toFixed(
                            2
                          )}%`}
                    </em>

                    <small>
                      净值日期：
                      {quote?.navDate ||
                        "--"}
                    </small>

                    {quote?.estimatedAt && (
                      <small>
                        估值时间：
                        {
                          quote.estimatedAt
                        }
                      </small>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* ==================== 资产走势 ==================== */}

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
                        (item) =>
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

      {/* ==================== 数据管理 ==================== */}

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

/* ==================== 统计卡片 ==================== */

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
