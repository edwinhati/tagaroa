"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleUserRound,
  Clock3,
  KeyRound,
  ShieldBan,
  ShieldCheck,
  Trash2,
  User,
  Shield,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Skeleton } from "@repo/ui/components/skeleton";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import {
  UserWithRole,
  SessionWithImpersonatedBy,
} from "better-auth/plugins/admin";
import { authClient } from "@repo/common/lib/auth-client";

interface UserDetailSheetProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated?: (user: UserWithRole) => void;
  onUserDeleted?: (userId: string) => void;
}

type BanDurationOption = "permanent" | "1d" | "7d" | "30d";

type ListUserSessionsParams = Parameters<
  typeof authClient.admin.listUserSessions
>[0];
type ListUserSessionsInput = NonNullable<ListUserSessionsParams>;
type ListUserSessionsResponse = Awaited<
  ReturnType<typeof authClient.admin.listUserSessions>
>;
type ListUserSessionsData = NonNullable<ListUserSessionsResponse["data"]>;
type UpdateUserParams = Parameters<typeof authClient.admin.updateUser>[0];
type UpdateUserInput = NonNullable<UpdateUserParams>;
type UpdateUserResponse = Awaited<
  ReturnType<typeof authClient.admin.updateUser>
>;
type UpdateUserData = NonNullable<UpdateUserResponse["data"]>;
type BanUserParams = Parameters<typeof authClient.admin.banUser>[0];
type BanUserInput = NonNullable<BanUserParams>;
type BanUserResponse = Awaited<ReturnType<typeof authClient.admin.banUser>>;
type BanUserData = NonNullable<BanUserResponse["data"]>;
type UnbanUserParams = Parameters<typeof authClient.admin.unbanUser>[0];
type UnbanUserInput = NonNullable<UnbanUserParams>;
type UnbanUserResponse = Awaited<ReturnType<typeof authClient.admin.unbanUser>>;
type UnbanUserData = NonNullable<UnbanUserResponse["data"]>;
type SetUserPasswordParams = Parameters<
  typeof authClient.admin.setUserPassword
>[0];
type SetUserPasswordInput = NonNullable<SetUserPasswordParams>;
type RevokeSessionParams = Parameters<
  typeof authClient.admin.revokeUserSession
>[0];
type RevokeSessionInput = NonNullable<RevokeSessionParams>;
type RevokeSessionsParams = Parameters<
  typeof authClient.admin.revokeUserSessions
>[0];
type RevokeSessionsInput = NonNullable<RevokeSessionsParams>;
type RemoveUserParams = Parameters<typeof authClient.admin.removeUser>[0];
type RemoveUserInput = NonNullable<RemoveUserParams>;
type ImpersonateUserParams = Parameters<
  typeof authClient.admin.impersonateUser
>[0];
type ImpersonateUserInput = NonNullable<ImpersonateUserParams>;
type ImpersonateUserResponse = Awaited<
  ReturnType<typeof authClient.admin.impersonateUser>
>;
type ImpersonateUserData = NonNullable<ImpersonateUserResponse["data"]>;

type ResultWithData<T> = {
  data: T | null;
  error: { message?: string } | null;
};

const roleBadgeConfig: Record<
  string,
  { variant: "default" | "secondary" | "outline"; Icon?: LucideIcon }
> = {
  admin: { variant: "default", Icon: Shield },
  moderator: { variant: "outline", Icon: UserCheck },
  user: { variant: "secondary", Icon: User },
};

const confirmAction = (message: string) => {
  const confirmFn = (globalThis as { confirm?: (msg: string) => boolean })
    .confirm;
  if (typeof confirmFn === "function") {
    return confirmFn(message);
  }
  return true;
};

const navigateTo = (path: string) => {
  const locationObj = (globalThis as { location?: Location }).location;
  if (locationObj?.assign) {
    locationObj.assign(path);
  }
};

const defaultBanReason = "Policy violation.";
const defaultBanDuration: BanDurationOption = "permanent";

