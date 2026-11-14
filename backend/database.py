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

    # 1. Users Table
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
            is_directory BOOLEAN NOT NULL,
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
            old_path TEXT NULL,
            status TEXT NOT NULL,
            current_hash TEXT NULL,
            FOREIGN KEY (scan_id) REFERENCES scan_history(id) ON DELETE CASCADE
        )
    """)

    # 6. Security Logs Table (Tracks failed logins & unauthorized access attempts)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS security_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            details TEXT NOT NULL,
            ip_address TEXT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- PERFORMANCE INDEXES ---
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


# --- TARGET MANAGEMENT HELPERS ---

def add_monitored_target(target_path, is_directory, added_by):
    """Registers a new file or directory target for file integrity monitoring."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO monitored_targets (target_path, is_directory, added_by) VALUES (?, ?, ?)",
            (target_path, is_directory, added_by)
        )
        conn.commit()
        target_id = cursor.lastrowid
        return True, target_id, "Target registered successfully."
    except sqlite3.IntegrityError:
        return False, None, "Target path already exists."
    finally:
        conn.close()

def get_all_monitored_targets():
    """Retrieves all registered monitored targets."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM monitored_targets;")
    targets = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return targets

def delete_monitored_target(target_id):
    """Deletes a monitored target and cascades deletion of its baselines."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM monitored_targets WHERE id = ?", (target_id,))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0


# --- BASELINE & SCAN PERSISTENCE HELPERS ---

def save_baselines_for_target(target_id, scan_dict):
    """Saves or updates baseline SHA-256 hashes for a specific target using INSERT OR REPLACE to prevent conflicts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for file_path, file_hash in scan_dict.items():
            file_name = os.path.basename(file_path)
            try:
                file_size = os.path.getsize(file_path)
            except OSError:
                file_size = 0
            cursor.execute(
                """INSERT OR REPLACE INTO file_baselines (target_id, file_name, file_path, file_size, sha256_hash)
                   VALUES (?, ?, ?, ?, ?)""",
                (target_id, file_name, file_path, file_size, file_hash)
            )
        conn.commit()
        return True, "Baselines established successfully."
    except Exception as exc:
        conn.rollback()
        return False, str(exc)
    finally:
        conn.close()

def get_baseline_dict_for_target(target_id):
    """Fetches a dictionary of file paths and their baseline hashes for a given target."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT file_path, sha256_hash FROM file_baselines WHERE target_id = ?", (target_id,))
    rows = cursor.fetchall()
    conn.close()
    return {row["file_path"]: row["sha256_hash"] for row in rows}

def get_all_baselines_dict():
    """Fetches a dictionary of all file paths and baseline hashes across all targets."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT file_path, sha256_hash FROM file_baselines;")
    rows = cursor.fetchall()
    conn.close()
    return {row["file_path"]: row["sha256_hash"] for row in rows}

def record_scan_history(triggered_by, total_files):
    """Records a new scan event in scan history and returns the generated scan ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO scan_history (triggered_by, total_files) VALUES (?, ?)",
        (triggered_by, total_files)
    )
    conn.commit()
    scan_id = cursor.lastrowid
    conn.close()
    return scan_id

def save_scan_results(scan_id, comparison_results):
    """Saves categorized file integrity check results into scan_results."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for status, items in comparison_results.items():
            for item in items:
                if status in ["Safe", "Modified", "Deleted", "New"]:
                    cursor.execute(
                        "INSERT INTO scan_results (scan_id, file_path, old_path, status) VALUES (?, ?, NULL, ?)",
                        (scan_id, item, status)
                    )
                elif status == "Renamed_Moved":
                    cursor.execute(
                        "INSERT INTO scan_results (scan_id, file_path, old_path, status) VALUES (?, ?, ?, ?)",
                        (scan_id, item["to"], item["from"], status)
                    )
                elif status == "Copied_Duplicate":
                    cursor.execute(
                        "INSERT INTO scan_results (scan_id, file_path, old_path, status) VALUES (?, ?, ?, ?)",
                        (scan_id, item["new_copy"], item["original_source"], status)
                    )
        conn.commit()
        return True
    except Exception as exc:
        conn.rollback()
        print(f"[ERROR] Failed to save scan results: {exc}")
        return False
    finally:
        conn.close()


# --- REPORTING & LOGGING HELPERS ---

def get_scan_reports():
    """Retrieves all historical scan summaries for dashboard reporting."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sh.id, sh.scan_timestamp, sh.total_files, u.username as triggered_by_user
        FROM scan_history sh
        LEFT JOIN users u ON sh.triggered_by = u.id
        ORDER BY sh.scan_timestamp DESC;
    """)
    scans = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return scans

def get_scan_details_by_id(scan_id):
    """Retrieves all file integrity findings associated with a specific scan ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scan_results WHERE scan_id = ?", (scan_id,))
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results

def log_security_event(event_type, details, ip_address=None):
    """Records security-relevant events into the security logs table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO security_logs (event_type, details, ip_address) VALUES (?, ?, ?)",
        (event_type, details, ip_address)
    )
    conn.commit()
    conn.close()

def get_security_logs():
    """Retrieves all security audit logs."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM security_logs ORDER BY timestamp DESC;")
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs


if __name__ == "__main__":
    init_db()
    print("SQLite Database initialized successfully.")