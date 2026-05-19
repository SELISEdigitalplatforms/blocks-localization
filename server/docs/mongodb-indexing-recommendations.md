# MongoDB Indexing Recommendations

Based on codebase analysis, ordered by usage frequency.

---

## **HIGH PRIORITY (Critical Performance)**

### 1. `UilmFiles` Collection - **MOST USED API (GetUilmFile)**

```javascript
// Priority 1: For GetUilmFile - MUST HAVE for performance
// Exact match on both Language and ModuleName
db.UilmFiles.createIndex({ "Language": 1, "ModuleName": 1 }, { unique: true })

// Priority 2: If you query by TenantId
db.UilmFiles.createIndex({ "TenantId": 1 })
```

### 2. `BlocksLanguageKeys` Collection - **SECOND MOST USED (Gets)**

```javascript
// Priority 2a: Compound unique index for upserts and key lookups
// Used by: GetAllKeysByModuleAsync, GetKeyByNameAsync, SaveKeyAsync, UpsertResourceKeysWithMergeAsync
db.BlocksLanguageKeys.createIndex({ "ModuleId": 1, "KeyName": 1 }, { unique: true })

// Priority 2b: For Gets (GetAllKeysAsync) with pagination and sorting
db.BlocksLanguageKeys.createIndex({ "ModuleId": 1 })
db.BlocksLanguageKeys.createIndex({ "ModuleId": 1, "KeyName": 1 })

// Priority 2c: For direct ItemId lookups (GetByIdAsync, DeleteAsync)
db.BlocksLanguageKeys.createIndex({ "ItemId": 1 }, { unique: true })
```

---

## **MEDIUM PRIORITY**

### 3. `KeyTimelines` Collection

```javascript
// Priority 2d: For GetLocalizationTimeline - grouped by OperationId
// Most common timeline query pattern
db.KeyTimelines.createIndex({ "OperationId": 1, "CreateDate": -1 })

// Priority 2e: For GetTimelineByOperationIdAsync
db.KeyTimelines.createIndex({ "OperationId": 1 })

// Priority 2f: For GetKeyTimelineAsync filtering by EntityId
db.KeyTimelines.createIndex({ "EntityId": 1, "CreateDate": -1 })

// Priority 2g: For GetKeyTimelineAsync filtering by UserId
db.KeyTimelines.createIndex({ "UserId": 1, "CreateDate": -1 })

// Priority 2h: For GetLatestPublishTimelinesAsync
db.KeyTimelines.createIndex({ "EntityId": 1, "LogFrom": 1, "CreateDate": -1 })
```

### 4. `UilmExportedFiles` Collection

```javascript
// Priority 2i: For GetUilmExportedFilesAsync - sorted by CreateDate, filtered by FileName
db.UilmExportedFiles.createIndex({ "CreateDate": -1 })
db.UilmExportedFiles.createIndex({ "FileName": 1 })  // For regex search
```

---

## **LOW PRIORITY (Supporting Indexes)**

### 5. Additional `BlocksLanguageKeys` Indexes for Complex Queries

```javascript
// Priority 3a: For GetAllKeysAsync - missing languages filter
db.BlocksLanguageKeys.createIndex({ "Resources.Culture": 1 })

// Priority 3b: For glossary filtering
db.BlocksLanguageKeys.createIndex({ "GlossaryIds": 1 })

// Priority 3c: For date range queries in Gets
db.BlocksLanguageKeys.createIndex({ "CreateDate": -1 })
db.BlocksLanguageKeys.createIndex({ "LastUpdateDate": -1 })

// Priority 3d: For GetsByKeyNamesAsync - In queries
db.BlocksLanguageKeys.createIndex({ "KeyName": 1 })
```

### 6. `BlocksLanguages` Collection

```javascript
// Priority 3e: For GetLanguageSettingAsync - IsDefault lookup
db.BlocksLanguages.createIndex({ "IsDefault": 1 })
```

---

## **Consolidated Migration Script**

Run all at once on your MongoDB instance:

```javascript
// ============ BlocksLanguageKeys ============
db.BlocksLanguageKeys.createIndex({ "ItemId": 1 }, { unique: true })
db.BlocksLanguageKeys.createIndex({ "ModuleId": 1, "KeyName": 1 }, { unique: true })
db.BlocksLanguageKeys.createIndex({ "ModuleId": 1 })
db.BlocksLanguageKeys.createIndex({ "KeyName": 1 })
db.BlocksLanguageKeys.createIndex({ "Resources.Culture": 1 })
db.BlocksLanguageKeys.createIndex({ "GlossaryIds": 1 })
db.BlocksLanguageKeys.createIndex({ "CreateDate": -1 })
db.BlocksLanguageKeys.createIndex({ "LastUpdateDate": -1 })

// ============ UilmFiles ============
db.UilmFiles.createIndex({ "Language": 1, "ModuleName": 1 }, { unique: true })
db.UilmFiles.createIndex({ "TenantId": 1 })

// ============ KeyTimelines ============
db.KeyTimelines.createIndex({ "OperationId": 1, "CreateDate": -1 })
db.KeyTimelines.createIndex({ "EntityId": 1, "CreateDate": -1 })
db.KeyTimelines.createIndex({ "UserId": 1, "CreateDate": -1 })
db.KeyTimelines.createIndex({ "EntityId": 1, "LogFrom": 1, "CreateDate": -1 })

// ============ UilmExportedFiles ============
db.UilmExportedFiles.createIndex({ "CreateDate": -1 })
db.UilmExportedFiles.createIndex({ "FileName": 1 })

// ============ BlocksLanguages ============
db.BlocksLanguages.createIndex({ "IsDefault": 1 })
```

---

## **Implementation Notes**

1. **Background Indexing**: All indexes should be built with `{ background: true }` option to avoid locking production writes:
   ```javascript
   db.BlocksLanguageKeys.createIndex({ "ModuleId": 1, "KeyName": 1 }, { unique: true, background: true })
   ```

2. **Index Validation**: After creating indexes, verify with:
   ```javascript
   db.collection.getIndexes()
   ```

3. **Monitor Performance**: Use MongoDB's `db.currentOp()` to monitor index builds and query performance afterward.

4. **Consider Sparse Indexes**: For fields that may be null or missing (like `GlossaryIds`), consider `{ sparse: true }` to reduce index size.