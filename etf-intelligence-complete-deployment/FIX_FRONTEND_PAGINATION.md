# Fix Frontend Pagination Display

## ✅ Backend is Correct!

Your backend returns:
```json
{
  "total": 5016,
  "totalPages": 251
}
```

**The issue is in the frontend** - it's showing "Page 1 of 1" instead of "Page 1 of 251".

---

## 🔍 Find the Frontend Screener Component

The ETF Screener page is likely at:
- `apps/web/src/app/screener/page.tsx`
- OR `apps/web/src/pages/screener.tsx`
- OR `apps/web/src/components/etf-screener.tsx`

---

## 🐛 Common Frontend Issues

### Issue 1: Using `data.length` instead of `totalPages`

**WRONG**:
```typescript
const [data, setData] = useState([]);
const totalPages = Math.ceil(data.length / pageSize);  // Always 20/20 = 1
```

**CORRECT**:
```typescript
const [data, setData] = useState([]);
const [totalPages, setTotalPages] = useState(1);

// When fetching:
const response = await fetch('http://localhost:3001/api/etfs?page=1&pageSize=20');
const result = await response.json();

setData(result.data);
setTotalPages(result.totalPages);  // Use backend's totalPages
```

---

### Issue 2: Not Storing totalPages from Response

**Check your fetch code**:

```typescript
// BAD - only saves data
const fetchETFs = async () => {
  const response = await fetch(`http://localhost:3001/api/etfs?page=${page}`);
  const result = await response.json();
  setETFs(result.data);  // ❌ Ignores totalPages
};

// GOOD - saves both data and totalPages
const fetchETFs = async () => {
  const response = await fetch(`http://localhost:3001/api/etfs?page=${page}`);
  const result = await response.json();
  setETFs(result.data);
  setTotalPages(result.totalPages);  // ✅ Saves totalPages
  setTotal(result.total);  // ✅ Saves total count
};
```

---

### Issue 3: Calculating Pages from Filtered Data

**WRONG**:
```typescript
// This calculates pages from the 20 items returned
const totalPages = Math.ceil(etfs.length / pageSize);  // 20 / 20 = 1
```

**CORRECT**:
```typescript
// Use the totalPages from backend
const totalPages = apiResponse.totalPages;  // 251
```

---

## ✅ Complete Fix Example

Here's what your screener component should look like:

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function ETFScreener() {
  const [etfs, setETFs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchETFs();
  }, [page]);

  const fetchETFs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:3001/api/etfs?page=${page}&pageSize=${pageSize}`
      );
      const result = await response.json();
      
      // CRITICAL: Save all pagination data from backend
      setETFs(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPage(result.page);
    } catch (error) {
      console.error('Failed to fetch ETFs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* ETF List */}
      <div>
        {etfs.map(etf => (
          <div key={etf.ticker}>{etf.name}</div>
        ))}
      </div>

      {/* Pagination Info */}
      <div>
        Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total} ETFs
      </div>

      {/* Pagination Controls */}
      <div>
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        
        <span>Page {page} of {totalPages}</span>
        
        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## 🎯 Key Changes Needed

1. **Add state for totalPages**:
   ```typescript
   const [totalPages, setTotalPages] = useState(1);
   ```

2. **Save totalPages from API response**:
   ```typescript
   setTotalPages(result.totalPages);
   ```

3. **Use totalPages in pagination display**:
   ```typescript
   <span>Page {page} of {totalPages}</span>
   ```

4. **Disable next button correctly**:
   ```typescript
   disabled={page === totalPages}
   ```

---

## 🔧 How to Find Your Component

### Option 1: Search for "Page 1 of 1" text

```cmd
cd apps/web
grep -r "Page.*of" src/
```

This will find the file with the pagination display.

### Option 2: Search for the fetch call

```cmd
cd apps/web
grep -r "api/etfs" src/
```

This will find where the API is being called.

### Option 3: Check common locations

Look in these files:
- `apps/web/src/app/screener/page.tsx`
- `apps/web/src/pages/screener.tsx`
- `apps/web/src/components/screener/*.tsx`

---

## 📝 What to Look For

Open the screener component file and find:

1. **The fetch/API call**:
   ```typescript
   fetch('http://localhost:3001/api/etfs')
   ```

2. **Where it saves the response**:
   ```typescript
   const result = await response.json();
   setETFs(result.???);  // What does it save?
   ```

3. **The pagination display**:
   ```typescript
   Page {page} of {???}  // What does it use here?
   ```

---

## 🚀 After Finding the File

**Share the component code** (or just the pagination section) and I'll give you the exact fix!

Or if you want to fix it yourself:
1. Add `const [totalPages, setTotalPages] = useState(1);`
2. In the fetch, add `setTotalPages(result.totalPages);`
3. In the display, use `{totalPages}` instead of calculating from data length

---

**The backend is perfect!** Just need to update the frontend to use the `totalPages` field that's already being returned. 🎉
