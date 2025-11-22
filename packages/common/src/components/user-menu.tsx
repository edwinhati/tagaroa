"use client";

import { useState } from "react";

import {
	BoltIcon,
	BookOpenIcon,
	Layers2Icon,
	LogOutIcon,
	PinIcon,
	UserPenIcon,
	UserXIcon,
} from "lucide-react";

import { toast } from "sonner";
import type { SessionWithImpersonatedBy } from "better-auth/plugins/admin";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { authClient } from "@repo/common/lib/auth-client";

const getBrowserLocation = () =>
	typeof globalThis !== "undefined"
		? (globalThis as { location?: Location }).location
		: undefined;

export function UserMenu() {
	const { data: session } = authClient.useSession();
	const avatarSrc = session?.user?.image?.trim() ? session.user.image : "";
	const [isStoppingImpersonation, setIsStoppingImpersonation] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const isImpersonating = Boolean(
		(session?.session as SessionWithImpersonatedBy)?.impersonatedBy,
	);

	const handleStopImpersonating = async () => {
		setIsStoppingImpersonation(true);
		try {
			const response = await authClient.admin.stopImpersonating();
			if (response?.error) {
				throw new Error(
					response.error.message ?? "Failed to stop impersonating.",
				);
			}
			toast.success("Impersonation session ended.");
			getBrowserLocation()?.reload();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to stop impersonating.";
			toast.error(message);
		} finally {
			setIsStoppingImpersonation(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
					<Avatar>
						<AvatarImage src={avatarSrc} alt="Profile image" />
						<AvatarFallback className="uppercase">
							{session?.user.name.split(" ").map((n: string) => n.charAt(0))}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="max-w-64" align="end">
				<DropdownMenuLabel className="flex min-w-0 flex-col">
					<span className="text-foreground truncate text-sm font-medium">
						{session?.user.name}
					</span>
					<span className="text-muted-foreground truncate text-xs font-normal">
						{session?.user.email}
					</span>
					{isImpersonating ? (
						<span className="text-amber-500 truncate text-xs font-medium">
							Impersonating • return to admin when finished
						</span>
					) : null}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<BoltIcon size={16} className="opacity-60" aria-hidden="true" />
						<span>Option 1</span>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<Layers2Icon size={16} className="opacity-60" aria-hidden="true" />
						<span>Option 2</span>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<BookOpenIcon size={16} className="opacity-60" aria-hidden="true" />
						<span>Option 3</span>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<PinIcon size={16} className="opacity-60" aria-hidden="true" />
						<span>Option 4</span>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<UserPenIcon size={16} className="opacity-60" aria-hidden="true" />
						<span>Option 5</span>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				{isImpersonating ? (
					<DropdownMenuItem
						disabled={isStoppingImpersonation}
						onSelect={(event) => {
							event.preventDefault();
							if (!isStoppingImpersonation) {
								void handleStopImpersonating();
							}
						}}
						onClick={(event) => {
							event.preventDefault();
							if (!isStoppingImpersonation) {
								void handleStopImpersonating();
							}
						}}
					>
						<UserXIcon size={16} className="opacity-60" aria-hidden="true" />
						<span>
							{isStoppingImpersonation ? "Stopping..." : "Stop impersonating"}
						</span>
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					disabled={isLoggingOut}
					onClick={async () => {
						if (isLoggingOut) return;

						setIsLoggingOut(true);
						try {
							// Sign out and wait for completion
							const result = await authClient.signOut();

							if (result?.error) {
								console.error("Logout error:", result.error);
							}

							// Add a small delay to ensure session is cleared
							await new Promise((resolve) => setTimeout(resolve, 100));

							// Redirect to auth app sign-in page with logout parameter
							const locationTarget = `${process.env.NEXT_PUBLIC_AUTH_APP_URL}/sign-in?logout=true`;
							const browserLocation = getBrowserLocation();
							if (browserLocation) {
								browserLocation.href = locationTarget;
							}
						} catch (error) {
							console.error("Logout failed:", error);
							// Force redirect even if everything fails
							const browserLocation = getBrowserLocation();
							if (browserLocation) {
								browserLocation.href = `${process.env.NEXT_PUBLIC_AUTH_APP_URL}/sign-in?logout=true`;
							}
						} finally {
							setIsLoggingOut(false);
						}
					}}
				>
					<LogOutIcon size={16} className="opacity-60" aria-hidden="true" />
					<span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
