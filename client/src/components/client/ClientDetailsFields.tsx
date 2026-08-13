import { CATEGORY_OPTIONS, DAY_LABELS, THEME_OPTIONS } from "@/components/client/clientEditorOptions";
import { FormField, SectionHeading } from "@/components/client/ClientEditorFields";
import type { FieldErrors, FormDetails } from "@/components/client/clientEditorForm";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Clock3, Sparkles, Store } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

export function ClientDetailsFields({
  details,
  errors,
  setDetails,
}: {
  details: FormDetails;
  errors: FieldErrors;
  setDetails: Dispatch<SetStateAction<FormDetails>>;
}) {
  return (
    <>
      <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
        <SectionHeading
          icon={Store}
          eyebrow="Step 1"
          title="Business details"
          description="Enter the information customers should see on the website."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Business name" error={errors.businessName}>
            <Input
              value={details.businessName}
              onChange={event => setDetails(current => ({ ...current, businessName: event.target.value }))}
              placeholder="Paradise Spas"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="Short name" error={errors.shortName} hint="A simple name your team will recognize.">
            <Input
              value={details.shortName}
              onChange={event => setDetails(current => ({ ...current, shortName: event.target.value }))}
              placeholder="Paradise"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="Phone number" error={errors.phone} hint="Include + and country code, such as +17015551234.">
            <Input
              type="tel"
              value={details.phone}
              onChange={event => setDetails(current => ({ ...current, phone: event.target.value }))}
              placeholder="+17015551234"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="Email address" error={errors.email}>
            <Input
              type="email"
              value={details.email}
              onChange={event => setDetails(current => ({ ...current, email: event.target.value }))}
              placeholder="hello@business.com"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="Website address" error={errors.websiteUrl}>
            <Input
              type="url"
              value={details.websiteUrl}
              onChange={event => setDetails(current => ({ ...current, websiteUrl: event.target.value }))}
              placeholder="https://business.com"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="Founded year" error={errors.foundedYear}>
            <Input
              type="number"
              inputMode="numeric"
              min="1800"
              max={new Date().getFullYear()}
              value={details.foundedYear}
              onChange={event => setDetails(current => ({ ...current, foundedYear: event.target.value }))}
              placeholder="1994"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Tagline" error={errors.tagline}>
              <Input
                value={details.tagline}
                onChange={event => setDetails(current => ({ ...current, tagline: event.target.value }))}
                placeholder="Relaxation starts here."
                className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
              />
            </FormField>
          </div>
        </div>

        <div className="my-7 h-px bg-white/8" />
        <h3 className="mb-4 text-lg font-extrabold">Business address</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Street address" error={errors.streetAddress}>
              <Input
                value={details.streetAddress}
                onChange={event => setDetails(current => ({ ...current, streetAddress: event.target.value }))}
                placeholder="123 Main Street"
                className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
              />
            </FormField>
          </div>
          <FormField label="City" error={errors.city}>
            <Input
              value={details.city}
              onChange={event => setDetails(current => ({ ...current, city: event.target.value }))}
              placeholder="Minot"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="State or region" error={errors.state}>
            <Input
              value={details.state}
              onChange={event => setDetails(current => ({ ...current, state: event.target.value }))}
              placeholder="North Dakota"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="ZIP or postal code" error={errors.postalCode}>
            <Input
              value={details.postalCode}
              onChange={event => setDetails(current => ({ ...current, postalCode: event.target.value }))}
              placeholder="58701"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="Country" error={errors.country}>
            <Input
              value={details.country}
              onChange={event => setDetails(current => ({ ...current, country: event.target.value }))}
              placeholder="United States"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
        </div>

        <div className="my-7 h-px bg-white/8" />
        <h3 className="mb-4 text-lg font-extrabold">Social and map links</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Facebook page" error={errors.facebookUrl}>
            <Input
              type="url"
              value={details.facebookUrl}
              onChange={event => setDetails(current => ({ ...current, facebookUrl: event.target.value }))}
              placeholder="https://facebook.com/business"
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
          <FormField label="Google Maps link" error={errors.googleMapsUrl}>
            <Input
              type="url"
              value={details.googleMapsUrl}
              onChange={event => setDetails(current => ({ ...current, googleMapsUrl: event.target.value }))}
              placeholder="https://maps.app.goo.gl/..."
              className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
            />
          </FormField>
        </div>
      </Card>

      <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
        <SectionHeading
          icon={Sparkles}
          eyebrow="Step 2"
          title="Look and products"
          description="Choose one website style and the products this client sells."
        />
        <fieldset>
          <legend className="text-sm font-extrabold">Website theme</legend>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {THEME_OPTIONS.map(option => {
              const selected = details.theme === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                    selected
                      ? "border-cyan-400 bg-cyan-400/8 ring-2 ring-cyan-400/15"
                      : "border-white/9 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={selected}
                    onChange={() => setDetails(current => ({ ...current, theme: option.value }))}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    {option.swatches.map(color => (
                      <span
                        key={color}
                        className="h-8 flex-1 rounded-lg ring-1 ring-white/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-lg font-extrabold">{option.label}</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">{option.description}</p>
                </label>
              );
            })}
          </div>
          {errors.theme ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-300">
              <AlertCircle className="h-4 w-4" /> {errors.theme}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-sm font-extrabold">Products they sell</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {CATEGORY_OPTIONS.map(option => {
              const checked = details.productCategories.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    checked ? "border-cyan-400/45 bg-cyan-400/7" : "border-white/9 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={next =>
                      setDetails(current => ({
                        ...current,
                        productCategories: next
                          ? [...current.productCategories, option.value]
                          : current.productCategories.filter(value => value !== option.value),
                      }))
                    }
                    className="h-6 w-6 border-white/25 data-[state=checked]:border-cyan-400 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950"
                  />
                  <span className="text-base font-extrabold">{option.label}</span>
                </label>
              );
            })}
          </div>
          {errors.productCategories ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-300">
              <AlertCircle className="h-4 w-4" /> {errors.productCategories}
            </p>
          ) : null}
        </fieldset>
      </Card>

      <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
        <SectionHeading
          icon={Clock3}
          eyebrow="Step 3"
          title="Hours of operation"
          description="Turn off any closed day. For open days, choose the opening and closing time."
        />
        <div className="space-y-3">
          {details.businessHours.map((hour, index) => (
            <div
              key={hour.day}
              className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:grid-cols-[150px_1fr] sm:items-center"
            >
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={hour.isOpen}
                  onCheckedChange={checked =>
                    setDetails(current => ({
                      ...current,
                      businessHours: current.businessHours.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, isOpen: Boolean(checked) } : item,
                      ),
                    }))
                  }
                  className="h-6 w-6 border-white/25 data-[state=checked]:border-cyan-400 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950"
                />
                <span className="font-extrabold">{DAY_LABELS[hour.day]}</span>
              </label>
              {hour.isOpen ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`${DAY_LABELS[hour.day]} opening time`}
                    value={hour.opensAt}
                    onChange={event =>
                      setDetails(current => ({
                        ...current,
                        businessHours: current.businessHours.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, opensAt: event.target.value } : item,
                        ),
                      }))
                    }
                    className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                  />
                  <span className="text-sm font-bold text-muted-foreground">to</span>
                  <Input
                    type="time"
                    aria-label={`${DAY_LABELS[hour.day]} closing time`}
                    value={hour.closesAt}
                    onChange={event =>
                      setDetails(current => ({
                        ...current,
                        businessHours: current.businessHours.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, closesAt: event.target.value } : item,
                        ),
                      }))
                    }
                    className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-base"
                  />
                </div>
              ) : (
                <div className="rounded-xl bg-white/[0.025] px-4 py-3 text-sm font-bold text-muted-foreground">Closed</div>
              )}
            </div>
          ))}
        </div>
        {errors.businessHours ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-300">
            <AlertCircle className="h-4 w-4" /> {errors.businessHours}
          </p>
        ) : null}
      </Card>

      <Card className="border-white/8 bg-card/85 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7">
        <SectionHeading
          icon={Sparkles}
          eyebrow="Step 4"
          title="Offers and promises"
          description="Use the exact wording this client wants customers to see."
        />
        <div className="space-y-5">
          <FormField label="Primary offer" error={errors.primaryOffer}>
            <Textarea
              value={details.primaryOffer}
              onChange={event => setDetails(current => ({ ...current, primaryOffer: event.target.value }))}
              placeholder="Save up to $2,500 on select models this month."
              className="min-h-28 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed"
            />
          </FormField>
          <FormField label="Financing promise" error={errors.financingPromise}>
            <Textarea
              value={details.financingPromise}
              onChange={event => setDetails(current => ({ ...current, financingPromise: event.target.value }))}
              placeholder="Flexible monthly payment options are available."
              className="min-h-28 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed"
            />
          </FormField>
          <FormField label="Delivery promise" error={errors.deliveryPromise}>
            <Textarea
              value={details.deliveryPromise}
              onChange={event => setDetails(current => ({ ...current, deliveryPromise: event.target.value }))}
              placeholder="Local delivery and setup are available."
              className="min-h-28 rounded-xl border-white/10 bg-white/[0.035] text-base leading-relaxed"
            />
          </FormField>
        </div>
      </Card>
    </>
  );
}
