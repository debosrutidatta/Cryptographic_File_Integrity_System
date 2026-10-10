def compare_scans(baseline_hashes, live_hashes):
    """
    Compares a baseline dictionary against a live scan dictionary.
    Keys are file paths, values are SHA-256 hashes.
    """
    results = {
        "Safe": [],
        "Modified": [],
        "Deleted": [],
        "New": [],
        "Renamed_Moved": [],
        "Copied_Duplicate": []
    }
    
    processed_live_paths = set()

    # Step 1: Check Baseline against Live Scan (Find Safe, Modified, Deleted)
    for base_path, base_hash in baseline_hashes.items():
        if base_path in live_hashes:
            if base_hash == live_hashes[base_path]:
                results["Safe"].append(base_path)
            else:
                results["Modified"].append(base_path)
            processed_live_paths.add(base_path)
        else:
            results["Deleted"].append(base_path)

    # Step 2: Check remaining Live Scan files (Find New, Renamed, Copied)
    unprocessed_live_paths = [p for p in live_hashes.keys() if p not in processed_live_paths]
    
    # Reverse lookup for the baseline: {hash: list_of_paths}
    baseline_reverse_lookup = {}
    for path, file_hash in baseline_hashes.items():
        if file_hash not in baseline_reverse_lookup:
            baseline_reverse_lookup[file_hash] = []
        baseline_reverse_lookup[file_hash].append(path)

    for live_path in unprocessed_live_paths:
        live_hash = live_hashes[live_path]
        
        if live_hash not in baseline_reverse_lookup:
            results["New"].append(live_path)
        else:
            original_paths = baseline_reverse_lookup[live_hash]
            
            # Check if any original path with this hash is currently marked as Deleted
            unaccounted_deleted = [p for p in original_paths if p in results["Deleted"]]
            
            # Check if an original path still exists with the exact same untouched hash
            intact_originals = [
                p for p in original_paths 
                if p in live_hashes and live_hashes[p] == live_hash
            ]
            
            if unaccounted_deleted:
                # Pair this new path with the missing original path (1-to-1 match)
                from_path = unaccounted_deleted[0]
                results["Renamed_Moved"].append({
                    "from": from_path,
                    "to": live_path
                })
                # Remove from Deleted so a second copy isn't also marked as Renamed_Moved
                results["Deleted"].remove(from_path)
                
            elif intact_originals:
                # Original file is still intact (or missing ones were already accounted for)
                results["Copied_Duplicate"].append({
                    "new_copy": live_path,
                    "original_source": intact_originals[0]
                })
            else:
                # Edge Case: Original path was overwritten by a different file (Modified),
                # OR original was moved AND copied multiple times in a single scan.
                overwritten_originals = [
                    p for p in original_paths 
                    if p in live_hashes and live_hashes[p] != live_hash
                ]
                already_moved = [
                    item["from"] for item in results["Renamed_Moved"] 
                    if item["from"] in original_paths
                ]
                
                if overwritten_originals and not already_moved:
                    results["Renamed_Moved"].append({
                        "from": overwritten_originals[0],
                        "to": live_path
                    })
                else:
                    results["Copied_Duplicate"].append({
                        "new_copy": live_path,
                        "original_source": original_paths[0]
                    })

    return results