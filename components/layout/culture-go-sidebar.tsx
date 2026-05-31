"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  AppSwitcher,
  GO_APPS,
  UserMenu,
} from "@takaki/go-design-system";
import {
  Home,
  Lightbulb,
  MapPin,
  Moon,
  Settings,
  SlidersHorizontal,
  Sofa,
  Sun,
  Tags as TagsIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UnreadCounts } from "@/lib/unread-counts";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  // 該当チャンネルの未読数を取り出す key。Tags のような非カードページは undefined。
  unreadKey?: keyof UnreadCounts;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, unreadKey: "global" },
  { href: "/local", label: "Saigon Shift", icon: MapPin, unreadKey: "hcmc" },
  { href: "/living", label: "Saigon Living", icon: Sofa, unreadKey: "hcmc_living" },
  { href: "/tags", label: "Tags", icon: TagsIcon },
];

// 今週の未読数バッジ。filled な濃色丸 + 数字白抜き。0 は描かない。
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#1A1A1A] px-1 text-[10px] font-semibold leading-none text-white tabular-nums dark:bg-white dark:text-[#1A1A1A] group-data-[collapsible=icon]:hidden"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CultureGoSidebar({
  unreadCounts,
}: {
  unreadCounts?: UnreadCounts | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isDark, setIsDark] = useState(false);

  const weekLabel = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    return start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setDisplayName(
        user.user_metadata?.display_name || user.email?.split("@")[0] || "User",
      );
      setEmail(user.email ?? "");
      setAvatarUrl(user.user_metadata?.avatar_url ?? "");
    });
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, [supabase]);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    localStorage.setItem("cg-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <AppSwitcher currentApp="CultureGo" apps={GO_APPS} placement="bottom" />
        <p className="px-3 pt-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)] group-data-[collapsible=icon]:hidden">
          Weekly · Slow Media
        </p>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon, unreadKey }) => {
                const count = unreadKey ? unreadCounts?.[unreadKey] ?? 0 : 0;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={isActive(href, pathname)}>
                      <Link href={href}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                        <UnreadBadge count={count} />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto px-3 pb-3 group-data-[collapsible=icon]:hidden">
          <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[var(--color-text-subtle)]">
            edition
          </p>
          <p className="cg-num mt-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
            {weekLabel}
          </p>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu
          displayName={displayName || "—"}
          email={email}
          avatarUrl={avatarUrl}
          items={[
            {
              title: "Concept",
              icon: Lightbulb,
              onSelect: () => router.push("/concept"),
              isActive: pathname.startsWith("/concept"),
            },
            {
              title: "Scoring",
              icon: SlidersHorizontal,
              onSelect: () => router.push("/scoring"),
              isActive: pathname.startsWith("/scoring"),
            },
            {
              title: "Settings",
              icon: Settings,
              onSelect: () => router.push("/settings"),
              isActive: pathname.startsWith("/settings"),
            },
            {
              title: isDark ? "Dark" : "Light",
              icon: isDark ? Moon : Sun,
              onSelect: toggleTheme,
            },
          ]}
          signOut={{ onSelect: handleSignOut }}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
