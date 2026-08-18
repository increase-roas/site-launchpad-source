type BootConfigurationErrorProps = {
  message: string;
};

export default function BootConfigurationError({
  message,
}: BootConfigurationErrorProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-8 bg-background text-foreground">
      <div className="flex flex-col items-center w-full max-w-xl p-8 text-center">
        <h1 className="text-xl font-semibold mb-4">Site Launchpad cannot start</h1>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <p className="text-sm text-muted-foreground">
          A required public environment variable is missing from this deployment.
        </p>
      </div>
    </div>
  );
}
