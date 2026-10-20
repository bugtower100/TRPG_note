import sqlite3


database_path = r"C:\Users\MR\Desktop\TRPG_note\疑似存在问题的数据库\storage.db"
connection = sqlite3.connect(
    "file:" + database_path.replace("\\", "/") + "?mode=ro",
    uri=True,
)
cursor = connection.cursor()

print("PRAGMAS")
for pragma in (
    "page_size",
    "page_count",
    "freelist_count",
    "journal_mode",
    "user_version",
    "foreign_keys",
):
    value = cursor.execute(f"PRAGMA {pragma}").fetchone()[0]
    print(pragma, value)

print("\nAPP_META")
for row in cursor.execute("SELECT key, value, updated_at FROM app_meta ORDER BY key"):
    print(row)

print("\nSCHEMA_MIGRATIONS")
for row in cursor.execute("SELECT * FROM schema_migrations ORDER BY id"):
    print(row)

print("\nSQLITE_SEQUENCE")
for row in cursor.execute("SELECT name, seq FROM sqlite_sequence ORDER BY name"):
    print(row)

print("\nKVS")
for key, value, version, created_at, updated_at in cursor.execute(
    "SELECT key, value, version, created_at, updated_at FROM kvs ORDER BY key"
):
    print("key=", key)
    print(
        "version=", version,
        "created_at=", created_at,
        "updated_at=", updated_at,
        "length=", len(value or ""),
    )
    print("value=", value)

connection.close()
