# Task 09: Upload API and Supabase Storage Setup

## Objective
Implement file upload API with Supabase Storage integration, including bucket configuration, signed URL generation, file validation, and security measures.

## Context
- Supabase Storage provides S3-compatible object storage
- Need to support multiple file types: PDF, images, spreadsheets, audio
- Files will be processed by OCR/ASR pipelines (Phase 4)
- Security is critical: validate file types, sizes, and prevent malicious uploads
- Storage paths must be organized and predictable
- Lifecycle policies needed to manage storage costs

## Requirements

### 1. Supabase Storage Bucket Configuration

**Create bucket:** `quote-uploads`

**Configuration:**
```typescript
// In Supabase Dashboard or via SQL:
// Storage > Create Bucket
{
  name: 'quote-uploads',
  public: false,  // Require authentication for access
  file_size_limit: 104857600,  // 100MB
  allowed_mime_types: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // XLSX
    'application/vnd.ms-excel',  // XLS
    'text/csv',
    'text/plain',
    'audio/mpeg',  // MP3
    'audio/mp4',   // M4A
    'audio/wav'
  ]
}
```

**RLS Policies:**
```sql
-- Users can upload to their own quotes
CREATE POLICY "Users can upload to their quotes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-uploads' AND
  (storage.foldername(name))[1] = 'quotes' AND
  EXISTS (
    SELECT 1 FROM quotes
    WHERE id::text = (storage.foldername(name))[2]
    AND (created_by = auth.uid() OR auth.jwt() ->> 'role' IN ('ADMIN', 'SALES'))
  )
);

-- Users can read their uploaded files
CREATE POLICY "Users can read their uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quote-uploads' AND
  EXISTS (
    SELECT 1 FROM uploads
    WHERE storage_path = name
    AND quote_id IN (
      SELECT id FROM quotes
      WHERE created_by = auth.uid() OR auth.jwt() ->> 'role' IN ('ADMIN', 'SALES')
    )
  )
);

-- ADMIN can delete files
CREATE POLICY "Admins can delete uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quote-uploads' AND
  auth.jwt() ->> 'role' = 'ADMIN'
);
```

### 2. Storage Path Structure

**Path format:** `quotes/{quote_id}/{timestamp}_{original_filename}`

**Example:**
```
quotes/550e8400-e29b-41d4-a716-446655440000/1699564800000_customer_order.pdf
quotes/550e8400-e29b-41d4-a716-446655440000/1699564801000_door_list.xlsx
quotes/550e8400-e29b-41d4-a716-446655440000/1699564802000_audio_note.m4a
```

**Benefits:**
- Easy to find all files for a quote
- Timestamp prevents filename conflicts
- Original filename preserved for user reference
- Hierarchical structure supports folder operations

### 3. Upload API Route

**File:** `pricing-tool/app/api/quotes/[id]/uploads/route.ts`

**POST /api/quotes/[id]/uploads**

**Request (multipart/form-data):**
```typescript
{
  file: File,  // The actual file
  file_type?: 'pdf' | 'image' | 'spreadsheet' | 'audio' | 'text'  // Optional hint
}
```

**Implementation:**
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const quoteId = params.id

  // 1. Verify quote exists and user has access
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, created_by')
    .eq('id', quoteId)
    .single()

  if (quoteError || !quote) {
    return NextResponse.json(
      { error: 'Quote not found' },
      { status: 404 }
    )
  }

  // 2. Parse multipart form data
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    )
  }

  // 3. Validate file
  const validation = validateFile(file)
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    )
  }

  // 4. Generate storage path
  const timestamp = Date.now()
  const sanitizedFilename = sanitizeFilename(file.name)
  const storagePath = `quotes/${quoteId}/${timestamp}_${sanitizedFilename}`

  // 5. Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('quote-uploads')
    .upload(storagePath, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    return NextResponse.json(
      { error: 'Upload failed', details: uploadError.message },
      { status: 500 }
    )
  }

  // 6. Create upload record in database
  const { data: uploadRecord, error: dbError } = await supabase
    .from('uploads')
    .insert({
      quote_id: quoteId,
      file_type: validation.file_type,
      original_name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      mime_type: file.type,
      status: 'pending'
    })
    .select()
    .single()

  if (dbError) {
    // Rollback storage upload
    await supabase.storage.from('quote-uploads').remove([storagePath])
    return NextResponse.json(
      { error: 'Database error', details: dbError.message },
      { status: 500 }
    )
  }

  // 7. Trigger processing pipeline (async)
  await triggerProcessingPipeline(uploadRecord.id, validation.file_type)

  return NextResponse.json({
    success: true,
    upload: uploadRecord
  })
}
```

### 4. File Validation

**File:** `pricing-tool/lib/upload-validation.ts`

**Validation checks:**
```typescript
export interface ValidationResult {
  valid: boolean
  error?: string
  file_type?: 'pdf' | 'image' | 'spreadsheet' | 'audio' | 'text'
}

