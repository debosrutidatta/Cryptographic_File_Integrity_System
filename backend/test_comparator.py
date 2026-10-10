from comparator import compare_scans


def run_test_case(test_name, description, baseline, live_scan):
    print("=" * 70)
    print(f"TEST: {test_name}")
    print(f"Scenario: {description}")
    print("-" * 70)
    
    print("1. BEFORE (Baseline stored in Database):")
    for path, h in baseline.items():
        print(f"   {path:<32} | Hash: {h}")
        
    print("\n2. AFTER (Live Scan of Hard Drive):")
    for path, h in live_scan.items():
        print(f"   {path:<32} | Hash: {h}")
        
    print("\n3. ALGORITHM VERDICT:")
    report = compare_scans(baseline, live_scan)
    
    for status, files in report.items():
        if files:
            print(f"  [{status.upper()}]:")
            for f in files:
                if status == "Renamed_Moved" and isinstance(f, dict):
                    print(f"    -> Moved from '{f['from']}' TO '{f['to']}'")
                elif status == "Copied_Duplicate" and isinstance(f, dict):
                    print(f"    -> '{f['new_copy']}' is a duplicate copy of '{f['original_source']}'")
                else:
                    print(f"    -> {f}")
    print("\n")


# --- TEST SUITE ---
if __name__ == "__main__":

    # Test 1: Standard All-States Verification
    run_test_case(
        "1. Standard Six-State Classification",
        "Verifies Safe, Modified, Deleted, New, Renamed/Moved, and Copied/Duplicate.",
        baseline={
            "/docs/taxes.pdf": "hash_A",
            "/docs/passwords.txt": "hash_B",
            "/docs/photo.jpg": "hash_C",
            "/docs/old_notes.txt": "hash_D"
        },
        live_scan={
            "/docs/taxes.pdf": "hash_A",         # Safe
            "/docs/passwords.txt": "hash_X",     # Modified
            "/pics/vacation.jpg": "hash_C",      # Renamed/Moved (from /docs/photo.jpg)
            "/docs/budget.xlsx": "hash_Y",       # New
            "/docs/taxes_backup.pdf": "hash_A"   # Copied/Duplicate (of /docs/taxes.pdf)
        }
    )

    # Test 2: Edge Case - Trojan Replacement (Move + Overwrite)
    run_test_case(
        "2. Trojan Replacement (Move + Overwrite at Original Path)",
        "Attacker moves 'auth.dll' to a hidden folder and drops a malicious 'auth.dll' in its place.",
        baseline={
            "/system/auth.dll": "hash_CLEAN"
        },
        live_scan={
            "/system/auth.dll": "hash_MALWARE",       # Modified at original path!
            "/temp/.hidden_auth.dll": "hash_CLEAN"    # Original content moved here!
        }
    )

    # Test 3: Edge Case - Simultaneous Move AND Copy (1-to-Many)
    run_test_case(
        "3. Simultaneous Move + Multiple Copies",
        "Original file is deleted, but its exact content appears in TWO new locations during one scan.",
        baseline={
            "/project/secret_key.pem": "hash_KEY"
        },
        live_scan={
            "/backup/key_moved.pem": "hash_KEY",      # 1st match: Renamed/Moved
            "/usb_drive/key_stolen.pem": "hash_KEY"   # 2nd match: Copied/Duplicate
        }
    )

    # Test 4: Edge Case - Pre-existing Duplicates in Baseline
    run_test_case(
        "4. Pre-existing Duplicates in Baseline (One Kept, One Renamed)",
        "Baseline already has 2 identical files. One stays untouched; the other is renamed.",
        baseline={
            "/app/config.json": "hash_CFG",
            "/app/backup/config.json": "hash_CFG"
        },
        live_scan={
            "/app/config.json": "hash_CFG",               # Safe
            "/app/backup/config_v2.json": "hash_CFG"      # Renamed (NOT falsely marked as Copied!)
        }
    )

    # Test 5: Edge Case - Content Swap Between Two Monitored Files
    run_test_case(
        "5. File Name / Content Swap",
        "Two files swap names with each other. Both paths exist, but neither holds its original hash.",
        baseline={
            "/data/prod_db.sql": "hash_PROD",
            "/data/test_db.sql": "hash_TEST"
        },
        live_scan={
            "/data/prod_db.sql": "hash_TEST",             # Modified
            "/data/test_db.sql": "hash_PROD"              # Modified
        }
    )

    # Test 6: Edge Case - Mass Deletion (Ransomware/Wipe Simulation)
    run_test_case(
        "6. Complete Directory Wipe",
        "All baseline files are wiped and replaced by a single ransom note.",
        baseline={
            "/vault/client_list.csv": "hash_1",
            "/vault/contracts.pdf": "hash_2",
            "/vault/financials.xlsx": "hash_3"
        },
        live_scan={
            "/vault/READ_ME_RANSOM.txt": "hash_RANSOM"    # New (while all 3 originals -> Deleted)
        }
    )