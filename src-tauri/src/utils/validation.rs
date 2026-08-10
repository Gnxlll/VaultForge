pub fn validate_id(id: &str) -> Result<(), String> {
    // UUIDs should be exactly 36 characters
    if id.len() != 36 {
        return Err("SECURITY_VIOLATION: Invalid ID format.".into());
    }
    // Only allow alphanumeric and hyphens
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("SECURITY_VIOLATION: Malformed ID.".into());
    }
    Ok(())
}

pub fn validate_passcode(passcode: &str) -> Result<(), String> {
    if passcode.is_empty() {
        return Err("SECURITY_VIOLATION: Passcode cannot be empty.".into());
    }
    if passcode.len() > 1024 {
        return Err("SECURITY_VIOLATION: Passcode exceeds maximum length (1024 chars).".into());
    }
    Ok(())
}

pub fn validate_payload(payload: &str, max_mb: usize) -> Result<(), String> {
    let max_bytes = max_mb * 1024 * 1024;
    if payload.len() > max_bytes {
        return Err(format!("SECURITY_VIOLATION: Payload exceeds maximum size of {}MB.", max_mb));
    }
    Ok(())
}