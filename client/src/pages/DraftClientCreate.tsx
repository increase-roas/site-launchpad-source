import { PageHeading } from "@/components/dashboard/PanelCard";
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
      setLocation(`/workspace/${view.client.id}`);
    },
    onError: error => toast.error(error.message),
  });
  const name = businessName.trim();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <button
        type="button"
        onClick={() => setLocation("/")}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </button>
      <PageHeading
        title="New client"
        description="Enter the business name. You can fill phone, address, and offer details later."
      />

      <section className="launchpad-panel rounded-lg p-4 sm:p-5">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Business name</span>
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
          />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={name.length < 2 || createMutation.isPending}
          onClick={() => createMutation.mutate({ businessName: name })}
          className="mt-4 h-9 w-full gap-1.5 text-xs font-semibold"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          Create client
        </Button>
      </section>
    </div>
  );
}
