use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub database_path: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_path: None,
        }
    }
}

impl AppConfig {
    /// Get the config file path (always in the default app data location)
    pub fn config_path() -> PathBuf {
        Self::default_data_dir().join("config.json")
    }

    /// Get the default data directory
    pub fn default_data_dir() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("tally")
    }

    /// Get the default database path
    pub fn default_db_path() -> PathBuf {
        Self::default_data_dir().join("data.db")
    }

    /// Load config from disk, or return default if not found
    pub fn load() -> Self {
        let config_path = Self::config_path();

        if config_path.exists() {
            if let Ok(contents) = std::fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str(&contents) {
                    return config;
                }
            }
        }

        Self::default()
    }

    /// Save config to disk
    pub fn save(&self) -> std::io::Result<()> {
        let config_path = Self::config_path();

        // Ensure directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let contents = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(&config_path, contents)
    }

    /// Get the effective database path (custom or default)
    pub fn get_db_path(&self) -> PathBuf {
        match &self.database_path {
            Some(path) if !path.is_empty() => PathBuf::from(path),
            _ => Self::default_db_path(),
        }
    }

    /// Set custom database path (None or empty string resets to default)
    pub fn set_db_path(&mut self, path: Option<String>) {
        self.database_path = path.filter(|p| !p.is_empty());
    }
}
