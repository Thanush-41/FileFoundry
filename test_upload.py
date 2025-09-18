#!/usr/bin/env python3
"""
Test script for multiple file upload functionality
Tests both single and multiple file uploads with MIME validation
"""

import requests
import os
import tempfile
import json

# Configuration
API_BASE = "http://localhost:8080/api/v1"
TEST_USER_EMAIL = "user@example.com"
TEST_USER_PASSWORD = "password123"

def create_test_files():
    """Create temporary test files with different content types"""
    test_files = []
    
    # Create a text file
    txt_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    txt_file.write("This is a test text file for upload testing.\nIt contains multiple lines.\nLine 3.")
    txt_file.close()
    test_files.append(('text', txt_file.name, 'text/plain'))
    
    # Create a JSON file
    json_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
    json.dump({"test": "data", "number": 42, "array": [1, 2, 3]}, json_file)
    json_file.close()
    test_files.append(('json', json_file.name, 'application/json'))
    
    # Create a binary file (simulated image)
    bin_file = tempfile.NamedTemporaryFile(mode='wb', suffix='.bin', delete=False)
    bin_file.write(b'\x89PNG\r\n\x1a\n' + b'fake image data' * 100)  # PNG header + data
    bin_file.close()
    test_files.append(('binary', bin_file.name, 'application/octet-stream'))
    
    return test_files

def authenticate():
    """Authenticate and get JWT token"""
    print("Authenticating...")
    response = requests.post(f"{API_BASE}/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    
    if response.status_code == 200:
        token = response.json().get('token')
        print(f"✓ Authentication successful")
        return token
    else:
        print(f"✗ Authentication failed: {response.status_code} - {response.text}")
        return None

def test_single_file_upload(token, test_file):
    """Test single file upload"""
    file_type, file_path, mime_type = test_file
    print(f"\nTesting single file upload: {file_type}")
    
    headers = {'Authorization': f'Bearer {token}'}
    
    with open(file_path, 'rb') as f:
        files = {'file': (os.path.basename(file_path), f, mime_type)}
        response = requests.post(f"{API_BASE}/files/upload", headers=headers, files=files)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ Single upload successful: {result.get('message')}")
        print(f"  - File ID: {result.get('files', [{}])[0].get('file_id') if result.get('files') else 'N/A'}")
        print(f"  - Is duplicate: {result.get('files', [{}])[0].get('is_duplicate') if result.get('files') else 'N/A'}")
        print(f"  - Saved bytes: {result.get('total_saved_bytes', 0)}")
        return True
    else:
        print(f"✗ Single upload failed: {response.status_code} - {response.text}")
        return False

def test_multiple_file_upload(token, test_files):
    """Test multiple file upload"""
    print(f"\nTesting multiple file upload ({len(test_files)} files)")
    
    headers = {'Authorization': f'Bearer {token}'}
    files = []
    
    for file_type, file_path, mime_type in test_files:
        with open(file_path, 'rb') as f:
            files.append(('files', (os.path.basename(file_path), f.read(), mime_type)))
    
    response = requests.post(f"{API_BASE}/files/upload", headers=headers, files=files)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ Multiple upload successful: {result.get('message')}")
        print(f"  - Files uploaded: {result.get('uploaded_files_count')}")
        print(f"  - Total size: {result.get('total_size')} bytes")
        print(f"  - Total saved: {result.get('total_saved_bytes')} bytes")
        
        if result.get('warnings'):
            print(f"  - Warnings: {result.get('warnings')}")
            
        for i, file_info in enumerate(result.get('files', [])):
            print(f"    File {i+1}: {file_info.get('filename')} (duplicate: {file_info.get('is_duplicate')})")
        return True
    else:
        print(f"✗ Multiple upload failed: {response.status_code} - {response.text}")
        return False

def test_mime_type_mismatch(token):
    """Test MIME type validation by uploading a file with wrong extension"""
    print(f"\nTesting MIME type validation")
    
    # Create a text file but claim it's an image
    txt_file = tempfile.NamedTemporaryFile(mode='w', suffix='.jpg', delete=False)
    txt_file.write("This is actually text content, not an image!")
    txt_file.close()
    
    headers = {'Authorization': f'Bearer {token}'}
    
    with open(txt_file.name, 'rb') as f:
        files = {'file': (os.path.basename(txt_file.name), f, 'image/jpeg')}  # Wrong MIME type
        response = requests.post(f"{API_BASE}/files/upload", headers=headers, files=files)
    
    os.unlink(txt_file.name)
    
    if response.status_code == 400:
        print(f"✓ MIME validation working: {response.json().get('error')}")
        return True
    else:
        print(f"✗ MIME validation failed: Expected 400, got {response.status_code}")
        print(f"   Response: {response.text}")
        return False

def cleanup_test_files(test_files):
    """Clean up temporary test files"""
    for _, file_path, _ in test_files:
        try:
            os.unlink(file_path)
        except:
            pass

def main():
    print("=== File Upload Test Suite ===")
    
    # Create test files
    test_files = create_test_files()
    print(f"Created {len(test_files)} test files")
    
    try:
        # Authenticate
        token = authenticate()
        if not token:
            return
        
        # Test single file uploads
        success_count = 0
        for test_file in test_files:
            if test_single_file_upload(token, test_file):
                success_count += 1
        
        # Test multiple file upload
        if test_multiple_file_upload(token, test_files):
            success_count += 1
        
        # Test MIME type validation
        if test_mime_type_mismatch(token):
            success_count += 1
        
        print(f"\n=== Results ===")
        print(f"Tests passed: {success_count}/{len(test_files) + 2}")
        
    finally:
        # Clean up
        cleanup_test_files(test_files)
        print("Test files cleaned up")

if __name__ == "__main__":
    main()