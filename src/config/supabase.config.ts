import { BadRequestException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!; // Prefer service key for server
const bucketName = process.env.SUPABASE_BUCKET || 'uploads';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false, // Server-side, no need for refresh
    persistSession: false,
  },
});

export const supabaseStorage = {
  async handleUpload(file: Express.Multer.File, folder: string = ''): Promise<string> {
    if (!file) throw new Error('No file provided');

    // Validate extension (as in your service)
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(extension)) {
      throw new BadRequestException('File must be a JPG, JPEG, or PNG');
    }

    // Generate unique path
    const fileName = `${uuidv4()}${extension}`;
    const path = folder ? `${folder}/${fileName}` : fileName;

    // Upload to Supabase (use Buffer directly)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, Buffer.from(file.buffer), {
        contentType: file.mimetype,
        upsert: false, // Don't overwrite if exists
        cacheControl: '3600', // Cache for 1 hour
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    // Return the path for DB storage
    return path;
  },

  // Helper to get public URL (use in frontend if needed, but backend can return it)
  getPublicUrl(path: string): string {
    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${path}`;
  },
};