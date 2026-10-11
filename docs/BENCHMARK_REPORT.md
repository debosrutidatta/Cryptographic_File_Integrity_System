# Cryptographic File Integrity System Backend Performance & Stress Test Report

## 1. Objective
* **Goal**: Evaluate the performance, recursive directory traversal, 64KB chunked cryptographic hashing (`scanner.py`), and SQLite WAL batch persistence (`database.py`) under real-world data loads.

## 2. Dataset Selection
* **Source**: Kaggle (`pariza/bbc-news-summary`)
* **Target Subfolder Path**: `backend/test_data/bbc_summary/BBC News Summary/News Articles/entertainment`
* **File Volume Verified**: Exactly **386 individual `.txt` files** nested within directory structures
* **Format**: Pure text articles (lightweight payload suitable for rapid I/O testing).

## 3. Setup and Ingestion Steps
1. **Download & Extraction**: 
   * Retrieved `archive.zip` from Kaggle and expanded it via PowerShell:
     ```powershell
     Expand-Archive -Path "$HOME\Downloads\archive.zip" -DestinationPath "backend/test_data/bbc_summary" -Force
     ```
2. **File Count Verification**:
   * Verified target count using PowerShell:
     ```powershell
     (Get-ChildItem -Recurse -File -Path "backend/test_data/bbc_summary/BBC News Summary/News Articles/entertainment").Count
     ```
   * **Result**: Confirmed 386 files

## 4. Execution Workflow
* **Target Registration**: `POST /api/targets` (automatically captures initial SHA-256 baselines)
* **Scan Trigger**: `POST /api/scan` (executes live comparison and persists findings)

## 5. Performance Metrics
* **Total Scan Duration**: Sub-second execution (< 1 second)
* **Total Files Processed**: `386`
* **Database Write Mode**: SQLite WAL (Write-Ahead Logging)

## 6. Stress Test & Integrity Verification Results

### Test Run A: Baseline Ingestion & Pristine Scan
* **Scan ID**: `1`
* **Total Files Scanned**: `386`
* **Execution Status**: Success (`success: True`)
* **Result**: All 386 files successfully cataloged as `Safe` against initial SHA-256 cryptographic baselines.

### Test Run B: Live Modification Detection Test
* **Scan ID**: `4`
* **Total Files Scanned**: `386`
* **Execution Status**: Success (`success: True`)
* **Result**: Successfully detected a live content change in `001.txt`. 
  * **Modified**: `1` (`001.txt`)
  * **Safe**: `385`
* **Database Persistence & Auditing**: SQLite WAL successfully processed the comparative scan, accurately updating file integrity states and logging audit events via `/api/alerts`.