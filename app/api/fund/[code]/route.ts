import { NextResponse } from "next/server";

function jsonpToJson(
  text: string
) {
  const match = text.match(
    /jsonpgz\(([\s\S]+)\)/
  );

  if (!match) {
    throw new Error(
      "基金实时接口返回格式异常"
    );
  }

  return JSON.parse(match[1]);
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      code: string;
    }>;
  }
) {
  const { code } =
    await params;

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      {
        error:
          "基金代码应为 6 位数字",
      },
      { status: 400 }
    );
  }

  try {
    const url =
      `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;

    const response =
      await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent":
            "Mozilla/5.0",
        },
      });

    if (!response.ok) {
      throw new Error(
        `上游接口 HTTP ${response.status}`
      );
    }

    const raw =
      await response.text();

    const data =
      jsonpToJson(raw);

    return NextResponse.json({
      code:
        data.fundcode ??
        code,

      name:
        data.name ??
        `基金 ${code}`,

      nav:
        Number(data.dwjz) || 0,

      navDate:
        data.jzrq ?? "",

      estimatedNav:
        Number(data.gsz) ||
        null,

      estimatedChangePct:
        Number(data.gszzl) ||
        null,

      estimatedAt:
        data.gztime ?? null,

      source:
        "Eastmoney/Tiantian Fund",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "基金数据获取失败",
      },
      {
        status: 502,
      }
    );
  }
}
