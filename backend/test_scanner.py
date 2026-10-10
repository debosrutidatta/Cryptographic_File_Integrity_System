import os
import shutil
from scanner import scan_target
from comparator import compare_scans

if __name__ == "__main__":
    test_workspace = os.path.abspath("temp_integrity_workspace")

    try:
        # 1. Initialize clean test environment
        if os.path.exists(test_workspace):
            shutil.rmtree(test_workspace)
        os.makedirs(os.path.join(test_workspace, "records"), exist_ok=True)

        with open(os.path.join(test_workspace, "taxes.txt"), "w", encoding="utf-8") as f:
            f.write("FY2026 Financial Summary:Verified")
        with open(os.path.join(test_workspace, "credentials.conf"), "w", encoding="utf-8") as f:
            f.write("db_host=localhost\ndb_port=5432")
        with open(os.path.join(test_workspace, "diagram.png"), "w", encoding="utf-8") as f:
            f.write("PNG_BINARY_PAYLOAD_HEADER_89504E47")
        with open(os.path.join(test_workspace, "records", "archive_log.txt"), "w", encoding="utf-8") as f:
            f.write("System initialized successfully.")

        print("=" * 75)
        print("FILE SYSTEM SCANNER & INTEGRITY ENGINE VERIFICATION")
        print(f"Target Scope: {test_workspace}")
        print("=" * 75)

        # 2. Capture baseline state
        print("\n[1] Capturing Baseline Hashes:")
        baseline_state = scan_target(test_workspace, use_relative_paths=True)
        for path, digest in baseline_state.items():
            print(f"    {path:<30} | SHA-256: {digest[:16]}...{digest[-8:]}")

        # 3. Execute file system mutations across all 6 classification states
        with open(os.path.join(test_workspace, "credentials.conf"), "a", encoding="utf-8") as f:
            f.write("\nallow_remote_admin=true")

        os.remove(os.path.join(test_workspace, "records", "archive_log.txt"))

        shutil.move(
            os.path.join(test_workspace, "diagram.png"),
            os.path.join(test_workspace, "records", "architecture_v2.png")
        )

        shutil.copy2(
            os.path.join(test_workspace, "taxes.txt"),
            os.path.join(test_workspace, "taxes_backup.txt")
        )

        with open(os.path.join(test_workspace, "unrecognized_script.sh"), "w", encoding="utf-8") as f:
            f.write("#!/bin/bash\necho 'Unauthorized execution'")

        # 4. Capture post-mutation state and run comparison
        print("\n[2] Capturing Live Scan Hashes:")
        live_state = scan_target(test_workspace, use_relative_paths=True)
        for path, digest in live_state.items():
            print(f"    {path:<30} | SHA-256: {digest[:16]}...{digest[-8:]}")

        print("\n[3] Classification Report:")
        print("-" * 75)
        integrity_report = compare_scans(baseline_state, live_state)

        for status, entries in integrity_report.items():
            if entries:
                print(f"  [{status.upper()}]:")
                for entry in entries:
                    if status == "Renamed_Moved" and isinstance(entry, dict):
                        print(f"    -> Moved from '{entry['from']}' to '{entry['to']}'")
                    elif status == "Copied_Duplicate" and isinstance(entry, dict):
                        print(f"    -> '{entry['new_copy']}' duplicated from '{entry['original_source']}'")
                    else:
                        print(f"    -> {entry}")
        print("=" * 75)

    finally:
        # Clean up temporary test files automatically
        if os.path.exists(test_workspace):
            shutil.rmtree(test_workspace)