use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde::{Deserialize, Serialize};
use ssh_key::{Algorithm, LineEnding, PrivateKey};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyPair {
    pub public_key: String,
    pub encrypted_private_key: String,
}

#[tauri::command]
pub fn generate_deploy_key() -> Result<KeyPair, String> {
    let private_key = PrivateKey::random(&mut rand::thread_rng(), Algorithm::Ed25519)
        .map_err(|e| format!("Key generation failed: {}", e))?;

    let public_openssh = private_key
        .public_key()
        .to_openssh()
        .map_err(|e| format!("Public key export failed: {}", e))?;

    let private_pem = private_key
        .to_openssh(LineEnding::LF)
        .map_err(|e| format!("Private key export failed: {}", e))?;

    Ok(KeyPair {
        public_key: public_openssh,
        encrypted_private_key: private_pem.to_string(),
    })
}

fn derive_key_iv(password: &[u8], salt: &[u8]) -> ([u8; 32], [u8; 16]) {
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha256;

    let mut derived = [0u8; 48];
    pbkdf2_hmac::<Sha256>(password, salt, 10000, &mut derived);

    let mut key = [0u8; 32];
    let mut iv = [0u8; 16];
    key.copy_from_slice(&derived[..32]);
    iv.copy_from_slice(&derived[32..48]);
    (key, iv)
}

#[tauri::command]
pub fn encrypt_key(private_key: String, password: String) -> Result<String, String> {
    use aes::Aes256;
    use cbc::cipher::{BlockEncryptMut, KeyIvInit, block_padding::Pkcs7};

    let salt: [u8; 8] = rand::random();
    let (key, iv) = derive_key_iv(password.as_bytes(), &salt);

    let encryptor = cbc::Encryptor::<Aes256>::new(&key.into(), &iv.into());
    let plaintext = private_key.as_bytes();
    let buf_len = plaintext.len() + 16;
    let mut buf = vec![0u8; buf_len];
    buf[..plaintext.len()].copy_from_slice(plaintext);
    let encrypted = encryptor
        .encrypt_padded_mut::<Pkcs7>(&mut buf, plaintext.len())
        .map_err(|_| "Encryption failed".to_string())?;

    let mut output = b"Salted__".to_vec();
    output.extend_from_slice(&salt);
    output.extend_from_slice(encrypted);

    Ok(BASE64.encode(&output))
}

#[tauri::command]
pub fn decrypt_key(encrypted: String, password: String) -> Result<String, String> {
    use aes::Aes256;
    use cbc::cipher::{BlockDecryptMut, KeyIvInit, block_padding::Pkcs7};

    let data = BASE64
        .decode(&encrypted)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if data.len() < 16 || &data[..8] != b"Salted__" {
        return Err("Invalid encrypted data format".to_string());
    }

    let salt = &data[8..16];
    let ciphertext = &data[16..];

    let (key, iv) = derive_key_iv(password.as_bytes(), salt);

    let decryptor = cbc::Decryptor::<Aes256>::new(&key.into(), &iv.into());
    let mut buf = ciphertext.to_vec();
    let decrypted = decryptor
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|_| "Decryption failed — wrong password?".to_string())?;

    String::from_utf8(decrypted.to_vec()).map_err(|e| format!("UTF-8 decode failed: {}", e))
}

#[tauri::command]
pub fn verify_password(encrypted: String, password: String) -> bool {
    decrypt_key(encrypted, password).is_ok()
}

#[tauri::command]
pub fn public_key_from_encrypted(encrypted: String, password: String) -> Result<String, String> {
    let pem = decrypt_key(encrypted, password)?;
    let private_key = PrivateKey::from_openssh(&pem)
        .map_err(|e| format!("Parse private key failed: {}", e))?;
    private_key
        .public_key()
        .to_openssh()
        .map_err(|e| format!("Public key export failed: {}", e))
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyInfo {
    pub name: String,
    pub path: String,
    pub key_type: String,
    pub public_key: String,
    pub has_passphrase: bool,
}

#[tauri::command]
pub fn list_ssh_keys() -> Vec<SshKeyInfo> {
    let home = dirs::home_dir().unwrap_or_default();
    let ssh_dir = home.join(".ssh");
    let mut keys = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&ssh_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

            if !name.starts_with("id_") || name.ends_with(".pub") {
                continue;
            }

            let key_type = if name.contains("ed25519") {
                "ed25519"
            } else if name.contains("rsa") {
                "rsa"
            } else if name.contains("ecdsa") {
                "ecdsa"
            } else {
                "unknown"
            }.to_string();

            let pub_path = path.with_extension("pub");
            let public_key = std::fs::read_to_string(&pub_path)
                .unwrap_or_default()
                .trim()
                .to_string();

            let has_passphrase = std::process::Command::new("ssh-keygen")
                .args(["-y", "-P", "", "-f"])
                .arg(&path)
                .output()
                .map(|o| !o.status.success())
                .unwrap_or(true);

            keys.push(SshKeyInfo {
                name: name.clone(),
                path: path.to_string_lossy().to_string(),
                key_type,
                public_key,
                has_passphrase,
            });
        }
    }

    keys.sort_by(|a, b| a.name.cmp(&b.name));
    keys
}

#[tauri::command]
pub fn get_host_git_config() -> (String, String) {
    let name = std::process::Command::new("git")
        .args(["config", "--global", "user.name"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string();

    let email = std::process::Command::new("git")
        .args(["config", "--global", "user.email"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string();

    (name, email)
}
