import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { AstroClientConfigInput } from "@shared/astroConfig";
import { fieldMessageFor, fieldStateFor, type ConfigReadiness } from "@shared/astroConfigReadiness";
import { BadgeDollarSign, Info } from "lucide-react";
import { FieldCell, FieldGrid } from "../ConfigSection";
import { UrlInput } from "../fieldWidgets";

function GroupHeading({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Separator className="flex-1" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      <Separator className="flex-1" />
    </div>
  );
}

export function FinancingEditor({
  value,
  readiness,
  onChange,
}: {
  value: AstroClientConfigInput["financing"];
  readiness: ConfigReadiness;
  onChange: (next: AstroClientConfigInput["financing"]) => void;
}) {
  const cell = (field: keyof AstroClientConfigInput["financing"]) => ({
    state: fieldStateFor(readiness, `financing.${field}`),
    message: fieldMessageFor(readiness, `financing.${field}`),
  });

  if (!value.enabled) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BadgeDollarSign />
          </EmptyMedia>
          <EmptyTitle>Financing is off</EmptyTitle>
          <EmptyDescription>
            Leave this off unless the client has an approved lender and legal copy ready.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onClick={() => onChange({ ...value, enabled: true })}>
            Turn financing on
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-1">
      <Alert>
        <Info />
        <AlertTitle>Shown on the financing page and offer modules</AlertTitle>
        <AlertDescription>
          Lender details, the monthly example, and legal copy all publish together. Turn this off if any of it is still draft.
        </AlertDescription>
      </Alert>
      <GroupHeading>Lender</GroupHeading>
      <FieldGrid columns={2}>
        <FieldCell label="Lender name" {...cell("lenderName")}>
          <Input
            value={value.lenderName}
            onChange={event => onChange({ ...value, lenderName: event.target.value })}
          />
        </FieldCell>
        <FieldCell label="Lender website" {...cell("lenderUrl")}>
          <UrlInput
            value={value.lenderUrl}
            onChange={lenderUrl => onChange({ ...value, lenderUrl })}
            placeholder="lender.example.com"
          />
        </FieldCell>
      </FieldGrid>
      <GroupHeading>Customer offer</GroupHeading>
      <FieldGrid columns={2}>
        <FieldCell label="Button label" {...cell("ctaLabel")}>
          <Input
            value={value.ctaLabel}
            onChange={event => onChange({ ...value, ctaLabel: event.target.value })}
          />
        </FieldCell>
        <FieldCell label="Monthly example" {...cell("monthlyExample")} hint="Short example such as From $149/mo.">
          <Input
            value={value.monthlyExample}
            onChange={event => onChange({ ...value, monthlyExample: event.target.value })}
          />
        </FieldCell>
      </FieldGrid>
      <GroupHeading>Legal</GroupHeading>
      <FieldGrid columns={1}>
        <FieldCell label="Disclaimer" {...cell("disclaimer")}>
          <Textarea
            value={value.disclaimer}
            onChange={event => onChange({ ...value, disclaimer: event.target.value })}
            className="min-h-28"
          />
        </FieldCell>
        <FieldCell label="Terms" {...cell("terms")}>
          <Textarea
            value={value.terms}
            onChange={event => onChange({ ...value, terms: event.target.value })}
            className="min-h-28"
          />
        </FieldCell>
      </FieldGrid>
    </div>
  );
}
