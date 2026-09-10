"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSnapshots,
  createTransaction,
  frequencyLabel,
  money,
  percent,
  portfolioStats,
} from "../../lib/calculator";
import {
  DcaPlan,
  FundQuote,
  Transaction,
} from "../../lib/types";

type JsonpData = Record<string, string | undefined>;

const STORAGE_KEY = "fund-dca-assistant-final-v2";

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

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function todayString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, FundQuote>>({});

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  // 新增定投计划
  const [planName, setPlanName] = useState("我的定投");
  const [planCode, setPlanCode] = useState("000001");
  const [planAmount, setPlanAmount] = useState("100");
  const [planFrequency, setPlanFrequency] =
    useState<DcaPlan["frequency"]>("weekly");

  // 手动买入
  const [buyCode, setBuyCode] = useState("000001");
  const [buyName, setBuyName] = useState("");
  const [buyAmount, setBuyAmount] = useState("100");
  const [buyNav, setBuyNav] = useState("");

  // -----------------------------
  // 从 localStorage 读取
  // -----------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const data = JSON.parse(raw);

        if (Array.isArray(data.plans)) {
          setPlans(data.plans);
        }

        if (Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        }
      }
    } catch (error) {
      console.error("读取本地数据失败:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  // -----------------------------
  // 保存到 localStorage
  // -----------------------------
  useEffect(() => {
    if (!loaded) {
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          plans,
          transactions,
        })
      );
    } catch (error) {
      console.error("保存本地数据失败:", error);
    }
  }, [plans, transactions, loaded]);

  // -----------------------------
  // 当前所有基金代码
  // -----------------------------
  const codes = useMemo(() => {
    const set = new Set<string>();

    plans.forEach((plan) => {
      if (plan.code) {
        set.add(plan.code);
      }
    });

    transactions.forEach((transaction) => {
      if (transaction.code) {
        set.add(transaction.code);
      }
    });

    return Array.from(set);
  }, [plans, transactions]);

  // -----------------------------
  // 天天基金 JSONP 获取基金数据
  //
  // 接口实际返回：
  // jsonpgz({...});
  //
  // 因此不能使用 callback=xxx
  // -----------------------------
  function loadQuotes(fundCodes: string[]) {
    if (!fundCodes.length) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let index = 0;

    const loadNext = () => {
      if (index >= fundCodes.length) {
        setLoading(false);
        return;
      }

      const fundCode = fundCodes[index];

      const script = document.createElement("script");

      let finished = false;

      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        try {
          script.remove();
        } catch {
          // ignore
        }

        try {
          const win =
            window as unknown as Record<string, unknown>;

          delete win.jsonpgz;
        } catch {
          // ignore
        }

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      const finish = () => {
        if (finished) {
          return;
        }

        finished = true;

        cleanup();

        index += 1;

        loadNext();
      };

      try {
        const win =
          window as unknown as Record<
            string,
            unknown
          >;

        /*
         * 天天基金接口固定调用：
         *
         * jsonpgz({...});
         *
         * 所以必须把 jsonpgz 挂到 window 上。
         */
        win.jsonpgz = (data: JsonpData) => {
          if (finished) {
            return;
          }

          const nav = toNumberOrNull(data?.dwjz);

          const estimatedNav =
            toNumberOrNull(data?.gsz);

          const estimatedChangePct =
            toNumberOrNull(data?.gszzl);

          const quote: FundQuote = {
            code: data?.fundcode || fundCode,

            name:
              data?.name ||
              `基金 ${fundCode}`,

            nav: nav ?? 0,

            navDate:
              data?.jzrq || "",

            estimatedNav,

            estimatedChangePct,

            estimatedAt:
              data?.gztime || null,
          };

          setQuotes((current) => ({
            ...current,
            [fundCode]: quote,
          }));

          finish();
        };
      } catch (error) {
        console.error(
          `基金 ${fundCode} JSONP 初始化失败:`,
          error
        );

        finish();

        return;
      }

      /*
       * 注意：
       * 这里不能再加 callback=xxx
       *
       * 接口：
       * https://fundgz.1234567.com.cn/js/000001.js
       */
      script.src =
        `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`;

      script.async = true;

      script.onerror = () => {
        console.warn(
          `基金 ${fundCode} 数据获取失败`
        );

        finish();
      };

      timeoutId = setTimeout(() => {
        console.warn(
          `基金 ${fundCode} 数据获取超时`
        );

        finish();
      }, 8000);

      document.body.appendChild(script);
    };

    loadNext();
  }

  // -----------------------------
  // 自动加载基金数据
  // -----------------------------
  useEffect(() => {
    if (!loaded) {
      return;
    }

    if (!codes.length) {
      return;
    }

    loadQuotes(codes);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, codes.join(",")]);

  // -----------------------------
  // 组合统计
  // -----------------------------
  const stats = useMemo(() => {
    return portfolioStats(
      transactions,
      quotes
    );
  }, [transactions, quotes]);

  // -----------------------------
  // 历史快照
  // -----------------------------
  const snapshots = useMemo(() => {
    return buildSnapshots(
      transactions,
      quotes
    );
  }, [transactions, quotes]);

  // -----------------------------
  // 添加定投计划
  // -----------------------------
  function addPlan() {
    const code = planCode.trim();

    const amount = Number(planAmount);

    if (!/^\d{6}$/.test(code)) {
      alert("基金代码必须是 6 位数字");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("请输入正确的定投金额");
      return;
    }

    const newPlan: DcaPlan = {
      id: createId(),
      name:
        planName.trim() ||
        `基金 ${code}`,

      code,

      amount,

      frequency: planFrequency,

      startDate: todayString(),

      enabled: true,
    };

    setPlans((current) => [
      ...current,
      newPlan,
    ]);

    setPlanCode(code);

    // 自动刷新
    loadQuotes([code]);
  }

  // -----------------------------
  // 手动买入
  // -----------------------------
  function addBuy() {
    const code = buyCode.trim();

    const amount = Number(buyAmount);

    const nav = Number(buyNav);

    if (!/^\d{6}$/.test(code)) {
      alert("基金代码必须是 6 位数字");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("请输入正确的买入金额");
      return;
    }

    if (!Number.isFinite(nav) || nav <= 0) {
      alert("请输入正确的基金净值");
      return;
    }

    const quote = quotes[code];

    const name =
      buyName.trim() ||
      quote?.name ||
      `基金 ${code}`;

    const transaction = createTransaction(
      code,
      name,
      todayString(),
      amount,
      nav
    );

    setTransactions((current) => [
      ...current,
      transaction,
    ]);

    setBuyName("");

    setBuyNav("");

    loadQuotes([code]);
  }

  // -----------------------------
  // 执行一次定投
  // -----------------------------
  function executePlan(plan: DcaPlan) {
    const quote = quotes[plan.code];

    if (!quote) {
      alert(
        "暂时没有获取到基金数据，请稍后再试。"
      );

      loadQuotes([plan.code]);

      return;
    }

    const nav =
      quote.estimatedNav ??
      quote.nav;

    if (!nav || nav <= 0) {
      alert("当前基金净值无效");
      return;
    }

    const transaction = createTransaction(
      plan.code,
      quote.name,
      todayString(),
      plan.amount,
      nav,
      plan.id
    );

    setTransactions((current) => [
      ...current,
      transaction,
    ]);
  }

  // -----------------------------
  // 删除计划
  // -----------------------------
  function deletePlan(id: string) {
    if (
      !window.confirm(
        "确定删除这个定投计划吗？"
      )
    ) {
      return;
    }

    setPlans((current) =>
      current.filter(
        (item) => item.id !== id
      )
    );
  }

  // -----------------------------
  // 删除全部数据
  // -----------------------------
  function clearAll() {
    if (
      !window.confirm(
        "确定删除所有定投计划、交易记录和本地数据吗？"
      )
    ) {
      return;
    }

    setPlans([]);

    setTransactions([]);

    setQuotes({});

    try {
      localStorage.removeItem(
        STORAGE_KEY
      );
    } catch {
      // ignore
    }
  }

  // -----------------------------
  // 刷新基金数据
  // -----------------------------
  function refreshQuotes() {
    if (!codes.length) {
      alert(
        "目前还没有基金，请先添加一个定投计划或买入记录。"
      );

      return;
    }

    loadQuotes(codes);
  }

  // -----------------------------
  // 添加计划时自动填充基金名称
  // -----------------------------
  function fillBuyFromQuote() {
    const quote = quotes[buyCode.trim()];

    if (!quote) {
      loadQuotes([buyCode.trim()]);
      return;
    }

    setBuyName(quote.name);

    if (
      quote.estimatedNav &&
      quote.estimatedNav > 0
    ) {
      setBuyNav(
        quote.estimatedNav.toFixed(4)
      );
    } else if (quote.nav > 0) {
      setBuyNav(
        quote.nav.toFixed(4)
      );
    }
  }

  // -----------------------------
  // 页面
  // -----------------------------
  return (
    <main className="page">
      <div className="container">
        {/* 顶部 */}
        <header className="header">
          <div>
            <div className="eyebrow">
              FUND DCA ASSISTANT
            </div>

            <h1>
              基金定投助手
            </h1>

            <p className="subtitle">
              定投 · 持仓 · 收益 · 实时估值
            </p>
          </div>

          <button
            className="secondaryButton"
            onClick={refreshQuotes}
            disabled={loading}
          >
            {loading
              ? "正在刷新..."
              : "刷新基金数据"}
          </button>
        </header>

        {/* 总览 */}
        <section className="statsGrid">
          <div className="statCard">
            <div className="statLabel">
              总资产
            </div>

            <div className="statValue">
              {money(stats.value)}
            </div>

            <div className="statHint">
              当前估值
            </div>
          </div>

          <div className="statCard">
            <div className="statLabel">
              累计投入
            </div>

            <div className="statValue">
              {money(stats.invested)}
            </div>

            <div className="statHint">
              定投 + 手动买入
            </div>
          </div>

          <div className="statCard">
            <div className="statLabel">
              累计收益
            </div>

            <div
              className={
                stats.profit >= 0
                  ? "statValue profit"
                  : "statValue loss"
              }
            >
              {money(stats.profit)}
            </div>

            <div className="statHint">
              收益率{" "}
              {percent(stats.rate)}
            </div>
          </div>

          <div className="statCard">
            <div className="statLabel">
              今日预计收益
            </div>

            <div
              className={
                stats.todayEstimate >= 0
                  ? "statValue profit"
                  : "statValue loss"
              }
            >
              {money(
                stats.todayEstimate
              )}
            </div>

            <div className="statHint">
              基于基金估值
            </div>
          </div>
        </section>

        {/* 提示 */}
        <div className="notice">
          <strong>数据说明：</strong>
          基金估值仅用于盘中参考，最终收益以基金实际公布的净值为准。
        </div>

        {/* 添加定投 */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>
                新建定投计划
              </h2>

              <p>
                设置每日、每周或每月定投
              </p>
            </div>
          </div>

          <div className="formGrid">
            <label className="field">
              <span>
                计划名称
              </span>

              <input
                value={planName}
                onChange={(event) =>
                  setPlanName(
                    event.target.value
                  )
                }
                placeholder="例如：沪深300定投"
              />
            </label>

            <label className="field">
              <span>
                基金代码
              </span>

              <input
                value={planCode}
                onChange={(event) =>
                  setPlanCode(
                    event.target.value
                  )
                }
                placeholder="例如：000001"
                inputMode="numeric"
                maxLength={6}
              />
            </label>

            <label className="field">
              <span>
                定投金额
              </span>

              <input
                value={planAmount}
                onChange={(event) =>
                  setPlanAmount(
                    event.target.value
                  )
                }
                placeholder="100"
                inputMode="decimal"
              />
            </label>

            <label className="field">
              <span>
                定投频率
              </span>

              <select
                value={planFrequency}
                onChange={(event) =>
                  setPlanFrequency(
                    event.target.value as DcaPlan["frequency"]
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
            </label>
          </div>

          <button
            className="primaryButton"
            onClick={addPlan}
          >
            添加定投计划
          </button>
        </section>

        {/* 手动买入 */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>
                记录一次买入
              </h2>

              <p>
                用于录入历史定投或手动加仓
              </p>
            </div>
          </div>

          <div className="formGrid">
            <label className="field">
              <span>
                基金代码
              </span>

              <input
                value={buyCode}
                onChange={(event) =>
                  setBuyCode(
                    event.target.value
                  )
                }
                placeholder="000001"
                inputMode="numeric"
                maxLength={6}
              />
            </label>

            <label className="field">
              <span>
                基金名称
              </span>

              <input
                value={buyName}
                onChange={(event) =>
                  setBuyName(
                    event.target.value
                  )
                }
                placeholder="可自动获取"
              />
            </label>

            <label className="field">
              <span>
                买入金额
              </span>

              <input
                value={buyAmount}
                onChange={(event) =>
                  setBuyAmount(
                    event.target.value
                  )
                }
                placeholder="100"
                inputMode="decimal"
              />
            </label>

            <label className="field">
              <span>
                买入净值
              </span>

              <input
                value={buyNav}
                onChange={(event) =>
                  setBuyNav(
                    event.target.value
                  )
                }
                placeholder="例如 1.2345"
                inputMode="decimal"
              />
            </label>
          </div>

          <div className="buttonRow">
            <button
              className="secondaryButton"
              onClick={fillBuyFromQuote}
            >
              获取当前净值
            </button>

            <button
              className="primaryButton"
              onClick={addBuy}
            >
              记录买入
            </button>
          </div>
        </section>

        {/* 定投计划 */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>
                我的定投计划
              </h2>

              <p>
                共 {plans.length} 个计划
              </p>
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="empty">
              暂时没有定投计划
            </div>
          ) : (
            <div className="list">
              {plans.map((plan) => {
                const quote =
                  quotes[plan.code];

                return (
                  <div
                    className="listItem"
                    key={plan.id}
                  >
                    <div className="listMain">
                      <div className="listTitle">
                        {plan.name}
                      </div>

                      <div className="listMeta">
                        {plan.code}
                        {" · "}
                        {frequencyLabel(
                          plan.frequency
                        )}
                        {" · "}
                        {money(plan.amount)}
                      </div>

                      {quote && (
                        <div className="listMeta">
                          {quote.name}
                          {" · "}
                          净值{" "}
                          {quote.nav > 0
                            ? quote.nav.toFixed(
                                4
                              )
                            : "--"}
                        </div>
                      )}
                    </div>

                    <div className="listActions">
                      <button
                        className="primaryButton small"
                        onClick={() =>
                          executePlan(plan)
                        }
                      >
                        执行本次
                      </button>

                      <button
                        className="dangerButton"
                        onClick={() =>
                          deletePlan(plan.id)
                        }
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 基金实时数据 */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>
                基金实时数据
              </h2>

              <p>
                来自天天基金公开估值接口
              </p>
            </div>

            {loading && (
              <span className="loading">
                正在获取...
              </span>
            )}
          </div>

          {codes.length === 0 ? (
            <div className="empty">
              添加基金后，这里会自动显示数据。
            </div>
          ) : (
            <div className="quoteGrid">
              {codes.map((code) => {
                const quote =
                  quotes[code];

                if (!quote) {
                  return (
                    <div
                      className="quoteCard"
                      key={code}
                    >
                      <div className="quoteCode">
                        {code}
                      </div>

                      <div className="quoteName">
                        正在获取数据...
                      </div>

                      <div className="quoteBig">
                        --
                      </div>
                    </div>
                  );
                }

                const change =
                  quote.estimatedChangePct;

                const positive =
                  change !== null &&
                  change >= 0;

                return (
                  <div
                    className="quoteCard"
                    key={code}
                  >
                    <div className="quoteTop">
                      <div>
                        <div className="quoteCode">
                          {quote.code}
                        </div>

                        <div className="quoteName">
                          {quote.name}
                        </div>
                      </div>

                      <span
                        className={
                          change === null
                            ? "badge"
                            : positive
                            ? "badge positive"
                            : "badge negative"
                        }
                      >
                        {change === null
                          ? "暂无估值"
                          : `${change >= 0 ? "+" : ""}${change.toFixed(
                              2
                            )}%`}
                      </span>
                    </div>

                    <div className="quoteBig">
                      {quote.estimatedNav !==
                      null
                        ? quote.estimatedNav.toFixed(
                            4
                          )
                        : quote.nav > 0
                        ? quote.nav.toFixed(
                            4
                          )
                        : "--"}
                    </div>

                    <div className="quoteDetails">
                      <span>
                        最新净值{" "}
                        {quote.nav > 0
                          ? quote.nav.toFixed(
                              4
                            )
                          : "--"}
                      </span>

                      <span>
                        净值日期{" "}
                        {quote.navDate ||
                          "--"}
                      </span>
                    </div>

                    {quote.estimatedAt && (
                      <div className="quoteTime">
                        估值时间{" "}
                        {quote.estimatedAt}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 持仓 */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>
                交易记录
              </h2>

              <p>
                共 {transactions.length} 笔
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="empty">
              暂时没有交易记录
            </div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      日期
                    </th>

                    <th>
                      基金
                    </th>

                    <th>
                      买入金额
                    </th>

                    <th>
                      净值
                    </th>

                    <th>
                      份额
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {transactions
                    .slice()
                    .reverse()
                    .map(
                      (
                        transaction
                      ) => (
                        <tr
                          key={
                            transaction.id
                          }
                        >
                          <td>
                            {
                              transaction.date
                            }
                          </td>

                          <td>
                            <strong>
                              {
                                transaction.code
                              }
                            </strong>

                            <div className="tableSub">
                              {
                                transaction.name
                              }
                            </div>
                          </td>

                          <td>
                            {money(
                              transaction.amount
                            )}
                          </td>

                          <td>
                            {transaction.nav.toFixed(
                              4
                            )}
                          </td>

                          <td>
                            {transaction.shares.toFixed(
                              4
                            )}
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 收益图 */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>
                资产变化
              </h2>

              <p>
                根据已录入交易记录计算
              </p>
            </div>
          </div>

          {snapshots.length < 1 ? (
            <div className="empty">
              有交易记录后，这里会显示资产变化。
            </div>
          ) : (
            <div className="chart">
              {snapshots.map(
                (snapshot) => {
                  const maxValue =
                    Math.max(
                      ...snapshots.map(
                        (item) =>
                          item.value
                      ),
                      1
                    );

                  const height =
                    Math.max(
                      8,
                      (snapshot.value /
                        maxValue) *
                        100
                    );

                  return (
                    <div
                      className="chartColumn"
                      key={
                        snapshot.date
                      }
                    >
                      <div className="chartValue">
                        {money(
                          snapshot.value
                        )}
                      </div>

                      <div className="chartTrack">
                        <div
                          className="chartBar"
                          style={{
                            height: `${height}%`,
                          }}
                        />
                      </div>

                      <div className="chartDate">
                        {
                          snapshot.date
                        }
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* 数据管理 */}
        <section className="panel dangerPanel">
          <div className="panelHeader">
            <div>
              <h2>
                数据管理
              </h2>

              <p>
                数据目前保存在浏览器本地
              </p>
            </div>
          </div>

          <button
            className="dangerButton"
            onClick={clearAll}
          >
            清空所有本地数据
          </button>
        </section>

        <footer className="footer">
          <div>
            基金定投助手
          </div>

          <div>
            基金估值仅供参考，实际净值以基金公司最终公布数据为准。
          </div>
        </footer>
      </div>
    </main>
  );
}
