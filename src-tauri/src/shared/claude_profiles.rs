//! Claude command profile resolver.
//!
//! A Claude command profile is a named pointer to a `claude` CLI binary
//! (typically a user-maintained wrapper script that talks to an OpenAI /
//! Anthropic-compatible endpoint). The user may keep several of these and
//! switch between them at runtime.
//!
//! Resolution order, from highest priority to lowest:
//!
//! 1. `workspace_override_id` — a per-workspace pinned profile.
//! 2. `AppSettings::claude_active_profile_id` — the globally selected profile.
//! 3. `None` — fall back to PATH lookup inside `ClaudeSession::build_command`.

use crate::types::AppSettings;

/// Resolve the effective `bin_path` for a Claude session.
///
/// Returns `None` when no profile is selected or the referenced profile does
/// not exist. The caller is expected to treat `None` as "use the legacy
/// PATH / npm-global lookup".
pub(crate) fn resolve_claude_bin_path(
    settings: &AppSettings,
    workspace_override_id: Option<&str>,
) -> Option<String> {
    if let Some(id) = workspace_override_id {
        match settings.claude_profiles.iter().find(|p| p.id == id) {
            Some(profile) => return Some(profile.bin_path.clone()),
            None => log::warn!(
                "[claude_profiles] workspace override profile id {:?} not found; falling back to global",
                id
            ),
        }
    }
    if let Some(id) = settings.claude_active_profile_id.as_deref() {
        match settings.claude_profiles.iter().find(|p| p.id == id) {
            Some(profile) => return Some(profile.bin_path.clone()),
            None => log::warn!(
                "[claude_profiles] active profile id {:?} not found; falling back to PATH lookup",
                id
            ),
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ClaudeCommandProfile;

    fn profile(id: &str, bin: &str) -> ClaudeCommandProfile {
        ClaudeCommandProfile {
            id: id.to_string(),
            name: id.to_string(),
            bin_path: bin.to_string(),
        }
    }

    #[test]
    fn returns_none_when_no_profiles() {
        let settings = AppSettings::default();
        assert!(resolve_claude_bin_path(&settings, None).is_none());
    }

    #[test]
    fn returns_active_profile_bin_path() {
        let mut settings = AppSettings::default();
        settings.claude_profiles = vec![profile("a", "/bin/a"), profile("b", "/bin/b")];
        settings.claude_active_profile_id = Some("b".to_string());
        assert_eq!(
            resolve_claude_bin_path(&settings, None).as_deref(),
            Some("/bin/b")
        );
    }

    #[test]
    fn workspace_override_wins_over_active() {
        let mut settings = AppSettings::default();
        settings.claude_profiles = vec![profile("a", "/bin/a"), profile("b", "/bin/b")];
        settings.claude_active_profile_id = Some("a".to_string());
        assert_eq!(
            resolve_claude_bin_path(&settings, Some("b")).as_deref(),
            Some("/bin/b")
        );
    }

    #[test]
    fn missing_workspace_override_falls_back_to_active() {
        let mut settings = AppSettings::default();
        settings.claude_profiles = vec![profile("a", "/bin/a")];
        settings.claude_active_profile_id = Some("a".to_string());
        assert_eq!(
            resolve_claude_bin_path(&settings, Some("ghost")).as_deref(),
            Some("/bin/a")
        );
    }

    #[test]
    fn missing_active_profile_returns_none() {
        let mut settings = AppSettings::default();
        settings.claude_profiles = vec![profile("a", "/bin/a")];
        settings.claude_active_profile_id = Some("ghost".to_string());
        assert!(resolve_claude_bin_path(&settings, None).is_none());
    }
}
