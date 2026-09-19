import type { goalSchema } from '@gambit/core';
import type { z } from 'zod';

export type Goal = z.infer<typeof goalSchema>;
