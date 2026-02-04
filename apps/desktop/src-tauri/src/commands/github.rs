use keyring::Entry;
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "otto-desktop";
const KEYRING_GITHUB_USER: &str = "github-token";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub clone_url: String,
    pub private: bool,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
}

#[tauri::command]
pub async fn github_save_token(token: String) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_GITHUB_USER).map_err(|e| e.to_string())?;

    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_get_token() -> Result<Option<String>, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_GITHUB_USER).map_err(|e| e.to_string())?;

    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn github_logout() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_GITHUB_USER).map_err(|e| e.to_string())?;

    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn github_get_user(token: String) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();

    let response = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "otto-desktop")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    response.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_list_repos(token: String) -> Result<Vec<GitHubRepo>, String> {
    let client = reqwest::Client::new();

    let response = client
        .get("https://api.github.com/user/repos?sort=updated&per_page=50")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "otto-desktop")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    response.json().await.map_err(|e| e.to_string())
}
