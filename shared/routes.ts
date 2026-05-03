import { z } from 'zod';
import { insertIncomeSchema, insertExpenseSchema, insertDepositSchema, incomes, expenses, deposits, batches, students, insertBatchSchema, insertStudentSchema, results, insertResultSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  batches: {
    list: {
      method: 'GET' as const,
      path: '/api/batches',
      responses: {
        200: z.array(z.custom<typeof batches.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/batches',
      input: insertBatchSchema,
      responses: {
        201: z.custom<typeof batches.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/batches/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  students: {
    list: {
      method: 'GET' as const,
      path: '/api/students',
      responses: {
        200: z.array(z.custom<typeof students.$inferSelect & { batch?: typeof batches.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/students',
      input: insertStudentSchema,
      responses: {
        201: z.custom<typeof students.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/students/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  incomes: {
    list: {
      method: 'GET' as const,
      path: '/api/incomes',
      responses: {
        200: z.array(z.custom<typeof incomes.$inferSelect & { student?: typeof students.$inferSelect, batch?: typeof batches.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/incomes',
      input: insertIncomeSchema,
      responses: {
        201: z.custom<typeof incomes.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      path: "/api/incomes/:id",
      responses: {
        204: z.void(),
      }
    },
    updateStatus: {
      method: "PATCH" as const,
      path: "/api/incomes/:id/status",
      input: z.object({ status: z.enum(["Pending", "Verified"]) }),
      responses: {
        200: z.custom<typeof incomes.$inferSelect>(),
      }
    }
  },
  expenses: {
    list: {
      method: 'GET' as const,
      path: '/api/expenses',
      responses: {
        200: z.array(z.custom<typeof expenses.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/expenses',
      input: insertExpenseSchema,
      responses: {
        201: z.custom<typeof expenses.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
        method: 'DELETE' as const,
        path: '/api/expenses/:id',
        responses: {
            204: z.void(), 
        }
    }
  },
  deposits: {
    list: {
      method: 'GET' as const,
      path: '/api/deposits',
      responses: {
        200: z.array(z.custom<typeof deposits.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/deposits',
      input: insertDepositSchema,
      responses: {
        201: z.custom<typeof deposits.$inferSelect>(),
        400: z.object({ message: z.string(), field: z.string().optional() }),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/deposits/:id',
      responses: {
        204: z.void(),
      },
    },
  },
  results: {
    list: {
      method: 'GET' as const,
      path: '/api/results',
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/results',
      input: insertResultSchema,
      responses: {
        201: z.custom<typeof results.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
