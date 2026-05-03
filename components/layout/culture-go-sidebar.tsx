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
  Moon,
  Settings,
  SlidersHorizontal,
  Sun,
  Tags as TagsIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/tags", label: "タグ管理", icon: TagsIcon },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CultureGoSidebar() {
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
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={isActive(href, pathname)}>
                    <Link href={href}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
              title: "コンセプト",
              icon: Lightbulb,
              onSelect: () => router.push("/concept"),
              isActive: pathname.startsWith("/concept"),
            },
            {
              title: "スコアリング",
              icon: SlidersHorizontal,
              onSelect: () => router.push("/scoring"),
              isActive: pathname.startsWith("/scoring"),
            },
            {
              title: "設定",
              icon: Settings,
              onSelect: () => router.push("/settings"),
              isActive: pathname.startsWith("/settings"),
            },
            {
              title: isDark ? "ダーク" : "ライト",
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