const ensureResponseData = <T,>(
  result: ResultWithData<T>,
  fallbackMessage: string,
): T => {
  if (!result || result.error || result.data == null) {
    const message = result?.error?.message ?? fallbackMessage;
    throw new Error(message);
  }
  return result.data;
};

const ensureListUserSessionsData = (
  result: ListUserSessionsResponse,
): ListUserSessionsData =>
  ensureResponseData(result, "Failed to load user sessions.");

const BAN_DURATION_SECONDS: Record<BanDurationOption, number | undefined> = {
  permanent: undefined,
  "1d": 60 * 60 * 24,
  "7d": 60 * 60 * 24 * 7,
  "30d": 60 * 60 * 24 * 30,
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value instanceof Date ? value : new Date(value));
  } catch {
    return value instanceof Date ? value.toISOString() : value;
  }
};

const pickPrimaryRole = (role: UserWithRole["role"]): string => {
  if (!role) return "user";
  if (Array.isArray(role)) {
    return role[0] ?? "user";
  }
  return role;
};

const getStatusBadge = (user?: UserWithRole | null) => {
  if (!user) return null;
  if (user.banned) {
    return <Badge variant="destructive">Banned</Badge>;
  }
  return <Badge variant="secondary">Active</Badge>;
};

export function UserDetailSheet(
  props: Readonly<UserDetailSheetProps>,
) {
  const { user, open, onOpenChange, onUserUpdated, onUserDeleted } = props;
  const {
    localUser,
    setLocalUser,
    nameInput,
    setNameInput,
    emailInput,
    setEmailInput,
    roleValue,
    setRoleValue,
    banReason,
    setBanReason,
    banDuration,
    setBanDuration,
    showBanForm,
    setShowBanForm,
    newPassword,
    setNewPassword,
  } = useLocalUserFormState(user);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isBanMutating, setIsBanMutating] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isRemovingUser, setIsRemovingUser] = useState(false);
  const [isImpersonatingUser, setIsImpersonatingUser] = useState(false);
  const {
    sessions,
    sessionsLoading,
    sessionsError,
    isRevokingAll,
    handleRevokeSession,
    handleRevokeAllSessions,
  } = useUserSessionsManager(localUser, open);

  const { data: currentSession } = authClient.useSession();
  const currentSessionUserId = currentSession?.user?.id ?? null;
  const localUserId = localUser?.id ?? null;
  const isViewingCurrentUser = useMemo(
    () =>
      Boolean(
        currentSessionUserId &&
          localUserId &&
          currentSessionUserId === localUserId,
      ),
    [currentSessionUserId, localUserId],
  );
  const isAlreadyImpersonating = Boolean(
    currentSession?.session?.impersonatedBy,
  );
  const impersonateDisabled =
    isImpersonatingUser || isViewingCurrentUser || isAlreadyImpersonating;

  const currentRoleBadge = roleBadgeConfig[roleValue] ?? roleBadgeConfig.user;
  const RoleBadgeIcon = currentRoleBadge.Icon;

  const renderSessions = () => {
    if (sessionsLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    }
    if (sessionsError) {
      return (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          {sessionsError}
        </div>
      );
    }
    if (sessions.length === 0) {
      return <p className="text-xs text-muted-foreground">No active sessions.</p>;
    }
    return (
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
              <span className="truncate">
                Token: {session.token ? truncateToken(session.token) : "-"}
              </span>
              <span className="text-muted-foreground">
                {formatDateTime(session.expiresAt)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
              <span>{session.userAgent ?? "User agent unavailable"}</span>
              <span>IP: {session.ipAddress ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              {session.impersonatedBy ? (
                <Badge variant="outline" className="gap-1">
                  <Clock3 className="h-3 w-3" />
                  Impersonated by {session.impersonatedBy}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Standard session</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  session.token && handleRevokeSession(session.token)
                }
                disabled={!session.token}
              >
                Revoke
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleSaveProfile = async () => {
    if (!localUser) return;
    const trimmedName = nameInput.trim();
    const trimmedEmail = emailInput.trim();

    const updates: Record<string, unknown> = {};
    if (trimmedName !== (localUser.name ?? "")) {
      updates.name = trimmedName;
    }
    if (trimmedEmail !== localUser.email) {
      updates.email = trimmedEmail;
    }

    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const payload: UpdateUserInput = {
        userId: localUser.id,
        data: updates,
      };
      const response: UpdateUserResponse =
        await authClient.admin.updateUser(payload);
      const updatedUser = ensureResponseData<UpdateUserData>(
        response,
        "Failed to update user profile.",
      );
      setLocalUser(updatedUser);
      onUserUpdated?.(updatedUser);
      toast.success("User profile updated.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update user profile.";
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangeRole = async (value: string) => {
    if (!localUser || value === pickPrimaryRole(localUser.role)) return;

    // Show confirmation dialog for role changes
    const currentRole = pickPrimaryRole(localUser.role);
    const userName = localUser.name || localUser.email || "this user";
    const confirmed = confirmAction(
      `Are you sure you want to change ${userName}'s role from "${currentRole}" to "${value}"? This will immediately affect their permissions across the system.`,
    );

    if (!confirmed) {
      return;
    }

    setRoleValue(value);
    setIsUpdatingRole(true);
    try {
      const payload = {
        userId: localUser.id,
        role: value,
      };
      const response = await authClient.admin.setRole(payload);
      const { user: updatedUser } = ensureResponseData<{ user: never }>(
        response,
        "Failed to update user role.",
      );
      setLocalUser(updatedUser);
      onUserUpdated?.(updatedUser);
      toast.success(`User role updated to ${value}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update user role.";
      setRoleValue(pickPrimaryRole(localUser.role));
      toast.error(message);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleBanUser = async () => {
    if (!localUser) return;
    if (!banReason.trim()) {
      toast.error("Ban reason cannot be empty.");
      return;
    }
    setIsBanMutating(true);
    try {
      const payload: BanUserInput = {
        userId: localUser.id,
        banReason: banReason.trim(),
        banExpiresIn: BAN_DURATION_SECONDS[banDuration],
      };
      const response: BanUserResponse = await authClient.admin.banUser(payload);
      const { user: updatedUser } = ensureResponseData<BanUserData>(
        response,
        "Failed to ban user.",
      );
      setLocalUser(updatedUser);
      onUserUpdated?.(updatedUser);
      toast.success("User banned successfully.");
      setShowBanForm(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to ban user.";
      toast.error(message);
    } finally {
      setIsBanMutating(false);
    }
  };

  const handleImpersonateUser = async () => {
    if (!localUser) return;
    if (currentSession?.user?.id === localUser.id) {
      toast.info("You are already signed in as this user.");
      return;
    }
    setIsImpersonatingUser(true);
    try {
      const payload: ImpersonateUserInput = {
        userId: localUser.id,
      };
      const response: ImpersonateUserResponse =
        await authClient.admin.impersonateUser(payload);
      ensureResponseData<ImpersonateUserData>(
        response,
        "Failed to impersonate user.",
      );
      toast.success(
        `Impersonating ${
          localUser.name ?? localUser.email ?? "selected user"
        }. Returning to app...`,
      );
      navigateTo("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to impersonate user.";
      toast.error(message);
    } finally {
      setIsImpersonatingUser(false);
    }
  };

  const handleUnbanUser = async () => {
    if (!localUser) return;
    setIsBanMutating(true);
    try {
      const payload: UnbanUserInput = {
        userId: localUser.id,
      };
      const response: UnbanUserResponse =
        await authClient.admin.unbanUser(payload);
      const { user: updatedUser } = ensureResponseData<UnbanUserData>(
        response,
        "Failed to update ban status.",
      );
      setLocalUser(updatedUser);
      onUserUpdated?.(updatedUser);
      toast.success("User ban status removed.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update ban status.";
      toast.error(message);
    } finally {
      setIsBanMutating(false);
    }
  };

  const handleSetPassword = async () => {
    if (!localUser) return;
    if (!newPassword.trim()) {
      toast.error("New password cannot be empty.");
      return;
    }

    setIsSettingPassword(true);
    try {
      const payload: SetUserPasswordInput = {
        userId: localUser.id,
        newPassword: newPassword.trim(),
      };
      await authClient.admin.setUserPassword(payload);
      toast.success("User password updated.");
      setNewPassword("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to set user password.";
      toast.error(message);
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!localUser) return;
    const confirmed = confirmAction(
      `User ${
        localUser.name ?? localUser.email
      } will be permanently deleted. Continue?`,
    );
    if (!confirmed) return;

    setIsRemovingUser(true);
    try {
      const payload: RemoveUserInput = { userId: localUser.id };
      await authClient.admin.removeUser(payload);
      toast.success("User deleted successfully.");
      onOpenChange(false);
      onUserDeleted?.(localUser.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete user.";
      toast.error(message);
    } finally {
      setIsRemovingUser(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full flex-col p-4 gap-6 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="items-start gap-1 text-left">
          <SheetTitle>{localUser?.name ?? "User Details"}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span>{localUser?.email ?? ""}</span>
            {getStatusBadge(localUser)}
          </SheetDescription>
        </SheetHeader>

        {!localUser ? (
          <div className="flex flex-1 items-center justify-center">
            <Skeleton className="h-12 w-12" />
          </div>
        ) : (
          <>
            <Card className="rounded-md bg-muted/40 px-4 text-sm">
              <div className="flex items-start gap-3">
                {localUser.banned ? (
                  <ShieldBan className="h-5 w-5 text-destructive mt-0.5" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5" />
                )}

                <div>
                  <p className="font-medium">
                    {localUser.banned ? "User banned" : "Active user"}
                  </p>

                  {localUser.banned && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {localUser.banReason && (
                        <>
                          <span className="font-medium">Reason:</span>{" "}
                          {localUser.banReason}.{" "}
                        </>
                      )}
                      {localUser.banExpires ? (
                        <>
                          <span className="font-medium">Expires:</span>{" "}
                          {formatDateTime(localUser.banExpires)}
                        </>
                      ) : (
                        "No expiration date."
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Ban Form */}
              {showBanForm && !localUser.banned && (
                <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ban-reason">Ban reason</Label>
                    <Input
                      id="ban-reason"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Example: Suspicious login attempts"
                    />
                  </div>

                  <RadioGroup
                    className="flex flex-wrap gap-2"
                    value={banDuration}
                    onValueChange={(value) =>
                      setBanDuration(value as BanDurationOption)
                    }
                  >
                    <div
                      key="permanent"
                      className="relative flex flex-col items-start gap-4 rounded-md border border-input p-3 shadow-xs outline-none has-data-[state=checked]:border-primary/50"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          id="permanent"
                          value="permanent"
                          className="after:absolute after:inset-0"
                        />
                        <Label htmlFor="permanent">Permanent</Label>
                      </div>
                    </div>
                    <div
                      key="1d"
                      className="relative flex flex-col items-start gap-4 rounded-md border border-input p-3 shadow-xs outline-none has-data-[state=checked]:border-primary/50"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          id="1d"
                          value="1d"
                          className="after:absolute after:inset-0"
                        />
                        <Label htmlFor="1d">24 hours</Label>
                      </div>
                    </div>
                    <div
                      key="7d"
                      className="relative flex flex-col items-start gap-4 rounded-md border border-input p-3 shadow-xs outline-none has-data-[state=checked]:border-primary/50"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          id="7d"
                          value="7d"
                          className="after:absolute after:inset-0"
                        />
                        <Label htmlFor="7d">7 days</Label>
                      </div>
                    </div>
                    <div
                      key="30d"
                      className="relative flex flex-col items-start gap-4 rounded-md border border-input p-3 shadow-xs outline-none has-data-[state=checked]:border-primary/50"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem
                          id="30d"
                          value="30d"
                          className="after:absolute after:inset-0"
                        />
                        <Label htmlFor="30d">30 days</Label>
                      </div>
                    </div>
                  </RadioGroup>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBanUser}
                    disabled={isBanMutating}
                    className="gap-2 w-full"
                  >
                    <ShieldBan className="h-4 w-4" />
                    {isBanMutating ? "Processing..." : "Confirm ban"}
                  </Button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {localUser.banned ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnbanUser}
                    disabled={isBanMutating}
                  >
                    {isBanMutating ? "Processing..." : "Undo ban"}
                  </Button>
                ) : (
                  <Button
                    variant={showBanForm ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setShowBanForm((prev) => !prev)}
                    disabled={isBanMutating}
                  >
                    {showBanForm ? "Close" : "Ban user"}
                  </Button>
                )}
              </div>
            </Card>

            <div className="space-y-6 pb-10">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Basic information
                    </CardTitle>
                  </div>
                  <CardAction>
                    <Button
                      size="sm"
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {isSavingProfile ? "Saving..." : "Save changes"}
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-name">Name</Label>
                    <Input
                      id="user-name"
                      value={nameInput}
                      onChange={(event) => setNameInput(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={emailInput}
                      onChange={(event) => setEmailInput(event.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDateTime(localUser.createdAt)} • Updated{" "}
                    {formatDateTime(localUser.updatedAt)}
                  </p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Role Management
                    </CardTitle>
                    <CardDescription>
                      Change the user&apos;s role and permissions
                    </CardDescription>
                  </div>
                  <CardAction>
                    <Badge
                      variant={currentRoleBadge.variant}
                      className="capitalize flex items-center gap-1"
                    >
                      {RoleBadgeIcon ? (
                        <RoleBadgeIcon className="h-3 w-3" />
                      ) : null}
                      {roleValue}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-role">User Role</Label>
                    <RadioGroup
                      value={roleValue}
                      onValueChange={handleChangeRole}
                      disabled={isUpdatingRole}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="user" id="role-user" />
                        <User className="h-4 w-4 text-muted-foreground" />
                        <Label
                          htmlFor="role-user"
                          className="flex-1 cursor-pointer"
                        >
                          <div>
                            <div className="font-medium">User</div>
                            <div className="text-xs text-muted-foreground">
                              Standard user with basic permissions
                            </div>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="admin" id="role-admin" />
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label
                          htmlFor="role-admin"
                          className="flex-1 cursor-pointer"
                        >
                          <div>
                            <div className="font-medium">Admin</div>
                            <div className="text-xs text-muted-foreground">
                              Administrator with full system access
                            </div>
                          </div>
                        </Label>
                      </div>
                      {/* <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="moderator" id="role-moderator" />
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <Label
                          htmlFor="role-moderator"
                          className="flex-1 cursor-pointer"
                        >
                          <div>
                            <div className="font-medium">Moderator</div>
                            <div className="text-xs text-muted-foreground">
                              Moderator with limited administrative permissions
                            </div>
                          </div>
                        </Label>
                      </div> */}
                    </RadioGroup>
                  </div>
                  {isUpdatingRole && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Updating role...
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">
                    Role changes take effect immediately and will affect the
                    user&apos;s permissions across the system.
                  </p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Impersonation
                  </CardTitle>
                  <CardDescription>
                    Start a temporary session as this user. This replaces your
                    current session until you stop impersonating or the session
                    expires.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleImpersonateUser}
                    disabled={impersonateDisabled || !localUser}
                  >
                    <CircleUserRound className="h-4 w-4" />
                    {isImpersonatingUser ? "Starting..." : "Impersonate user"}
                  </Button>
                  {isViewingCurrentUser && (
                    <p className="text-xs text-muted-foreground mt-2">
                      You are already signed in as this user.
                    </p>
                  )}
                  {isAlreadyImpersonating && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Stop the current impersonation before starting a new one.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Password
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="user-new-password">Set a new password</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="user-new-password"
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="sm:flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleSetPassword}
                      disabled={isSettingPassword}
                      className="gap-2"
                    >
                      <KeyRound className="h-4 w-4" />
                      {isSettingPassword ? "Saving..." : "Update password"}
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">
                    The new password takes effect immediately and is not shared
                    with the user automatically.
                  </p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Active sessions
                  </CardTitle>
                  <CardAction>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRevokeAllSessions}
                      disabled={isRevokingAll || sessions.length === 0}
                    >
                      {isRevokingAll ? "Processing..." : "Revoke all"}
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>{renderSessions()}</CardContent>
              </Card>

              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Danger zone
                  </CardTitle>
                  <CardDescription>
                    Deleting a user removes all related data and cannot be
                    undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={handleRemoveUser}
                    disabled={isRemovingUser}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isRemovingUser ? "Deleting..." : "Delete user"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function useLocalUserFormState(user: UserWithRole | null) {
  const [localUser, setLocalUser] = useState<UserWithRole | null>(user);
  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [emailInput, setEmailInput] = useState(user?.email ?? "");
  const [roleValue, setRoleValue] = useState(pickPrimaryRole(user?.role));
  const [banReason, setBanReason] = useState(defaultBanReason);
  const [banDuration, setBanDuration] =
    useState<BanDurationOption>(defaultBanDuration);
  const [showBanForm, setShowBanForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!user) {
      setLocalUser(null);
      setNameInput("");
      setEmailInput("");
      setRoleValue("user");
      setShowBanForm(false);
      setBanReason(defaultBanReason);
      setBanDuration(defaultBanDuration);
      setNewPassword("");
      return;
    }
    setLocalUser(user);
    setNameInput(user.name ?? "");
    setEmailInput(user.email ?? "");
    setRoleValue(pickPrimaryRole(user.role));
    setShowBanForm(false);
    setBanReason(defaultBanReason);
    setBanDuration(defaultBanDuration);
    setNewPassword("");
  }, [user]);

  return {
    localUser,
    setLocalUser,
    nameInput,
    setNameInput,
    emailInput,
    setEmailInput,
    roleValue,
    setRoleValue,
    banReason,
    setBanReason,
    banDuration,
    setBanDuration,
    showBanForm,
    setShowBanForm,
    newPassword,
    setNewPassword,
  };
}

function useUserSessionsManager(
  localUser: UserWithRole | null,
  open: boolean,
) {
  const [sessions, setSessions] = useState<SessionWithImpersonatedBy[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const fetchSessions = useCallback(async (userId: string) => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const input: ListUserSessionsInput = { userId };
      const response = await authClient.admin.listUserSessions(input);
      const { sessions } = ensureListUserSessionsData(response);
      setSessions(sessions);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load user sessions.";
      setSessionsError(message);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSessions([]);
    setSessionsError(null);
  }, [localUser?.id]);

  useEffect(() => {
    if (open && localUser?.id) {
      fetchSessions(localUser.id).catch(() => {});
    }
  }, [open, localUser?.id, fetchSessions]);

  const handleRevokeSession = useCallback(
    async (sessionToken: string | null) => {
      if (!sessionToken) {
        toast.error("Session token not found.");
        return;
      }
      try {
        const payload: RevokeSessionInput = { sessionToken };
        await authClient.admin.revokeUserSession(payload);
        setSessions((prev) =>
          prev.filter((session) => session.token !== sessionToken),
        );
        toast.success("Session revoked.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to revoke session.";
        toast.error(message);
      }
    },
    [],
  );

  const handleRevokeAllSessions = useCallback(async () => {
    if (!localUser) {
      toast.error("User information unavailable.");
      return;
    }
    setIsRevokingAll(true);
    try {
      const payload: RevokeSessionsInput = { userId: localUser.id };
      await authClient.admin.revokeUserSessions(payload);
      setSessions([]);
      toast.success("All user sessions revoked.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to revoke all sessions.";
      toast.error(message);
    } finally {
      setIsRevokingAll(false);
    }
  }, [localUser]);

  return {
    sessions,
    sessionsLoading,
    sessionsError,
    isRevokingAll,
    handleRevokeSession,
    handleRevokeAllSessions,
  };
}

const truncateToken = (token: string) => {
  if (token.length <= 24) return token;
  return `${token.slice(0, 12)}…${token.slice(-6)}`;
};
