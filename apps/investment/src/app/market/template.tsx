"use client";

export default function MarketTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex flex-1 flex-col p-2">{children}</div>;
}
