import { useState } from "react";
import type {
  AppSettings,
  ClaudeCommandProfile,
  WorkspaceInfo,
  WorkspaceSettings,
} from "@/types";

type ClaudeSectionProps = {
  active: boolean;
  t: (key: string) => string;
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  projects: WorkspaceInfo[];
  onUpdateWorkspaceSettings: (
    id: string,
    settings: Partial<WorkspaceSettings>,
  ) => Promise<void>;
};

function generateProfileId(existing: ClaudeCommandProfile[]): string {
  const base = `profile-${Date.now().toString(36)}`;
  if (!existing.some((p) => p.id === base)) return base;
  let suffix = 1;
  while (existing.some((p) => p.id === `${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export function ClaudeSection({
  active,
  t,
  appSettings,
  onUpdateAppSettings,
  projects,
  onUpdateWorkspaceSettings,
}: ClaudeSectionProps) {
  const [addingError, setAddingError] = useState<string | null>(null);

  if (!active) {
    return null;
  }

  const profiles = appSettings.claudeProfiles ?? [];
  const activeProfileId = appSettings.claudeActiveProfileId ?? null;

  async function persistProfiles(next: ClaudeCommandProfile[]) {
    await onUpdateAppSettings({ ...appSettings, claudeProfiles: next });
  }

  async function handleAddProfile() {
    setAddingError(null);
    const newProfile: ClaudeCommandProfile = {
      id: generateProfileId(profiles),
      name: t("settings.claudeProfileDefaultName"),
      binPath: "",
    };
    try {
      await persistProfiles([...profiles, newProfile]);
    } catch (err) {
      setAddingError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleUpdateProfile(
    id: string,
    patch: Partial<ClaudeCommandProfile>,
  ) {
    const next = profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));
    await persistProfiles(next);
  }

  async function handleDeleteProfile(id: string) {
    const next = profiles.filter((p) => p.id !== id);
    const clearedActive = activeProfileId === id;
    await onUpdateAppSettings({
      ...appSettings,
      claudeProfiles: next,
      claudeActiveProfileId: clearedActive ? null : activeProfileId,
    });
    if (clearedActive) {
      // Clear workspace overrides pointing at the deleted profile.
      for (const workspace of projects) {
        if (workspace.settings.claudeProfileOverrideId === id) {
          await onUpdateWorkspaceSettings(workspace.id, {
            claudeProfileOverrideId: null,
          });
        }
      }
    }
  }

  async function handleSetActive(id: string | null) {
    await onUpdateAppSettings({ ...appSettings, claudeActiveProfileId: id });
  }

  return (
    <section className="settings-section">
      <div className="settings-section-title">{t("settings.claudeTitle")}</div>
      <div className="settings-section-subtitle">
        {t("settings.claudeDescription")}
      </div>

      <div className="settings-field">
        <div className="settings-field-label">
          {t("settings.claudeProfilesLabel")}
        </div>
        <div className="settings-help">
          {t("settings.claudeProfilesHelp")}
        </div>
        {addingError && (
          <div className="settings-agents-error">{addingError}</div>
        )}

        <div className="settings-overrides">
          {profiles.length === 0 && (
            <div className="settings-empty">
              {t("settings.claudeProfilesEmpty")}
            </div>
          )}
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            return (
              <div key={profile.id} className="settings-override-row">
                <div className="settings-override-info">
                  <label className="settings-claude-profile-default">
                    <input
                      type="radio"
                      name="claude-active-profile"
                      checked={isActive}
                      onChange={() => void handleSetActive(profile.id)}
                      aria-label={t("settings.claudeSetActive")}
                    />
                    {t("settings.claudeSetActive")}
                  </label>
                </div>
                <div className="settings-override-actions">
                  <div className="settings-override-field">
                    <input
                      className="settings-input settings-input--compact"
                      value={profile.name}
                      placeholder={t("settings.claudeProfileNamePlaceholder")}
                      onChange={(event) =>
                        void handleUpdateProfile(profile.id, {
                          name: event.target.value,
                        })
                      }
                      aria-label={`Claude profile name for ${profile.id}`}
                    />
                  </div>
                  <div className="settings-override-field">
                    <input
                      className="settings-input settings-input--compact"
                      value={profile.binPath}
                      placeholder={t(
                        "settings.claudeProfileBinPathPlaceholder",
                      )}
                      onChange={(event) =>
                        void handleUpdateProfile(profile.id, {
                          binPath: event.target.value,
                        })
                      }
                      aria-label={`Claude profile binPath for ${profile.id}`}
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void handleDeleteProfile(profile.id)}
                      aria-label={t("settings.claudeDeleteProfile")}
                    >
                      {t("settings.claudeDeleteProfile")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="settings-field-actions">
          <button
            type="button"
            className="primary"
            onClick={() => void handleAddProfile()}
          >
            {t("settings.claudeAddProfile")}
          </button>
          {activeProfileId != null && (
            <button
              type="button"
              className="ghost"
              onClick={() => void handleSetActive(null)}
            >
              {t("settings.claudeClearActive")}
            </button>
          )}
        </div>
      </div>

      <div className="settings-field">
        <div className="settings-field-label">
          {t("settings.claudeWorkspaceOverridesLabel")}
        </div>
        <div className="settings-help">
          {t("settings.claudeWorkspaceOverridesHelp")}
        </div>
        <div className="settings-overrides">
          {projects.length === 0 && (
            <div className="settings-empty">
              {t("settings.noProjectsYet")}
            </div>
          )}
          {projects.map((workspace) => {
            const override = workspace.settings.claudeProfileOverrideId ?? "";
            return (
              <div key={workspace.id} className="settings-override-row">
                <div className="settings-override-info">
                  <div className="settings-project-name">{workspace.name}</div>
                  <div className="settings-project-path">{workspace.path}</div>
                </div>
                <div className="settings-override-actions">
                  <div className="settings-override-field">
                    <select
                      className="settings-select settings-input--compact"
                      value={override}
                      onChange={(event) => {
                        const value = event.target.value;
                        void onUpdateWorkspaceSettings(workspace.id, {
                          claudeProfileOverrideId:
                            value === "" ? null : value,
                        });
                      }}
                      aria-label={`Claude profile override for ${workspace.name}`}
                    >
                      <option value="">
                        {t("settings.claudeUseGlobalDefault")}
                      </option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name || profile.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
