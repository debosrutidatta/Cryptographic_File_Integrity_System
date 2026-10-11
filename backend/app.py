import os
from flask import Flask, jsonify, request
from flask_cors import CORS

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
    get_security_logs
)
from scanner import scan_target
from comparator import compare_scans

app = Flask(__name__)
# Enable CORS to allow secure communication with your React frontend
CORS(app)

# Ensure database tables exist and default admin is provisioned on startup
with app.app_context():
    init_db()
    if not admin_exists():
        # Default bootstrap credentials: admin / AdminSecurePass2026!
        create_admin_user("admin", "AdminSecurePass2026!")
        print("[INFO] Default admin account provisioned successfully.")


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
    """Registers a new monitored target path and captures its initial SHA-256 cryptographic baseline."""
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

    # Register target in SQLite
    success, target_id, msg = add_monitored_target(abs_path, is_directory, added_by)
    if not success:
        return jsonify({"success": False, "error": msg}), 409

    # Capture and store initial file baselines
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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)