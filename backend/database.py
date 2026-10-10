import os
import sqlite3
import bcrypt

# Database file stored locally inside the backend directory
DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

def get_db_connection():
    """
    Creates a SQLite connection with Write-Ahead Logging (WAL) mode,
    row factory enabled, and foreign key constraints strictly enforced.
    """
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high-concurrency read/write operations (e.g., dashboard querying during scans)
    conn.execute("PRAGMA journal_mode = WAL;")
    # Enforce relational integrity constraints
    conn.execute("PRAGMA foreign_keys = ON;")
    # Optimize synchronous writing for better performance without sacrificing safety
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def init_db():
    """
    Initializes the SQLite database schema, creating all required tables
    for authentication, target monitoring, baselines, scan history, results, and security logs.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table (Single-Admin Model - no role column required)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Monitored Targets Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS monitored_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_path TEXT UNIQUE NOT NULL,
            is_directory BOOLEAN NOT NULL, -- 1 for directory, 0 for single file
            added_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # 3. File Baselines Table (The Source of Truth)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS file_baselines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT UNIQUE NOT NULL,
            file_size INTEGER NOT NULL,
            sha256_hash TEXT NOT NULL,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (target_id) REFERENCES monitored_targets(id) ON DELETE CASCADE
        )
    """)

    # 4. Scan History Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            triggered_by INTEGER,
            total_files INTEGER NOT NULL,
            FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # 5. Scan Results Table (Stores the 6 integrity classification states)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            old_path TEXT NULL,            -- Populated for Renamed/Moved files
            status TEXT NOT NULL,          -- Safe, Modified, Deleted, New, Renamed_Moved, Copied_Duplicate
            current_hash TEXT NULL,
            FOREIGN KEY (scan_id) REFERENCES scan_history(id) ON DELETE CASCADE
        )
    """)

    # 6. Security Logs Table (Tracks failed logins & unauthorized access attempts)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS security_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,      -- e.g., "Failed Login", "Unauthorized Access"
            details TEXT NOT NULL,
            ip_address TEXT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- PERFORMANCE INDEXES ---
    # Optimized for fast querying by the React dashboard API layer
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_baselines_target ON file_baselines(target_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_results_scan ON scan_results(scan_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON security_logs(timestamp);")

    conn.commit()
    conn.close()


# --- AUTHENTICATION HELPERS ---

def admin_exists():
    """Checks if any admin user has been registered in the system."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users;")
    count = cursor.fetchone()[0]
    conn.close()
    return count > 0

def create_admin_user(username, password):
    """Creates the default administrator account with a secure bcrypt password hash."""
    conn = get_db_connection()
    cursor = conn.cursor()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        conn.commit()
        return True, "Admin user created successfully."
    except sqlite3.IntegrityError:
        return False, "Username already exists."
    finally:
        conn.close()

def verify_admin_credentials(username, password):
    """Verifies admin login credentials against the stored bcrypt hash."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return True, user['id']
    return False, None


if __name__ == "__main__":
    init_db()
    print("SQLite Database initialized successfully.")