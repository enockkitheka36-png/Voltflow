import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createVoltflowPlatform } from "./createPlatform.js";

const PlatformContext = createContext(null);

function bootstrapPlatform() {
  try {
    const built = createVoltflowPlatform({ env: import.meta.env || {} });
    return { ...built, error: null };
  } catch (error) {
    return { config: { mode: "configuration-error" }, platform: null, client: null, error };
  }
}

export function VoltflowPlatformProvider({ children }) {
  const [bootstrap] = useState(bootstrapPlatform);
  const [session, setSession] = useState(null);
  const [authorization, setAuthorization] = useState(null);
  const [activeMembershipId, setActiveMembershipId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(bootstrap.error);

  const refreshAuthorization = useCallback(async () => {
    if (!bootstrap.platform) return null;
    try {
      const nextSession = await bootstrap.platform.auth.getSession();
      setSession(nextSession);
      if (!nextSession && bootstrap.platform.authRequired) {
        setAuthorization(null);
        setActiveMembershipId(null);
        return null;
      }
      const nextAuthorization = await bootstrap.platform.auth.getAuthorizationContext();
      setAuthorization(nextAuthorization);
      setActiveMembershipId((current) => {
        if (nextAuthorization.memberships?.some((membership) => membership.id === current)) return current;
        return nextAuthorization.memberships?.[0]?.id || null;
      });
      setError(null);
      return nextAuthorization;
    } catch (nextError) {
      setError(nextError);
      if (bootstrap.platform.authRequired) setAuthorization(null);
      return null;
    }
  }, [bootstrap.platform]);

  useEffect(() => {
    if (!bootstrap.platform) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    refreshAuthorization().finally(() => { if (active) setLoading(false); });
    return bootstrap.platform.auth.subscribe((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      refreshAuthorization();
    });
  }, [bootstrap.platform, refreshAuthorization]);

  const activeMembership = useMemo(() => (
    authorization?.memberships?.find((membership) => membership.id === activeMembershipId)
    || authorization?.memberships?.[0]
    || null
  ), [authorization, activeMembershipId]);

  const signIn = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const result = await bootstrap.platform.auth.signIn(credentials);
      if (!result?.otpSent) await refreshAuthorization();
      setError(null);
      return result;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [bootstrap.platform, refreshAuthorization]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await bootstrap.platform.auth.signOut();
      setSession(null);
      setAuthorization(null);
      setActiveMembershipId(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [bootstrap.platform]);

  const value = useMemo(() => ({
    config: bootstrap.config,
    platform: bootstrap.platform,
    mode: bootstrap.config?.mode || "configuration-error",
    cloudEnabled: !!bootstrap.platform?.cloudEnabled,
    authRequired: !!bootstrap.platform?.authRequired,
    session,
    authorization,
    activeMembership,
    loading,
    error,
    signIn,
    signOut,
    refreshAuthorization,
    selectOrganisation: setActiveMembershipId,
  }), [bootstrap, session, authorization, activeMembership, loading, error, signIn, signOut, refreshAuthorization]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function useVoltflowPlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("useVoltflowPlatform must be used inside VoltflowPlatformProvider.");
  return context;
}
