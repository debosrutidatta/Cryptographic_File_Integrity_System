import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Load environment variables from local .env file
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(dotenv_path=env_path)

# Import verified database helper functions and modules
from database import (
    init_db,
    admin_exists,
    create_admin_user,
    verify_admin_credentials,
    add_monitored_target,
    get_all_monitored_targets,
    delete_monitored_target,
    save_baselines_for_target,
    get_baseline_dict_for_target,
    record_scan_history,
    save_scan_results,
    get_scan_reports,
    get_scan_details_by_id,
    log_security_event,
    get_security_logs,
    DB_PATH
)
from scanner import scan_target
from comparator import compare_scans

app = Flask(__name__)
# Enable CORS to allow secure communication with your React frontend
CORS(app)

# Ensure database tables exist and default admin is provisioned securely on startup
with app.app_context():
    init_db()
    if not admin_exists():
        admin_user = os.environ.get("FIM_ADMIN_USER", "admin")
        admin_pass = os.environ.get("FIM_ADMIN_PASS")
        
        if not admin_pass:
            raise ValueError("[ERROR] FIM_ADMIN_PASS environment variable is not set! Please define it in your .env file.")
            
        create_admin_user(admin_user, admin_pass)
        print("[INFO] Default admin account provisioned successfully from environment configuration.")


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify backend status."""
    return jsonify({"status": "healthy", "message": "FIM Backend is running successfully"}), 200


@app.route('/api/login', methods=['POST'])
def login():
    """Authenticate administrator credentials with strict type and content-type validation."""
    if not request.is_json:
        return jsonify({"success": False, "error": "Content-Type must be application/json"}), 415

    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    # Strict type and presence validation
    if not username or not password or not isinstance(username, str) or not isinstance(password, str):
        return jsonify({"success": False, "error": "Invalid username or password format"}), 400

    success, user_id = verify_admin_credentials(username, password)
    client_ip = request.remote_addr

    if success:
        log_security_event("Login Success", f"Administrator '{username}' logged in successfully.", client_ip)
        return jsonify({
            "success": True, 
            "user_id": user_id,
            "message": "Authentication successful"
        }), 200
    else:
        log_security_event("Login Failed", f"Failed authentication attempt for username '{username}'.", client_ip)
        return jsonify({
            "success": False, 
            "error": "Invalid credentials"
        }), 401


@app.route('/api/targets', methods=['GET'])
def get_targets():
    """Retrieves all registered monitored targets for the dashboard."""
    targets = get_all_monitored_targets()
    return jsonify({"success": True, "targets": targets}), 200


@app.route('/api/targets', methods=['POST'])
def add_target():
    """Registers a new monitored target path, or loads an existing one without overwriting its baseline."""
    if not request.is_json:
        return jsonify({"success": False, "error": "Content-Type must be application/json"}), 415

    data = request.get_json() or {}
    target_path = data.get('target_path')
    added_by = data.get('added_by', 1)  # Default to admin ID 1

    if not target_path or not isinstance(target_path, str):
        return jsonify({"success": False, "error": "Valid target path is required"}), 400

    abs_path = os.path.abspath(target_path)
    if not os.path.exists(abs_path):
        return jsonify({"success": False, "error": f"Path does not exist on disk: {abs_path}"}), 404

    is_directory = os.path.isdir(abs_path)

    # Check if target already exists in database
    existing_targets = get_all_monitored_targets()
    matched_target = next((t for t in existing_targets if os.path.abspath(t['target_path']) == abs_path), None)

    if matched_target:
        target_id = matched_target['id']
        # Do not overwrite baselines here; leave baseline intact for live comparison scanning
        log_security_event("Target Selected", f"Monitored target selected for inspection: {abs_path}", request.remote_addr)
        return jsonify({
            "success": True,
            "target_id": target_id,
            "message": "Target selected successfully. Ready for integrity scan.",
        }), 200

    # Otherwise, register new target in SQLite
    success, target_id, msg = add_monitored_target(abs_path, is_directory, added_by)
    if not success:
        return jsonify({"success": False, "error": msg}), 409

    # Capture and store initial file baselines ONLY on first registration
    baseline_hashes = scan_target(abs_path, use_relative_paths=False)
    base_success, base_msg = save_baselines_for_target(target_id, baseline_hashes)

    if not base_success:
        return jsonify({"success": False, "error": f"Target registered, but failed to save baselines: {base_msg}"}), 500

    log_security_event("Target Added", f"New monitored target registered: {abs_path}", request.remote_addr)
    return jsonify({
        "success": True,
        "target_id": target_id,
        "message": "Target registered and baseline captured successfully.",
        "file_count": len(baseline_hashes)
    }), 201


@app.route('/api/targets/<int:target_id>', methods=['DELETE'])
def remove_target(target_id):
    """Deletes a monitored target and cascades deletion of its child file baselines."""
    success = delete_monitored_target(target_id)
    if success:
        log_security_event("Target Deleted", f"Monitored target ID {target_id} removed.", request.remote_addr)
        return jsonify({"success": True, "message": "Target and associated baselines removed successfully."}), 200
    else:
        return jsonify({"success": False, "error": "Target not found."}), 404


@app.route('/api/targets/<int:target_id>/refresh', methods=['POST'])
def refresh_target_baseline(target_id):
    """Explicitly clears old baselines and captures the current disk state as the new baseline."""
    targets = get_all_monitored_targets()
    target = next((t for t in targets if t['id'] == target_id), None)
    
    if not target:
        return jsonify({"success": False, "error": "Target not found."}), 404

    target_path = target['target_path']
    if not os.path.exists(target_path):
        return jsonify({"success": False, "error": "Target path no longer exists on disk."}), 404

    # Clear out existing baseline rows to prevent ghost deletions or duplicate conflicts
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM file_baselines WHERE target_id = ?", (target_id,))
    conn.commit()
    conn.close()

    # Capture fresh live hashes and save them as the new baseline
    baseline_hashes = scan_target(target_path, use_relative_paths=False)
    success, msg = save_baselines_for_target(target_id, baseline_hashes)

    if not success:
        return jsonify({"success": False, "error": f"Failed to refresh baseline: {msg}"}), 500

    log_security_event("Baseline Refreshed", f"Baseline fully reset and updated for target: {target_path}", request.remote_addr)
    return jsonify({
        "success": True,
        "message": "Baseline refreshed successfully to current disk state.",
        "file_count": len(baseline_hashes)
    }), 200


@app.route('/api/scan', methods=['POST'])
def trigger_scan():
    """Triggers a live integrity scan across monitored targets, classifies the 6 states, and records results."""
    data = request.get_json() if request.is_json else {}
    triggered_by = data.get('triggered_by', 1)
    target_id_filter = data.get('target_id')

    targets = get_all_monitored_targets()
    if target_id_filter:
        targets = [t for t in targets if t['id'] == target_id_filter]

    if not targets:
        return jsonify({"success": False, "error": "No monitored targets available to scan."}), 404

    overall_report = {
        "Safe": [], 
        "Modified": [], 
        "Deleted": [], 
        "New": [], 
        "Renamed_Moved": [], 
        "Copied_Duplicate": []
    }
    total_files_scanned = 0

    for target in targets:
        target_path = target['target_path']
        target_id = target['id']

        if not os.path.exists(target_path):
            continue

        live_hashes = scan_target(target_path, use_relative_paths=False)
        db_baselines = get_baseline_dict_for_target(target_id)

        report = compare_scans(db_baselines, live_hashes)
        total_files_scanned += len(live_hashes)

        for status, items in report.items():
            if status in overall_report:
                overall_report[status].extend(items)

    # Persist scan history and categorized results in SQLite
    scan_id = record_scan_history(triggered_by, total_files_scanned)
    save_success = save_scan_results(scan_id, overall_report)

    if not save_success:
        return jsonify({"success": False, "error": "Scan executed, but failed to save findings to database."}), 500

    log_security_event("Scan Executed", f"Integrity scan completed successfully (Scan ID: {scan_id}).", request.remote_addr)

    return jsonify({
        "success": True,
        "scan_id": scan_id,
        "total_files_scanned": total_files_scanned,
        "report": overall_report,
        "message": "Integrity scan completed and persisted successfully."
    }), 200


@app.route('/api/reports', methods=['GET'])
def get_reports():
    """Retrieves all historical scan summaries for dashboard reporting."""
    reports = get_scan_reports()
    return jsonify({"success": True, "reports": reports}), 200


@app.route('/api/reports/<int:scan_id>', methods=['GET'])
def get_report_details(scan_id):
    """Retrieves all file integrity findings associated with a specific scan ID."""
    details = get_scan_details_by_id(scan_id)
    if not details:
        return jsonify({"success": False, "error": "Scan report details not found."}), 404
    return jsonify({"success": True, "scan_id": scan_id, "results": details}), 200


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Retrieves security audit logs for threat monitoring."""
    logs = get_security_logs()
    return jsonify({"success": True, "alerts": logs}), 200


