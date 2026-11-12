import { AccountSecurityPanel } from "@repo/shell/account-security";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { useState } from "react";

import { ProfileSection } from "./account-profile";
import { SessionsSection } from "./account-sessions";

type Section = "profile" | "security" | "sessions";

const SECTIONS = [
  ["profile", "Profile"],
  ["security", "Security"],
  ["sessions", "Sessions"],
] as const satisfies ReadonlyArray<readonly [Section, string]>;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts.at(-1)![0] ?? ""}`.toUpperCase();
}

export function AccountSettingsDialog({
  email,
  name,
  open,
  onOpenChange,
  twoFactorEnabled,
}: {
  email: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  twoFactorEnabled: boolean;
}) {
  const [section, setSection] = useState<Section>("profile");
  const [mfaEnabled, setMfaEnabled] = useState(twoFactorEnabled);

  const [previousMfaEnabled, setPreviousMfaEnabled] =
    useState(twoFactorEnabled);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousMfaEnabled !== twoFactorEnabled) {
    setPreviousMfaEnabled(twoFactorEnabled);
    setMfaEnabled(twoFactorEnabled);
  }
  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (open) setSection("profile");
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-md overflow-hidden overscroll-contain"
        data-account-settings=""
        showCloseButton
      >
        <Tabs
          className="flex flex-col"
          onValueChange={(value) => setSection(value as Section)}
          value={section}
        >
          <DialogHeader className="gap-4 px-5 pt-5 pb-0 pr-12 text-left">
            <div className="gap-3.5 flex items-center">
              <Avatar size="lg">
                <AvatarFallback>{initialsFromName(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 gap-0.5 flex flex-col">
                <DialogTitle className="text-base font-medium leading-snug tracking-[-0.02em] text-balance">
                  {name}
                </DialogTitle>
                <DialogDescription className="text-[0.8125rem] break-all">
                  {email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <TabsList
            aria-label="Account sections"
            className="h-auto w-full justify-stretch"
            variant="line"
          >
            {SECTIONS.map(([id, label]) => (
              <TabsTrigger
                className="h-10 flex-1 touch-manipulation"
                key={id}
                value={id}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="px-5 pt-4 pb-5 max-h-[min(28rem,70dvh)] overflow-y-auto overscroll-contain">
            {section === "profile" ? (
              <ProfileSection
                mfaEnabled={mfaEnabled}
                name={name}
                onManageSignIn={() => setSection("security")}
              />
            ) : null}
            {section === "security" ? (
              <div className="outline-none" role="tabpanel">
                <AccountSecurityPanel
                  onTwoFactorChange={setMfaEnabled}
                  twoFactorEnabled={mfaEnabled}
                />
              </div>
            ) : null}
            {section === "sessions" ? <SessionsSection /> : null}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
