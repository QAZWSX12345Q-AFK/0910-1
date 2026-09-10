# 基金定投助手

一个面向中国基金定投用户的个人投资记录与收益分析工具。

## 当前功能

- 基金代码查询
- 基金最新净值
- 基金当日估值
- 每日定投
- 每周定投
- 每月定投
- 手动记录买入
- 自动计算基金份额
- 累计投入
- 当前市值
- 累计收益
- 收益率
- 今日预计收益
- 收益滚存
- 移动端响应式界面
- PWA 基础支持
- 浏览器 LocalStorage 数据保存

## 技术栈

- Next.js
- React
- TypeScript
- CSS
- PWA
- Eastmoney / Tiantian Fund public data

## 项目结构

```text
0910/
├── app/
│   ├── api/
│   │   └── fund/
│   │       └── [code]/
│   │           └── route.ts
│   ├── ui/
│   │   └── Dashboard.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── calculator.ts
│   └── types.ts
├── public/
│   └── manifest.webmanifest
├── .gitignore
├── README.md
├── next-env.d.ts
├── next.config.ts
├── package.json
└── tsconfig.json