@app.route('/api/security-logs', methods=['GET'])
def fetch_security_logs():
    """Retrieves security audit logs for the dedicated security logs viewer."""
    try:
        logs = get_security_logs()
        return jsonify({"success": True, "logs": logs}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/browse', methods=['GET'])
def browse_directory():
    """Provides directory listing, supporting multi-drive switching and permission handling."""
    req_path = request.args.get('path', '')
    
    # Special handler to list system drives (C:, D:, etc.)
    if req_path == 'DRIVES' or req_path == 'computer':
        entries = []
        if os.name == 'nt':
            import string
            for letter in string.ascii_uppercase:
                drive_path = f"{letter}:\\"
                if os.path.exists(drive_path):
                    entries.append({
                        "name": f"Local Disk ({letter}:)",
                        "path": drive_path.replace("\\", "/"),
                        "is_dir": True
                    })
        else:
            entries.append({
                "name": "Root ( / )",
                "path": "/",
                "is_dir": True
            })
        return jsonify({
            "success": True,
            "current_path": "Computer / Drives",
            "parent_path": None,
            "entries": entries
        }), 200

    # Default to user home directory for initial view
    if not req_path:
        abs_path = os.path.expanduser("~")
    else:
        abs_path = os.path.abspath(req_path)

    if not os.path.exists(abs_path) or not os.path.isdir(abs_path):
        return jsonify({"success": False, "error": f"Directory not found: {abs_path}"}), 404

    try:
        entries = []
        for entry in os.listdir(abs_path):
            if entry.startswith('.'):
                continue
            full_path = os.path.join(abs_path, entry)
            
            try:
                is_dir = os.path.isdir(full_path)
                if is_dir:
                    os.listdir(full_path)
            except (PermissionError, OSError):
                continue

            entries.append({
                "name": entry,
                "path": full_path.replace("\\", "/"),
                "is_dir": is_dir
            })

        # Sort: directories first, then files alphabetically
        entries.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))

        parent_path = os.path.dirname(abs_path).replace("\\", "/")
        
        return jsonify({
            "success": True,
            "current_path": abs_path.replace("\\", "/"),
            "parent_path": parent_path if parent_path != abs_path and len(abs_path) > 3 else 'DRIVES',
            "entries": entries
        }), 200
    except PermissionError:
        return jsonify({"success": False, "error": f"Access denied to system directory: {abs_path}"}), 403
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route('/api/search', methods=['GET'])
def search_directories():
    """Searches recursively for directories matching a query within the current base path."""
    query = request.args.get('q', '').strip().lower()
    base_path = request.args.get('path', '')

    if not base_path or not os.path.exists(base_path):
        base_path = os.path.expanduser("~")

    if not query or len(query) < 2:
        return jsonify({"success": True, "results": []}), 200

    results = []
    max_results = 15

    try:
        for root, dirs, files in os.walk(base_path):
            # Limit depth to maintain performance and prevent system hangs
            rel_path = os.path.relpath(root, base_path)
            depth = 0 if rel_path == '.' else len(rel_path.split(os.sep))
            if depth > 4:
                dirs[:] = []
                continue

            for d in dirs:
                if query in d.lower():
                    full_path = os.path.join(root, d).replace("\\", "/")
                    results.append({
                        "name": d,
                        "path": full_path,
                        "is_dir": True
                    })
                    if len(results) >= max_results:
                        break
            if len(results) >= max_results:
                break

        return jsonify({"success": True, "results": results}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)