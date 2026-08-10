use argon2::{Algorithm, Argon2, Params, Version};

pub fn derive_key(passcode: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::default()
    );
    
    let mut key = [0u8; 32];
    
    // Hash the password into the 32-byte key buffer
    argon2.hash_password_into(passcode.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Key derivation failed: {}", e))?;
        
    Ok(key)
}