export function validateFile(file: File): ValidationResult {
  // 1. Check file size (max 100MB)
  const MAX_SIZE = 100 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is 100MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`
    }
  }

  // 2. Check minimum size (prevent empty files)
  if (file.size < 10) {
    return {
      valid: false,
      error: 'File is too small or empty'
    }
  }

  // 3. Validate MIME type
  const allowedTypes = {
    'application/pdf': 'pdf',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
    'application/vnd.ms-excel': 'spreadsheet',
    'text/csv': 'spreadsheet',
    'text/plain': 'text',
    'audio/mpeg': 'audio',
    'audio/mp4': 'audio',
    'audio/wav': 'audio'
  }

  const fileType = allowedTypes[file.type as keyof typeof allowedTypes]
  if (!fileType) {
    return {
      valid: false,
      error: `File type not allowed: ${file.type}. Allowed types: PDF, images, spreadsheets, audio, text.`
    }
  }

  // 4. Validate file extension matches MIME type
  const extension = file.name.split('.').pop()?.toLowerCase()
  const validExtensions: Record<string, string[]> = {
    'pdf': ['pdf'],
    'image': ['jpg', 'jpeg', 'png', 'webp'],
    'spreadsheet': ['xlsx', 'xls', 'csv'],
    'text': ['txt'],
    'audio': ['mp3', 'm4a', 'wav']
  }

  if (!extension || !validExtensions[fileType]?.includes(extension)) {
    return {
      valid: false,
      error: `File extension .${extension} does not match MIME type ${file.type}`
    }
  }

  // 5. Validate filename (no path traversal)
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid filename'
    }
  }

  return {
    valid: true,
    file_type: fileType as any
  }
}

export function sanitizeFilename(filename: string): string {
  // Remove special characters, keep alphanumeric, dash, underscore, dot
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255)  // Max filename length
}
```

### 5. Signed URL Generation

**Purpose:** Allow clients to download files securely

**File:** `pricing-tool/lib/storage.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

export async function getSignedUploadUrl(
  storagePath: string,
  expiresIn: number = 3600  // 1 hour default
): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .storage
    .from('quote-uploads')
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    console.error('Error generating signed URL:', error)
    return null
  }

  return data.signedUrl
}

export async function getSignedUrls(
  storagePaths: string[],
  expiresIn: number = 3600
): Promise<Record<string, string>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .storage
    .from('quote-uploads')
    .createSignedUrls(storagePaths, expiresIn)

  if (error) {
    console.error('Error generating signed URLs:', error)
    return {}
  }

  return data.reduce((acc, item) => {
    if (item.signedUrl) {
      acc[item.path] = item.signedUrl
    }
    return acc
  }, {} as Record<string, string>)
}
```

### 6. Virus Scanning Consideration

**For production, integrate virus scanning:**

**Option 1: ClamAV (self-hosted)**
```typescript
// Install ClamAV in Docker container
// Scan files before processing
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function scanFile(filePath: string): Promise<boolean> {
  try {
    await execAsync(`clamscan ${filePath}`)
    return true  // Clean
  } catch (error) {
    return false  // Infected or error
  }
}
```

**Option 2: Cloud service (AWS S3 + Lambda + ClamAV)**
- Use Supabase webhook to trigger Lambda on upload
- Lambda scans file with ClamAV
- Update uploads.status based on result

**For MVP:** Skip virus scanning, add in production.

### 7. Lifecycle Policies

**Auto-delete processed uploads after 90 days:**

```sql
-- Create function to clean old uploads
CREATE OR REPLACE FUNCTION delete_old_uploads()
RETURNS void AS $$
DECLARE
  old_upload RECORD;
BEGIN
  FOR old_upload IN
    SELECT storage_path FROM uploads
    WHERE processed_at < NOW() - INTERVAL '90 days'
    AND status = 'completed'
  LOOP
    -- Delete from storage
    PERFORM storage.delete_object('quote-uploads', old_upload.storage_path);

    -- Update database record
    UPDATE uploads
    SET status = 'archived', storage_path = NULL
    WHERE storage_path = old_upload.storage_path;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup (use pg_cron extension)
SELECT cron.schedule('cleanup-old-uploads', '0 2 * * *', 'SELECT delete_old_uploads()');
```

### 8. Progress Tracking for Large Uploads

**For client-side upload progress:**
```typescript
// Client component
async function uploadFile(file: File, quoteId: string, onProgress: (percent: number) => void) {
  const formData = new FormData()
  formData.append('file', file)

  const xhr = new XMLHttpRequest()

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100
      onProgress(percent)
    }
  })

  return new Promise((resolve, reject) => {
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(xhr.statusText))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload failed')))

    xhr.open('POST', `/api/quotes/${quoteId}/uploads`)
    xhr.send(formData)
  })
}
```

## Files to Create/Modify

**New Files:**
- `pricing-tool/app/api/quotes/[id]/uploads/route.ts` (upload API)
- `pricing-tool/lib/upload-validation.ts` (validation logic)
- `pricing-tool/lib/storage.ts` (signed URL helpers)

**Modified Files:**
- `pricing-tool/supabase-schema.sql` (add storage policies)
- `pricing-tool/lib/types.ts` (add Upload interface)

**Supabase Dashboard:**
- Create `quote-uploads` bucket with configuration

## Testing Requirements

1. **Manual Testing:**
   - Upload PDF file (< 100MB)
   - Upload image (JPEG, PNG, WebP)
   - Upload spreadsheet (XLSX, CSV)
   - Upload audio file (MP3, M4A)
   - Try to upload > 100MB (should fail)
   - Try to upload .exe file (should fail)
   - Verify file appears in storage bucket
   - Verify upload record created in database
   - Download file via signed URL

2. **Edge Cases:**
   - Upload file with special characters in name
   - Upload file with same name twice (should not conflict due to timestamp)
   - Upload to non-existent quote (should fail)
   - Upload without authentication (should fail)
   - Concurrent uploads to same quote

3. **Security Testing:**
   - Try path traversal in filename (../../../etc/passwd)
   - Try to access another user's uploads
   - Verify RLS policies work

## Acceptance Criteria

- [ ] Supabase Storage bucket created and configured
- [ ] Upload API accepts multipart/form-data
- [ ] File validation checks size, type, extension
- [ ] Files stored at correct path with timestamp
- [ ] Upload record created in database
- [ ] Signed URLs generated for downloads
- [ ] RLS policies prevent unauthorized access
- [ ] Storage path prevents filename conflicts
- [ ] Error handling for all failure scenarios
- [ ] Maximum file size enforced (100MB)
- [ ] Maximum total files per quote (10 files)
- [ ] Filenames sanitized to prevent security issues
- [ ] Lifecycle policy documented (90-day retention)

## Dependencies

- Task 01 (quotes and uploads table must exist)
- Supabase Storage enabled in project

## Estimated Effort

4-5 hours

## Review Checklist

- [ ] File validation is comprehensive
- [ ] Security: no path traversal vulnerabilities
- [ ] Security: RLS policies tested
- [ ] Error messages don't leak sensitive info
- [ ] Storage paths are predictable and organized
- [ ] Signed URLs have appropriate expiration
- [ ] Large files don't timeout (increase timeout if needed)
- [ ] Rollback on partial failure (delete storage if DB fails)
- [ ] Filename sanitization prevents injection
- [ ] MIME type validation prevents type confusion attacks
- [ ] Consider rate limiting to prevent abuse
- [ ] Logging for debugging without exposing user data
