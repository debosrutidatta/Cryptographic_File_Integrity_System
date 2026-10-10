import os
import shutil
import sqlite3
from database import init_db, get_db_connection, create_admin_user, admin_exists, DB_PATH
from scanner import scan_target
from comparator import compare_scans

def run_comprehensive_integration_test():
    print("=" * 75)
    print("COMPREHENSIVE FIM INTEGRATION TEST (All 6 States + DB Persistence)")
    print("=" * 75)

    # 1. Clean up old database and test workspace
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    test_workspace = os.path.abspath("temp_comprehensive_workspace")
    if os.path.exists(test_workspace):
        shutil.rmtree(test_workspace)
    
    archive_dir = os.path.join(test_workspace, "archive")
    os.makedirs(archive_dir, exist_ok=True)

    try:
        # Initialize database
        init_db()

        # Dynamic Admin Check (Ensures no hardcoded assumption in app flow)
        if not admin_exists():
            # In a real app, this would prompt the user or run via secure CLI setup
            create_admin_user("secure_admin_user", "DynamicStrongP@ss2026!")
            print("[INFO] No admin found on startup. Dynamically provisioned first admin account.")

        conn = get_db_connection()
        cursor = conn.cursor()

        # 2. Setup Baseline Files
        f_safe = os.path.join(test_workspace, "settings.json")      # Will remain Safe
        f_mod = os.path.join(test_workspace, "config.ini")       # Will be Modified
        f_del = os.path.join(test_workspace, "temp_data.log")    # Will be Deleted
        f_move = os.path.join(test_workspace, "report.pdf")      # Will be Renamed/Moved
        f_copy = os.path.join(test_workspace, "notes.txt")       # Will be Copied/Duplicate

        with open(f_safe, "w", encoding="utf-8") as f: f.write("theme=dark")
        with open(f_mod, "w", encoding="utf-8") as f: f.write("timeout=30")
        with open(f_del, "w", encoding="utf-8") as f: f.write("temporary buffer")
        with open(f_move, "w", encoding="utf-8") as f: f.write("Q1 Financials")
        with open(f_copy, "w", encoding="utf-8") as f: f.write("Meeting notes")

        print("\n[1] Baseline files initialized.")

        # Register Target in DB
        cursor.execute(
            "INSERT INTO monitored_targets (target_path, is_directory, added_by) VALUES (?, ?, ?)",
            (test_workspace, 1, 1)
        )
        target_id = cursor.lastrowid
        conn.commit()

        # Capture Baseline Scan & Store
        baseline_hashes = scan_target(test_workspace, use_relative_paths=False)
        for path, file_hash in baseline_hashes.items():
            cursor.execute("""
                INSERT INTO file_baselines (target_id, file_name, file_path, file_size, sha256_hash)
                VALUES (?, ?, ?, ?, ?)
            """, (target_id, os.path.basename(path), path, os.path.getsize(path), file_hash))
        conn.commit()
        print(f"  -> Stored {len(baseline_hashes)} baseline records in database.")

        # 3. Execute Mutations to Trigger ALL 6 States
        # State 1: Safe -> f_safe left untouched
        # State 2: Modified -> change content of f_mod
        with open(f_mod, "w", encoding="utf-8") as f: f.write("timeout=999 (Modified)")

        # State 3: Deleted -> remove f_del
        os.remove(f_del)

        # State 4: New -> create a brand new file
        f_new = os.path.join(test_workspace, "malicious_script.sh")
        with open(f_new, "w", encoding="utf-8") as f: f.write("echo 'hack'")

        # State 5: Renamed_Moved -> move f_move into archive/
        f_moved_dest = os.path.join(archive_dir, "report_v2.pdf")
        shutil.move(f_move, f_moved_dest)

        # State 6: Copied_Duplicate -> copy f_copy to a new location
        f_copied_dest = os.path.join(archive_dir, "notes_backup.txt")
        shutil.copy2(f_copy, f_copied_dest)

        print("\n[2] Executed mutations across all 6 test vectors (Safe, Modified, Deleted, New, Moved, Copied).")

        # 4. Run Live Scan & Comparator
        live_hashes = scan_target(test_workspace, use_relative_paths=False)
        
        cursor.execute("SELECT file_path, sha256_hash FROM file_baselines WHERE target_id = ?", (target_id,))
        db_baselines = {row["file_path"]: row["sha256_hash"] for row in cursor.fetchall()}

        report = compare_scans(db_baselines, live_hashes)
        
        print("\n[3] Comparator Report Verification:")
        for status, entries in report.items():
            print(f"    -> [{status}]: {len(entries)} detected")

        # 5. Persist Scan History and Results to Database
        cursor.execute("INSERT INTO scan_history (triggered_by, total_files) VALUES (?, ?)", (1, len(live_hashes)))
        scan_id = cursor.lastrowid

        for status, entries in report.items():
            for entry in entries:
                if status in ["Renamed_Moved", "Copied_Duplicate"]:
                    current_path = entry.get("to") or entry.get("new_copy")
                    old_path = entry.get("from") or entry.get("original_source")
                    cursor.execute("""
                        INSERT INTO scan_results (scan_id, file_path, old_path, status, current_hash)
                        VALUES (?, ?, ?, ?, ?)
                    """, (scan_id, current_path, old_path, status, live_hashes.get(current_path)))
                else:
                    file_path = entry
                    curr_hash = live_hashes.get(file_path) if status != "Deleted" else None
                    cursor.execute("""
                        INSERT INTO scan_results (scan_id, file_path, status, current_hash)
                        VALUES (?, ?, ?, ?)
                    """, (scan_id, file_path, status, curr_hash))
        conn.commit()

        # 6. Query and Assert All States Exist in SQLite
        print("\n[4] Querying Database Scan Results Table:")
        cursor.execute("SELECT file_path, status, old_path FROM scan_results WHERE scan_id = ?", (scan_id,))
        stored_results = cursor.fetchall()

        found_statuses = set()
        for row in stored_results:
            found_statuses.add(row["status"])
            print(f"    - Status: {row['status']:<18} | Path: {os.path.basename(row['file_path'])} {f'(From: {os.path.basename(row["old_path"])})' if row['old_path'] else ''}")

        expected_statuses = {"Safe", "Modified", "Deleted", "New", "Renamed_Moved", "Copied_Duplicate"}
        assert expected_statuses.issubset(found_statuses), f"Missing states in DB! Found: {found_statuses}"

        print("\n" + "=" * 75)
        print("ALL 6 INTEGRITY STATES VERIFIED AND PERSISTED SUCCESSFULLY!")
        print("=" * 75)
        conn.close()

    finally:
        if os.path.exists(test_workspace):
            shutil.rmtree(test_workspace)

if __name__ == "__main__":
    run_comprehensive_integration_test()