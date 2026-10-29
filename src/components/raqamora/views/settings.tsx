"use client";

/**
 * RAQAMORA Settings view — profile, data & backup (manual JSON download,
 * demo seeding, typed-confirmation erase), about and session.
 */
import * as React from "react";
import {
  Database,
  Download,
  FlaskConical,
  Info,
  LogOut,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError, apiGet, apiSend } from "@/lib/raqamora/client";
import type { SessionUser } from "@/lib/raqamora/types";
import { useApp } from "@/components/raqamora/app-root";
import { ConfirmDialog, PageHeader, SectionCard, Spinner } from "@/components/raqamora/kit";
import { RaqamoraWordmark } from "@/components/raqamora/brand";
import type { ViewProps } from "@/components/raqamora/view-props";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

/* ------------------------------------------------------------------ helpers */

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function karachiTodayCompact(): string {
  return new Date(Date.now() + KARACHI_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, "");
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

function SettingsRow({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
  action: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span
            className={
              tone === "danger"
                ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger-brand/10 text-danger-brand"
                : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-soft"
            }
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className={`text-sm font-medium ${tone === "danger" ? "text-danger-brand" : "text-ink"}`}>{title}</p>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{description}</p> : null}
        </div>
      </div>
      <div className="shrink-0 sm:pl-11">{action}</div>
    </div>
  );
}

/* -------------------------------------------------------------------- View */

