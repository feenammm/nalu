use crate::db::database::get_connection;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MysqlUser {
    pub id: String,
    pub username: String,
    pub password: String,
    pub databases: String, // comma-separated list of databases
    pub created_at: String,
}

fn validate_database_name(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 64 {
        return Err("数据库名长度必须为 1-64 个字符".to_string());
    }
    if !value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '$'))
    {
        return Err("数据库名仅支持字母、数字、下划线和 $".to_string());
    }
    Ok(())
}

fn validate_username(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 32 {
        return Err("用户名长度必须为 1-32 个字符".to_string());
    }
    if !value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.'))
    {
        return Err("用户名仅支持字母、数字、下划线、短横线和点".to_string());
    }
    Ok(())
}

fn quote_identifier(value: &str) -> String {
    format!("`{}`", value.replace('`', "``"))
}

fn quote_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn insert_managed_user(
    conn: &rusqlite::Connection,
    username: String,
    password: String,
    database: String,
) -> Result<MysqlUser, String> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO mysql_users (id, username, password, databases) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, username, password, database],
    )
    .map_err(|e| e.to_string())?;

    Ok(MysqlUser {
        id,
        username,
        password,
        databases: database,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

fn save_managed_user(
    username: String,
    password: String,
    database: String,
) -> Result<MysqlUser, String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    insert_managed_user(conn, username, password, database)
}

#[tauri::command]
pub fn get_mysql_users() -> Result<Vec<MysqlUser>, String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, username, password, databases, created_at FROM mysql_users ORDER BY username ASC")
        .map_err(|e| e.to_string())?;
    let users = stmt
        .query_map([], |row| {
            Ok(MysqlUser {
                id: row.get(0)?,
                username: row.get(1)?,
                password: row.get(2)?,
                databases: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(users)
}

#[tauri::command]
pub fn add_mysql_user(
    username: String,
    password: String,
    databases: String,
) -> Result<MysqlUser, String> {
    validate_username(&username)?;
    validate_database_name(&databases)?;
    save_managed_user(username, password, databases)
}

#[tauri::command]
pub fn upsert_mysql_user(
    username: String,
    password: String,
    database: String,
) -> Result<MysqlUser, String> {
    validate_username(&username)?;
    validate_database_name(&database)?;
    if password.is_empty() {
        return Err("密码不能为空".to_string());
    }

    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM mysql_users WHERE username = ?1",
            rusqlite::params![username],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(id) = existing_id {
        conn.execute(
            "UPDATE mysql_users SET password = ?1, databases = ?2 WHERE id = ?3",
            rusqlite::params![password, database, id],
        )
        .map_err(|e| e.to_string())?;
        return Ok(MysqlUser {
            id,
            username,
            password,
            databases: database,
            created_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    insert_managed_user(conn, username, password, database)
}

#[tauri::command]
pub fn update_mysql_user(
    id: String,
    password: Option<String>,
    databases: Option<String>,
) -> Result<(), String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    if let Some(pw) = &password {
        conn.execute(
            "UPDATE mysql_users SET password = ?1 WHERE id = ?2",
            rusqlite::params![pw, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(dbs) = &databases {
        conn.execute(
            "UPDATE mysql_users SET databases = ?1 WHERE id = ?2",
            rusqlite::params![dbs, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_mysql_user(id: String) -> Result<(), String> {
    let db = get_connection()?;
    let conn = db.as_ref().unwrap();
    conn.execute(
        "DELETE FROM mysql_users WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn mysql_create_user_on_server(
    config: super::mysql::MysqlConfig,
    new_username: String,
    new_password: String,
    grant_databases: String,
    host: Option<String>,
) -> Result<bool, String> {
    validate_username(&new_username)?;
    let host = host.unwrap_or_else(|| "localhost".to_string());

    let opts = mysql_async::OptsBuilder::default()
        .ip_or_hostname(&config.host)
        .tcp_port(config.port)
        .user(Some(&config.user))
        .pass(Some(&config.password));

    let pool = mysql_async::Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    use mysql_async::prelude::*;

    let create_sql = format!(
        "CREATE USER IF NOT EXISTS {}@{} IDENTIFIED BY {}",
        quote_literal(&new_username),
        quote_literal(&host),
        quote_literal(&new_password)
    );
    conn.query_drop(&create_sql)
        .await
        .map_err(|e| e.to_string())?;

    if !grant_databases.is_empty() {
        for db_name in grant_databases.split(',') {
            let db_name = db_name.trim();
            if !db_name.is_empty() {
                validate_database_name(db_name)?;
                let grant_sql = format!(
                    "GRANT ALL PRIVILEGES ON {}.* TO {}@{}",
                    quote_identifier(db_name),
                    quote_literal(&new_username),
                    quote_literal(&host)
                );
                conn.query_drop(&grant_sql)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        conn.query_drop("FLUSH PRIVILEGES")
            .await
            .map_err(|e| e.to_string())?;
    }

    conn.disconnect().await.map_err(|e| e.to_string())?;
    pool.disconnect().await.map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub async fn mysql_create_database_with_user(
    config: super::mysql::MysqlConfig,
    database_name: String,
    new_username: String,
    new_password: String,
    host: Option<String>,
) -> Result<MysqlUser, String> {
    validate_database_name(&database_name)?;
    validate_username(&new_username)?;
    if new_password.is_empty() {
        return Err("密码不能为空".to_string());
    }
    let host = host.unwrap_or_else(|| "localhost".to_string());

    let opts = mysql_async::OptsBuilder::default()
        .ip_or_hostname(&config.host)
        .tcp_port(config.port)
        .user(Some(&config.user))
        .pass(Some(&config.password));

    let pool = mysql_async::Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    use mysql_async::prelude::*;

    let database_exists: Option<String> = conn
        .exec_first(
            "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
            (&database_name,),
        )
        .await
        .map_err(|e| e.to_string())?;
    if database_exists.is_some() {
        return Err(format!("数据库 {database_name} 已存在"));
    }

    let user_exists: Option<String> = conn
        .exec_first(
            "SELECT User FROM mysql.user WHERE User = ? AND Host = ?",
            (&new_username, &host),
        )
        .await
        .map_err(|e| e.to_string())?;
    if user_exists.is_some() {
        return Err(format!("用户 {new_username}@{host} 已存在"));
    }

    let create_database_sql = format!(
        "CREATE DATABASE {} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
        quote_identifier(&database_name)
    );
    conn.query_drop(create_database_sql)
        .await
        .map_err(|e| e.to_string())?;

    let create_user_sql = format!(
        "CREATE USER {}@{} IDENTIFIED BY {}",
        quote_literal(&new_username),
        quote_literal(&host),
        quote_literal(&new_password)
    );
    if let Err(error) = conn.query_drop(create_user_sql).await {
        let _ = conn
            .query_drop(format!(
                "DROP DATABASE {}",
                quote_identifier(&database_name)
            ))
            .await;
        return Err(error.to_string());
    }

    let grant_sql = format!(
        "GRANT ALL PRIVILEGES ON {}.* TO {}@{}",
        quote_identifier(&database_name),
        quote_literal(&new_username),
        quote_literal(&host)
    );
    if let Err(error) = conn.query_drop(grant_sql).await {
        let _ = conn
            .query_drop(format!(
                "DROP USER IF EXISTS {}@{}",
                quote_literal(&new_username),
                quote_literal(&host)
            ))
            .await;
        let _ = conn
            .query_drop(format!(
                "DROP DATABASE {}",
                quote_identifier(&database_name)
            ))
            .await;
        return Err(error.to_string());
    }

    conn.disconnect().await.map_err(|e| e.to_string())?;
    pool.disconnect().await.map_err(|e| e.to_string())?;

    match save_managed_user(new_username.clone(), new_password, database_name.clone()) {
        Ok(user) => Ok(user),
        Err(error) => Err(format!("数据库和用户已创建，但本地凭据保存失败：{error}")),
    }
}

#[tauri::command]
pub async fn mysql_delete_database_with_user(
    config: super::mysql::MysqlConfig,
    database_name: String,
    username: Option<String>,
) -> Result<(), String> {
    validate_database_name(&database_name)?;
    if let Some(value) = username.as_deref() {
        validate_username(value)?;
    }

    let opts = mysql_async::OptsBuilder::default()
        .ip_or_hostname(&config.host)
        .tcp_port(config.port)
        .user(Some(&config.user))
        .pass(Some(&config.password));
    let pool = mysql_async::Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    use mysql_async::prelude::*;

    conn.query_drop(format!(
        "DROP DATABASE IF EXISTS {}",
        quote_identifier(&database_name)
    ))
    .await
    .map_err(|e| e.to_string())?;

    if let Some(value) = username.as_deref() {
        conn.query_drop(format!("DROP USER IF EXISTS {}@'%'", quote_literal(value)))
            .await
            .map_err(|e| e.to_string())?;
    }

    conn.disconnect().await.map_err(|e| e.to_string())?;
    pool.disconnect().await.map_err(|e| e.to_string())?;

    let db = get_connection()?;
    let local = db.as_ref().unwrap();
    if let Some(value) = username {
        local
            .execute(
                "DELETE FROM mysql_users WHERE username = ?1 OR databases = ?2",
                rusqlite::params![value, database_name],
            )
            .map_err(|e| e.to_string())?;
    } else {
        local
            .execute(
                "DELETE FROM mysql_users WHERE databases = ?1",
                rusqlite::params![database_name],
            )
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn mysql_update_managed_user_password(
    config: super::mysql::MysqlConfig,
    id: String,
    username: String,
    new_password: String,
) -> Result<(), String> {
    validate_username(&username)?;
    if new_password.is_empty() {
        return Err("密码不能为空".to_string());
    }

    let opts = mysql_async::OptsBuilder::default()
        .ip_or_hostname(&config.host)
        .tcp_port(config.port)
        .user(Some(&config.user))
        .pass(Some(&config.password));
    let pool = mysql_async::Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    use mysql_async::prelude::*;

    conn.query_drop(format!(
        "ALTER USER {}@'%' IDENTIFIED BY {}",
        quote_literal(&username),
        quote_literal(&new_password)
    ))
    .await
    .map_err(|e| e.to_string())?;

    conn.disconnect().await.map_err(|e| e.to_string())?;
    pool.disconnect().await.map_err(|e| e.to_string())?;

    update_mysql_user(id, Some(new_password), None)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerUser {
    pub user: String,
    pub host: String,
    pub plugin: String,
}

#[tauri::command]
pub async fn mysql_list_server_users(
    config: super::mysql::MysqlConfig,
) -> Result<Vec<ServerUser>, String> {
    let opts = mysql_async::OptsBuilder::default()
        .ip_or_hostname(&config.host)
        .tcp_port(config.port)
        .user(Some(&config.user))
        .pass(Some(&config.password));

    let pool = mysql_async::Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    use mysql_async::prelude::*;

    let rows: Vec<(String, String, String)> = conn
        .query("SELECT User, Host, plugin FROM mysql.user ORDER BY User, Host")
        .await
        .map_err(|e| e.to_string())?;

    conn.disconnect().await.map_err(|e| e.to_string())?;
    pool.disconnect().await.map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|(user, host, plugin)| ServerUser { user, host, plugin })
        .collect())
}

#[tauri::command]
pub async fn mysql_drop_server_user(
    config: super::mysql::MysqlConfig,
    username: String,
    host: String,
) -> Result<(), String> {
    let protected = [
        "root",
        "mysql.sys",
        "mysql.session",
        "mysql.infoschema",
        "debian-sys-maint",
    ];
    if protected.contains(&username.as_str()) {
        return Err(format!("不允许删除系统用户 {}", username));
    }

    let opts = mysql_async::OptsBuilder::default()
        .ip_or_hostname(&config.host)
        .tcp_port(config.port)
        .user(Some(&config.user))
        .pass(Some(&config.password));

    let pool = mysql_async::Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    use mysql_async::prelude::*;

    let sql = format!(
        "DROP USER {}@{}",
        quote_literal(&username),
        quote_literal(&host)
    );
    conn.query_drop(&sql).await.map_err(|e| e.to_string())?;

    conn.disconnect().await.map_err(|e| e.to_string())?;
    pool.disconnect().await.map_err(|e| e.to_string())?;

    Ok(())
}
