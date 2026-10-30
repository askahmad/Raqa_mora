"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { useLanguage, type Locale } from "@/lib/raqamora/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLanguage();

  const labels: Record<Locale, { name: string; short: string }> = {
    en: { name: "English", short: "EN" },
    roman: { name: "Roman Urdu", short: "Roman" },
    ur: { name: "اردو (Urdu)", short: "اردو" },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 px-2.5 text-xs font-medium gap-1.5 border-hairline hover:bg-muted/60 transition-colors ${className ?? ""}`}
          aria-label="Change Language"
        >
          <Globe className="size-3.5 text-ink-soft shrink-0" />
          <span className="font-semibold text-ink">{labels[locale].short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => setLocale("en")}
          className={`cursor-pointer text-xs flex items-center justify-between ${locale === "en" ? "font-bold text-brand-emerald" : ""}`}
        >
          <span>English</span>
          {locale === "en" && <span>✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale("roman")}
          className={`cursor-pointer text-xs flex items-center justify-between ${locale === "roman" ? "font-bold text-brand-emerald" : ""}`}
        >
          <span>Roman Urdu</span>
          {locale === "roman" && <span>✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale("ur")}
          className={`cursor-pointer text-xs flex items-center justify-between font-urdu ${locale === "ur" ? "font-bold text-brand-emerald" : ""}`}
        >
          <span>اردو (Urdu)</span>
          {locale === "ur" && <span>✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
