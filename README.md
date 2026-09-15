# Cryptographic File Integrity System

## Problem Statement
Files can be modified, deleted, replaced, renamed, moved, copied or accessed without the owner's knowledge due to unauthorized access, malware or insider threats. The system uses cryptographic techniques to verify file integrity and detect suspicious changes. It also implements authentication and authorization to restrict access to the system and detect unauthorized access attempts.

Since a cryptographic hash verifies the contents of a file but not its name or location, the system also tracks file names and paths along with cryptographic hashes to distinguish between renamed/moved files and copied/duplicate files.

---

## Project Objectives
- Allow authorized administrators to select specific files or directories for monitoring.
- Monitor files within selected directories, including files in subdirectories.
- Generate SHA-256 cryptographic hashes for monitored files.
- Create and securely store file integrity records.
- Detect file modification, deletion, replacement, renaming, movement, copying, and newly added files.
- Compare current file hashes with previously stored baseline hashes.
- Track file names and paths along with cryptographic hashes.
- Distinguish between renamed/moved files and copied/duplicate files.
- Classify files as Safe, Modified, Deleted, New, Renamed/Moved, or Copied/Duplicate.
- Implement user authentication and secure password storage.
- Implement role-based authorization for restricted system functions.
- Detect and log unauthorized login or access attempts.
- Generate security alerts for unauthorized access attempts and suspicious file changes.
- Generate file integrity and security reports.

---

## Technologies Required
- **Python** — Core application development
- **SHA-256 ("hashlib")** — File integrity verification
- **bcrypt** — Secure password hashing
- **OS / File System Operations** — File and recursive directory monitoring
- **SQLite** — Database storage
- **Flask** — Backend and web application
- **HTML, CSS, Bootstrap** — Web dashboard interface

---

## Key Features

### File and Directory Monitoring
Authorized administrators can select individual files or directories for monitoring. When a directory is selected, the system scans and monitors all files within that directory, including files in its subdirectories.

The system generates SHA-256 hashes and stores baseline records containing file names, paths and hashes. During future scans, the current file information is compared with the stored baseline to detect changes.

### File Status Classification
Files are classified as:
- **Safe:** The file exists at its original path and its SHA-256 hash is unchanged.
- **Modified:** The file exists at its original path, but its SHA-256 hash has changed.
- **Deleted:** A previously monitored file no longer exists, and no matching file is found elsewhere within the monitored scope.
- **New:** A file is detected within the monitored scope that was not present in the original baseline and does not match the hash of an existing monitored file.
- **Renamed/Moved:** A previously monitored file is missing from its original path, but a file with the same SHA-256 hash is found at a different name or location within the monitored scope.
- **Copied/Duplicate:** A new file with the same SHA-256 hash as an existing monitored file is detected while the original file still exists at its original path.

### Authentication and Authorization
Users must log in to access the system. Passwords are securely stored using bcrypt, and Role-Based Access Control (RBAC) restricts sensitive actions to authorized users.

### Unauthorized Access Detection
The system detects and logs:
- Failed login attempts
- Unauthorized access attempts
- Attempts to perform restricted actions

Security alerts are generated when such events occur.

### Database Storage
Stores:
- Monitored file and directory information
- File names
- File paths
- SHA-256 hashes
- File sizes (optional additional metadata)
- Timestamps
- File verification status
- User credentials and roles
- Security logs and unauthorized access attempts

### Security Reports
Generates reports showing:
- Safe files
- Modified files
- Deleted files
- New files
- Renamed/Moved files
- Copied/Duplicate files
- Suspicious file changes
- Unauthorized access attempts

### Web Dashboard
Provides a centralized dashboard where authorized users can:
- Select files or directories for monitoring
- Monitor file integrity
- Perform integrity scans
- View all file status classifications
- View security alerts
- View unauthorized access logs
- Access security reports

---

## Basic Working

### File Integrity Process
```text
Administrator Selects File/Directory 
  -> Scan Files and Subdirectories 
  -> Record File Name + Path 
  -> Generate SHA-256 Hash 
  -> Store Baseline Record 
  -> Perform Future Scans 
  -> Recalculate Hash and Check File Path 
  -> Compare 
  -> Safe / Modified / Deleted / New / Renamed-Moved / Copied-Duplicate 
  -> Report
```

### Access Security Process

```text
User Login → Authentication → Authorization Check → Allow Access / Deny Access → Log Unauthorized Attempts → Generate Alert
```

---

## Algorithms and Security Techniques Used

- SHA-256 — File content integrity verification
- bcrypt — Secure password hashing
- RBAC (Role-Based Access Control) — User authorization and permission management
- Recursive Directory Scanning — Monitoring files within selected directories and subdirectories
- Hash and Path Comparison — Detection and differentiation of renamed/moved and copied/duplicate files

---

## Setup & Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd Cryptographic_File_Integrity_System
   ```

2. Create and activate a virtual environment:

   **Windows (PowerShell):**

   ```bash
   python -m venv venv
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\venv\Scripts\Activate.ps1
   ```

   **macOS / Linux:**

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```
