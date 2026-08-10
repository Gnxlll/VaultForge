use rand::rngs::OsRng;
use rand::Rng;

// A small subset of a standard wordlist for demonstration. 
// In production, load a full EFF diceware list (e.g., 7776 words).
const WORDLIST: &[&str] = &[
    "acid", "acorn", "acre", "acts", "afar", "affair", "aged", "agent", "agile", "aging",
    "agony", "ahead", "candy", "cane", "capital", "captain", "caramel", "carbon", "card",
    "care", "cobra", "cobweb", "cocoa", "code", "coffee", "coil", "coin", "cold", "collar",
    "cyber", "neon", "matrix", "nexus", "synth", "glitch", "proxy", "quantum", "hacker"
];

#[tauri::command]
pub fn generate_password(
    length: usize, 
    use_upper: bool, 
    use_lower: bool, 
    use_numbers: bool, 
    use_symbols: bool
) -> Result<String, String> {
    if length < 4 || length > 128 {
        return Err("Password length must be between 4 and 128 characters".into());
    }

    let mut charset = String::new();
    if use_upper { charset.push_str("ABCDEFGHIJKLMNOPQRSTUVWXYZ"); }
    if use_lower { charset.push_str("abcdefghijklmnopqrstuvwxyz"); }
    if use_numbers { charset.push_str("0123456789"); }
    if use_symbols { charset.push_str("!@#$%^&*()_+-=[]{}|;:,.<>?"); }

    if charset.is_empty() {
        return Err("At least one character set must be selected".into());
    }

    let chars: Vec<char> = charset.chars().collect();
    let mut password = String::new();
    
    for _ in 0..length {
        let idx = OsRng.gen_range(0..chars.len());
        password.push(chars[idx]);
    }

    Ok(password)
}

#[tauri::command]
pub fn generate_passphrase(
    word_count: usize,
    separator: String,
    capitalize: bool,
    include_number: bool
) -> Result<String, String> {
    if word_count < 3 || word_count > 20 {
        return Err("Word count must be between 3 and 20".into());
    }

    let mut words = Vec::new();
    for _ in 0..word_count {
        let idx = OsRng.gen_range(0..WORDLIST.len());
        let mut word = WORDLIST[idx].to_string();
        
        if capitalize {
            let mut c = word.chars();
            if let Some(first) = c.next() {
                word = first.to_uppercase().collect::<String>() + c.as_str();
            }
        }
        words.push(word);
    }

    if include_number {
        let num = OsRng.gen_range(0..99);
        let random_idx = OsRng.gen_range(0..words.len());
        words[random_idx] = format!("{}{}", words[random_idx], num);
    }

    Ok(words.join(&separator))
}