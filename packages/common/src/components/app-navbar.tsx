"use client";

import { UserMenu } from "@repo/common/components/user-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import Link from "next/link";
import * as React from "react";

type NavItem = { name: string; href: string };

type AppNavbarProps = {
  nav?: NavItem[];
  currentPath?: string;
};

type Crumb = { name: string; href: string; isLast: boolean };

function formatSegment(segment: string): string {
  // UUID / numeric IDs → "Detail"
  if (/^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment))
    return "Detail";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function buildCrumbs(nav: NavItem[], currentPath: string): Crumb[] {
  const segments = currentPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    const root = nav.find((item) => item.href === "/");
    return root ? [{ name: root.name, href: "/", isLast: true }] : [];
  }

  const crumbs: Crumb[] = [];
  let accumulated = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    accumulated += `/${segment}`;
    const isLast = i === segments.length - 1;
    const match = nav.find((item) => item.href === accumulated);
    crumbs.push({
      name: match?.name ?? formatSegment(segment),
      href: accumulated,
      isLast,
    });
  }

  return crumbs;
}

export function AppNavbar({ nav, currentPath }: AppNavbarProps) {
  const crumbs = React.useMemo<Crumb[]>(() => {
    if (!nav || !currentPath) return [];
    return buildCrumbs(nav, currentPath);
  }, [nav, currentPath]);

  return (
    <header className="border rounded-md mb-2 mt-2 px-3 md:px-3">
      <div className="flex h-12 items-center justify-between gap-4">
        {/* Left side — breadcrumb */}
        <div className="flex min-w-0 items-center">
          {crumbs.length > 0 && (
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage className="font-semibold text-foreground">
                          {crumb.name}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link href={crumb.href} />}>
                          {crumb.name}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </div>
        {/* Right side */}
        <div className="flex items-center gap-4">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
