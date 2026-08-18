import { simpleFormOfflineConversionContractSchema } from "../../../shared/simpleFormContract";
import {
  REQUIRED_FORM_LEAD_FIELDS,
  isFormOrLeadStep,
  isSunPoolName,
  isValidMetaPixelId,
  parsePaidFunnelPackage,
  parsePaidFunnelPublishSettings,
  type PaidFunnelPackage,
  type PaidFunnelPublishSettings,
} from "../../../shared/studio/paidFunnelPackage";

export const PAID_FUNNEL_READINESS_KEYS = [
  "package",
  "steps",
  "formMapping",
  "navigation",
  "integration",
  "tracking",
  "secrets",
  "build",
  "adapter",
] as const;
export type PaidFunnelReadinessKey =
  (typeof PAID_FUNNEL_READINESS_KEYS)[number];

export type PaidFunnelReadinessSection = {
  key: PaidFunnelReadinessKey;
  label: string;
  ready: boolean;
  missing: string[];
};

export type PaidFunnelReadiness = {
  sections: PaidFunnelReadinessSection[];
  configurationReady: boolean;
};

const LABELS: Record<PaidFunnelReadinessKey, string> = {
  package: "Package",
  steps: "Steps",
  formMapping: "Form mapping",
  navigation: "Navigation",
  integration: "Integration",
  tracking: "Tracking",
  secrets: "Runtime secrets",
  build: "Build",
  adapter: "Adapter",
};

function section(
  key: PaidFunnelReadinessKey,
  missing: string[]
): PaidFunnelReadinessSection {
  return {
    key,
    label: LABELS[key],
    ready: missing.length === 0,
    missing,
  };
}

