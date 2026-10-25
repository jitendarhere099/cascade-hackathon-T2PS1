# API Reference & Contracts

## Overview
This document records all API route handlers, Server Actions, data schemas, and Supabase database contracts.

> [!NOTE]
> Detailed endpoints and schemas will be documented here as features are implemented following the user's project requirements.

## API Design Standards
1. **Response Format**: All API responses must return structured JSON:
   - Success: `{ "success": true, "data": ... }`
   - Error: `{ "success": false, "error": { "code": "...", "message": "..." } }`
2. **HTTP Status Codes**:
   - `200 OK`: Request succeeded.
   - `201 Created`: Resource successfully created.
   - `400 Bad Request`: Input validation failed.
   - `401 Unauthorized`: Authentication required or token invalid.
   - `403 Forbidden`: Authenticated user lacks permission.
   - `404 Not Found`: Resource not found.
   - `500 Internal Server Error`: Unexpected server error.
3. **Validation**: Every route handler and Server Action must validate incoming payloads using strict runtime schemas (e.g. `zod`).

## Database Tables & RLS Policies (Schema Blueprint)
- To be populated upon schema creation.
- Every table MUST have:
  - `id`: UUID primary key (default `gen_random_uuid()`).
  - `created_at`: `timestamptz default now()`.
  - `updated_at`: `timestamptz default now()`.
  - Row Level Security enabled (`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`).
  - Explicit policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
