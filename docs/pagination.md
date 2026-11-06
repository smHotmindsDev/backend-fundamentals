# Pagination: OFFSET and Keyset

There are two main kinds of pagination: **OFFSET** and **Keyset**.

In my implementation I used `OFFSET`, because the task required it.

**OFFSET** works with the position of a record in a sorted set of data. Even with a B-tree index, the DBMS still has to read and skip every record before the requested position.

**Keyset** uses the value of the last received key instead of a row number:

```sql
SELECT *
FROM books
WHERE book_id < $last
ORDER BY book_id DESC
LIMIT 10;
```

The server continues from the last key, using the index to find the right position.

### Pros and cons

**Pros of Keyset:**

- **Performance.** There is no need to read all the previous records to get the next page.
- **Stability.** Inserting or deleting records before the current position does not shift the page boundary. In the same situation OFFSET can return duplicates or skip records.

With a matching B-tree index, the approximate complexity is:

- **OFFSET:** `O(offset + limit)`
- **Keyset:** `O(log N + limit)`, where N is the number of records.

**Con of Keyset:** you cannot jump straight to an arbitrary page by its number. To get the next page you need to know the key of the previous one.

Cursor pagination often uses Keyset under the hood, passing the last key to the client as a cursor.

### Key requirements

**For correctness:**

- Uniqueness: if the sort column is not unique, it has to be extended with a unique column, for example `book_id` with `PRIMARY KEY`.
- Stability: the key value must not change while the client is paginating.
- Match with `ORDER BY`: the condition that continues the selection must cover all the sort columns and their sort order.

**For performance:**

- A matching B-tree index that lets the DBMS find the position quickly and continue reading from it.

### Measurements

SQL queries: [13_keyset_pagination.sql](../drills/13_keyset_pagination.sql)

| # | Query | Depth | Rows read | Returned | Buffers | Time |
|---|---|---|---:|---:|---:|---:|
| 1 | `OFFSET 0` | start | 10 | 10 | 12 | 0.036 ms |
| 3 | `keyset < 'fffe…'` | start | 10 | 10 | 12 | 0.012 ms |
| 2 | `OFFSET 49990` | end | 50 000 | 10 | 50 499 | 11.7 ms |
| 4 | `keyset < '000dd794…'` | end | 10 | 10 | 12 | 0.010 ms |
| 5 | `OFFSET 100000` | out of range | 50 000 | 0 | 50 500 | 12.3 ms |

### Why does OFFSET 100000 hurt?

The table holds only 50 000 records, so the query returns no rows. But the DBMS still has to go through all 50 000 records to find out that the requested position does not exist.

So the cost of OFFSET depends not only on the number of returned records, but also on the number of skipped ones.

### Why so many Buffers?

`book_id` uses random UUID v4 values. There is practically no correlation between the order of the keys and the physical location of the records (`correlation = -0.0015`).

Because of this, the Index Scan visits the table pages in an almost random order. The table has about 706 pages, but while reading 50 000 records they are accessed again and again.

That is why we get about 50 500 buffer accesses, although there are far fewer physical pages.

### Conclusion

At the start of the list both approaches perform well.

At the end of the list the difference becomes significant: OFFSET read 50 000 records, Keyset read only 10.

The number of buffer accesses differs about **4 200 times** (50 499 vs 12). The execution time also differs a lot, although at such small values it fluctuates between runs.

So Keyset is more efficient for sequential browsing of large data sets, while OFFSET is more convenient when you need to jump to an arbitrary page by its number.
