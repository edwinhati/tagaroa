import { UserMenu } from "@repo/common/components/user-menu";

export function AdminNavbar() {
  return (
    <header className="border-b px-4 md:px-6">
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
