use std::collections::BTreeSet;

#[tauri::command]
pub async fn list_system_fonts() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut database = fontdb::Database::new();
        database.load_system_fonts();

        let mut families = BTreeSet::new();
        for face in database.faces() {
            for (family, _) in &face.families {
                let trimmed = family.trim();
                if !trimmed.is_empty() {
                    families.insert(trimmed.to_string());
                }
            }
        }

        Ok(families.into_iter().collect())
    })
    .await
    .map_err(|error| format!("Failed to list system fonts: {error}"))?
}
