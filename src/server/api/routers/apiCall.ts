import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

const headersSchema = z.record(z.string(), z.string()).optional();

const callFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  url: z.string().url("Must be a valid URL").max(2000),
  method: methodSchema,
  headers: headersSchema,
  body: z.string().max(50_000).optional(),
  cadenceDays: z
    .number()
    .int()
    .min(1, "Minimum cadence is once per day")
    .max(365),
});

const responsesInclude = {
  responses: {
    orderBy: { createdAt: "desc" as const },
    take: env.MAX_RESPONSES_PER_CALL,
  },
};

export const apiCallRouter = createTRPCRouter({
  // -- reads -----------------------------------------------------------

  myCalls: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.apiCall.findMany({
      where: { createdById: ctx.session.user.id },
      include: responsesInclude,
      orderBy: { createdAt: "desc" },
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const call = await ctx.db.apiCall.findUnique({
        where: { id: input.id },
        include: {
          ...responsesInclude,
          createdBy: { select: { name: true, email: true, image: true } },
        },
      });
      if (!call) throw new TRPCError({ code: "NOT_FOUND" });
      const isOwner = call.createdById === ctx.session.user.id;
      const isAdmin = ctx.session.user.isAdmin;
      if (!isOwner && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return {
        ...call,
        isOwner,
        canEdit: isAdmin || (isOwner && !call.enabled),
      };
    }),

  allCalls: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.apiCall.findMany({
      include: {
        ...responsesInclude,
        createdBy: { select: { name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  pendingCalls: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.apiCall.findMany({
      where: { enabled: false },
      include: {
        createdBy: { select: { name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // -- writes ------------------------------------------------------------

  create: protectedProcedure
    .input(callFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.apiCall.create({
        data: {
          ...input,
          headers: input.headers ?? undefined,
          // Admins approve their own requests implicitly; everyone else's
          // requests start disabled until an admin reviews and enables them.
          enabled: ctx.session.user.isAdmin,
          createdById: ctx.session.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(callFieldsSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.apiCall.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const isOwner = existing.createdById === ctx.session.user.id;
      const isAdmin = ctx.session.user.isAdmin;
      if (!isAdmin && !isOwner) throw new TRPCError({ code: "FORBIDDEN" });
      if (!isAdmin && existing.enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "This request is enabled and can only be edited by an admin.",
        });
      }

      return ctx.db.apiCall.update({
        where: { id },
        data: { ...data, headers: data.headers ?? undefined },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.apiCall.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const isOwner = existing.createdById === ctx.session.user.id;
      if (!ctx.session.user.isAdmin && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.apiCall.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  setEnabled: adminProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.apiCall.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });
    }),
});
