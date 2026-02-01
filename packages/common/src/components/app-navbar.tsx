"use client";

import { UserMenu } from "@repo/common/components/user-menu";
import * as React from "react";

export function AppNavbar() {
  return (
    <header className="border rounded-md mb-2 mt-2 px-3 md:px-3">
      <div className="flex h-12 items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-2">
          {/* Main nav */}
          <div className="flex items-center gap-6"></div>
        </div>
        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">{/* Notification */}</div>
          {/* User menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
