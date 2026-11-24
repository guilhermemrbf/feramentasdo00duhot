import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { OrganicLanding } from "@/components/landing/OrganicLanding";
import { BRAND_MARK, BRAND_NAME } from "@/lib/brand";
import { AccessStatusPanel } from "./AccessStatusPanel";
import { usePlatformAccess } from "./PlatformAccessProvider";

export function PublicBrand() {
  return (
    <Link to="/" className="launch-brand" aria-label={`${BRAND_NAME}, página inicial`}>
      <img src={BRAND_MARK} width={36} height={36} alt="" />
      <strong>{BRAND_NAME}</strong>
    </Link>
  );
}

export function LaunchPage() {
  const access = usePlatformAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (!access.isError && ["admin", "approved", "trial"].includes(access.status ?? "")) {
      void navigate({ to: "/painel", replace: true });
    }
  }, [access.status, access.isError, navigate]);

  if (access.user) {
    return (
      <div className="launch-site">
        <header className="launch-top launch-wrap launch-top-static">
          <PublicBrand />
        </header>
        <main className="access-standalone">
          <AccessStatusPanel />
        </main>
      </div>
    );
  }

  return <OrganicLanding />;
}
