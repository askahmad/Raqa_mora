"use client";

/**
 * RAQAMORA auth — centered card on ivory with login/signup tabs,
 * React Hook Form + zod validation, server errors in a destructive Alert.
 */
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { apiSend } from "@/lib/raqamora/client";
import type { SessionUser } from "@/lib/raqamora/types";
import { loginSchema, signupSchema } from "@/lib/raqamora/validation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RaqamoraWordmark } from "@/components/raqamora/brand";
import { DemoButton, Spinner } from "@/components/raqamora/kit";

export type AuthMode = "login" | "signup";

export interface AuthScreenProps {
  initialMode?: AuthMode;
  onAuthed: (user: SessionUser) => void;
}

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

export function AuthScreen({ initialMode = "login", onAuthed }: AuthScreenProps) {
  const [mode, setMode] = React.useState<AuthMode>(initialMode);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <RaqamoraWordmark size="md" />
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-5 shadow-raised sm:p-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as AuthMode)}>
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="login" className="min-h-8">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="min-h-8">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-4 outline-none">
              <LoginForm onAuthed={onAuthed} />
            </TabsContent>
            <TabsContent value="signup" className="mt-4 outline-none">
              <SignupForm onAuthed={onAuthed} />
            </TabsContent>
          </Tabs>

          <div className="my-4 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[11px] uppercase tracking-wide text-ink-soft">or</span>
            <Separator className="flex-1" />
          </div>

          <DemoButton className="w-full" size="default" onDemo={onAuthed} />
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
          Sessions are protected with httpOnly cookies. Your ledger stays yours.
        </p>
      </div>
    </div>
  );
}

function ServerErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function LoginForm({ onAuthed }: { onAuthed: (user: SessionUser) => void }) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { user } = await apiSend<{ user: SessionUser }>("/api/auth/login", "POST", values);
      onAuthed(user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4">
        {serverError ? <ServerErrorAlert message={serverError} /> : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="min-h-10 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Spinner className="size-4 text-current" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </Form>
  );
}

function SignupForm({ onAuthed }: { onAuthed: (user: SessionUser) => void }) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { user } = await apiSend<{ user: SessionUser }>("/api/auth/signup", "POST", values);
      onAuthed(user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Sign up failed. Please try again.");
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4">
        {serverError ? <ServerErrorAlert message={serverError} /> : null}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="e.g. Ayesha Khan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...field} />
              </FormControl>
              <FormDescription>Use at least 8 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="Re-enter your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="min-h-10 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Spinner className="size-4 text-current" /> Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </Form>
  );
}
