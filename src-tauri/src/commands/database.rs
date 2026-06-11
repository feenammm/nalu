use crate::db::database::get_connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
}

#[tauri::command]
pub fn db_query(sql: String) -> Result<QueryResult, String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows: Vec<Vec<serde_json::Value>> = stmt
        .query_map([], |row| {
            let mut values = Vec::new();
            for i in 0..columns.len() {
                let val: serde_json::Value = match row.get::<_, rusqlite::types::Value>(i) {
                    Ok(rusqlite::types::Value::Null) => serde_json::Value::Null,
                    Ok(rusqlite::types::Value::Integer(i)) => serde_json::Value::Number(i.into()),
                    Ok(rusqlite::types::Value::Real(f)) => serde_json::Number::from_f64(f)
                        .map(serde_json::Value::Number)
                        .unwrap_or(serde_json::Value::Null),
                    Ok(rusqlite::types::Value::Text(s)) => serde_json::Value::String(s),
                    Ok(rusqlite::types::Value::Blob(b)) => {
                        serde_json::Value::String(format!("[blob: {} bytes]", b.len()))
                    }
                    Err(e) => serde_json::Value::String(format!("[error: {}]", e)),
                };
                values.push(val);
            }
            Ok(values)
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(QueryResult { columns, rows })
}

#[tauri::command]
pub fn db_execute(sql: String) -> Result<usize, String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    conn.execute(&sql, []).map_err(|e| e.to_string())
}