export default function SettingsView({ user }: ViewProps) {
  const { setUser, refreshUnread, handleUnauthorized } = useApp();

  /* --- Profile --- */
  const [name, setName] = React.useState(user.name);
  const [threshold, setThreshold] = React.useState(user.warnThreshold);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileNote, setProfileNote] = React.useState<string | null>(null);

  /* Keep local fields in sync if the session user changes (e.g. demo seed). */
  React.useEffect(() => {
    setName(user.name);
    setThreshold(user.warnThreshold);
  }, [user]);

  /* --- Data & backup --- */
  const [backingUp, setBackingUp] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = React.useState(false);
  const [eraseOpen, setEraseOpen] = React.useState(false);
  const [eraseText, setEraseText] = React.useState("");
  const [erasing, setErasing] = React.useState(false);

  /* --- Session --- */
  const [signingOut, setSigningOut] = React.useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setProfileNote("Name cannot be empty");
      return;
    }
    setSavingProfile(true);
    setProfileNote(null);
    try {
      const { user: updated } = await apiSend<{ user: SessionUser }>("/api/settings", "PATCH", {
        name: trimmed,
        warnThreshold: threshold,
      });
      setUser(updated);
      toast.success("Settings saved");
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      setProfileNote(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSavingProfile(false);
    }
  }

  async function downloadBackup() {
    setBackingUp(true);
    try {
      const res = await fetch("/api/export/backup", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        throw new Error(`Backup failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `raqamora-backup-${karachiTodayCompact()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded — keep it somewhere safe");
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not download the backup");
    } finally {
      setBackingUp(false);
    }
  }

  async function loadDemoData() {
    setSeeding(true);
    try {
      await apiSend("/api/demo/seed", "POST");
      const { user: me } = await apiGet<{ user: SessionUser }>("/api/auth/me");
      if (me) setUser(me);
      await refreshUnread();
      window.dispatchEvent(new Event("raqamora:txn-changed"));
      toast.success("Demo data loaded — explore freely, it's all sample data");
      setSeedConfirmOpen(false);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not load demo data");
    } finally {
      setSeeding(false);
    }
  }

  async function eraseAll() {
    setErasing(true);
    try {
      await apiSend("/api/settings/reset", "POST");
      setUser({ ...user, isDemo: false });
      await refreshUnread();
      window.dispatchEvent(new Event("raqamora:txn-changed"));
      toast.success("All financial data erased — fresh start");
      setEraseOpen(false);
      setEraseText("");
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not erase data");
    } finally {
      setErasing(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await apiSend("/api/auth/logout", "POST");
    } catch {
      /* clear the session locally regardless */
    }
    window.location.reload();
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <PageHeader
        title="Settings"
        description="Profile, data & preferences."
        actions={
          user.isDemo ? (
            <Badge className="border-gold/40 bg-gold/15 text-[10px] text-gold-deep dark:text-[#dcc494]" variant="outline">
              <FlaskConical className="mr-1 size-3" aria-hidden />
              DEMO DATA
            </Badge>
          ) : undefined
        }
      />

      {/* ------------------------------------------------------- Profile */}
      <SectionCard title="Profile" subtitle="How you appear and when budgets start warning you.">
        <form onSubmit={saveProfile} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value);
                setProfileNote(null);
              }}
            />
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="settings-threshold">Budget warning threshold</Label>
              <span className="money text-sm font-semibold text-ink">{threshold}%</span>
            </div>
            <Slider
              id="settings-threshold"
              min={10}
              max={100}
              step={5}
              value={[threshold]}
              onValueChange={(v) => setThreshold(v[0] ?? threshold)}
              aria-label="Budget warning threshold percentage"
            />
            <p className="text-[11px] leading-relaxed text-ink-soft">
              Budgets at or above {threshold}% of their limit turn amber, and a warning notification is created.
            </p>
          </div>
          {profileNote ? <p className="text-xs font-medium text-danger-brand">{profileNote}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={savingProfile}>
              {savingProfile ? <Spinner className="size-4 text-current" /> : <Save className="size-4" aria-hidden />}
              Save
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* -------------------------------------------------- Data & backup */}
      <SectionCard title="Data & backup" subtitle="Backups are manual downloads — nothing leaves this workspace by itself.">
        <div className="space-y-2.5">
          <SettingsRow
            icon={Download}
            title="Download backup"
            description="Full JSON snapshot of every account, transaction, debt, budget, goal and rule."
            action={
              <Button variant="outline" size="sm" onClick={() => void downloadBackup()} disabled={backingUp}>
                {backingUp ? <Spinner className="size-4 text-current" /> : <Download className="size-4" aria-hidden />}
                Download
              </Button>
            }
          />
          <SettingsRow
            icon={FlaskConical}
            title="Load demo data"
            description="Replaces everything with realistic Pakistan-themed sample data — great for exploring."
            action={
              <Button variant="outline" size="sm" onClick={() => setSeedConfirmOpen(true)} disabled={seeding}>
                {seeding ? <Spinner className="size-4 text-current" /> : <Database className="size-4" aria-hidden />}
                Load demo
              </Button>
            }
          />
        </div>
      </SectionCard>

      {/* ---------------------------------------------------- Danger zone */}
      <section
        className="rounded-xl border border-danger-brand/30 bg-danger-brand/[0.03] p-4 sm:p-5"
        aria-labelledby="danger-zone-title"
      >
        <h2 id="danger-zone-title" className="text-sm font-semibold text-danger-brand">
          Danger zone
        </h2>
        <p className="mt-0.5 text-xs text-ink-soft">Irreversible actions — download a backup first.</p>
        <div className="mt-3">
          <SettingsRow
            tone="danger"
            icon={ShieldAlert}
            title="Erase all financial data"
            description="Deletes every account, transaction, debt, budget, goal, recurring rule and notification. Your login stays."
            action={
              <Button
                variant="outline"
                size="sm"
                className="border-danger-brand/40 text-danger-brand hover:bg-danger-brand/10 hover:text-danger-brand"
                onClick={() => {
                  setEraseText("");
                  setEraseOpen(true);
                }}
              >
                Erase data
              </Button>
            }
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- About */}
      <SectionCard title="About">
        <div className="flex flex-col gap-4">
          <div>
            <RaqamoraWordmark size="md" tone="onLight" />
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              Premium personal finance, Pakistan-first. Track cash, bank and wallets, lend & borrow with
              confidence, and budget without spreadsheets.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-ink-soft">Version</dt>
              <dd className="font-medium text-ink sm:mt-0.5">1.0</dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-ink-soft">Currency</dt>
              <dd className="font-medium text-ink sm:mt-0.5">PKR (Rs)</dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-ink-soft">Timezone</dt>
              <dd className="font-medium text-ink sm:mt-0.5">Asia/Karachi</dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-ink-soft">Money handling</dt>
              <dd className="font-medium text-ink sm:mt-0.5">Integer paisa arithmetic — no floating point</dd>
            </div>
          </dl>
          <p className="flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
            All data stays in this workspace. No bank connections; nothing is shared.
          </p>
        </div>
      </SectionCard>

      {/* -------------------------------------------------------- Session */}
      <SectionCard title="Session">
        <SettingsRow
          icon={LogOut}
          title={`Signed in as ${user.email}`}
          description="Sign out on this device. Your data is waiting when you return."
          action={
            <Button variant="outline" size="sm" onClick={() => void signOut()} disabled={signingOut}>
              {signingOut ? <Spinner className="size-4 text-current" /> : <LogOut className="size-4" aria-hidden />}
              Sign out
            </Button>
          }
        />
      </SectionCard>

      <p className="flex items-center gap-1.5 px-1 pb-2 text-[11px] text-ink-soft">
        <Sparkles className="size-3 shrink-0 text-gold-deep" aria-hidden />
        Urdu labels and Roman-Urdu quick entry are on the roadmap.
      </p>

      {/* ------------------------------------------------- Demo seed dialog */}
      <ConfirmDialog
        open={seedConfirmOpen}
        onOpenChange={setSeedConfirmOpen}
        title="Load demo data?"
        description="This REPLACES all your current accounts, transactions, debts, budgets, goals and recurring rules with sample data. Download a backup first if you want to keep anything."
        confirmLabel="Replace with demo"
        destructive
        loading={seeding}
        onConfirm={loadDemoData}
      />

      {/* ---------------------------------------------------- Erase dialog */}
      <Dialog
        open={eraseOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEraseOpen(false);
            setEraseText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Erase all financial data?</DialogTitle>
            <DialogDescription>
              Every account, transaction, debt, budget, goal, recurring rule and notification will be permanently
              deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="erase-confirm">
              Type <span className="font-mono font-semibold text-danger-brand">DELETE</span> to confirm
            </Label>
            <Input
              id="erase-confirm"
              value={eraseText}
              autoComplete="off"
              spellCheck={false}
              placeholder="DELETE"
              onChange={(e) => setEraseText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEraseOpen(false);
                setEraseText("");
              }}
              disabled={erasing}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={erasing || eraseText !== "DELETE"} onClick={() => void eraseAll()}>
              {erasing ? <Spinner className="size-4 text-current" /> : null}
              Erase everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
