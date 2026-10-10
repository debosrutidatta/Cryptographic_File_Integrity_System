import os
import sqlite3
from database import (
    init_db, 
    get_db_connection, 
    create_admin_user, 
    verify_admin_credentials, 
    DB_PATH
)

def run_database_tests():
    print("=" * 65)
    print("DATABASE PERSISTENCE LAYER TEST SUITE")
    print("=" * 65)

    # 1. Clean up old test db if it exists to start from a pristine state
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("[INFO] Removed existing test database for a clean verification run.")

    # 2. Test Initialization & Schema Creation
    print("\n[TEST 1] Initializing Database Schema...")
    init_db()
    assert os.path.exists(DB_PATH), "Database file was not created!"
    print("  -> SUCCESS: Database file and tables initialized.")

    # 3. Test Admin User Creation
    print("\n[TEST 2] Creating Admin User...")
    success, msg = create_admin_user("admin", "SecureSystemPassword123!")
    assert success, f"Failed to create admin user: {msg}"
    print(f"  -> SUCCESS: {msg}")

    # 4. Test Duplicate Username Constraint
    print("\n[TEST 3] Testing Duplicate Username Prevention...")
    success_dup, msg_dup = create_admin_user("admin", "AnotherPassword456!")
    assert not success_dup, "Duplicate username allowed incorrectly!"
    print(f"  -> SUCCESS: Handled duplicate username properly -> {msg_dup}")

    # 5. Test Credential Verification (Valid Login)
    print("\n[TEST 4] Verifying Correct Admin Credentials...")
    is_valid, user_id = verify_admin_credentials("admin", "SecureSystemPassword123!")
    assert is_valid, "Valid credentials failed verification!"
    assert user_id is not None, "User ID returned as None for valid login!"
    print(f"  -> SUCCESS: Credentials verified successfully. Admin User ID: {user_id}")

    # 6. Test Credential Verification (Incorrect Password)
    print("\n[TEST 5] Verifying Incorrect Password...")
    is_valid_fail, _ = verify_admin_credentials("admin", "WrongPassword!")
    assert not is_valid_fail, "Incorrect password was accepted by the system!"
    print("  -> SUCCESS: Incorrect password correctly rejected.")

    # 7. Test Credential Verification (Non-existent User)
    print("\n[TEST 6] Verifying Non-existent User Account...")
    is_valid_ghost, _ = verify_admin_credentials("ghost_admin", "SecureSystemPassword123!")
    assert not is_valid_ghost, "Non-existent user accepted!"
    print("  -> SUCCESS: Non-existent user correctly rejected.")

    # 8. Test PRAGMA Settings & Foreign Keys
    print("\n[TEST 7] Verifying SQLite Configurations...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check foreign keys enforcement
    cursor.execute("PRAGMA foreign_keys;")
    fk_status = cursor.fetchone()[0]
    assert fk_status == 1, "Foreign keys are not strictly enforced!"

    # Check journal mode (WAL)
    cursor.execute("PRAGMA journal_mode;")
    journal_mode = cursor.fetchone()[0].lower()
    assert journal_mode == "wal", f"Journal mode is not WAL (got {journal_mode})"

    conn.close()
    print(f"  -> SUCCESS: PRAGMA configurations active (Foreign Keys: ON, Journal Mode: WAL).")

    print("\n" + "=" * 65)
    print("ALL DATABASE TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_database_tests()