use crate::error::{AppError, Result};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use rusqlite::Connection;
use std::path::PathBuf;

pub struct Database {
    conn: Option<Connection>,
    db_path: PathBuf,
}

impl Database {
    pub fn new() -> Self {
        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("money");

        std::fs::create_dir_all(&data_dir).ok();

        Self {
            conn: None,
            db_path: data_dir.join("data.db"),
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.conn.is_some()
    }

    pub fn unlock(&mut self, password: &str) -> Result<bool> {
        let key = derive_key(password);

        let conn = Connection::open(&self.db_path)?;

        // Set SQLCipher encryption key
        conn.pragma_update(None, "key", &key)?;

        // Verify the database is accessible
        match conn.pragma_query_value(None, "schema_version", |_| Ok(())) {
            Ok(_) => {
                // Run migrations if this is a new database
                self.run_migrations(&conn)?;
                self.conn = Some(conn);
                Ok(true)
            }
            Err(_) => {
                Ok(false)
            }
        }
    }

    pub fn change_password(&mut self, current_password: &str, new_password: &str) -> Result<bool> {
        if !self.is_unlocked() {
            return Err(AppError::NotUnlocked);
        }

        // Derive new key
        let _current_key = derive_key(current_password);
        let new_key = derive_key(new_password);

        if let Some(ref conn) = self.conn {
            // Rekey the database
            conn.pragma_update(None, "rekey", &new_key)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn get_connection(&self) -> Result<&Connection> {
        self.conn.as_ref().ok_or(AppError::NotUnlocked)
    }

    fn run_migrations(&self, conn: &Connection) -> Result<()> {
        // Create tables if they don't exist
        conn.execute_batch(include_str!("../../migrations/001_initial_schema.sql"))?;

        // Seed default categories
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM categories",
            [],
            |row| row.get(0),
        )?;

        if count == 0 {
            conn.execute_batch(include_str!("../../migrations/002_seed_categories.sql"))?;
        }

        Ok(())
    }
}

fn derive_key(password: &str) -> String {
    // Use a fixed salt for SQLCipher (the actual key derivation happens in SQLCipher)
    // This is just to normalize the password into a hex key
    let salt = SaltString::from_b64("bW9uZXlhcHBzYWx0").unwrap();
    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .unwrap();

    // Extract the hash portion and convert to hex for SQLCipher
    let hash_str = hash.hash.unwrap().to_string();
    format!("x'{}'", hex::encode(hash_str.as_bytes()))
}

// For hex encoding
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}
