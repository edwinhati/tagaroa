"use client";

import Link from "next/link";
import type { ComponentProps, ComponentType } from "react";

import {
	Sidebar,
	SidebarHeader,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "@repo/ui/components/sidebar";

import { Logo } from "@repo/common/components/logo";
import { ThemeSwitcher } from "@repo/common/components/theme-switcher";

type AppSidebarProps = Readonly<
	ComponentProps<typeof Sidebar> & {
		appName: string;
		nav: Array<{ name: string; icon: ComponentType; href: string }>;
	}
>;

export function AppSidebar({ appName, nav, ...props }: AppSidebarProps) {
	const { open } = useSidebar();
	return (
		<div>
			<Sidebar
				className="h-[calc(11svh-var(--header-height))]!"
				variant="floating"
				collapsible="icon"
			>
				{open ? (
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild>
								<Link href="#">
									<div>
										<Logo size={28} />
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">Tagaroa</span>
										<span className="truncate text-xs">{appName}</span>
									</div>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				) : (
					<SidebarHeader>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton size="lg" asChild>
									<Link href="#">
										<div>
											<Logo size={28} />
										</div>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-medium">Tagaroa</span>
											<span className="truncate text-xs">Test</span>
										</div>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarHeader>
				)}
			</Sidebar>
			<Sidebar
				className="mt-0.5 top-(--header-height) h-[calc(100svh-var(--header-height))]!"
				variant="floating"
				collapsible="icon"
				{...props}
			>
				<SidebarContent>
					<SidebarGroup>
						<SidebarMenu>
							{nav.map((item) => (
								<SidebarMenuItem key={item.name}>
									<SidebarMenuButton tooltip={item.name} asChild>
										<Link href={item.href}>
											<item.icon />
											<span>{item.name}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>{" "}
				</SidebarContent>
				<SidebarFooter>
					{open ? (
						<div className="flex justify-between">
							<SidebarTrigger variant="outline" className="w-9 h-9" />
							<ThemeSwitcher />
						</div>
					) : (
						<div className="space-y-2">
							<ThemeSwitcher />
							<SidebarTrigger variant="outline" className="w-9 h-9" />
						</div>
					)}
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
		</div>
	);
}
