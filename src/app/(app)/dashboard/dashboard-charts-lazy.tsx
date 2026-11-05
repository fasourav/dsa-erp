"use client"

import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"

export const Sparkline = dynamic(
  () => import("./dashboard-charts").then((m) => m.Sparkline),
  {
    ssr: false,
    loading: () => <Skeleton className="h-11.5 w-full md:h-16" />,
  },
)

export const WeeklyChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.WeeklyChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full md:h-72" />,
  },
)

export const ExpenseDonut = dynamic(
  () => import("./dashboard-charts").then((m) => m.ExpenseDonut),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto size-50 rounded-full md:size-49" />,
  },
)

export const AnnualChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.AnnualChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full md:h-60" />,
  },
)

export const TrendChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.TrendChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-40 w-full md:h-60" />,
  },
)
