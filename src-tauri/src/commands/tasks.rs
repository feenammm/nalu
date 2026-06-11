use crate::db::database::get_connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub project: String,
    pub title: String,
    pub done: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_tasks(project: Option<String>) -> Result<Vec<Task>, String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();

    let tasks = match &project {
        Some(p) => {
            let mut stmt = conn
                .prepare("SELECT id, project, title, done, created_at, updated_at FROM tasks WHERE project = ?1 ORDER BY created_at DESC")
                .map_err(|e| e.to_string())?;
            let rows: Vec<Task> = stmt
                .query_map(rusqlite::params![p], |row| {
                    Ok(Task {
                        id: row.get(0)?,
                        project: row.get(1)?,
                        title: row.get(2)?,
                        done: row.get::<_, i32>(3)? != 0,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            rows
        }
        None => {
            let mut stmt = conn
                .prepare("SELECT id, project, title, done, created_at, updated_at FROM tasks ORDER BY created_at DESC")
                .map_err(|e| e.to_string())?;
            let rows: Vec<Task> = stmt
                .query_map([], |row| {
                    Ok(Task {
                        id: row.get(0)?,
                        project: row.get(1)?,
                        title: row.get(2)?,
                        done: row.get::<_, i32>(3)? != 0,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            rows
        }
    };

    Ok(tasks)
}

#[tauri::command]
pub fn add_task(title: String, project: Option<String>) -> Result<Task, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let project = project.unwrap_or_else(|| "default".to_string());

    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    conn.execute(
        "INSERT INTO tasks (id, project, title) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, project, title],
    )
    .map_err(|e| e.to_string())?;

    Ok(Task {
        id,
        project,
        title,
        done: false,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn toggle_task(id: String) -> Result<bool, String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    conn.execute(
        "UPDATE tasks SET done = 1 - done, updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    let done: bool = conn
        .query_row(
            "SELECT done FROM tasks WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get::<_, i32>(0),
        )
        .map_err(|e| e.to_string())?
        != 0;

    Ok(done)
}

#[tauri::command]
pub fn update_task(id: String, title: String) -> Result<Task, String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    conn.execute(
        "UPDATE tasks SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![title, id],
    )
    .map_err(|e| e.to_string())?;

    let task = conn
        .query_row(
            "SELECT id, project, title, done, created_at, updated_at FROM tasks WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Task {
                    id: row.get(0)?,
                    project: row.get(1)?,
                    title: row.get(2)?,
                    done: row.get::<_, i32>(3)? != 0,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(task)
}

#[tauri::command]
pub fn delete_task(id: String) -> Result<(), String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    conn.execute("DELETE FROM tasks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
