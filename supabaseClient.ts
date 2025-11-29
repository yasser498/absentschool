import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gucmiesbgdgmakgtwmtk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H-MFNv0sTxuPZAznV1R8qQ_Ayt4t037';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);