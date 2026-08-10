use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use rand::RngCore;
use rand::rngs::OsRng;
use zeroize::Zeroize;
use super::key_derivation::derive_key;

pub fn encrypt_vault_payload(passcode: &str, plaintext: &str) -> Result<Vec<u8>, String> {
    // 1. Generate 32-byte random salt
    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);
    
    // 2. Derive key using Argon2id
    let mut key = derive_key(passcode, &salt)?;
    
    // 3. Generate 12-byte random nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // 4. Encrypt with AES-256-GCM
    let cipher = Aes256Gcm::new((&key).into());
    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| "ENCRYPTION_FAILED".to_string())?;
        
    // 5. Zeroize the derived key from memory immediately
    key.zeroize();
    
    // 6. Pack payload: [Salt (32)] + [Nonce (12)] + [Ciphertext + Tag]
    let mut payload = Vec::new();
    payload.extend_from_slice(&salt);
    payload.extend_from_slice(&nonce_bytes);
    payload.extend_from_slice(&ciphertext);
    
    Ok(payload)
}

pub fn decrypt_vault_payload(passcode: &str, payload: &[u8]) -> Result<String, String> {
    // Validate minimum length (32 salt + 12 nonce + at least 16 byte tag)
    if payload.len() < 60 {
        return Err("DECRYPTION_FAILED: Payload too short or corrupted".into());
    }
    
    let salt = &payload[0..32];
    let nonce_bytes = &payload[32..44];
    let ciphertext = &payload[44..];
    
    // Derive key
    let mut key = derive_key(passcode, salt)?;
    
    // Decrypt
    let cipher = Aes256Gcm::new((&key).into());
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext_bytes = cipher.decrypt(nonce, ciphertext)
        .map_err(|_| "INVALID_PASSWORD_OR_CORRUPT_DATA".to_string())?;
        
    // Clean up key
    key.zeroize();
    
    // Convert to String
    String::from_utf8(plaintext_bytes)
        .map_err(|_| "DECRYPTION_FAILED: Invalid UTF-8 sequence".into())
}