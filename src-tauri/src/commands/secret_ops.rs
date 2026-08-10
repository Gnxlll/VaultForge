use rand::rngs::OsRng;
use rand::RngCore;
use base64::{Engine as _, engine::general_purpose::{URL_SAFE_NO_PAD, STANDARD}};

#[tauri::command]
pub fn generate_jwt_secret(entropy_bits: usize) -> Result<String, String> {
    if entropy_bits < 256 {
        return Err("Minimum entropy for JWT is 256 bits".into());
    }
    
    let num_bytes = entropy_bits / 8;
    let mut key = vec![0u8; num_bytes];
    OsRng.fill_bytes(&mut key);
    
    // JWT secrets are typically base64url encoded
    Ok(URL_SAFE_NO_PAD.encode(key))
}

#[tauri::command]
pub fn generate_generic_secret(length_bytes: usize, encoding: String) -> Result<String, String> {
    if length_bytes == 0 || length_bytes > 1024 {
        return Err("Length must be between 1 and 1024 bytes".into());
    }

    let mut key = vec![0u8; length_bytes];
    OsRng.fill_bytes(&mut key);
    
    match encoding.as_str() {
        "hex" => {
            let hex_string: String = key.iter().map(|b| format!("{:02x}", b)).collect();
            Ok(hex_string)
        },
        "base64" => {
            Ok(STANDARD.encode(key))
        },
        "base64url" => {
            Ok(URL_SAFE_NO_PAD.encode(key))
        }
        _ => Err("UNSUPPORTED_ENCODING: Valid options are hex, base64, base64url".into())
    }
}