import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function DraftClientCreate() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [businessName, setBusinessName] = useState("");
  const createMutation = trpc.clients.createDraft.useMutation({
    onSuccess: async view => {
      await utils.clients.list.invalidate();
      toast.success("Client created.");
      setLocation(`/workspace/${view.client.id}/funnels`);
    },
    onError: error => toast.error(error.message),
  });
  const name = businessName.trim();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <button
        type="button"
        onClick={() => setLocation("/")}
        className="inline-flex items-center gap-2 text-sm font-extrabold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All clients
      </button>
      <section className="rounded-3xl border border-white/8 bg-card/80 p-6 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">New client</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Add Client</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
          Enter the business name. You can fill phone, address, and offer details later.
        </p>
        <label className="mt-6 block space-y-2">
          <span className="text-sm font-extrabold">Business Name</span>
          <Input
            autoFocus
            value={businessName}
            onChange={event => setBusinessName(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && name.length >= 2 && !createMutation.isPending) {
                event.preventDefault();
                createMutation.mutate({ businessName: name });
              }
            }}
            placeholder="Paradise Spas"
            className="h-13 rounded-xl border-white/10 bg-white/[0.035] text-base"
          />
        </label>
        <Button
          type="button"
          disabled={name.length < 2 || createMutation.isPending}
          onClick={() => createMutation.mutate({ businessName: name })}
          className="mt-5 h-13 w-full gap-2 rounded-xl bg-cyan-400 text-base font-extrabold text-slate-950 hover:bg-cyan-300"
        >
          {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          Create Client
        </Button>
      </section>
    </div>
  );
}
