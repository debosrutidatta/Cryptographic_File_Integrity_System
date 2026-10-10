import os
import json
import hashlib

# --- EXTERNAL CONFIGURATION LOADER ---
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def load_configuration():
    """Loads configuration parameters from an external JSON file with fallback defaults."""
    default_config = {
        "chunk_size": 65536,
        "ignored_directories": [".git", "__pycache__", "venv", ".venv", "node_modules"]
    }
    
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                user_config = json.load(f)
                default_config["chunk_size"] = user_config.get("chunk_size", default_config["chunk_size"])
                if "ignored_directories" in user_config:
                    default_config["ignored_directories"] = user_config["ignored_directories"]
        except (json.JSONDecodeError, OSError) as exc:
            print(f"[WARN] Failed to parse config.json ({exc}). Falling back to default configuration.")
            
    # Convert ignored directories list to a set for O(1) performance lookups
    return default_config["chunk_size"], set(default_config["ignored_directories"])

# Load runtime constants from external configuration
CHUNK_SIZE, IGNORED_DIRECTORIES = load_configuration()


def calculate_sha256(file_path, chunk_size=CHUNK_SIZE):
    """
    Computes the SHA-256 cryptographic hash of a target file.

    Reads the file in binary chunks to maintain a low memory footprint
    when processing large files.

    Args:
        file_path (str): Path to the file to be hashed.
        chunk_size (int): Number of bytes to read per iteration.

    Returns:
        str | None: Hexadecimal SHA-256 digest, or None if the file is inaccessible.
    """
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as file_stream:
            for chunk in iter(lambda: file_stream.read(chunk_size), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except (PermissionError, FileNotFoundError, OSError) as exc:
        print(f"[WARN] Unable to read '{file_path}': {exc}")
        return None


def scan_target(target_path, use_relative_paths=False):
    """
    Scans a single file or recursively scans a directory and its subdirectories.

    Args:
        target_path (str): Path to the file or directory to monitor.
        use_relative_paths (bool): If True, normalizes keys relative to target_path.
                                   If False, uses normalized absolute file paths.

    Returns:
        dict[str, str]: Mapping of normalized file paths to their SHA-256 hashes.
    """
    scan_records = {}
    abs_target = os.path.abspath(target_path)

    if not os.path.exists(abs_target):
        raise FileNotFoundError(f"Target path does not exist: {abs_target}")

    # Single-file monitoring
    if os.path.isfile(abs_target):
        file_hash = calculate_sha256(abs_target)
        if file_hash:
            key = f"/{os.path.basename(abs_target)}" if use_relative_paths else abs_target.replace("\\", "/")
            scan_records[key] = file_hash
        return scan_records

    # Recursive directory monitoring
    for root, dirs, files in os.walk(abs_target):
        # Prune ignored directories in-place using values loaded from config.json
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRECTORIES and not d.startswith('.')]

        for file_name in files:
            full_path = os.path.abspath(os.path.join(root, file_name))
            file_hash = calculate_sha256(full_path)

            if file_hash:
                if use_relative_paths:
                    rel_path = os.path.relpath(full_path, abs_target).replace("\\", "/")
                    path_key = f"/{rel_path}"
                else:
                    path_key = full_path.replace("\\", "/")

                scan_records[path_key] = file_hash

    return scan_records