function failClosedInvalidPackage(errors: string[]): PaidFunnelReadiness {
  const packageMissing = errors.length
    ? errors
    : ["Package is invalid"];
  return {
    sections: PAID_FUNNEL_READINESS_KEYS.map(key =>
      key === "package"
        ? section(key, packageMissing)
        : section(key, ["Package is invalid"])
    ),
    configurationReady: false,
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function checkPackage(
  pkg: PaidFunnelPackage,
  settings: PaidFunnelPublishSettings
): string[] {
  const missing: string[] = [];
  if (pkg.kind !== "paid-funnel") missing.push("kind must be paid-funnel");
  if (pkg.schemaVersion !== 1) missing.push("schemaVersion must be 1");
  if (!settings.domain.trim()) missing.push("Publish domain");
  if (!settings.path.startsWith("/")) missing.push("Publish path");
  if (!settings.consent.version.trim()) missing.push("Consent version");
  if (settings.consent.text.trim().length < 40) missing.push("Consent text");
  return unique(missing);
}

function checkSteps(
  pkg: PaidFunnelPackage,
  settings: PaidFunnelPublishSettings
): string[] {
  const missing: string[] = [];
  if (pkg.steps.length === 0) missing.push("At least one funnel step");
  const states = new Map(
    settings.stepStates.map(state => [state.stepKey, state])
  );
  for (const step of pkg.steps) {
    if (!step.key) missing.push("Step key");
    if (!step.slug) missing.push(`Step ${step.key} slug`);
    if (!step.title) missing.push(`Step ${step.key} title`);
    const state = states.get(step.key);
    if (!state) {
      missing.push(`Preview/publish state for ${step.key}`);
      continue;
    }
    if (!state.previewReady) missing.push(`Preview ready for ${step.key}`);
    if (!state.publishReady) missing.push(`Publish ready for ${step.key}`);
  }
  for (const state of settings.stepStates) {
    if (!pkg.steps.some(step => step.key === state.stepKey)) {
      missing.push(`Unknown step state ${state.stepKey}`);
    }
  }
  return unique(missing);
}

function checkFormMapping(pkg: PaidFunnelPackage): string[] {
  const missing: string[] = [];
  const contract = simpleFormOfflineConversionContractSchema.safeParse(
    pkg.offlineConversionContract
  );
  if (!contract.success) {
    missing.push("Canonical offline conversion contract");
    return missing;
  }
  if (contract.data.joinKey !== "leadUuid") {
    missing.push("Offline conversion joinKey must be leadUuid");
  }
  if (!contract.data.purchase.requiresExplicitPositiveValue) {
    missing.push("Purchase requires an explicit positive value");
  }
  const purchase = contract.data.stageMappings.find(
    mapping => mapping.metaEvent === "Purchase"
  );
  if (!purchase) missing.push("Sold stage must map to Purchase");

  const formSteps = pkg.steps.filter(isFormOrLeadStep);
  if (formSteps.length === 0) missing.push("A form or lead step");
  for (const step of formSteps) {
    if (!step.formMapping) {
      missing.push(`Form mapping for ${step.key}`);
      continue;
    }
    if (step.formMapping.joinKey !== "leadUuid") {
      missing.push(`Form mapping joinKey for ${step.key} must be leadUuid`);
    }
    const bound = new Set(
      step.formMapping.fieldBindings.map(binding => binding.leadField)
    );
    for (const field of REQUIRED_FORM_LEAD_FIELDS) {
      if (!bound.has(field)) {
        missing.push(`Form mapping for ${step.key} is missing ${field}`);
      }
    }
  }
  return unique(missing);
}

function checkNavigation(
  pkg: PaidFunnelPackage,
  settings: PaidFunnelPublishSettings
): string[] {
  const missing: string[] = [];
  const keys = new Set(pkg.steps.map(step => step.key));
  let hasTerminal = false;
  for (const step of pkg.steps) {
    if (step.nextStep == null) {
      hasTerminal = true;
      continue;
    }
    if (!keys.has(step.nextStep)) {
      missing.push(`Step ${step.key} targets missing ${step.nextStep}`);
    }
  }
  if (!hasTerminal) missing.push("A terminal next-step");
  for (const target of settings.navigationTargets) {
    if (!keys.has(target)) {
      missing.push(`Navigation target ${target} is missing`);
    }
  }
  return unique(missing);
}

function checkIntegration(
  pkg: PaidFunnelPackage,
  settings: PaidFunnelPublishSettings
): string[] {
  const missing: string[] = [];
  if (pkg.integrations.ghl && !settings.integrations.ghlLocationId?.trim()) {
    missing.push("GHL Location ID");
  }
  if (
    pkg.integrations.googleSheets &&
    !settings.integrations.googleSheetsId?.trim()
  ) {
    missing.push("Google Sheet ID");
  }
  return unique(missing);
}

function checkTracking(
  pkg: PaidFunnelPackage,
  settings: PaidFunnelPublishSettings
): string[] {
  const missing: string[] = [];
  if (!settings.tracking.preserveUtm) {
    missing.push("UTM preservation");
  }
  if (!settings.tracking.preserveClickIds) {
    missing.push("Click-ID preservation");
  }
  if (pkg.integrations.meta) {
    if (!isValidMetaPixelId(settings.tracking.metaPixelId)) {
      missing.push("Meta Pixel ID");
    }
    if (!settings.tracking.metaCapiPresent) {
      missing.push("Meta CAPI presence");
    }
  }
  return unique(missing);
}

function checkSecrets(
  pkg: PaidFunnelPackage,
  settings: PaidFunnelPublishSettings
): string[] {
  const missing: string[] = [];
  const required = unique([
    ...pkg.requiredRuntimeSecrets,
    ...pkg.offlineConversionContract.requiredRuntimeSecrets,
  ]);
  for (const name of required) {
    if (settings.secretPresence[name] !== true) {
      missing.push(name);
    }
  }
  return missing;
}

function checkBuild(pkg: PaidFunnelPackage): string[] {
  const missing: string[] = [];
  if (!pkg.build.command.trim()) missing.push("Build command");
  if (!pkg.build.outputDir.trim()) missing.push("Build outputDir");
  return missing;
}

function checkAdapter(
  pkg: PaidFunnelPackage,
  settings: PaidFunnelPublishSettings
): string[] {
  const missing: string[] = [];
  if (pkg.publishAdapter === "legacy-simple-form") {
    missing.push("Use the specialized Simple Form adapter");
  } else if (pkg.publishAdapter !== "generic-paid-funnel") {
    missing.push("publishAdapter must be generic-paid-funnel");
  }
  if (isSunPoolName(settings.clientKey) || isSunPoolName(settings.templateKey)) {
    missing.push("Sun Pool is forbidden");
  }
  if (settings.audience !== "qa") {
    missing.push("QA client/template only");
  }
  return unique(missing);
}

export function buildPaidFunnelReadiness(
  rawPackage: unknown,
  rawSettings: unknown
): PaidFunnelReadiness {
  const parsedPackage = parsePaidFunnelPackage(rawPackage);
  if (!parsedPackage.success) {
    return failClosedInvalidPackage(
      parsedPackage.error.issues.map(issue => {
        const path = issue.path.map(segment => String(segment)).join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      })
    );
  }

  const parsedSettings = parsePaidFunnelPublishSettings(rawSettings);
  if (!parsedSettings.success) {
    return failClosedInvalidPackage(
      parsedSettings.error.issues.map(issue => {
        const path = issue.path.map(segment => String(segment)).join(".");
        return path
          ? `settings.${path}: ${issue.message}`
          : `settings: ${issue.message}`;
      })
    );
  }

  const pkg = parsedPackage.data;
  const settings = parsedSettings.data;
  const sections = [
    section("package", checkPackage(pkg, settings)),
    section("steps", checkSteps(pkg, settings)),
    section("formMapping", checkFormMapping(pkg)),
    section("navigation", checkNavigation(pkg, settings)),
    section("integration", checkIntegration(pkg, settings)),
    section("tracking", checkTracking(pkg, settings)),
    section("secrets", checkSecrets(pkg, settings)),
    section("build", checkBuild(pkg)),
    section("adapter", checkAdapter(pkg, settings)),
  ];
  return {
    sections,
    configurationReady: sections.every(item => item.ready),
  };
}

export function paidFunnelReadinessIssues(
  readiness: PaidFunnelReadiness
): string[] {
  return readiness.sections.flatMap(item =>
    item.missing.map(message => `${item.label}: ${message}`)
  );
}
