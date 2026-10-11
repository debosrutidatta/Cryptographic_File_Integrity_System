import os
import shutil
from database import (
    init_db, 
    create_admin_user, 
    admin_exists, 
    DB_PATH,
    add_monitored_target,
    save_baselines_for_target,
    get_baseline_dict_for_target,
    record_scan_history,
    save_scan_results,
    get_scan_details_by_id,
    log_security_event,
    get_security_logs
)
from scanner import scan_target
from comparator import compare_scans

def run_comprehensive_integration_test():
    print("=" * 75)
    print("COMPREHENSIVE FIM INTEGRATION TEST (Helper Functions & All 6 States)")
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
        # Initialize database schema
        init_db()

        # Provision Admin User via Helper
        if not admin_exists():
            create_admin_user("secure_admin_user", "DynamicStrongP@ss2026!")
            print("[INFO] Dynamically provisioned first admin account.")

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

        # Register Target via Helper Function
        success, target_id, msg = add_monitored_target(test_workspace, is_directory=True, added_by=1)
        assert success, f"Failed to add target: {msg}"
        print(f"  -> Target registered successfully with ID: {target_id}")

        # Capture Baseline Scan & Store via Helper Function
        baseline_hashes = scan_target(test_workspace, use_relative_paths=False)
        save_success, save_msg = save_baselines_for_target(target_id, baseline_hashes)
        assert save_success, f"Failed to save baselines: {save_msg}"
        print(f"  -> Stored {len(baseline_hashes)} baseline records via helper function.")

        # 3. Execute Mutations to Trigger ALL 6 States
        with open(f_mod, "w", encoding="utf-8") as f: f.write("timeout=999 (Modified)")
        os.remove(f_del)
        f_new = os.path.join(test_workspace, "malicious_script.sh")
        with open(f_new, "w", encoding="utf-8") as f: f.write("echo 'hack'")
        f_moved_dest = os.path.join(archive_dir, "report_v2.pdf")
        shutil.move(f_move, f_moved_dest)
        f_copied_dest = os.path.join(archive_dir, "notes_backup.txt")
        shutil.copy2(f_copy, f_copied_dest)

        print("\n[2] Executed mutations across all 6 test vectors.")

        # 4. Run Live Scan & Comparator
        live_hashes = scan_target(test_workspace, use_relative_paths=False)
        db_baselines = get_baseline_dict_for_target(target_id)
        report = compare_scans(db_baselines, live_hashes)
        
        print("\n[3] Comparator Report Verification:")
        for status, entries in report.items():
            print(f"    -> [{status}]: {len(entries)} detected")

        # 5. Persist Scan History and Results via Helper Functions
        scan_id = record_scan_history(triggered_by=1, total_files=len(live_hashes))
        results_saved = save_scan_results(scan_id, report)
        assert results_saved, "Failed to save scan results!"

        # Test Security Logging Helper
        log_security_event("Scan Executed", f"Integrity scan completed with ID {scan_id}", "127.0.0.1")

        # 6. Query and Assert All States Exist in SQLite
        print("\n[4] Querying Database Scan Results Table via Helpers:")
        stored_results = get_scan_details_by_id(scan_id)

        found_statuses = set()
        for row in stored_results:
            found_statuses.add(row["status"])
            print(f"    - Status: {row['status']:<18} | Path: {os.path.basename(row['file_path'])}")

        expected_statuses = {"Safe", "Modified", "Deleted", "New", "Renamed_Moved", "Copied_Duplicate"}
        assert expected_statuses.issubset(found_statuses), f"Missing states in DB! Found: {found_statuses}"

        # Verify security logs helper output
        logs = get_security_logs()
        assert len(logs) > 0, "Security logs failed to record!"
        print(f"  -> Verified Security Log Entry: {logs[0]['event_type']}")

        print("\n" + "=" * 75)
        print("ALL NEW HELPER FUNCTIONS & 6 INTEGRITY STATES VERIFIED SUCCESSFULLY!")
        print("=" * 75)

    finally:
        if os.path.exists(test_workspace):
            shutil.rmtree(test_workspace)

if __name__ == "__main__":
    run_comprehensive_integration_test()